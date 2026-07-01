from __future__ import annotations

import asyncio
import logging
import os
import time
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from ai_engine import engine
from ai_engine.chatbot import process_chat_message, process_chat_with_image, process_with_rag
from ai_engine.database import ProcurementDatabase
from ai_engine.models import (
    AnalyticsQueryRequest,
    ERPCreatePORequest,
    ERPSyncSupplierRequest,
    NegotiationRequest,
    QuoteLineModel,
    QuoteModel,
    RFQModel,
    SupplierProfileModel,
)
from ai_engine.ocr import extract_text_from_bytes
from ai_engine.rag import (
    init_rag_db,
    search_similar_rfqs,
    search_similar_suppliers,
    add_rfq_document,
    add_supplier_document,
    _rfq_collection,
    _supplier_collection,
    answer_from_documents,
)
from ai_engine.shadow_audit import run_shadow_audit
from crawler_service import run_crawl

ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("procurement_ai")

app = FastAPI(title="AI Procurement Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.middleware("http")
async def log_requests(request, call_next):
    start = time.time()
    response = await call_next(request)
    elapsed = time.time() - start
    logger.info("%s %s -> %d (%dms)", request.method, request.url.path, response.status_code, int(elapsed * 1000))
    return response


@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/shadow-audit")
async def shadow_audit_page():
    return FileResponse(STATIC_DIR / "shadow-audit.html")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/ai/schema")
async def ai_schema():
    return {
        "workflow": {
            "need_text": "I need 500 office chairs in Tunis, budget 12000 TND, delivery within 15 days",
            "suppliers": [],
            "quotes": [{"supplier_name": "Tunis Office Solutions", "text": "Tunis Office Solutions\nChaise bureau ergonomique 500 pcs 22 TND\nLivraison 12 jours\nTotal HT: 11000 TND"}],
            "delivery": {"promised_days": 12},
            "invoices": [],
            "top_k": 5,
            "use_llm": False,
        },
        "quote_parse": {"quotes": [{"supplier_name": "Supplier A", "text": "Laptop Dell 20 pcs 1800 TND\nTotal: 36000 TND\nLivraison 10 jours"}]},
        "risk": {
            "rfq": {"title": "Office chairs", "items": [{"name": "Office chair", "quantity": 500}], "delivery_deadline_days": 15},
            "supplier_matches": [],
            "quote_comparisons": [],
            "delivery": {"promised_days": 20},
            "invoices": [{"invoice_number": "INV-001", "amount": 12000, "quote_total": 11000, "po_reference": "PO-100", "supplier_is_new": False, "bank_account_changed": False, "duplicate_invoice": False}],
        },
        "negotiate": {
            "rfq": {"title": "Office chairs", "items": [{"name": "Office chair", "quantity": 500}], "currency": "TND"},
            "supplier_matches": [],
            "quote_comparisons": [],
        },
        "analytics": {"question": "How much did we spend on packaging last year?", "question_fr": "Combien avons-nous depense en emballage l'annee derniere ?"},
        "erp": {
            "action": "create_po",
            "rfq": {"title": "Office chairs", "items": [{"name": "Office chair", "quantity": 500}], "currency": "TND"},
            "supplier": {"name": "Tunis Office Solutions", "categories": ["office furniture"], "contacts": {"emails": ["contact@tunisoffice.tn"]}},
            "quotes": [{"supplier_name": "Tunis Office Solutions", "total_amount": 11000, "currency": "TND", "lines": [{"description": "Chaise bureau ergonomique", "quantity": 500, "unit_price": 22}]}],
            "provider": "odoo",
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
async def compare_quotes_endpoint(payload: dict[str, Any]):
    try:
        rfq = payload.get("rfq") or {}
        quotes = payload.get("quotes") or []
        return {"comparisons": engine.compare_quotes(rfq, quotes)}
    except Exception as exc:
        logger.exception("compare quotes failed")
        return {"comparisons": [], "error": str(exc)}


@app.post("/api/ai/risk")
async def assess_risk(payload: dict[str, Any]):
    return engine.assess_risk(
        rfq_payload=payload.get("rfq") or {},
        supplier_matches=payload.get("supplier_matches") or [],
        quote_comparisons=payload.get("quote_comparisons") or [],
        delivery=payload.get("delivery") or {},
        invoices=payload.get("invoices") or [],
    )


@app.post("/api/ai/negotiate")
async def negotiate(payload: dict[str, Any]):
    rfq = payload.get("rfq") or {}
    supplier_matches = payload.get("supplier_matches") or []
    quote_comparisons = payload.get("quote_comparisons") or []
    return engine.analyze_negotiation(rfq, supplier_matches, quote_comparisons)


@app.post("/api/ai/negotiate/best-offer")
async def negotiate_best_offer(payload: dict[str, Any]):
    rfq = payload.get("rfq") or {}
    quote_comparisons = payload.get("quote_comparisons") or []
    supplier_matches = payload.get("supplier_matches") or []
    return engine.select_best_offer(rfq, quote_comparisons, supplier_matches)


@app.post("/api/ai/analytics/query")
async def analytics_query(payload: dict[str, Any]):
    question = payload.get("question") or payload.get("query") or ""
    if not question:
        return {"error": "question is required"}
    return engine.analytics_query(question)


@app.get("/api/ai/analytics/dashboard")
async def analytics_dashboard():
    return engine.dashboard()


@app.get("/api/ai/analytics/forecast")
async def spend_forecast():
    from ai_engine.analytics import get_spend_forecast
    return get_spend_forecast(engine.db.path)


@app.get("/api/ai/analytics/buyer-performance")
async def buyer_performance():
    from ai_engine.analytics import get_buyer_performance
    return get_buyer_performance(engine.db.path)


@app.post("/api/ai/analytics/market-benchmarks")
async def market_benchmarks(payload: dict[str, Any]):
    from ai_engine.analytics import get_market_benchmarks
    query = payload.get("query", "")
    return get_market_benchmarks(engine.db.path, query)


@app.get("/api/ai/erp/providers")
async def erp_providers():
    from ai_engine.erp import erp_provider_status
    return erp_provider_status()


@app.post("/api/ai/erp/sync-supplier")
async def erp_sync_supplier(payload: dict[str, Any]):
    supplier = payload.get("supplier") or {}
    provider = payload.get("provider") or "odoo"
    return engine.erp_sync_supplier(supplier, provider)


@app.post("/api/ai/erp/create-po")
async def erp_create_po(payload: dict[str, Any]):
    rfq = payload.get("rfq") or {}
    supplier = payload.get("supplier") or {}
    quotes = payload.get("quotes") or []
    provider = payload.get("provider") or "odoo"
    return engine.erp_create_po(rfq, supplier, quotes, provider)


@app.post("/api/ai/erp/sync-inventory")
async def erp_sync_inventory(payload: dict[str, Any]):
    rfq = payload.get("rfq") or {}
    return engine.erp_sync_inventory(rfq)


@app.post("/api/ai/workflow")
async def run_workflow(payload: dict[str, Any]):
    try:
        image_payload = payload.get("image")
        pdf_payload = payload.get("pdf")
        workflow_payload = dict(payload)
        if image_payload or pdf_payload:
            raw = image_payload or pdf_payload
            if isinstance(raw, str):
                content = __import__("base64").b64decode(raw)
                filename = "upload.png" if image_payload else "upload.pdf"
                extracted_text = extract_text_from_bytes(content, filename=filename)
                workflow_payload["need_text"] = extracted_text or workflow_payload.get("need_text", "")
        return engine.run_workflow(workflow_payload)
    except Exception as exc:
        logger.exception("workflow failed")
        return {"error": str(exc)}


@app.post("/api/ai/chat")
async def chat_endpoint(payload: dict[str, Any]):
    message = payload.get("message") or ""
    image = payload.get("image")
    pdf = payload.get("pdf")
    mode = payload.get("mode")
    file_info = payload.get("file")
    if file_info and isinstance(file_info, dict):
        file_type = (file_info.get("type") or "").lower()
        file_data = file_info.get("data")
        if file_data:
            if file_type.endswith("pdf"):
                pdf = pdf or file_data
            else:
                image = image or file_data
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
        image_b64 = __import__("base64").b64encode(content).decode("utf-8")
        if filename.lower().endswith(".pdf"):
            result = process_with_rag("", pdf_base64=image_b64)
        else:
            result = process_with_rag("", image_base64=image_b64)
        return {"success": True, "filename": filename, **result}
    except Exception as exc:
        logger.exception("rag process failed")
        return {"success": False, "error": str(exc)}


@app.post("/api/ai/ocr/extract")
async def ocr_extract(file: UploadFile = File(...)):
    try:
        content = await file.read()
        text = extract_text_from_bytes(content, filename=file.filename or "upload")
        return {"text": text, "filename": file.filename}
    except Exception as exc:
        logger.exception("ocr extract failed")
        return {"text": "", "error": str(exc)}


@app.post("/api/ai/shadow-audit")
async def shadow_audit(files: list[UploadFile] = File(default=[])):
    try:
        uploads: list[tuple[str, bytes, str]] = []
        for f in files:
            content = await f.read()
            uploads.append((f.filename or "upload", content, f.content_type or ""))
        if not uploads:
            return {"success": False, "error": "No files uploaded."}
        result = run_shadow_audit(uploads)
        return {"success": True, **result}
    except Exception as exc:
        logger.exception("shadow audit failed")
        return {"success": False, "error": str(exc)}


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
        logger.exception("rag search failed")
        return {"rfq_knowledge": [], "supplier_knowledge": [], "error": str(exc)}


@app.post("/api/ai/rag/add-rfq")
async def rag_add_rfq(payload: dict[str, Any]):
    text = payload.get("text") or ""
    doc_id = payload.get("doc_id") or f"rfq_{time.time()}"
    metadata = payload.get("metadata") or {}
    ok = add_rfq_document(text, metadata, doc_id)
    return {"success": ok, "doc_id": doc_id}


@app.post("/api/ai/rag/add-supplier")
async def rag_add_supplier(payload: dict[str, Any]):
    text = payload.get("text") or ""
    doc_id = payload.get("doc_id") or f"supplier_{time.time()}"
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
        logger.exception("rag stats failed")
        return {"rfq_knowledge": 0, "supplier_knowledge": 0, "error": str(exc)}


@app.post("/api/ai/offers/generate")
async def generate_offer(payload: dict[str, Any]):
    rfq = payload.get("rfq") or {}
    suppliers = payload.get("suppliers") or []
    return engine.generate_offer(rfq, suppliers)


@app.post("/api/ai/offers/counter")
async def counter_offer_endpoint(payload: dict[str, Any]):
    rfq = payload.get("rfq") or {}
    original_offer = payload.get("original_offer") or {}
    supplier = payload.get("supplier") or {}
    return engine.generate_counter_offer(rfq, original_offer, supplier)


@app.post("/api/ai/chat/query")
async def chat_query(payload: dict[str, Any]):
    message = payload.get("message") or ""
    doc_ids = payload.get("doc_ids")
    context = answer_from_documents(message, doc_ids)
    if context.get("context"):
        system_prompt = f"""You are an AI Business Specialist answering questions about procurement documents.
        Use the following context to answer the user's question.
        Context: {context['context'][:2000]}
        Be concise and professional.
        """
        from ai_engine.chatbot import chat_with_groq
        response = chat_with_groq([{"role": "user", "content": message}], system_prompt)
        return {"response": response or "Based on the documents, I found relevant information.", "sources": context.get("sources", [])}
    return {"response": "No relevant documents found for your query.", "sources": []}


@app.websocket("/ws/crawl")
async def crawl_ws(websocket: WebSocket):
    await websocket.accept()
    running = False
    queue: asyncio.Queue = asyncio.Queue()
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

    sender_task = None
    try:
        sender_task = asyncio.ensure_future(sender())
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
                logger.exception("crawl failed")
                queue.put_nowait({"type": "error", "payload": {"message": str(exc)}})
            finally:
                running = False
    except WebSocketDisconnect:
        closed = True
        return
    except Exception as exc:
        logger.exception("crawl ws error")
        try:
            queue.put_nowait({"type": "error", "payload": {"message": str(exc)}})
        except Exception:
            pass
    finally:
        closed = True
        if sender_task:
            sender_task.cancel()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
