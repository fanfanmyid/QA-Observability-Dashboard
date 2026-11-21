import os
import time
import asyncio
import shlex
import httpx
import asyncssh
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="QA Observability Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    cred_token = os.environ.get("CRED_TOKEN", "")
    if not cred_token or credentials.credentials != cred_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials

class LoginRequest(BaseModel):
    password: str

@app.post("/api/login")
def login(request: LoginRequest):
    expected_password = os.environ.get("QA_DASHBOARD_PASSWORD", "")
    cred_token = os.environ.get("CRED_TOKEN", "")
    if expected_password and cred_token and request.password == expected_password:
        return {"token": cred_token}
    raise HTTPException(status_code=401, detail="Incorrect password")

def get_env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)

JENKINS_URL = get_env("JENKINS_URL")
JENKINS_USER = get_env("JENKINS_USER")
JENKINS_API_TOKEN = get_env("JENKINS_API_TOKEN")

async def fetch_jenkins_job(client: httpx.AsyncClient, job_name: str) -> dict:
    if not job_name or not JENKINS_URL:
        return {"status": "UNKNOWN", "duration": 0, "build_id": "-", "timestamp": None}
    try:
        url = f"{JENKINS_URL}/job/{job_name}/lastBuild/api/json"
        auth = (JENKINS_USER, JENKINS_API_TOKEN) if JENKINS_USER else None
        response = await client.get(url, auth=auth, timeout=10.0)
        response.raise_for_status()
        data = response.json()
        return {
            "status": data.get("result", "RUNNING") or "RUNNING",
            "duration": data.get("duration", 0) // 1000,
            "build_id": str(data.get("number", "-")),
            "timestamp": data.get("timestamp")
        }
    except Exception as e:
        return {"status": "ERROR", "duration": 0, "build_id": "-", "error": str(e), "timestamp": None}

@app.get("/api/qa/pipeline", dependencies=[Depends(verify_token)])
async def get_pipeline_status():
    async with httpx.AsyncClient() as client:
        backend_job = get_env("JENKINS_JOB_BACKEND")
        frontend_job = get_env("JENKINS_JOB_FRONTEND")
        backend_result, frontend_result = await asyncio.gather(
            fetch_jenkins_job(client, backend_job),
            fetch_jenkins_job(client, frontend_job)
        )
        return {
            "backend": backend_result,
            "frontend": frontend_result
        }

async def fetch_jenkins_tests(client: httpx.AsyncClient, job_name: str) -> dict:
    if not job_name or not JENKINS_URL:
        return {"passed": 0, "failed": 0, "skipped": 0, "total": 0}
    try:
        url = f"{JENKINS_URL}/job/{job_name}/lastCompletedBuild/testReport/api/json"
        auth = (JENKINS_USER, JENKINS_API_TOKEN) if JENKINS_USER else None
        response = await client.get(url, auth=auth, timeout=10.0)
        if response.status_code == 404:
            return {"passed": 0, "failed": 0, "skipped": 0, "total": 0, "note": "no test report published"}
        response.raise_for_status()
        data = response.json()
        return {
            "passed": data.get("passCount", 0),
            "failed": data.get("failCount", 0),
            "skipped": data.get("skipCount", 0),
            "total": data.get("totalCount", 0)
        }
    except Exception:
        return {"passed": 0, "failed": 0, "skipped": 0, "total": 0, "note": "test report unavailable"}

@app.get("/api/qa/tests", dependencies=[Depends(verify_token)])
async def get_test_stats():
    async with httpx.AsyncClient() as client:
        backend_job = get_env("JENKINS_JOB_BACKEND")
        frontend_job = get_env("JENKINS_JOB_FRONTEND")
        backend_result, frontend_result = await asyncio.gather(
            fetch_jenkins_tests(client, backend_job),
            fetch_jenkins_tests(client, frontend_job)
        )
        return {
            "backend": backend_result,
            "frontend": frontend_result
        }

async def fetch_health_nginx(client: httpx.AsyncClient) -> dict:
    url = get_env("FRONTEND_NGINX_EXPORTER_URL")
    if not url:
        return {"status": "UNKNOWN", "active_connections": 0, "raw": ""}
    try:
        res = await client.get(url, timeout=5.0)
        res.raise_for_status()
        text = res.text
        active = 0
        for line in text.split('\n'):
            if line.startswith("nginx_connections_active"):
                parts = line.split()
                if len(parts) >= 2:
                    active = int(parts[1])
                break
        return {"status": "UP", "active_connections": active}
    except Exception as e:
        return {"status": "DOWN", "error": str(e)}

async def fetch_health_backend(client: httpx.AsyncClient) -> dict:
    url = get_env("BACKEND_HEALTH_URL")
    if not url:
        return {"status": "UNKNOWN"}
    try:
        res = await client.get(url, timeout=5.0)
        res.raise_for_status()
        return {"status": "UP", "details": res.json()}
    except Exception as e:
        return {"status": "DOWN", "error": str(e)}

@app.get("/api/qa/health", dependencies=[Depends(verify_token)])
async def get_health():
    async with httpx.AsyncClient() as client:
        frontend_health, backend_health = await asyncio.gather(
            fetch_health_nginx(client),
            fetch_health_backend(client)
        )
        return {
            "frontend": frontend_health,
            "backend": backend_health
        }

@app.get("/api/qa/logs", dependencies=[Depends(verify_token)])
async def get_logs(service: str = "backend"):
    if service not in ("backend", "frontend"):
        raise HTTPException(status_code=400, detail="service must be 'backend' or 'frontend'")
    host = get_env("BACKEND_SSH_HOST") if service == "backend" else get_env("FRONTEND_SSH_HOST")
    container = get_env("BACKEND_CONTAINER_NAME") if service == "backend" else get_env("FRONTEND_CONTAINER_NAME")
    ssh_user = get_env("SSH_USER", "root")
    ssh_key = get_env("SSH_KEY_PATH", "/root/.ssh/id_rsa")

    if not host or not container:
        return ["Error: SSH host or container name not configured in env"]

    # Noise filter: merge stderr into stdout, drop health/metrics probe lines,
    # then take the last 50 lines of the cleaned log. Container name is
    # shell-quoted to prevent command injection via env configuration.
    safe_container = shlex.quote(container)
    command = (
        f"docker logs {safe_container} 2>&1 "
        "| grep -v '/metrics' | grep -v '/api/v1/health' | grep -v '/stub_status' "
        "| tail -n 50"
    )

    try:
        async with asyncssh.connect(
            host,
            username=ssh_user,
            client_keys=[ssh_key],
            known_hosts=None
        ) as conn:
            result = await conn.run(command, check=False)
            logs = result.stdout.split('\n')
            return [line for line in logs if line.strip()]

    except Exception as e:
        return [f"ERROR fetching logs via SSH: [{host}] {str(e)}"]
