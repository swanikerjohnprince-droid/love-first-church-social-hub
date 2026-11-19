# Architecture

- apps/web: React + TypeScript + Vite.
- apps/desktop: Tauri v2 desktop shell preparation.
- backend: FastAPI API service.
- PostgreSQL: durable application data.
- Redis: queue broker/cache for future background workers.
- Cloud object storage: future media storage.

The API and frontend are independently deployable. Publishing workers will run in the cloud, not on desktop clients.
