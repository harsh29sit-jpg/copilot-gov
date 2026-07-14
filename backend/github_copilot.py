"""GitHub Copilot Seat Management client. Soft-fail + mock when unconfigured."""
import os
import httpx
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

GITHUB_ORG = os.environ.get("GITHUB_ORG", "").strip()
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "").strip()
GITHUB_API_VERSION = os.environ.get("GITHUB_API_VERSION", "2022-11-28")
BASE = "https://api.github.com"

def is_enabled() -> bool:
    return bool(GITHUB_ORG and GITHUB_TOKEN)

def _headers() -> Dict[str, str]:
    return {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        "Authorization": f"Bearer {GITHUB_TOKEN}",
    }

async def _request(method: str, path: str, json: Optional[dict] = None) -> Dict[str, Any]:
    async with httpx.AsyncClient(base_url=BASE, timeout=15.0) as c:
        r = await c.request(method, path, headers=_headers(), json=json)
        return {"status_code": r.status_code, "body": (r.json() if r.content else {}), "headers": dict(r.headers)}

def _classify_error(status: int, body: dict) -> str:
    if status == 401: return "bad_token"
    if status == 403: return "forbidden_or_rate_limited"
    if status == 404: return "org_not_found"
    if status == 422:
        msg = str(body.get("message", "")).lower() if isinstance(body, dict) else ""
        if "not a member" in msg or "pending" in msg: return "user_not_org_member"
        if "not enabled" in msg: return "copilot_not_enabled"
        if "seat" in msg and ("limit" in msg or "cap" in msg): return "no_seats_available"
        return "unprocessable"
    if status == 429: return "rate_limited"
    return f"http_{status}"

async def assign_seat(github_username: str) -> Dict[str, Any]:
    if not is_enabled():
        return {"sync_status": "mock", "message": "GitHub integration not configured (env GITHUB_ORG/GITHUB_TOKEN missing)."}
    if not github_username:
        return {"sync_status": "failed", "error": "no_github_username", "message": "Employee has no GitHub username on file."}
    try:
        resp = await _request("POST", f"/orgs/{GITHUB_ORG}/copilot/billing/selected_users",
                              json={"selected_usernames": [github_username]})
    except Exception as e:
        return {"sync_status": "failed", "error": "network_error", "message": str(e)}
    if resp["status_code"] in (200, 201):
        return {"sync_status": "synced", "github_username": github_username, "response": resp["body"]}
    err = _classify_error(resp["status_code"], resp["body"])
    return {"sync_status": "failed", "error": err, "message": resp["body"].get("message", "") if isinstance(resp["body"], dict) else "", "status_code": resp["status_code"]}

async def revoke_seat(github_username: str) -> Dict[str, Any]:
    if not is_enabled():
        return {"sync_status": "mock", "message": "GitHub integration not configured."}
    if not github_username:
        return {"sync_status": "failed", "error": "no_github_username", "message": "No GitHub username to revoke."}
    try:
        resp = await _request("DELETE", f"/orgs/{GITHUB_ORG}/copilot/billing/selected_users",
                              json={"selected_usernames": [github_username]})
    except Exception as e:
        return {"sync_status": "failed", "error": "network_error", "message": str(e)}
    if resp["status_code"] in (200, 204):
        return {"sync_status": "synced", "github_username": github_username}
    err = _classify_error(resp["status_code"], resp["body"])
    return {"sync_status": "failed", "error": err, "message": resp["body"].get("message", "") if isinstance(resp["body"], dict) else "", "status_code": resp["status_code"]}

async def get_seat_for_user(github_username: str) -> Optional[Dict[str, Any]]:
    """Returns seat object (with last_activity_at) if user has one, else None. Returns None if disabled."""
    if not is_enabled() or not github_username:
        return None
    try:
        resp = await _request("GET", f"/orgs/{GITHUB_ORG}/copilot/billing/seats")
    except Exception:
        return None
    if resp["status_code"] != 200:
        return None
    seats = resp["body"].get("seats", []) if isinstance(resp["body"], dict) else []
    for s in seats:
        u = s.get("assignee") or s.get("user") or {}
        if u.get("login") == github_username:
            return {
                "last_activity_at": s.get("last_activity_at"),
                "created_at": s.get("created_at"),
                "pending_cancellation_date": s.get("pending_cancellation_date"),
            }
    return None
