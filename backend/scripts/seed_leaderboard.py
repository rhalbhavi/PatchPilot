import argparse
import asyncio
import json
import os
import random
import sys
from pathlib import Path

import aiosqlite
import httpx

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from app.db import upsert_contributor_stat

DB_PATH = os.environ.get(
    "PATCHPILOT_DB_PATH",
    os.path.join(os.path.dirname(__file__), "..", "patchpilot.db"),
)
MENTORS_JSON_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "mentors.json"))


async def seed_data(repo_owner: str, repo_name: str):
    """
    Clears existing stats and inserts fresh data by fetching the actual
    contributors from the project's GitHub repository and generating plausible
    random stats for them.
    """
    if not os.path.exists(DB_PATH):
        print(f"❌ Error: Database file not found at '{DB_PATH}'")
        print("Please run the backend server at least once to create the database before seeding.")
        sys.exit(1)

    # 1. Fetch actual contributors from GitHub
    repo_url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/contributors"
    print(f"Fetching contributors from {repo_url}...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(repo_url, params={"per_page": 100})
            response.raise_for_status()
            contributors = response.json()
    except httpx.RequestError as e:
        print(f"❌ Error fetching contributors: {e}")
        print("Please check your internet connection and if the repository is public.")
        sys.exit(1)
    except httpx.HTTPStatusError as e:
        print(f"❌ GitHub API returned an error: {e.response.status_code} {e.response.text}")
        print("This may be due to rate limiting. Please try again later.")
        sys.exit(1)

    # Filter out bots
    real_contributors = [c for c in contributors if c.get("type") == "User"]
    print(f"Found {len(real_contributors)} real contributors.")

    # 2. Clear the database
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM contributor_stats")
        await db.execute("DELETE FROM mentor_stats")
        await db.commit()
        print("Cleared existing contributor and mentor stats.")

    # 3. Seed the database with new data
    print("Seeding leaderboard with actual contributors and random stats...")
    for contrib in real_contributors:
        username = contrib["login"]
        
        # Generate plausible random stats
        fixes_submitted = random.randint(5, 80)
        # Ensure fixes passed is not more than submitted
        fixes_passed = random.randint(int(fixes_submitted * 0.6), fixes_submitted)
        findings_closed = random.randint(fixes_passed, fixes_passed + 20)
        prs_merged = random.randint(1, 25)

        await upsert_contributor_stat(
            username=username,
            findings=findings_closed,
            fixes_submitted=fixes_submitted,
            fixes_passed=fixes_passed,
            prs=prs_merged,
        )

    # 4. Seed the mentor database with new data
    print("Seeding mentor leaderboard with random stats...")
    if os.path.exists(MENTORS_JSON_PATH):
        try:
            with open(MENTORS_JSON_PATH, "r") as f:
                mentors = json.load(f)
            if isinstance(mentors, list):
                async with aiosqlite.connect(DB_PATH) as db:
                    for mentor_username in mentors:
                        reviews = random.randint(5, 50)
                        await db.execute(
                            """
                            INSERT INTO mentor_stats (github_username, reviews) VALUES (?, ?)
                            ON CONFLICT(github_username) DO UPDATE SET reviews = excluded.reviews
                            """,
                            (mentor_username, reviews),
                        )
                    await db.commit()
                print(f"Seeded {len(mentors)} mentors.")
            else:
                print("⚠️  Could not seed mentors: mentors.json is not a list.")
        except (json.JSONDecodeError, IOError):
            print("⚠️  Could not read or parse mentors.json, skipping mentor seeding.")

    print("✅ Seeding complete!")
    print("You can now refresh the leaderboard page in the frontend to see the results.")

if __name__ == "__main__":
    # Try to get defaults from GitHub Actions environment variables or a hardcoded fallback
    repo_full = os.environ.get("GITHUB_REPOSITORY", "ionfwsrijan/PatchPilot")
    default_owner, default_repo = repo_full.split('/')

    parser = argparse.ArgumentParser(
        description="Seed the contributor leaderboard with data from a GitHub repository.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--owner", default=default_owner, help=f"The GitHub repository owner. Defaults to '{default_owner}'."
    )
    parser.add_argument(
        "--repo", default=default_repo, help=f"The GitHub repository name. Defaults to '{default_repo}'."
    )
    args = parser.parse_args()

    # Ensure dependencies are installed
    try:
        import httpx
        import aiosqlite
    except ImportError as e:
        print(f"❌ Error: A required package is not installed ({e.name}).")
        print("Please install dependencies by running: pip install httpx aiosqlite")
        sys.exit(1)
        
    asyncio.run(seed_data(repo_owner=args.owner, repo_name=args.repo))