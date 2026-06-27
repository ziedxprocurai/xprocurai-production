from __future__ import annotations

import asyncio
import base64
from pathlib import Path
from typing import Any

from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from ai_engine import engine
from ai_engine.chatbot import process_chat_message, process_chat_with_image, process_with_rag
from ai_engine.database import ProcurementDatabase
from ai_engine.ocr import extract_text_from_bytes
from ai_engine.rag import (
    init_rag_db,
    search_similar_rfqs,
    search_similar_suppliers,
    add_rfq_document,
    add_supplier_document,
    _rfq_collection,
    _supplier_collection,
)
from crawler_service import run_crawl

ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"

app = FastAPI(title="AI Procurement Platform")

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/ai/schema")
async def ai_schema():
    return {
        "workflow": {
            "need_text": "I need 500 office chairs in Tunis, budget 12000 TND, delivery within 15 days",
            "suppliers": [],
            "quotes": [
                {
                    "supplier_name": "Tunis Office Solutions",
                    "text": "Tunis Office Solutions\nChaise bureau ergonomique 500 pcs 22 TND\nLivraison 12 jours\nTotal HT: 11000 TND",
                }
            ],
            "delivery": {"promised_days": 12},
            "invoices": [],
            "top_k": 5,
            "use_llm": False,
        },
        "quote_parse": {
            "quotes": [
                {"supplier_name": "Supplier A", "text": "Laptop Dell 20 pcs 1800 TND\nTotal: 36000 TND\nLivraison 10 jours"}
            ]
        },
        "risk": {
            "rfq": {"title": "Office chairs", "items": [{"name": "Office chair", "quantity": 500}], "delivery_deadline_days": 15},
            "supplier_matches": [],
            "quote_comparisons": [],
            "delivery": {"promised_days": 20},
            "invoices": [
                {"invoice_number": "INV-001", "amount": 12000, "quote_total": 11000, "po_reference": "PO-100", "supplier_is_new": False, "bank_account_changed": False, "duplicate_invoice": False}
            ],
        },
    }


@app.post("/api/ai/rfq/extract")
async def extract_rfq(payload: dict[str, Any]):
    text = payload.get("text") or payload.get("need_text") or ""
    use_llm = bool(payload.get("use_llm", False))
    return engine.extract_rfq(text, use_llm=use_llm)


@app.get("/api/ai/suppliers")
async def list_suppliers():
    return {"suppliers": engine.list_suppliers()}


@app.get("/api/ai/database/stats")
async def database_stats():
    db = ProcurementDatabase("data/procurement.db")
    with db.connect() as conn:
        return {
            "suppliers": conn.execute("SELECT COUNT(*) FROM suppliers").fetchone()[0],
            "rfqs": conn.execute("SELECT COUNT(*) FROM rfqs").fetchone()[0],
            "quotes": conn.execute("SELECT COUNT(*) FROM quotes").fetchone()[0],
            "risk_assessments": conn.execute("SELECT COUNT(*) FROM risk_assessments").fetchone()[0],
            "crawl_runs": conn.execute("SELECT COUNT(*) FROM crawl_runs").fetchone()[0],
        }


@app.post("/api/ai/suppliers/upsert")
async def upsert_suppliers(payload: dict[str, Any]):
    suppliers = payload.get("suppliers") or []
    return {"suppliers": engine.upsert_suppliers(suppliers)}


@app.post("/api/ai/suppliers/from-crawl")
async def suppliers_from_crawl(payload: dict[str, Any]):
    crawl_result = payload.get("crawl_result") or payload
    return {"suppliers": engine.add_suppliers_from_crawl(crawl_result)}


@app.post("/api/ai/suppliers/match")
async def match_suppliers(payload: dict[str, Any]):
    rfq = payload.get("rfq") or {}
    top_k = int(payload.get("top_k", 5))
    return {"matches": engine.match_suppliers(rfq, top_k=top_k)}


@app.post("/api/ai/quotes/parse")
async def parse_quotes(payload: dict[str, Any]):
    quotes = payload.get("quotes") or []
    return {"quotes": engine.parse_quotes(quotes)}


@app.post("/api/ai/quotes/compare")
async def compare_quotes(payload: dict[str, Any]):
    rfq = payload.get("rfq") or {}
    quotes = payload.get("quotes") or []
    return {"comparisons": engine.compare_quotes(rfq, quotes)}


@app.post("/api/ai/risk")
async def assess_risk(payload: dict[str, Any]):
    return engine.assess_risk(
        rfq_payload=payload.get("rfq") or {},
        supplier_matches=payload.get("supplier_matches") or [],
        quote_comparisons=payload.get("quote_comparisons") or [],
        delivery=payload.get("delivery") or {},
        invoices=payload.get("invoices") or [],
    )


@app.post("/api/ai/workflow")
async def run_workflow(payload: dict[str, Any]):
    try:
        image_payload = payload.get("image")
        pdf_payload = payload.get("pdf")
        workflow_payload = dict(payload)
        if image_payload or pdf_payload:
            raw = image_payload or pdf_payload
            if isinstance(raw, str):
                content = base64.b64decode(raw)
                filename = "upload.png" if image_payload else "upload.pdf"
                extracted_text = extract_text_from_bytes(content, filename=filename)
                workflow_payload["need_text"] = extracted_text or workflow_payload.get("need_text", "")
        return engine.run_workflow(workflow_payload)
    except Exception as exc:
        return {"error": str(exc)}


@app.post("/api/ai/chat")
async def chat_endpoint(payload: dict[str, Any]):
    message = payload.get("message") or ""
    image = payload.get("image")
    pdf = payload.get("pdf")
    mode = payload.get("mode")
    if image or pdf:
        if mode == "rag":
            return process_with_rag(message, image_base64=image, pdf_base64=pdf)
        return process_chat_with_image(message, image_base64=image, pdf_base64=pdf)
    return process_chat_message(message)


@app.post("/api/ai/rag/process")
async def rag_process(file: UploadFile = File(...)):
    try:
        content = await file.read()
        filename = file.filename or "upload"
        image_b64 = base64.b64encode(content).decode("utf-8")
        if filename.lower().endswith(".pdf"):
            result = process_with_rag("", pdf_base64=image_b64)
        else:
            result = process_with_rag("", image_base64=image_b64)
        return {"success": True, "filename": filename, **result}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


@app.post("/api/ai/ocr/extract")
async def ocr_extract(file: UploadFile = File(...)):
    try:
        content = await file.read()
        text = extract_text_from_bytes(content, filename=file.filename or "upload")
        return {"text": text, "filename": file.filename}
    except Exception as exc:
        return {"text": "", "error": str(exc)}


@app.post("/api/ai/rag/search")
async def rag_search(payload: dict[str, Any]):
    query = payload.get("query") or ""
    top_k = int(payload.get("top_k", 5))
    collection = payload.get("collection", "all")
    try:
        if collection == "rfq" or collection == "all":
            rfq_results = search_similar_rfqs(query, top_k=top_k)
        else:
            rfq_results = []
        if collection == "supplier" or collection == "all":
            supplier_results = search_similar_suppliers(query, top_k=top_k)
        else:
            supplier_results = []
        return {
            "rfq_knowledge": rfq_results,
            "supplier_knowledge": supplier_results,
        }
    except Exception as exc:
        return {"rfq_knowledge": [], "supplier_knowledge": [], "error": str(exc)}


@app.post("/api/ai/rag/add-rfq")
async def rag_add_rfq(payload: dict[str, Any]):
    text = payload.get("text") or ""
    doc_id = payload.get("doc_id") or f"rfq_{asyncio.get_event_loop().time()}"
    metadata = payload.get("metadata") or {}
    ok = add_rfq_document(text, metadata, doc_id)
    return {"success": ok, "doc_id": doc_id}


@app.post("/api/ai/rag/add-supplier")
async def rag_add_supplier(payload: dict[str, Any]):
    text = payload.get("text") or ""
    doc_id = payload.get("doc_id") or f"supplier_{asyncio.get_event_loop().time()}"
    metadata = payload.get("metadata") or {}
    ok = add_supplier_document(text, metadata, doc_id)
    return {"success": ok, "doc_id": doc_id}


@app.get("/api/ai/rag/stats")
async def rag_stats():
    try:
        init_rag_db()
        rfq_count = _rfq_collection.count() if _rfq_collection is not None else 0
        supplier_count = _supplier_collection.count() if _supplier_collection is not None else 0
        return {
            "rfq_knowledge": rfq_count,
            "supplier_knowledge": supplier_count,
        }
    except Exception as exc:
        return {"rfq_knowledge": 0, "supplier_knowledge": 0, "error": str(exc)}


@app.websocket("/ws/crawl")
async def crawl_ws(websocket: WebSocket):
    await websocket.accept()
    running = False
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
    closed = False

    async def sender():
        nonlocal closed
        while not closed:
            event = await queue.get()
            try:
                await websocket.send_json(event)
            except Exception:
                closed = True
                break

    def emit(kind: str, payload: dict[str, Any] | None = None):
        queue.put_nowait({"type": kind, "payload": payload or {}})

    sender_task = asyncio.create_task(sender())
    try:
        while True:
            message = await websocket.receive_json()
            if running:
                queue.put_nowait({"type": "error", "payload": {"message": "Crawl already running"}})
                continue

            running = True
            try:
                result = await asyncio.to_thread(run_crawl, message, emit=emit)
                queue.put_nowait({"type": "result", "payload": result.to_dict()})
            except Exception as exc:
                queue.put_nowait({"type": "error", "payload": {"message": str(exc)}})
            finally:
                running = False
    except WebSocketDisconnect:
        closed = True
        return
    except Exception as exc:
        queue.put_nowait({"type": "error", "payload": {"message": str(exc)}})
    finally:
        closed = True
        sender_task.cancel()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
