# LFC Social Hub

A single-church, multi-user social media management workspace for Love First Church.

## Milestone 1 foundation

- React + TypeScript + Vite dashboard
- FastAPI backend with health and workspace endpoints
- PostgreSQL and Redis development infrastructure
- Responsive workspace navigation and platform status overview
- Desktop wrapper preparation (Tauri)

## Run locally

### Frontend
```powershell
cd apps/web
npm install
npm run dev
```

### Backend
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Health endpoint: http://localhost:8000/health

### Infrastructure
From the repository root:
```powershell
docker compose up -d
```

## Important

This is the Milestone 1 application foundation. Social OAuth, automatic publishing, authentication, durable scheduling, and production deployment are subsequent milestones. Never expose platform access tokens in frontend code.
