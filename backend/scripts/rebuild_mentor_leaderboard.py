import argparse
import asyncio
import json
import os
import sys
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter

import httpx
import aiosqlite

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

# --- Configuration ---
MENTORS_JSON_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "mentors.json"))
# ---


async def rebuild_leaderboard(repo_owner: str, repo_name: str):
    """
    Scans all merged pull requests in the repository to rebuild the mentor
    review leaderboard from scratch. This is API-intensive and should be
    run periodically to ensure data accuracy.

    Args:
        repo_owner (str): The owner of the GitHub repository.
        repo_name (str): The name of the GitHub repository.

    It reads the list of mentors from the existing `mentors.json` file and
    updates the 'reviews' count for each.
    """
    github_token = os.environ.get("GITHUB_TOKEN")
    headers = {
        "Accept": "application/vnd.github.v3+json",
    }
    if github_token:
        headers["Authorization"] = f"Bearer {github_token}"
        print("🔑 Found GITHUB_TOKEN. Using authenticated requests.")
    else:
        print("⚠️  GITHUB_TOKEN not set. Using unauthenticated requests.")
        print("    This has a lower rate limit and may fail on large repositories.")
        print("    For reliable execution, set a GITHUB_TOKEN with 'public_repo' scope.")

    if not os.path.exists(MENTORS_JSON_PATH):
        print(f"❌ Error: Mentor file not found at '{MENTORS_JSON_PATH}'.", file=sys.stderr)
        print("Please create the file with initial mentor usernames as keys.", file=sys.stderr)
        sys.exit(1)

    with open(MENTORS_JSON_PATH, "r") as f:
        mentors_list = json.load(f)
    
    if not mentors_list or not isinstance(mentors_list, list):
        print("⚠️ Warning: No mentors found in `mentors.json`. Exiting.")
        return

    print(f"Found {len(mentors_list)} mentors to track: {', '.join(mentors_list)}")

    review_counts = Counter()

    async with httpx.AsyncClient(headers=headers, timeout=30.0) as client:
        print(f"Fetching all merged pull requests from {repo_owner}/{repo_name}...")
        
        merged_prs = []
        page = 1
        while True:
            try:
                pr_url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/pulls"
                params = {"state": "closed", "per_page": 100, "page": page}
                response = await client.get(pr_url, params=params)

                if response.status_code in (403, 429) and 'rate limit' in response.text.lower():
                    reset_time_str = response.headers.get("X-RateLimit-Reset")
                    if reset_time_str:
                        reset_ts = int(reset_time_str)
                        now_ts = int(datetime.now(timezone.utc).timestamp())
                        sleep_for = max(0, reset_ts - now_ts) + 5  # 5s buffer
                        print(f"⏳ Rate limit hit while fetching PRs. Waiting for {int(sleep_for)} seconds...")
                        await asyncio.sleep(sleep_for)
                        continue # Retry the same page

                response.raise_for_status()
                
                data = response.json()
                if not data:
                    break
                
                page_merged_prs = [pr for pr in data if pr.get("merged_at")]
                merged_prs.extend(page_merged_prs)
                print(f"Page {page}: Found {len(page_merged_prs)} merged PRs (Total: {len(merged_prs)})...")
                page += 1
                
            except httpx.HTTPStatusError as e:
                print(f"❌ GitHub API error fetching PRs: {e}", file=sys.stderr)
                print(f"Response: {e.response.text}", file=sys.stderr)
                sys.exit(1)

        print(f"\nTotal merged PRs found: {len(merged_prs)}")
        print("Fetching reviews for each PR... (this may take a while)")
        
        async def fetch_reviews_for_pr(pr_number: int):
            for attempt in range(3): # Retry up to 3 times
                try:
                    reviews_url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/pulls/{pr_number}/reviews"
                    res = await client.get(reviews_url, params={"per_page": 100})

                    if res.status_code in (403, 429) and 'rate limit' in res.text.lower():
                        reset_time_str = res.headers.get("X-RateLimit-Reset")
                        if reset_time_str and attempt < 2:
                            reset_ts = int(reset_time_str)
                            now_ts = int(datetime.now(timezone.utc).timestamp())
                            sleep_for = max(0, reset_ts - now_ts) + 5
                            print(f"⏳ Rate limit hit on PR #{pr_number}. Waiting for {int(sleep_for)} seconds...")
                            await asyncio.sleep(sleep_for)
                            continue # Retry

                    res.raise_for_status()
                    return res.json()
                except httpx.HTTPStatusError as e:
                    print(f"⚠️ Could not fetch reviews for PR #{pr_number}, skipping. Status: {e.response.status_code}", file=sys.stderr)
                    return [] # Give up on this PR after an error
            return [] # Give up after retries

        tasks = [fetch_reviews_for_pr(pr["number"]) for pr in merged_prs]
        all_reviews_per_pr = await asyncio.gather(*tasks)

        print("\nProcessing reviews...")
        for reviews in all_reviews_per_pr:
            # Count each mentor only once per PR, even if they left multiple reviews
            reviewers_on_pr = {review["user"]["login"] for review in reviews if review.get("user")}
            for reviewer in reviewers_on_pr:
                if reviewer in mentors_list:
                    review_counts[reviewer] += 1

    print("\nWriting new leaderboard to database...")
    db_path = os.environ.get(
        "PATCHPILOT_DB_PATH",
        os.path.join(os.path.dirname(__file__), "..", "patchpilot.db"),
    )

    async with aiosqlite.connect(db_path) as db:
        # This ensures the table exists if the script is run before the app
        await db.execute("""
            CREATE TABLE IF NOT EXISTS mentor_stats (
                github_username TEXT PRIMARY KEY,
                reviews INTEGER NOT NULL DEFAULT 0
            )
        """)
        for mentor in mentors_list:
            count = review_counts.get(mentor, 0)
            await db.execute(
                """
                INSERT INTO mentor_stats (github_username, reviews) VALUES (?, ?)
                ON CONFLICT(github_username) DO UPDATE SET reviews = excluded.reviews
                """,
                (mentor, count),
            )
        await db.commit()

    print("✅ Mentor leaderboard rebuild complete!")
    print("Stats written to the database.")

if __name__ == "__main__":
    # Try to get defaults from GitHub Actions environment variables
    repo_full = os.environ.get("GITHUB_REPOSITORY", "ionfwsrijan/PatchPilot")
    default_owner, default_repo = repo_full.split('/')

    parser = argparse.ArgumentParser(
        description="Rebuild the mentor leaderboard by scanning all PRs in a repository.",
        epilog=(
            "Example for a fork:\n"
            "  python scripts/rebuild_mentor_leaderboard.py --owner another-user --repo PatchPilot-fork"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--owner", default=default_owner, help=f"The GitHub repository owner. Defaults to '{default_owner}'.")
    parser.add_argument("--repo", default=default_repo, help=f"The GitHub repository name. Defaults to '{default_repo}'.")
    args = parser.parse_args()

    # Ensure dependencies are installed
    try:
        import httpx
        import aiosqlite
    except ImportError as e:
        print(f"❌ Error: A required package is not installed ({e.name}).")
        print("Please install dependencies by running: pip install httpx aiosqlite")
        sys.exit(1)

    asyncio.run(rebuild_leaderboard(repo_owner=args.owner, repo_name=args.repo))