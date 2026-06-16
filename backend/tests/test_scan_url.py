from unittest.mock import AsyncMock, patch

import httpx
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_scan_url_invalid_format():
    res = client.post(
        "/scan-url", data={"repo_url": "not-a-url", "project_name": "test_project"}
    )
    assert res.status_code == 400
    assert "Only GitHub repo URLs are supported right now." in res.json()["detail"]


@patch("app.main.httpx.AsyncClient")
def test_scan_url_not_found(mock_async_client):
    mock_client = AsyncMock()
    mock_async_client.return_value.__aenter__ = AsyncMock(return_value=mock_client)
    mock_async_client.return_value.__aexit__ = AsyncMock(return_value=None)

    mock_response = httpx.Response(404)
    mock_client.head = AsyncMock(return_value=mock_response)

    res = client.post(
        "/scan-url",
        data={
            "repo_url": "https://github.com/owner/repo",
            "project_name": "test_project",
        },
    )
    assert res.status_code == 400
    assert "Failed to download repo ZIP" in res.json()["detail"]


@patch("app.main.httpx.AsyncClient")
def test_scan_url_timeout(mock_async_client):
    mock_client = AsyncMock()
    mock_async_client.return_value.__aenter__ = AsyncMock(return_value=mock_client)
    mock_async_client.return_value.__aexit__ = AsyncMock(return_value=None)
    mock_client.head = AsyncMock(side_effect=httpx.TimeoutException("timeout"))

    res = client.post(
        "/scan-url",
        data={
            "repo_url": "https://github.com/owner/repo",
            "project_name": "test_project",
        },
    )
    assert res.status_code == 400
    assert "Failed to download repo ZIP" in res.json()["detail"]


@patch("app.main.httpx.AsyncClient")
@patch("app.main.download_to_path", new_callable=AsyncMock)
@patch("app.main.unzip_to_dir")
@patch("app.main._scan_repo_dir")
@patch("app.main.get_db")
def test_scan_url_success(
    mock_get_db, mock_scan, mock_unzip, mock_download, mock_async_client
):
    mock_client = AsyncMock()
    mock_async_client.return_value.__aenter__ = AsyncMock(return_value=mock_client)
    mock_async_client.return_value.__aexit__ = AsyncMock(return_value=None)
    mock_response = httpx.Response(200)
    mock_client.head = AsyncMock(return_value=mock_response)
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock()
    mock_db.executemany = AsyncMock()
    mock_db.__aenter__ = AsyncMock(return_value=mock_db)
    mock_db.__aexit__ = AsyncMock(return_value=False)
    mock_get_db.return_value = mock_db

    mock_scan.return_value = ([], [], [], [], [])

    res = client.post(
        "/scan-url",
        data={
            "repo_url": "https://github.com/owner/repo",
            "project_name": "test_project",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["project_name"] == "test_project"
    assert data["status"] == "running"
    assert "job_id" in data
