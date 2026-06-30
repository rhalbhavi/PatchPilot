import os
import tempfile

import pytest

# This is needed to patch the DB_PATH before other modules import it.
# We create a temporary file that will be used as the DB.
tmp_db = tempfile.NamedTemporaryFile(delete=False)
os.environ["PATCHPILOT_DB_PATH"] = tmp_db.name

from app.db import get_leaderboard_stats, init_db, upsert_contributor_stat  # noqa: E402

# Mark all tests in this file as asyncio
pytestmark = pytest.mark.asyncio


@pytest.fixture(scope="function", autouse=True)
async def setup_and_teardown_db():
    """Fixture to set up and tear down the database for each test function."""
    # Setup: initialize a clean database
    await init_db()

    yield

    # Teardown: close and delete the temporary database file
    tmp_db.close()
    os.unlink(tmp_db.name)


async def test_leaderboard_calculation_and_sorting():
    """Test that leaderboard scores, rates, and sorting work correctly."""
    # Add some contributors with different stats
    await upsert_contributor_stat(username="alice", findings=42, fixes_submitted=42, fixes_passed=35, prs=10)
    await upsert_contributor_stat(username="bob", findings=38, fixes_submitted=38, fixes_passed=29, prs=8)
    await upsert_contributor_stat(username="charlie", findings=31, fixes_submitted=40, fixes_passed=24, prs=5)
    await upsert_contributor_stat(username="diana", findings=50, fixes_submitted=50, fixes_passed=50, prs=20)
    # Add a user with a high verification rate but lower volume to test sorting
    await upsert_contributor_stat(username="grace", findings=10, fixes_submitted=20, fixes_passed=19, prs=2)

    # Test default sorting (by leaderboard_score)
    leaderboard_default = await get_leaderboard_stats()

    assert len(leaderboard_default) == 5
    assert [u["github_username"] for u in leaderboard_default] == ["diana", "alice", "bob", "charlie", "grace"]

    # Check ranks
    assert leaderboard_default[0]["rank"] == 1
    assert leaderboard_default[4]["rank"] == 5

    # Check calculations for one user (alice)
    alice_stats = next(u for u in leaderboard_default if u["github_username"] == "alice")
    assert alice_stats["findings_closed"] == 42
    assert alice_stats["verified_fixes"] == 35
    assert alice_stats["verification_rate"] == 83.33
    assert alice_stats["leaderboard_score"] == 267 # (35*5) + (42*2) + 8

    # Test sorting by findings_closed
    leaderboard_findings = await get_leaderboard_stats(sort_by="findings_closed")
    assert [u["github_username"] for u in leaderboard_findings] == ["diana", "alice", "bob", "charlie", "grace"]

    # Test sorting by verified_fixes
    leaderboard_fixes = await get_leaderboard_stats(sort_by="verified_fixes")
    assert [u["github_username"] for u in leaderboard_fixes] == ["diana", "alice", "bob", "charlie", "grace"]

    # Test sorting by verification_rate
    leaderboard_rate = await get_leaderboard_stats(sort_by="verification_rate")
    assert [u["github_username"] for u in leaderboard_rate] == ["diana", "grace", "alice", "bob", "charlie"]

    # Test limit parameter
    leaderboard_limited = await get_leaderboard_stats(limit=2)
    assert len(leaderboard_limited) == 2
    assert leaderboard_limited[0]["github_username"] == "diana"
    assert leaderboard_limited[1]["github_username"] == "alice"

async def test_leaderboard_empty_state():
    """Test that the leaderboard returns an empty list when no contributors exist."""
    leaderboard = await get_leaderboard_stats()
    assert leaderboard == []

async def test_leaderboard_zero_division():
    """Test that verification rate is 0 if a contributor has submitted no fixes."""
    await upsert_contributor_stat(username="eve", findings=10, fixes_submitted=0, fixes_passed=0, prs=1)
    leaderboard = await get_leaderboard_stats()
    assert len(leaderboard) == 1
    assert leaderboard[0]["github_username"] == "eve"
    assert leaderboard[0]["verification_rate"] == 0
    assert leaderboard[0]["leaderboard_score"] == 20