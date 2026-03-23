# QA Observability Dashboard

A minimal MVP for a QA Observability System employing a Backend-For-Frontend architecture.
The app leverages React (Vite) + Tailwind CSS on the frontend, and Python (FastAPI) on the backend.

## Tech Stack
- Frontend: React + Vite + Tailwind CSS (Lucide Icons)
- Backend: Python 3.11 + FastAPI + Uvicorn
- Infrastructure: Docker + Docker Compose + Nginx proxy

## Architecture
- The **Backend** exposes API endpoints secured via a simple password verification mechanism (`/api/login`) that issues a static token, required for fetching subsequent mock data routines.
- The **Frontend** authenticates via the `/api/login` endpoint, stores the token in `localStorage`, and wraps the Dashboard under a Protected Route.
- **Docker Compose** connects both services via an internal bridge network `qa_dashboard_net`.
- **Nginx** is used on the frontend to serve the built static react app on port `3000` and seamlessly proxies the `/api/*` endpoints to the backend container to avert CORS and domain name routing issues.

## Running Locally

1. Setup the environment variable if you want to override the default password (`QA_Secure_2026`):
   ```bash
   export QA_DASHBOARD_PASSWORD="YourPassword"
   ```
2. Rapidly boot the entire stack by executing:
   ```bash
   docker compose up -d --build
   ```
3. Open `http://localhost:3000` via your standard browser.
4. Input the configured password (or the default `QA_Secure_2026`) to authenticate and inspect real-time mock observability metrics.