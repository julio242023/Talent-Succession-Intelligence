"""
Servidor Backend FastAPI para Centria Talent & Succession Intelligence.
Recicla la arquitectura y conector de credenciales de Breca-Nexia-Foro (Proyecto Nexxia)
e integra el motor RAG en memoria sobre 2026_Reporte_Sucesion.xlsx.
"""

import os
import json
import importlib
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import utils.excel_loader as excel_loader_mod
from utils.excel_loader import parse_excel_file
from utils.call_llm import (
    call_talent_agent,
    get_config,
    get_firewall_status,
    reset_firewall_status,
    CONFIG_FILE,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EXCEL_DEFAULT_PATH = os.path.join(BASE_DIR, "2026_Reporte_Sucesion.xlsx")
WEB_DIR = os.path.join(BASE_DIR, "web")

app = FastAPI(
    title="Centria Talent & Succession Intelligence API (Nexxia Connector)",
    version="2.7.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Estado en memoria de la base de datos de talento y sucesión
TALENT_DB: List[Dict[str, Any]] = parse_excel_file(EXCEL_DEFAULT_PATH)


class ChatRequest(BaseModel):
    message: Optional[str] = None
    question: Optional[str] = None
    history: Optional[List[Dict[str, str]]] = []
    records: Optional[List[Dict[str, Any]]] = None
    company_filter: Optional[str] = "ALL"
    api_key: Optional[str] = None
    prefer_live_api: Optional[bool] = True


class SyncTalentsRequest(BaseModel):
    records: List[Dict[str, Any]]


@app.get("/api/config")
async def read_config():
    cfg = get_config()
    cred_path = os.path.join(BASE_DIR, cfg.get("GOOGLE_APPLICATION_CREDENTIALS", "google_credentials.json"))
    has_gcp_file = os.path.exists(cred_path)
    has_gemini_key = bool((cfg.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY") or "").strip())
    fw = get_firewall_status()

    return {
        "LLM_PROVIDER": cfg.get("LLM_PROVIDER", "gemini"),
        "GEMINI_MODEL": cfg.get("GEMINI_MODEL", "gemini-2.5-flash"),
        "GCP_PROJECT": cfg.get("GCP_PROJECT", "core-agentspace-prd"),
        "GCP_LOCATION": cfg.get("GCP_LOCATION", "us-central1"),
        "GOOGLE_APPLICATION_CREDENTIALS": cfg.get("GOOGLE_APPLICATION_CREDENTIALS", "google_credentials.json"),
        "HAS_GCP_FILE": has_gcp_file,
        "HAS_GEMINI_KEY": has_gemini_key,
        "TOTAL_RECORDS": len(TALENT_DB),
        "STATUS": "CONNECTED",
        "FIREWALL_STATUS": fw,
        # Alias camel/snake para el frontend
        "project_id": cfg.get("GCP_PROJECT", "core-agentspace-prd"),
        "model": cfg.get("GEMINI_MODEL", "gemini-2.5-flash"),
        "credentials_found": has_gcp_file or has_gemini_key,
        "firewall_status": {
            "attempted": bool(fw.get("checked")),
            "blocked": bool(fw.get("checked") and not fw.get("live_reachable")),
            "reason": fw.get("reason", ""),
        },
    }


@app.post("/api/config")
async def update_config(new_cfg: Dict[str, Any]):
    cfg = get_config()
    for k, v in new_cfg.items():
        if v is not None:
            cfg[k] = v
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=4, ensure_ascii=False)
    reset_firewall_status()
    return {"status": "ok", "config": await read_config()}


@app.post("/api/config/gcp-credentials")
async def upload_gcp_credentials(file: UploadFile = File(...)):
    content = await file.read()
    try:
        parsed = json.loads(content.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="El archivo no es un JSON válido de Service Account.")

    target_path = os.path.join(BASE_DIR, "google_credentials.json")
    with open(target_path, "wb") as f:
        f.write(content)

    cfg = get_config()
    cfg["GOOGLE_APPLICATION_CREDENTIALS"] = "google_credentials.json"
    if "project_id" in parsed:
        cfg["GCP_PROJECT"] = parsed["project_id"]
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=4, ensure_ascii=False)
    reset_firewall_status()

    return {"status": "ok", "project_id": cfg.get("GCP_PROJECT")}


@app.get("/api/talents")
@app.get("/api/data")
async def get_talents():
    return {
        "total": len(TALENT_DB),
        "records": TALENT_DB,
    }


@app.post("/api/talents/sync")
async def sync_talents(payload: SyncTalentsRequest):
    global TALENT_DB
    TALENT_DB = payload.records
    return {
        "status": "ok",
        "total": len(TALENT_DB),
    }


@app.post("/api/talents/reset")
@app.post("/api/reload")
async def reset_talents():
    global TALENT_DB
    importlib.reload(excel_loader_mod)
    TALENT_DB = excel_loader_mod.parse_excel_file(EXCEL_DEFAULT_PATH)
    return {
        "status": "ok",
        "total": len(TALENT_DB),
        "records": TALENT_DB,
    }


@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    query_text = (req.message or req.question or "").strip()
    if not query_text:
        raise HTTPException(status_code=400, detail="La consulta no puede estar vacía.")

    if req.api_key and req.api_key.strip():
        os.environ["GEMINI_API_KEY"] = req.api_key.strip()
        reset_firewall_status()

    active_records = req.records if (req.records is not None and len(req.records) > 0) else TALENT_DB
    result = call_talent_agent(
        message=query_text,
        records=active_records,
        history=req.history,
        company_filter=req.company_filter,
        prefer_live_api=bool(req.prefer_live_api),
    )
    reply_md = result.get("reply", "")
    model_label = result.get("model", "Gemini 2.5 Flash · Nexxia RAG")
    return {
        **result,
        "answer": reply_md,
        "engine": model_label,
    }


@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(WEB_DIR, "index.html"))


app.mount("/web", StaticFiles(directory=WEB_DIR, html=True), name="web_sub")
app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")
