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
- The Telegram connection uses the official Bot API. Bot tokens are encrypted at rest with Fernet using CREDENTIALS_ENCRYPTION_KEY; never put that key in frontend variables or commit it. Other platform OAuth integrations are still being built.

## Current limitations

The dashboard still contains demonstration content. Team invitations, role administration, a full publishing worker, Meta/Google/TikTok OAuth integrations, analytics and the native desktop wrapper are not implemented yet.

## Deploy the API

The backend includes a production container definition at `backend/Dockerfile`. It installs the pinned-range Python dependencies, applies Alembic migrations at container startup, and serves FastAPI on the platform-provided `PORT`.

Configure these environment variables in your hosting provider:

- `ENVIRONMENT=production`
- `DATABASE_URL` — PostgreSQL connection string using the `postgresql+psycopg://` SQLAlchemy driver
- `JWT_SECRET` — unique random value of at least 32 characters
- `BOOTSTRAP_SECRET` — separate one-time setup secret of at least 24 characters
- `CREDENTIALS_ENCRYPTION_KEY` — private Fernet key for encrypting social-account credentials at rest. Generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. Keep it stable and back it up securely; losing it makes stored tokens unreadable.
- `FRONTEND_ORIGIN` — exact HTTPS origin of the deployed frontend
- `PORT` — supplied by most container hosting platforms

After the API is reachable, create the first owner once with `POST /api/v1/auth/bootstrap`, then remove or rotate the bootstrap secret. Do not expose the bootstrap secret in frontend configuration.

For the frontend build, set `VITE_API_BASE_URL` to the API's HTTPS origin. This value is public and must never contain secrets. The GitHub Pages preview intentionally stays in demo mode until this value is configured and the API is deployed.

### Connect the hosted frontend to the API

In the GitHub repository, open **Settings → Secrets and variables → Actions → Variables** and add a repository variable named `VITE_API_BASE_URL` containing only the public HTTPS API origin (for example, `https://api.your-domain.example`, with no trailing slash). This is a public frontend setting, not a secret. The Pages build workflow passes it to Vite. Also set the API's `FRONTEND_ORIGIN` to the exact GitHub Pages origin, such as `https://swanikerjohnprince-droid.github.io`.

## Media uploads and platform-specific drafts

The Create Post composer supports multiple JPG, PNG, WebP, GIF, MP4 and MOV attachments (up to 100 MB per file), individual captions and platform settings for Facebook, Instagram, TikTok, YouTube, WhatsApp Channels and Telegram. Drafts and scheduled post metadata are stored through the authenticated API. Platform options are persisted as structured JSON so each platform adapter can validate and map supported settings when publishing integrations are added.

The backend media API is:
- `POST /api/v1/media` — authenticated multipart upload using the `file` field.
- `GET /api/v1/media/{asset_id}/file` — authenticated media retrieval.
- `POST /api/v1/posts` — saves platform variants, media asset references and platform-specific options.

The upload implementation currently stores files under `MEDIA_ROOT` (default `./media`). This is suitable for local development only unless the deployment uses a persistent disk. For a production deployment, configure a persistent volume or replace the storage adapter with private S3-compatible object storage before relying on uploaded media. Do not assume container-local files survive redeploys.

The migration `0002_post_media_options` adds per-platform option storage and the many-to-many post-media table. Existing deployments must run Alembic migrations before using the updated post API.

**Publishing limitation:** saving a draft or scheduled record does not publish it to a social network. Official account authorization, platform-specific API permissions, media constraints, review/approval requirements and publishing workers still need to be implemented and tested for each provider. Some native-app features are not exposed to third-party APIs, so the composer must only enable actual publishing for options supported by the connected provider.

## Telegram channel connection

The Settings page includes a Telegram connection flow using the official Telegram Bot API. Create a bot, add it as an administrator to the target channel with permission to post messages, then enter its token and the channel username/ID in the authenticated Settings page. The backend validates the bot and channel permissions before saving the connection. The bot token is encrypted with Fernet and is never returned to the frontend.

Required backend environment variable: `CREDENTIALS_ENCRYPTION_KEY`. Generate a Fernet key with:

```powershell
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Set this as a backend-only environment variable. Do not set it as a Vite variable, paste it into chat, or commit it. Keep a secure backup because rotating or losing the key without re-encrypting existing credentials will make stored connections unreadable.

Telegram connection endpoints:
- `GET /api/v1/integrations` — returns connection status without secrets.
- `POST /api/v1/integrations/telegram/connect` — validates and stores a bot/channel connection.
- `DELETE /api/v1/integrations/telegram` — removes the stored token and disconnects the channel.

The Telegram connection is the first provider integration. Direct publishing, scheduled delivery and retry handling are separate follow-up work; a connected bot does not mean queued posts are automatically published yet.
