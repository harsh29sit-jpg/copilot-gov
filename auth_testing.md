# Auth Testing Playbook — Copilot License Governance Portal

## Credentials
See `/app/memory/test_credentials.md`. Admin: `admin@copilot-gov.com` / `admin123`. Managers/Employees: `password123`.

## Steps
```
curl -c /tmp/cookies.txt -X POST $REACT_APP_BACKEND_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@copilot-gov.com","password":"admin123"}'

curl -b /tmp/cookies.txt $REACT_APP_BACKEND_URL/api/auth/me
```

Login returns `{ token, user }` and sets the `access_token` cookie. `/api/auth/me` returns the user object. Other protected endpoints accept either the cookie or `Authorization: Bearer <token>`.
