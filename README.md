# LFC Social Hub

A single-church, multi-user social media management workspace for Love First Church.

## Current foundation

- React + TypeScript + Vite dashboard
- FastAPI backend with authenticated workspace API
- PostgreSQL data models and Alembic migration
- First-owner bootstrap, password hashing and JWT bearer authentication
- Workspace, membership, social account, post, media, approval, publishing-job and audit-log tables
- PostgreSQL and Redis development infrastructure

## Run locally

### 1. Start infrastructure

From the repository root:

```powershell
docker compose up -d
```

### 2. Configure the backend

Copy `.env.example` to `.env` in the repository root. Set unique random values for `JWT_SECRET` and `BOOTSTRAP_SECRET`. Keep the real `.env` file private; it is ignored by Git.

### 3. Run database migrations and the API

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Health endpoint: http://localhost:8000/health
API documentation: http://localhost:8000/docs

### 4. Create the first workspace owner

The bootstrap endpoint is available only while the users table is empty and requires the server-side `BOOTSTRAP_SECRET`. Run this once from PowerShell, replacing the sample values:

```powershell
$body = @{
  bootstrap_secret = "YOUR_BOOTSTRAP_SECRET"
  email = "owner@example.com"
  full_name = "Workspace Owner"
  password = "Use-A-Unique-Password-At-Least-12-Chars"
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/v1/auth/bootstrap" -ContentType "application/json" -Body $body
```

The response contains a short-lived bearer access token. Use it in the `Authorization: Bearer <token>` header for `/api/v1/auth/me` and `/api/v1/workspace`. Sign in later through `POST /api/v1/auth/login`.

### 5. Run the frontend

In a second terminal:

```powershell
cd apps/web
npm install
npm run dev
```

## Security notes

- Never commit real `.env` files, passwords, JWT secrets or social-platform tokens.
- Use long, unique secrets in production; production startup rejects weak JWT/bootstrap secrets.
- The initial owner bootstrap endpoint becomes unavailable after the first user is created.
- Social OAuth and publishing integrations are not connected yet. Platform credentials must be stored server-side using an encrypted secret store in a later milestone.

## Current limitations

The dashboard still contains demonstration content. Team invitations, role administration, post CRUD, media uploads, publishing workers, OAuth integrations, analytics and the native desktop wrapper are not implemented yet.

## Deploy the API

The backend includes a production container definition at `backend/Dockerfile`. It installs the pinned-range Python dependencies, applies Alembic migrations at container startup, and serves FastAPI on the platform-provided `PORT`.

Configure these environment variables in your hosting provider:

- `ENVIRONMENT=production`
- `DATABASE_URL` — PostgreSQL connection string using the `postgresql+psycopg://` SQLAlchemy driver
- `JWT_SECRET` — unique random value of at least 32 characters
- `BOOTSTRAP_SECRET` — separate one-time setup secret of at least 24 characters
- `FRONTEND_ORIGIN` — exact HTTPS origin of the deployed frontend
- `PORT` — supplied by most container hosting platforms

After the API is reachable, create the first owner once with `POST /api/v1/auth/bootstrap`, then remove or rotate the bootstrap secret. Do not expose the bootstrap secret in frontend configuration.

For the frontend build, set `VITE_API_BASE_URL` to the API's HTTPS origin. This value is public and must never contain secrets. The GitHub Pages preview intentionally stays in demo mode until this value is configured and the API is deployed.

### Connect the hosted frontend to the API

In the GitHub repository, open **Settings → Secrets and variables → Actions → Variables** and add a repository variable named `VITE_API_BASE_URL` containing only the public HTTPS API origin (for example, `https://api.your-domain.example`, with no trailing slash). This is a public frontend setting, not a secret. The Pages build workflow passes it to Vite. Also set the API's `FRONTEND_ORIGIN` to the exact GitHub Pages origin, such as `https://swanikerjohnprince-droid.github.io`.
