import asyncio
import json
import os
import sys
from pathlib import Path

import aiosqlite
import httpx

# Add project root to path to allow importing 'app'
ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

MENTORS_JSON_PATH = ROOT_DIR.parent / "mentors.json"
DB_PATH = os.environ.get(
    "PATCHPILOT_DB_PATH",
    ROOT_DIR / "patchpilot.db",
)

async def update_stats_for_pr():
    """
    Incrementally updates mentor review counts in the database for a single
    merged pull request. Designed to be run in a GitHub Action.
    """
    # --- Get data from GitHub Actions environment ---
    github_token = os.environ.get("GITHUB_TOKEN")
    repo_full = os.environ.get("GITHUB_REPOSITORY")
    event_path = os.environ.get("GITHUB_EVENT_PATH")

    if not all([github_token, repo_full, event_path]):
        print("❌ Error: Missing required GitHub Actions environment variables.", file=sys.stderr)
        print("   (GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_EVENT_PATH)", file=sys.stderr)
        sys.exit(1)

    try:
        with open(event_path, "r") as f:
            event_payload = json.load(f)
        pr_number = event_payload["pull_request"]["number"]
    except (IOError, KeyError, json.JSONDecodeError) as e:
        print(f"❌ Error reading PR number from event payload: {e}", file=sys.stderr)
        sys.exit(1)

    owner, repo = repo_full.split('/')
    
    # --- Load mentor list ---
    try:
        with open(MENTORS_JSON_PATH, "r") as f:
            mentors_list = json.load(f)
        if not isinstance(mentors_list, list):
            print("⚠️ Warning: mentors.json is not a list. Skipping update.", file=sys.stderr)
            return
    except (IOError, json.JSONDecodeError):
        print("⚠️ Warning: Could not read mentors.json. Skipping update.", file=sys.stderr)
        return

    # --- Fetch reviewers for the merged PR ---
    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github.v3+json",
    }
    async with httpx.AsyncClient(headers=headers) as client:
        try:
            reviews_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/reviews"
            response = await client.get(reviews_url, params={"per_page": 100})
            response.raise_for_status()
            reviews = response.json()
        except httpx.HTTPStatusError as e:
            print(f"❌ GitHub API error fetching reviews for PR #{pr_number}: {e}", file=sys.stderr)
            sys.exit(1)

    reviewers_on_pr = {review["user"]["login"] for review in reviews if review.get("user")}
    mentors_who_reviewed = [user for user in reviewers_on_pr if user in mentors_list]

    if not mentors_who_reviewed:
        print("No registered mentors reviewed this PR. Nothing to update.")
        return

    print(f"Found {len(mentors_who_reviewed)} reviewing mentors: {', '.join(mentors_who_reviewed)}")

    # --- Update database ---
    async with aiosqlite.connect(DB_PATH) as db:
        for mentor in mentors_who_reviewed:
            # Upsert the mentor and increment their review count.
            await db.execute(
                """
                INSERT INTO mentor_stats (github_username, reviews) VALUES (?, 1)
                ON CONFLICT(github_username) DO UPDATE SET reviews = reviews + 1
                """,
                (mentor,),
            )
        await db.commit()
        print(f"✅ Successfully updated review counts for {len(mentors_who_reviewed)} mentors in the database.")

if __name__ == "__main__":
    asyncio.run(update_stats_for_pr())