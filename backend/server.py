from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import bcrypt
import jwt as pyjwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------------- DB ----------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]

app = FastAPI(title="Copilot License Governance Portal")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("copilot-gov")


# ---------------- Helpers ----------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False


def make_token(user_id: str, email: str, role: str, ttl_min: int = 60 * 24) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ttl_min),
        "type": "access",
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


def require_role(*roles: str):
    async def dep(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return dep


async def log_audit(actor: dict, action: str, target_type: str, target_id: str, meta: Optional[dict] = None):
    await db.audit_logs.insert_one({
        "id": new_id(),
        "actor_id": actor["id"],
        "actor_name": actor.get("name"),
        "actor_email": actor.get("email"),
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "meta": meta or {},
        "timestamp": now_iso(),
    })


async def notify(user_id: str, ntype: str, title: str, body: str, meta: Optional[dict] = None):
    await db.notifications.insert_one({
        "id": new_id(),
        "user_id": user_id,
        "type": ntype,
        "title": title,
        "body": body,
        "meta": meta or {},
        "read": False,
        "created_at": now_iso(),
    })


# ---------------- Models ----------------
class LoginInput(BaseModel):
    email: EmailStr
    password: str
    portal: Optional[Literal["employee", "manager"]] = None


class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    project: Optional[str] = None
    team: Optional[str] = None
    cost_center: Optional[str] = None
    manager_id: Optional[str] = None


class RequestCreate(BaseModel):
    project: str
    team: str
    cost_center: str
    manager_id: str
    justification: str


class RequestDecide(BaseModel):
    decision: Literal["approved", "rejected"]
    comments: Optional[str] = ""
    license_id: Optional[str] = None  # when approving + assigning


class RenewalAction(BaseModel):
    action: Literal["continue", "release", "moved"]
    new_project: Optional[str] = None
    new_team: Optional[str] = None
    new_cost_center: Optional[str] = None
    new_manager_id: Optional[str] = None
    justification: Optional[str] = ""


class BulkNotifyInput(BaseModel):
    scope: Literal["project", "team", "cost_center"]
    value: str
    title: str
    body: str


# ---------------- Auth ----------------
@api.post("/auth/login")
async def login(data: LoginInput, response: Response):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    if data.portal == "employee" and user["role"] != "employee":
        raise HTTPException(403, "This account belongs to the Manager portal. Switch to Manager login.")
    if data.portal == "manager" and user["role"] not in ("manager", "admin"):
        raise HTTPException(403, "This account belongs to the Employee portal. Switch to Employee login.")
    token = make_token(user["id"], user["email"], user["role"])
    response.set_cookie("access_token", token, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    return {
        "token": token,
        "user": {k: v for k, v in user.items() if k not in ("_id", "password_hash")},
    }


@api.post("/auth/logout")
async def logout(response: Response, _: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------------- Reference data ----------------
@api.get("/meta/reference")
async def reference(user: dict = Depends(get_current_user)):
    managers = await db.users.find({"role": {"$in": ["manager", "admin"]}}, {"_id": 0, "password_hash": 0}).to_list(200)
    projects = await db.projects.find({}, {"_id": 0}).to_list(200)
    teams = await db.teams.find({}, {"_id": 0}).to_list(200)
    cost_centers = await db.cost_centers.find({}, {"_id": 0}).to_list(200)
    return {"managers": managers, "projects": projects, "teams": teams, "cost_centers": cost_centers}


@api.get("/users")
async def list_users(user: dict = Depends(require_role("manager", "admin"))):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return users


# ---------------- Requests ----------------
@api.post("/requests")
async def create_request(payload: RequestCreate, user: dict = Depends(get_current_user)):
    # Block duplicate active requests
    existing = await db.requests.find_one({
        "employee_id": user["id"],
        "status": {"$in": ["pending", "approved", "assigned"]},
    })
    if existing:
        raise HTTPException(400, "You already have an active license or pending request")
    req = {
        "id": new_id(),
        "employee_id": user["id"],
        "employee_name": user["name"],
        "employee_email": user["email"],
        "project": payload.project,
        "team": payload.team,
        "cost_center": payload.cost_center,
        "manager_id": payload.manager_id,
        "justification": payload.justification,
        "status": "pending",
        "created_at": now_iso(),
        "decided_at": None,
        "decided_by": None,
        "comments": "",
        "assigned_license_id": None,
        "assigned_at": None,
        "last_renewal_at": None,
    }
    await db.requests.insert_one(req)
    await log_audit(user, "request.created", "request", req["id"], {"project": payload.project})
    await notify(payload.manager_id, "request_submitted",
                 f"New license request from {user['name']}",
                 f"Project: {payload.project} — Justification: {payload.justification[:80]}",
                 {"request_id": req["id"]})
    req.pop("_id", None)
    return req


@api.get("/requests/mine")
async def my_requests(user: dict = Depends(get_current_user)):
    rows = await db.requests.find({"employee_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return rows


@api.get("/requests")
async def list_requests(
    status: Optional[str] = None,
    scope: Optional[str] = Query(None, description="'mine_to_approve' for manager queue"),
    user: dict = Depends(get_current_user),
):
    q = {}
    if user["role"] == "employee":
        q["employee_id"] = user["id"]
    elif scope == "mine_to_approve" and user["role"] == "manager":
        q["manager_id"] = user["id"]
    if status:
        q["status"] = status
    rows = await db.requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return rows


@api.post("/requests/{rid}/decide")
async def decide_request(rid: str, payload: RequestDecide, user: dict = Depends(require_role("manager", "admin"))):
    req = await db.requests.find_one({"id": rid})
    if not req:
        raise HTTPException(404, "Request not found")
    if req["status"] != "pending":
        raise HTTPException(400, f"Request already {req['status']}")
    if user["role"] == "manager" and req["manager_id"] != user["id"]:
        raise HTTPException(403, "You are not the assigned manager")

    update = {
        "status": payload.decision,
        "decided_at": now_iso(),
        "decided_by": user["id"],
        "comments": payload.comments or "",
    }

    if payload.decision == "approved":
        # Auto-pick a license if not specified
        lic_id = payload.license_id
        if not lic_id:
            available = await db.licenses.find_one({"status": "available"})
            if not available:
                raise HTTPException(400, "No available licenses to assign")
            lic_id = available["id"]
        lic = await db.licenses.find_one({"id": lic_id})
        if not lic or lic["status"] != "available":
            raise HTTPException(400, "License not available")
        ts = now_iso()
        await db.licenses.update_one({"id": lic_id}, {"$set": {
            "status": "assigned",
            "assigned_user_id": req["employee_id"],
            "assigned_user_name": req["employee_name"],
            "project": req["project"],
            "team": req["team"],
            "cost_center": req["cost_center"],
            "assigned_at": ts,
            "last_renewal_at": ts,
            "next_renewal_due": (datetime.now(timezone.utc) + timedelta(days=90)).isoformat(),
        }})
        update.update({
            "status": "assigned",
            "assigned_license_id": lic_id,
            "assigned_at": ts,
            "last_renewal_at": ts,
        })
        await notify(req["employee_id"], "license_assigned",
                     "Your Copilot license is assigned",
                     f"License {lic['license_key']} has been assigned for project {req['project']}.",
                     {"request_id": rid, "license_id": lic_id})
        await log_audit(user, "request.approved", "request", rid, {"license_id": lic_id})
        await log_audit(user, "license.assigned", "license", lic_id, {"user_id": req["employee_id"]})
    else:
        await notify(req["employee_id"], "request_rejected",
                     "Your Copilot license request was rejected",
                     payload.comments or "Please contact your manager.",
                     {"request_id": rid})
        await log_audit(user, "request.rejected", "request", rid, {"comments": payload.comments})

    await db.requests.update_one({"id": rid}, {"$set": update})
    updated = await db.requests.find_one({"id": rid}, {"_id": 0})
    return updated


# ---------------- Licenses ----------------
@api.get("/licenses")
async def list_licenses(
    status: Optional[str] = None,
    project: Optional[str] = None,
    q: Optional[str] = None,
    user: dict = Depends(require_role("manager", "admin")),
):
    flt = {}
    if status:
        flt["status"] = status
    if project:
        flt["project"] = project
    if q:
        flt["$or"] = [
            {"license_key": {"$regex": q, "$options": "i"}},
            {"assigned_user_name": {"$regex": q, "$options": "i"}},
        ]
    rows = await db.licenses.find(flt, {"_id": 0}).sort("license_key", 1).to_list(2000)
    return rows


@api.get("/licenses/mine")
async def my_license(user: dict = Depends(get_current_user)):
    lic = await db.licenses.find_one({"assigned_user_id": user["id"], "status": "assigned"}, {"_id": 0})
    return lic


@api.post("/licenses/{lid}/reclaim")
async def reclaim_license(lid: str, user: dict = Depends(require_role("manager", "admin"))):
    lic = await db.licenses.find_one({"id": lid})
    if not lic:
        raise HTTPException(404, "License not found")
    prev_user = lic.get("assigned_user_id")
    await db.licenses.update_one({"id": lid}, {"$set": {
        "status": "available",
        "assigned_user_id": None,
        "assigned_user_name": None,
        "project": None,
        "team": None,
        "cost_center": None,
        "assigned_at": None,
        "last_renewal_at": None,
        "next_renewal_due": None,
    }})
    if prev_user:
        await db.requests.update_many(
            {"assigned_license_id": lid, "status": "assigned"},
            {"$set": {"status": "released"}},
        )
        await notify(prev_user, "license_reclaimed", "Your Copilot license was reclaimed",
                     "Your license has been reclaimed by your manager and returned to the pool.",
                     {"license_id": lid})
    await log_audit(user, "license.reclaimed", "license", lid, {"previous_user": prev_user})
    return {"ok": True}


@api.post("/licenses/release")
async def release_my_license(user: dict = Depends(get_current_user)):
    lic = await db.licenses.find_one({"assigned_user_id": user["id"], "status": "assigned"})
    if not lic:
        raise HTTPException(404, "You have no assigned license")
    await db.licenses.update_one({"id": lic["id"]}, {"$set": {
        "status": "available",
        "assigned_user_id": None,
        "assigned_user_name": None,
        "project": None,
        "team": None,
        "cost_center": None,
        "assigned_at": None,
        "last_renewal_at": None,
        "next_renewal_due": None,
    }})
    await db.requests.update_many(
        {"employee_id": user["id"], "assigned_license_id": lic["id"], "status": "assigned"},
        {"$set": {"status": "released"}},
    )
    await log_audit(user, "license.released", "license", lic["id"], {})
    return {"ok": True}


# ---------------- Renewals ----------------
@api.get("/renewals/mine")
async def my_renewal(user: dict = Depends(get_current_user)):
    lic = await db.licenses.find_one({"assigned_user_id": user["id"], "status": "assigned"}, {"_id": 0})
    if not lic:
        return {"due": False}
    next_due = lic.get("next_renewal_due")
    if not next_due:
        return {"due": False, "license": lic}
    due_dt = datetime.fromisoformat(next_due)
    now = datetime.now(timezone.utc)
    days = (due_dt - now).days
    return {"due": days <= 14, "overdue": days < 0, "days_until_due": days, "license": lic}


@api.post("/renewals/action")
async def renewal_action(payload: RenewalAction, user: dict = Depends(get_current_user)):
    lic = await db.licenses.find_one({"assigned_user_id": user["id"], "status": "assigned"})
    if not lic:
        raise HTTPException(404, "No assigned license")

    if payload.action == "continue":
        ts = now_iso()
        next_due = (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()
        await db.licenses.update_one({"id": lic["id"]}, {"$set": {"last_renewal_at": ts, "next_renewal_due": next_due}})
        await db.requests.update_many({"assigned_license_id": lic["id"], "status": "assigned"},
                                      {"$set": {"last_renewal_at": ts}})
        await log_audit(user, "license.renewed", "license", lic["id"], {})
        return {"ok": True, "next_renewal_due": next_due}

    if payload.action == "release":
        await db.licenses.update_one({"id": lic["id"]}, {"$set": {
            "status": "available",
            "assigned_user_id": None, "assigned_user_name": None, "project": None,
            "team": None, "cost_center": None, "assigned_at": None,
            "last_renewal_at": None, "next_renewal_due": None,
        }})
        await db.requests.update_many({"employee_id": user["id"], "status": "assigned"},
                                      {"$set": {"status": "released"}})
        await log_audit(user, "license.released", "license", lic["id"], {"reason": "renewal_release"})
        return {"ok": True}

    if payload.action == "moved":
        if not (payload.new_project and payload.new_manager_id):
            raise HTTPException(400, "new_project and new_manager_id required")
        # Mark current as transferred (released to pool), open a new approval request
        await db.licenses.update_one({"id": lic["id"]}, {"$set": {
            "status": "available",
            "assigned_user_id": None, "assigned_user_name": None, "project": None,
            "team": None, "cost_center": None, "assigned_at": None,
            "last_renewal_at": None, "next_renewal_due": None,
        }})
        await db.requests.update_many({"employee_id": user["id"], "status": "assigned"},
                                      {"$set": {"status": "transferred"}})
        new_req = {
            "id": new_id(),
            "employee_id": user["id"],
            "employee_name": user["name"],
            "employee_email": user["email"],
            "project": payload.new_project,
            "team": payload.new_team or "",
            "cost_center": payload.new_cost_center or "",
            "manager_id": payload.new_manager_id,
            "justification": payload.justification or f"Moved project to {payload.new_project}",
            "status": "pending",
            "created_at": now_iso(),
            "decided_at": None, "decided_by": None, "comments": "",
            "assigned_license_id": None, "assigned_at": None, "last_renewal_at": None,
        }
        await db.requests.insert_one(new_req)
        await notify(payload.new_manager_id, "request_submitted",
                     f"Transfer request from {user['name']}",
                     f"Moved to project {payload.new_project}.",
                     {"request_id": new_req["id"]})
        await log_audit(user, "license.transferred", "license", lic["id"], {"to_project": payload.new_project})
        new_req.pop("_id", None)
        return {"ok": True, "new_request": new_req}

    raise HTTPException(400, "Invalid action")


@api.get("/renewals/due")
async def renewals_due(user: dict = Depends(require_role("manager", "admin"))):
    licenses = await db.licenses.find({"status": "assigned", "next_renewal_due": {"$ne": None}}, {"_id": 0}).to_list(2000)
    now = datetime.now(timezone.utc)
    out = []
    for lic in licenses:
        due_dt = datetime.fromisoformat(lic["next_renewal_due"])
        days = (due_dt - now).days
        if days <= 14:
            out.append({**lic, "days_until_due": days, "overdue": days < 0})
    return out


# ---------------- Reclamation ----------------
@api.get("/reclamation/candidates")
async def reclaim_candidates(user: dict = Depends(require_role("manager", "admin"))):
    licenses = await db.licenses.find({"status": "assigned"}, {"_id": 0}).to_list(2000)
    now = datetime.now(timezone.utc)
    out = []
    for lic in licenses:
        reasons = []
        nd = lic.get("next_renewal_due")
        if nd:
            due_dt = datetime.fromisoformat(nd)
            if (now - due_dt).days > 30:
                reasons.append("overdue_renewal_30d")
        lr = lic.get("last_renewal_at")
        if lr:
            try:
                lr_dt = datetime.fromisoformat(lr)
                if (now - lr_dt).days > 120:
                    reasons.append("inactive_120d")
            except Exception:
                pass
        if reasons:
            out.append({**lic, "reclaim_reasons": reasons})
    return out


# ---------------- Notifications ----------------
@api.get("/notifications")
async def get_notifications(user: dict = Depends(get_current_user)):
    rows = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return rows


@api.post("/notifications/{nid}/read")
async def read_notification(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": nid, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


@api.post("/notifications/read-all")
async def read_all_notifications(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


@api.post("/notifications/bulk")
async def bulk_notify(payload: BulkNotifyInput, user: dict = Depends(require_role("manager", "admin"))):
    field_map = {"project": "project", "team": "team", "cost_center": "cost_center"}
    field = field_map[payload.scope]
    # find users assigned to licenses matching the scope
    licenses = await db.licenses.find({field: payload.value, "status": "assigned"}, {"_id": 0}).to_list(2000)
    recipient_ids = {lic["assigned_user_id"] for lic in licenses if lic.get("assigned_user_id")}
    for uid in recipient_ids:
        await notify(uid, "bulk", payload.title, payload.body, {"scope": payload.scope, "value": payload.value})
    await log_audit(user, "notification.bulk_sent", "notification", "-", {
        "scope": payload.scope, "value": payload.value, "count": len(recipient_ids)
    })
    return {"sent": len(recipient_ids)}


# ---------------- Analytics ----------------
@api.get("/analytics/overview")
async def analytics_overview(user: dict = Depends(require_role("manager", "admin"))):
    total = await db.licenses.count_documents({})
    assigned = await db.licenses.count_documents({"status": "assigned"})
    available = await db.licenses.count_documents({"status": "available"})
    expired = await db.licenses.count_documents({"status": "expired"})
    pending_requests = await db.requests.count_documents({"status": "pending"})
    released = await db.requests.count_documents({"status": "released"})

    # renewal due
    licenses = await db.licenses.find({"status": "assigned", "next_renewal_due": {"$ne": None}}, {"next_renewal_due": 1}).to_list(2000)
    now = datetime.now(timezone.utc)
    renewal_due = sum(1 for lic in licenses if (datetime.fromisoformat(lic["next_renewal_due"]) - now).days <= 14)

    reclaimable_resp = await reclaim_candidates(user)
    reclaimable = len(reclaimable_resp)

    utilization = round((assigned / total) * 100, 1) if total else 0.0
    # active users = users with recent renewal in last 60 days
    cutoff = (now - timedelta(days=60)).isoformat()
    active_users = await db.licenses.count_documents({"status": "assigned", "last_renewal_at": {"$gte": cutoff}})
    inactive_users = assigned - active_users
    waste = round(((inactive_users + reclaimable) / total) * 100, 1) if total else 0.0

    return {
        "total": total,
        "assigned": assigned,
        "available": available,
        "expired": expired,
        "pending_requests": pending_requests,
        "released": released,
        "renewal_due": renewal_due,
        "reclaimable": reclaimable,
        "utilization": utilization,
        "active_users": active_users,
        "inactive_users": inactive_users,
        "waste": waste,
    }


@api.get("/analytics/by-project")
async def analytics_by_project(user: dict = Depends(require_role("manager", "admin"))):
    pipeline = [
        {"$match": {"status": "assigned"}},
        {"$group": {"_id": "$project", "assigned": {"$sum": 1}}},
        {"$sort": {"assigned": -1}},
    ]
    rows = await db.licenses.aggregate(pipeline).to_list(200)
    return [{"project": r["_id"] or "Unassigned", "assigned": r["assigned"]} for r in rows]


@api.get("/analytics/by-cost-center")
async def analytics_by_cc(user: dict = Depends(require_role("manager", "admin"))):
    pipeline = [
        {"$match": {"status": "assigned"}},
        {"$group": {"_id": "$cost_center", "assigned": {"$sum": 1}}},
        {"$sort": {"assigned": -1}},
    ]
    rows = await db.licenses.aggregate(pipeline).to_list(200)
    # Approx cost: 19 USD/month/seat
    return [{"cost_center": r["_id"] or "Unassigned", "assigned": r["assigned"], "monthly_cost": r["assigned"] * 19}
            for r in rows]


@api.get("/analytics/requests-trend")
async def requests_trend(user: dict = Depends(require_role("manager", "admin"))):
    rows = await db.requests.find({}, {"_id": 0, "created_at": 1, "status": 1}).to_list(5000)
    bucket = {}
    for r in rows:
        day = r["created_at"][:10]
        bucket.setdefault(day, {"day": day, "submitted": 0, "approved": 0, "rejected": 0})
        bucket[day]["submitted"] += 1
        if r["status"] in ("approved", "assigned"):
            bucket[day]["approved"] += 1
        if r["status"] == "rejected":
            bucket[day]["rejected"] += 1
    return sorted(bucket.values(), key=lambda x: x["day"])[-30:]


# ---------------- Audit ----------------
@api.get("/audit")
async def audit_logs(
    q: Optional[str] = None,
    action: Optional[str] = None,
    user: dict = Depends(require_role("manager", "admin")),
):
    flt = {}
    if action:
        flt["action"] = action
    if q:
        flt["$or"] = [
            {"actor_name": {"$regex": q, "$options": "i"}},
            {"actor_email": {"$regex": q, "$options": "i"}},
            {"target_id": {"$regex": q, "$options": "i"}},
            {"action": {"$regex": q, "$options": "i"}},
        ]
    rows = await db.audit_logs.find(flt, {"_id": 0}).sort("timestamp", -1).to_list(1000)
    return rows


# ---------------- Health ----------------
@api.get("/")
async def health():
    return {"status": "ok", "service": "copilot-license-governance"}


# ---------------- App wiring ----------------
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- Seed ----------------
async def seed_data():
    # Reset only if not seeded yet
    if await db.users.count_documents({}) > 0:
        # Always ensure admin password matches .env
        admin_email = os.environ["ADMIN_EMAIL"].lower()
        existing = await db.users.find_one({"email": admin_email})
        if existing and not verify_password(os.environ["ADMIN_PASSWORD"], existing["password_hash"]):
            await db.users.update_one(
                {"email": admin_email},
                {"$set": {"password_hash": hash_password(os.environ["ADMIN_PASSWORD"])}},
            )
        log.info("DB already seeded; skipped.")
        return

    log.info("Seeding demo data ...")

    # Projects
    projects = [
        {"id": new_id(), "name": "Phoenix", "code": "PHX"},
        {"id": new_id(), "name": "Atlas", "code": "ATL"},
        {"id": new_id(), "name": "Orion", "code": "ORI"},
        {"id": new_id(), "name": "Nova", "code": "NOV"},
    ]
    await db.projects.insert_many(projects)

    # Cost Centers
    cost_centers = [
        {"id": new_id(), "code": "CC-1001", "name": "Platform Eng"},
        {"id": new_id(), "code": "CC-2002", "name": "AI & ML"},
        {"id": new_id(), "code": "CC-3003", "name": "Product Eng"},
        {"id": new_id(), "code": "CC-4004", "name": "Data Eng"},
    ]
    await db.cost_centers.insert_many(cost_centers)

    # Teams
    teams = [
        {"id": new_id(), "name": "Backend"},
        {"id": new_id(), "name": "Frontend"},
        {"id": new_id(), "name": "Mobile"},
        {"id": new_id(), "name": "ML"},
        {"id": new_id(), "name": "DevOps"},
    ]
    await db.teams.insert_many(teams)

    # Users
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_pwd = os.environ["ADMIN_PASSWORD"]

    def mkuser(name, email, role, project=None, team=None, cc=None, manager_id=None, password="password123"):
        return {
            "id": new_id(),
            "name": name,
            "email": email.lower(),
            "role": role,
            "project": project,
            "team": team,
            "cost_center": cc,
            "manager_id": manager_id,
            "password_hash": hash_password(password),
            "created_at": now_iso(),
        }

    admin = mkuser("Riya Admin", admin_email, "admin", password=admin_pwd)
    mgr1 = mkuser("Marcus Chen", "marcus.chen@copilot-gov.com", "manager", "Phoenix", "Backend", "CC-1001")
    mgr2 = mkuser("Priya Shah", "priya.shah@copilot-gov.com", "manager", "Atlas", "ML", "CC-2002")
    await db.users.insert_many([admin, mgr1, mgr2])

    employees_seed = [
        ("Alice Park", "alice.park@copilot-gov.com", "Phoenix", "Backend", "CC-1001", mgr1["id"]),
        ("Bob Martinez", "bob.martinez@copilot-gov.com", "Phoenix", "Frontend", "CC-1001", mgr1["id"]),
        ("Carol Singh", "carol.singh@copilot-gov.com", "Atlas", "ML", "CC-2002", mgr2["id"]),
        ("David Liu", "david.liu@copilot-gov.com", "Atlas", "ML", "CC-2002", mgr2["id"]),
        ("Esha Nair", "esha.nair@copilot-gov.com", "Orion", "Backend", "CC-3003", mgr1["id"]),
        ("Farid Hassan", "farid.hassan@copilot-gov.com", "Orion", "DevOps", "CC-3003", mgr1["id"]),
        ("Grace Yu", "grace.yu@copilot-gov.com", "Nova", "Mobile", "CC-4004", mgr2["id"]),
        ("Hiro Tanaka", "hiro.tanaka@copilot-gov.com", "Nova", "Frontend", "CC-4004", mgr2["id"]),
        ("Ivy Brown", "ivy.brown@copilot-gov.com", "Phoenix", "Backend", "CC-1001", mgr1["id"]),
    ]
    employees = [mkuser(n, e, "employee", p, t, c, m) for (n, e, p, t, c, m) in employees_seed]
    await db.users.insert_many(employees)

    # Licenses (30 total)
    licenses = []
    for i in range(1, 31):
        licenses.append({
            "id": new_id(),
            "license_key": f"GHC-{1000 + i:04d}",
            "status": "available",
            "assigned_user_id": None,
            "assigned_user_name": None,
            "project": None,
            "team": None,
            "cost_center": None,
            "assigned_at": None,
            "last_renewal_at": None,
            "next_renewal_due": None,
            "created_at": now_iso(),
        })

    # Assign licenses to first 7 employees with varied renewal states
    now = datetime.now(timezone.utc)
    assignments = [
        (0, employees[0], now - timedelta(days=10), now + timedelta(days=80)),   # fresh
        (1, employees[1], now - timedelta(days=45), now + timedelta(days=45)),
        (2, employees[2], now - timedelta(days=82), now + timedelta(days=8)),    # due soon
        (3, employees[3], now - timedelta(days=95), now - timedelta(days=5)),    # overdue
        (4, employees[4], now - timedelta(days=130), now - timedelta(days=40)),  # candidate to reclaim
        (5, employees[5], now - timedelta(days=20), now + timedelta(days=70)),
        (6, employees[6], now - timedelta(days=60), now + timedelta(days=30)),
    ]
    requests_seed = []
    for idx, emp, last_renewal, next_due in assignments:
        lic = licenses[idx]
        lic.update({
            "status": "assigned",
            "assigned_user_id": emp["id"],
            "assigned_user_name": emp["name"],
            "project": emp["project"],
            "team": emp["team"],
            "cost_center": emp["cost_center"],
            "assigned_at": last_renewal.isoformat(),
            "last_renewal_at": last_renewal.isoformat(),
            "next_renewal_due": next_due.isoformat(),
        })
        requests_seed.append({
            "id": new_id(),
            "employee_id": emp["id"],
            "employee_name": emp["name"],
            "employee_email": emp["email"],
            "project": emp["project"], "team": emp["team"], "cost_center": emp["cost_center"],
            "manager_id": emp["manager_id"],
            "justification": "Need Copilot for daily development tasks.",
            "status": "assigned",
            "created_at": last_renewal.isoformat(),
            "decided_at": last_renewal.isoformat(),
            "decided_by": emp["manager_id"],
            "comments": "Approved.",
            "assigned_license_id": lic["id"],
            "assigned_at": last_renewal.isoformat(),
            "last_renewal_at": last_renewal.isoformat(),
        })

    await db.licenses.insert_many(licenses)

    # Pending requests for employees 7, 8 (Hiro, Ivy)
    for emp in employees[7:9]:
        requests_seed.append({
            "id": new_id(),
            "employee_id": emp["id"],
            "employee_name": emp["name"],
            "employee_email": emp["email"],
            "project": emp["project"], "team": emp["team"], "cost_center": emp["cost_center"],
            "manager_id": emp["manager_id"],
            "justification": "Joining new initiative, need Copilot to accelerate delivery.",
            "status": "pending",
            "created_at": (now - timedelta(days=2)).isoformat(),
            "decided_at": None, "decided_by": None, "comments": "",
            "assigned_license_id": None, "assigned_at": None, "last_renewal_at": None,
        })
    # One rejected
    requests_seed.append({
        "id": new_id(),
        "employee_id": employees[8]["id"],
        "employee_name": employees[8]["name"],
        "employee_email": employees[8]["email"],
        "project": "Atlas", "team": "ML", "cost_center": "CC-2002",
        "manager_id": mgr2["id"],
        "justification": "Trial use",
        "status": "rejected",
        "created_at": (now - timedelta(days=15)).isoformat(),
        "decided_at": (now - timedelta(days=14)).isoformat(),
        "decided_by": mgr2["id"],
        "comments": "Insufficient justification; please re-apply with project details.",
        "assigned_license_id": None, "assigned_at": None, "last_renewal_at": None,
    })

    await db.requests.insert_many(requests_seed)

    # Audit log seed
    for r in requests_seed:
        await db.audit_logs.insert_one({
            "id": new_id(),
            "actor_id": r["employee_id"],
            "actor_name": r["employee_name"],
            "actor_email": r["employee_email"],
            "action": "request.created",
            "target_type": "request",
            "target_id": r["id"],
            "meta": {"project": r["project"]},
            "timestamp": r["created_at"],
        })
        if r["status"] in ("assigned", "rejected"):
            await db.audit_logs.insert_one({
                "id": new_id(),
                "actor_id": r["decided_by"],
                "actor_name": "Manager",
                "actor_email": "",
                "action": "request.approved" if r["status"] == "assigned" else "request.rejected",
                "target_type": "request",
                "target_id": r["id"],
                "meta": {},
                "timestamp": r["decided_at"],
            })

    # Notifications for managers about pending requests
    for r in requests_seed:
        if r["status"] == "pending":
            await notify(r["manager_id"], "request_submitted",
                         f"Pending request from {r['employee_name']}",
                         f"Project {r['project']} — please review.",
                         {"request_id": r["id"]})

    log.info("Seed complete: %d users, %d licenses, %d requests",
             3 + len(employees), len(licenses), len(requests_seed))


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.licenses.create_index("license_key", unique=True)
    await db.requests.create_index("employee_id")
    await db.audit_logs.create_index("timestamp")
    await seed_data()


@app.on_event("shutdown")
async def shutdown():
    client.close()
