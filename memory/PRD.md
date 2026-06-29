# Copilot License Governance Portal — PRD

## Problem statement (verbatim from user)
GitHub Copilot access requests are currently managed manually through Teams messages. Managers lack centralized visibility into license allocation, user ownership, project mapping, renewals, inactive users, and overall license utilization. This results in administrative overhead, unused licenses, and poor auditability.

## Goal
A centralized self-service portal for requesting, approving, tracking, renewing, and reclaiming GitHub Copilot licenses across projects and teams.

## User personas
- **Employee** — request access, view status, confirm continued usage, release, transfer.
- **Manager** — approve/reject, auto-assign from pool, monitor utilization, reclaim.
- **Admin** — superset of manager (full visibility).

## Stack used
- Backend: FastAPI + Motor (Mongo). JWT auth (httpOnly cookie + Bearer fallback).
- Frontend: React 19, react-router, shadcn/ui, Tailwind, recharts, sonner toasts, lucide icons.
- DB: MongoDB (collections: users, projects, teams, cost_centers, licenses, requests, audit_logs, notifications).

## Architecture decisions
- Single FastAPI server with `/api` prefix; routes namespaced (`/auth/*`, `/requests/*`, `/licenses/*`, `/renewals/*`, `/reclamation/*`, `/analytics/*`, `/audit`, `/notifications/*`).
- UUID string IDs everywhere (not Mongo ObjectId) for simpler serialization.
- Renewal cycle = 90 days (quarterly default). Reclaim signals: renewal overdue > 30d OR last renewal > 120d.
- Role-based UI: sidebar entries + protected routes (`<ProtectedRoute roles={...}>`).
- In-app notification center via bell dropdown; `/api/notifications` polled every 30s.

## Implemented (2026-02 MVP)
- Auth: JWT login/logout/me; admin auto-seed; bcrypt hashing; httpOnly cookie + Bearer token.
- Seed data: 1 admin, 2 managers, 9 employees, 30 licenses (7 assigned with varied renewal states), 10 requests (assigned/pending/rejected), seed audit log + manager notifications.
- Request management: create, list (mine / scope=mine_to_approve), decide (approve+auto-assign or reject), duplicate guard.
- License inventory: list/filter/search, reclaim, my-license, employee self-release.
- Renewals: employee self-action (continue / release / moved-project transfer with new approval), manager-side renewals due list, dashboard count.
- Reclamation: candidate listing with reasons; manual reclaim; bulk in-app notify by project/team/cost_center.
- Analytics: overview metrics (utilization, waste, active users, renewal_due, reclaimable), by-project bar, cost-by-CC pie, 30-day requests trend.
- Audit logs: searchable + CSV export; auto-recorded on every state change.
- Notifications: bell with unread count, mark-all-read, bulk by scope, per-event triggers (request_submitted, license_assigned, request_rejected, license_reclaimed).

## Test credentials
See `/app/memory/test_credentials.md`.

## Backlog (next phases)
### P0
- Email notifications (Resend or SendGrid) for renewal due, license assigned, request rejected.
- Microsoft Teams webhook integration for manager queue and approval notifications.
### P1
- Configurable renewal cycle per project (monthly/quarterly/annual).
- Bulk approve / bulk assign from approvals queue.
- License expiry (vs. release) lifecycle and TTL.
- Microsoft Entra ID (Azure AD) SSO as alternative to JWT auth.
- Audit export filters: by date range, by actor, by action type.
### P2
- Per-user activity ping (last_active_at) from Copilot API to better detect inactivity.
- Cost forecasting and budget alerts per cost center.
- Manager bulk reclaim with reassignment in one step.
- CSV import of new license SKUs.
- Mobile-responsive sidebar.

## Next action items (post first-finish)
- Decide on email provider (Resend or SendGrid) for renewal reminders.
- Confirm preferred renewal cycle defaults.
- Confirm whether to switch JWT auth to Entra ID SSO when moving to production.
