# prelegal
A platform for drafting common legal agreements.

- `templates/` - Common Paper legal templates (CC BY 4.0), listed in `catalog.json`
- `frontend/` - Next.js app, statically exported; see [frontend/README.md](frontend/README.md)
- `backend/` - FastAPI (uv) service that serves the frontend and the API; SQLite database recreated on every start
- `scripts/` - start and stop scripts

## Run

Requires Docker and a `.env` file in the project root.

```bash
scripts/start-mac.sh      # or start-linux.sh / start-windows.ps1
scripts/stop-mac.sh       # or stop-linux.sh / stop-windows.ps1
```

The app is served at http://localhost:8000. The sign-in screen is a placeholder: any input is accepted.

## Test

```bash
cd backend && uv run pytest
cd frontend && npm test && npm run test:e2e
```

## Status

In progress, expected to be complete by 2026-10-10.
