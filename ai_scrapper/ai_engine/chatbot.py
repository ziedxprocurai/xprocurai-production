from __future__ import annotations

import base64
import json
import os
from typing import Any

import requests

from .ocr import extract_text_from_bytes
from .rag import add_rfq_document, init_rag_db, search_similar_rfqs, search_similar_suppliers
from .schemas import RfqItem, RFQ, to_jsonable


def get_groq_client() -> dict[str, Any]:
    api_key = os.getenv("GROQ_API_KEY")
    base_url = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    return {"api_key": api_key, "base_url": base_url, "model": model}


def chat_with_groq(messages: list[dict[str, str]], system_prompt: str | None = None) -> str | None:
    client = get_groq_client()
    if not client["api_key"]:
        return None
    payload_messages = []
    if system_prompt:
        payload_messages.append({"role": "system", "content": system_prompt})
    for msg in messages:
        payload_messages.append({"role": msg["role"], "content": msg["content"]})
    try:
        response = requests.post(
            f"{client['base_url']}/chat/completions",
            headers={"Authorization": f"Bearer {client['api_key']}", "Content-Type": "application/json"},
            json={"model": client["model"], "messages": payload_messages, "temperature": 0.7, "max_tokens": 1024},
            timeout=60,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
    except Exception:
        return None


INTENT_KEYWORDS = {
    "check_stock": ["stock", "inventaire", "disponible", "available", "inventory", "fournisseurs disponibles", "liste fournisseurs"],
    "compare_suppliers": ["compare", "comparing", "supplier", "fournisseur", "meilleure offre", "meilleur prix", "best offer", "best price"],
    "analyze_risk": ["risque", "risk", "danger", "fraude", "fraud", "analyser risque"],
    "analytics_spend": ["spend", "spent", "dépens", "budget", "cost", "montant", "total", "combien", "analytics", "dashboard", "dashbord", "graphique", "chart", "visualiser", "comparer", "comparison", "stats", "performances", "performance", "fournisseur", "supplier", "dernier", "année", "month", "mois", "monthly", "trend"],
    "ocr_process": ["upload", "ocr", "scan", "image", "pdf", "document", "fichier", "télécharger"],
}


def detect_intent(text: str, has_file: bool = False) -> str:
    lowered = text.lower()
    if has_file or any(kw in lowered for kw in ["upload", "image", "pdf", "document", "scan", "télécharger", "fichier"]):
        return "ocr_process"
    if any(kw in lowered for kw in ["besoin", "want", "commander", "rfq", "requisition", "je veux", "j'ai besoin", "i need"]) or any(word in lowered for word in ["chaise", "chair", "bureau", "desk", "laptop", "ordinateur", "fourniture", "papeterie"]):
        return "create_requisition"
    for intent, keywords in INTENT_KEYWORDS.items():
        if intent != "ocr_process" and any(kw in lowered for kw in keywords):
            return intent
    return "general"


def format_action_cards(intent: str, result: Any = None, workflow_payload: dict[str, Any] = None) -> dict[str, Any]:
    cards = {
        "create_requisition": {
            "title": "Create Requisition",
            "description": "Start a new procurement request from natural language.",
            "action": "create_rfq",
            "result": result,
        },
        "check_stock": {
            "title": "Check Stock",
            "description": "Check available suppliers in inventory.",
            "action": "check_stock",
            "result": result,
        },
        "compare_suppliers": {
            "title": "Compare Suppliers",
            "description": "Find and rank best matching suppliers.",
            "action": "compare_suppliers",
            "result": result,
        },
        "check_budget": {
            "title": "Check Budget",
            "description": "View budget context for procurement.",
            "action": "check_budget",
            "result": result,
        },
        "analyze_risk": {
            "title": "Risk Analysis",
            "description": "AI-powered risk assessment and fraud detection.",
            "action": "analyze_risk",
            "result": result,
        },
        "ocr_process": {
            "title": "OCR Process",
            "description": "Extracted RFQ from image/PDF document.",
            "action": "create_rfq",
            "result": result,
        },
        "rag_process": {
            "title": "RAG Knowledge",
            "description": "Analyzed document and stored in knowledge base.",
            "action": "rag_query",
            "result": result,
        },
        "analytics_spend": {
            "title": "Spend Analytics",
            "description": "Procurement spend analysis and BI dashboard.",
            "action": "analytics",
            "result": result,
        },
    }
    card = cards.get(intent, {"title": "General Query", "description": "Ask me anything about procurement.", "action": "general", "result": result})
    if workflow_payload:
        card["workflow_payload"] = workflow_payload
    return card


def _decode_base64_content(content_b64: str, default_ext: str) -> tuple[bytes | None, str]:
    if content_b64.startswith("data:"):
        content_b64 = content_b64.split(",", 1)[1]
    try:
        content = base64.b64decode(content_b64)
        if content[:4] == b"\x89PNG":
            default_ext = ".png"
        elif content[:2] == b"\xff\xd8":
            default_ext = ".jpeg"
        elif content[:4] == b"%PDF":
            default_ext = ".pdf"
        return content, f"upload{default_ext}"
    except Exception:
        return None, default_ext


def _analyze_document_with_llm(extracted_text: str, message: str = "") -> dict[str, Any]:
    analysis_prompt = f"""Analyze the following document content and extract structured procurement information.
Extract items, quantities, budget, location, and other relevant details for RFQ creation.

Document content:
{extracted_text[:2000]}

{"User context: " + message if message else ""}

Return JSON with these fields:
{{
    "items": [{{"name": "item name", "quantity": 1, "category": "category", "specs": []}}],
    "budget": null or number,
    "location": "",
    "currency": "TND",
    "delivery_deadline_days": null,
    "certifications": [],
    "urgency": "normal",
    "summary": "Brief summary of document content"
}}
"""
    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {os.getenv('GROQ_API_KEY')}", "Content-Type": "application/json"},
            json={"model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"), "messages": [{"role": "user", "content": analysis_prompt}], "temperature": 0.3},
            timeout=60,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        start = content.find("{")
        end = content.rfind("}") + 1
        if start != -1 and end > start:
            return json.loads(content[start:end])
    except Exception:
        pass
    return {}


def process_with_rag(
    message: str,
    image_base64: str | None = None,
    pdf_base64: str | None = None,
    filename: str = "upload",
    ai_engine: Any = None,
) -> dict[str, Any]:
    from .orchestrator import engine as default_engine

    ai_engine = ai_engine or default_engine
    init_rag_db()

    image_content, image_filename = None, filename
    pdf_content, pdf_filename = None, filename

    if image_base64:
        image_content, image_filename = _decode_base64_content(image_base64, ".png")
    elif pdf_base64:
        pdf_content, pdf_filename = _decode_base64_content(pdf_b64, ".pdf")

    content = image_content or pdf_content
    actual_filename = image_filename if image_content else pdf_filename

    if not content:
        return {"intent": "rag_process", "response": "No valid image or PDF content provided.", "action_card": format_action_cards("ocr_process")}

    extracted_text = extract_text_from_bytes(content, actual_filename)
    vision_fallback = False
    vision_result = None
    if not extracted_text:
        return {"intent": "rag_process", "response": "Could not extract text from the uploaded document.", "action_card": format_action_cards("ocr_process")}
    if extracted_text.startswith("[EMPTY_OCR]"):
        if image_base64:
            image_base64_clean = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
            vision_result = _extract_text_with_vision(image_base64_clean, message, filename=filename)
            if vision_result and not vision_result.get("_error"):
                vision_fallback = True
                extracted_text = vision_result.get("raw_text") or ""
                if not extracted_text:
                    return {"intent": "rag_process", "response": "Vision model could not read any text from the image.", "action_card": format_action_cards("ocr_process")}
            else:
                err_msg = "Unknown vision error"
                if vision_result and vision_result.get("_error"):
                    err_msg = f"Vision failed ({vision_result.get('_error')})"
                return {"intent": "rag_process", "response": f"OCR produced no text and vision fallback failed. {err_msg}.", "action_card": format_action_cards("ocr_process")}
        else:
            return {"intent": "rag_process", "response": "OCR produced no text for this PDF.", "action_card": format_action_cards("ocr_process")}

    llm_analysis = _analyze_document_with_llm(extracted_text, message)
    if vision_fallback and vision_result:
        llm_analysis = vision_result

    rfq = None
    if llm_analysis.get("items"):
        items = [RfqItem(**item) if isinstance(item, dict) else item for item in llm_analysis.get("items", [])]
        rfq = RFQ(
            title=llm_analysis.get("summary") or "Document Analysis",
            description=extracted_text[:500],
            items=items,
            location=llm_analysis.get("location", ""),
            budget=llm_analysis.get("budget"),
            currency=llm_analysis.get("currency", "TND"),
            delivery_deadline_days=llm_analysis.get("delivery_deadline_days"),
            certifications=llm_analysis.get("certifications", []),
            urgency=llm_analysis.get("urgency", "normal"),
            raw_text=extracted_text,
            extracted_by="rag-analyzed",
            confidence=0.9,
        )
        rfq = to_jsonable(rfq)

    doc_id = f"rag-{abs(hash(extracted_text[:100])) % 100000}"
    add_rfq_document(
        text=f"{llm_analysis.get('summary', '')}\n\n{extracted_text}",
        metadata={
            "doc_type": "rag_knowledge",
            "filename": actual_filename,
            "analysis": str(llm_analysis.get("items", [])),
            "budget": llm_analysis.get("budget"),
            "location": llm_analysis.get("location", ""),
            "item_count": len(llm_analysis.get("items", [])),
        },
        doc_id=doc_id,
    )

    similar_rag_docs = search_similar_rfqs(extracted_text[:500], top_k=5)

    response_parts = []
    if llm_analysis.get("items"):
        item_names = [item.get("name", "unknown") for item in llm_analysis.get("items", [])]
        response_parts.append(f"I've analyzed the document and extracted {len(item_names)} item(s): {', '.join(item_names[:3])}")
    else:
        response_parts.append("I've analyzed the document content and stored it in the knowledge base.")
        if vision_fallback:
            response_parts.append("(Used vision model because OCR was empty.)")

    if llm_analysis.get("budget"):
        response_parts.append(f"Detected budget: {llm_analysis.get('budget')} {llm_analysis.get('currency', 'TND')}.")

    if llm_analysis.get("location"):
        response_parts.append(f"Location: {llm_analysis.get('location')}.")

    if similar_rag_docs:
        response_parts.append(f"Found {len(similar_rag_docs)} related documents in knowledge base.")

    result = {
        "extracted_text": extracted_text,
        "llm_analysis": llm_analysis,
        "rfq": rfq,
        "similar_documents": similar_rag_docs,
    }

    card = format_action_cards("rag_process", result, {"need_text": extracted_text, "top_k": 5})
    if rfq:
        card["workflow_payload"]["rfq_data"] = rfq

    return {"intent": "rag_process", "response": " ".join(response_parts), "action_card": card, "extracted_text": extracted_text, "llm_analysis": llm_analysis, "rfq": rfq, "rag_context": {"similar_documents": similar_rag_docs}}


def _extract_text_with_vision(image_base64: str, message: str = "", filename: str = "upload") -> dict | None:
    try:
        client = get_groq_client()
        if not client["api_key"]:
            return {"_error": "no_api_key"}
        vision_model = os.getenv("GROQ_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")
        system_prompt = """You are an OCR and document analysis assistant for a procurement platform.
Extract all text from the image verbatim. If it looks like a purchase requisition or RFQ, also structure it as JSON:
{
  "title": "document title or subject",
  "items": [{"name": "item", "quantity": number, "category": "category"}],
  "budget": number or null,
  "location": "city or country",
  "currency": "TND",
  "delivery_deadline_days": number or null,
  "certifications": [],
  "urgency": "normal",
  "summary": "brief summary"
}
If no JSON is possible, just return the raw text."""
        image_b64 = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
        mime = "image/jpeg"
        if image_base64.startswith("data:"):
            mime = image_base64.split(";")[0].split(":", 1)[1]
        else:
            lower = filename.lower()
            if lower.endswith(".png"):
                mime = "image/png"
            elif lower.endswith(".webp"):
                mime = "image/webp"
        payload = {
            "model": vision_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": [
                    {"type": "text", "text": message or "Extract all text from this image and convert to RFQ if possible."},
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_b64}"}}
                ]}
            ],
            "temperature": 0.3,
            "max_tokens": 2048,
        }
        response = requests.post(
            f"{client['base_url']}/chat/completions",
            headers={"Authorization": f"Bearer {client['api_key']}", "Content-Type": "application/json"},
            json=payload,
            timeout=180,
        )
        response.raise_for_status()
        body = response.json()
        choices = body.get("choices") or []
        if choices:
            content = choices[0]["message"]["content"]
        else:
            content = ""
        start = content.find("{")
        end = content.rfind("}") + 1
        if start != -1 and end > start:
            try:
                parsed = json.loads(content[start:end])
                if isinstance(parsed, dict):
                    parsed["raw_text"] = parsed.get("raw_text") or content
                    return parsed
            except Exception:
                pass
        if content and content.strip():
            return {"raw_text": content.strip()}
        return {"_error": "empty_response"}
    except Exception as exc:
        return {"_error": f"{type(exc).__name__}: {str(exc)[:200]}"}


def process_chat_with_image(
    message: str,
    image_base64: str | None = None,
    pdf_base64: str | None = None,
    filename: str = "upload",
    ai_engine: Any = None,
) -> dict[str, Any]:
    from .orchestrator import engine as default_engine

    ai_engine = ai_engine or default_engine
    init_rag_db()

    image_content, image_filename = None, filename
    pdf_content, pdf_filename = None, filename

    if image_base64:
        image_content, image_filename = _decode_base64_content(image_base64, ".png")
    elif pdf_base64:
        pdf_content, pdf_filename = _decode_base64_content(pdf_base64, ".pdf")

    content = image_content or pdf_content
    actual_filename = image_filename if image_content else pdf_filename

    if not content:
        return {"intent": "ocr_process", "response": "No valid image or PDF content provided.", "action_card": format_action_cards("ocr_process")}

    extracted_text = extract_text_from_bytes(content, actual_filename)
    vision_fallback = False
    vision_result = None
    if not extracted_text:
        return {"intent": "ocr_process", "response": "Could not extract text from the uploaded document.", "action_card": format_action_cards("ocr_process")}
    if extracted_text.startswith("[EMPTY_OCR]"):
        if image_base64:
            image_base64_clean = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
            vision_result = _extract_text_with_vision(image_base64_clean, message, filename=filename)
            if vision_result and not vision_result.get("_error"):
                vision_fallback = True
                extracted_text = vision_result.get("raw_text") or ""
                if not extracted_text:
                    return {"intent": "ocr_process", "response": "Vision model could not read any text from the image.", "action_card": format_action_cards("ocr_process")}
            else:
                err_msg = "Unknown vision error"
                if vision_result and vision_result.get("_error"):
                    err_msg = f"Vision failed ({vision_result.get('_error')})"
                return {"intent": "ocr_process", "response": f"OCR produced no text and vision fallback failed. {err_msg}.", "action_card": format_action_cards("ocr_process")}
        else:
            return {"intent": "ocr_process", "response": "OCR produced no text for this PDF.", "action_card": format_action_cards("ocr_process")}

    llm_analysis = _analyze_document_with_llm(extracted_text, message)
    if vision_fallback and vision_result:
        llm_analysis = vision_result

    rfq = None
    if llm_analysis.get("items"):
        items = [RfqItem(**item) if isinstance(item, dict) else item for item in llm_analysis.get("items", [])]
        rfq = RFQ(
            title=llm_analysis.get("summary") or "Procurement from Document",
            description=extracted_text[:500],
            items=items,
            location=llm_analysis.get("location", ""),
            budget=llm_analysis.get("budget"),
            currency=llm_analysis.get("currency", "TND"),
            delivery_deadline_days=llm_analysis.get("delivery_deadline_days"),
            certifications=llm_analysis.get("certifications", []),
            urgency=llm_analysis.get("urgency", "normal"),
            raw_text=extracted_text,
            extracted_by="ocr-llm",
            confidence=0.85,
        )
        rfq = to_jsonable(rfq)
    else:
        rfq = ai_engine.extract_rfq(extracted_text, use_llm=False)

    ocr_doc_id = f"ocr-raw-{abs(hash(extracted_text)) % 1000000}"
    add_rfq_document(
        text=extracted_text,
        metadata={
            "doc_type": "ocr_raw",
            "filename": actual_filename,
            "extracted_by": "ocr",
        },
        doc_id=ocr_doc_id,
    )

    analyzed_content = f"{llm_analysis.get('summary', 'RFQ from document')}\n\nItems: {', '.join(item.get('name', '') for item in llm_analysis.get('items', []))}"
    analyzed_doc_id = f"ocr-analyzed-{abs(hash(analyzed_content)) % 1000000}"
    add_rfq_document(
        text=analyzed_content,
        metadata={
            "doc_type": "ocr_analyzed",
            "filename": actual_filename,
            "items": str(llm_analysis.get("items", [])),
            "budget": llm_analysis.get("budget"),
            "location": llm_analysis.get("location", ""),
        },
        doc_id=analyzed_doc_id,
    )

    query_text = rfq.get("raw_text", "") or rfq.get("title", "") or extracted_text
    rag_context = {
        "similar_rfqs": search_similar_rfqs(query_text, top_k=5),
        "similar_suppliers": search_similar_suppliers(query_text, top_k=5),
    }

    supplier_count = len(ai_engine.list_suppliers())
    context = {
        "supplier_count": supplier_count,
        "extracted_text": extracted_text,
        "rag_context": rag_context,
    }

    system_prompt = f"""You are an AI Copilot for a procurement platform.
Respond conversationally in French/English mix based on user language.
Context: {context['supplier_count']} suppliers in database.

Extracted text from document:
{extracted_text[:500]}{'...' if len(extracted_text) > 500 else ''}

Similar historical RFQs:
{format_rag_results(rag_context.get('similar_rfqs', []), 'RFQ')}

Similar suppliers:
{format_rag_results(rag_context.get('similar_suppliers', []), 'Supplier')}

User message: {message or '(none)'}

Be helpful, concise, and suggest relevant actions.
"""

    llm_response = chat_with_groq([{"role": "user", "content": extracted_text}], system_prompt)

    items = rfq.get("items") or []
    first_item = items[0] if items else {}

    result = {
        "extracted_text": extracted_text,
        "rfq": rfq,
        "rag_context": rag_context,
    }

    response = f"I've extracted text from your document and created a requisition: {rfq.get('title', 'Procurement')}. "
    if vision_fallback:
        response += "(Used vision model because OCR was empty.) "
    if first_item.get("name"):
        response += f"Found {first_item.get('name')} with {first_item.get('quantity', 'N/A')} quantity. "
    if rag_context.get("similar_rfqs"):
        response += f"Found {len(rag_context['similar_rfqs'])} similar historical RFQs."

    card = format_action_cards("ocr_process", result, {"need_text": extracted_text, "top_k": 5})
    if llm_response:
        card["llm_response"] = llm_response

    return {"intent": "ocr_process", "response": response, "action_card": card, "extracted_text": extracted_text, "rfq": rfq, "rag_context": rag_context}


def process_chat_message_with_file(
    message: str,
    image_base64: str | None = None,
    pdf_base64: str | None = None,
    filename: str = "upload",
    ai_engine: Any = None,
) -> dict[str, Any]:
    return process_chat_with_image(message, image_base64, pdf_base64, filename, ai_engine)


def format_rag_results(results: list[dict], result_type: str) -> str:
    if not results:
        return "None found."
    lines = []
    for r in results[:3]:
        score = 1 - (r.get("distance") or 0)
        if result_type == "RFQ":
            meta = r.get("metadata", {})
            lines.append(f"- {meta.get('title', 'Untitled')} (score: {score:.2f})")
        else:
            meta = r.get("metadata", {})
            lines.append(f"- {meta.get('name', 'Unknown')} (score: {score:.2f})")
    return "\n".join(lines)


def _format_money(value: float | None, currency: str = "") -> str:
    if value is None:
        return "n/a"
    return f"{float(value):,.2f} {currency}".strip()


def _format_dashboard(data: dict[str, Any]) -> str:
    parts = []
    if "total_spend" in data:
        parts.append(f"Total spend: {_format_money(data['total_spend'], data.get('currency', 'TND'))}")
    if "total_quotes" in data:
        parts.append(f"{data['total_quotes']} quotes processed")
    if "total_suppliers" in data:
        parts.append(f"{data['total_suppliers']} suppliers in catalog")
    if "average_quote_amount" in data and data["average_quote_amount"]:
        parts.append(f"Average quote: {_format_money(data['average_quote_amount'], data.get('currency', 'TND'))}")
    if "top_supplier" in data and data["top_supplier"]:
        parts.append(f"Top supplier: {data['top_supplier'].get('supplier_name', 'n/a')} ({_format_money(data['top_supplier'].get('total'), data.get('currency', 'TND'))})")
    if "average_risk_score" in data and data["average_risk_score"] is not None:
        parts.append(f"Avg risk score: {data['average_risk_score']}/100")
    if "monthly_spend" in data and data["monthly_spend"]:
        parts.append("Monthly trend available")
    return ". ".join(parts) if parts else "Dashboard ready."


def process_chat_message(message: str, ai_engine: Any = None) -> dict[str, Any]:
    from .orchestrator import engine as default_engine
    from .rag import search_similar_rfqs

    ai_engine = ai_engine or default_engine
    intent = detect_intent(message)
    supplier_count = len(ai_engine.list_suppliers())
    context = {
        "supplier_count": supplier_count,
        "budget_context": "Available procurement budget tracking via cost center integration.",
    }

    system_prompt = f"""You are an AI Copilot for a procurement platform.
Respond conversationally in French/English mix based on user language.
Context: {context['supplier_count']} suppliers in database.
Be helpful, concise, and suggest relevant actions.
"""

    if intent == "create_requisition":
        rfq = ai_engine.extract_rfq(message, use_llm=False)
        rag_context = search_similar_rfqs(rfq.get("raw_text") or rfq.get("title") or "", top_k=5)
        card = format_action_cards(intent, rfq, {"need_text": message, "top_k": 5})
        card["rag_context"] = {"similar_rfqs": rag_context}
        card["suggested_prompt"] = "Would you like me to find matching suppliers for this requisition?"
        items = rfq.get("items") or []
        first_item = items[0] if items else {}
        response = f"I've extracted your requisition: {rfq.get('title', 'Procurement')}. "
        response += f"Found {first_item.get('name', 'items')} with {first_item.get('quantity', 'N/A')} quantity. "
        if rag_context:
            response += f"Found {len(rag_context)} similar historical RFQs."
        return {"intent": intent, "response": response, "action_card": card}

    if intent == "check_stock":
        suppliers = ai_engine.list_suppliers()[:10]
        card = format_action_cards(intent, suppliers)
        return {"intent": intent, "response": f"Found {context['supplier_count']} suppliers in the database. Showing top {len(suppliers)}.", "action_card": card}

    if intent == "check_budget":
        card = format_action_cards(intent, {"note": "Budget tracking is integrated with cost centers."})
        return {"intent": intent, "response": "Budget context available for your procurement request.", "action_card": card}

    if intent == "analytics_spend":
        dashboard = ai_engine.dashboard()
        question_lower = message.lower()
        query_result = None
        try:
            query_result = ai_engine.analytics_query(message)
        except Exception:
            query_result = {"error": "Query failed"}

        is_dashboard_request = any(kw in question_lower for kw in ["dashboard", "dashbord", "trend", "monthly", "month", "stats", "graphique", "visualiser", "overview", "summary", "vue d'ensemble", "résumé"])
        if is_dashboard_request:
            data = dashboard
            summary = _format_dashboard(data)
            response = f"Here is your procurement dashboard. {summary}"
            card = format_action_cards(intent, data)
            card["dashboard"] = data
            card["query"] = query_result
            return {"intent": intent, "response": response, "action_card": card, "dashboard_data": data}

        if query_result and "rows" in query_result:
            rows = query_result.get("rows") or []
            row_count = len(rows)
            summary = query_result.get("summary") or f"{row_count} record(s) found."
            first = rows[0] if rows else {}
            response = f"Here is your spend analysis. {summary}"
            card = format_action_cards(intent, query_result)
            card["query"] = query_result
            card["dashboard"] = dashboard
            return {"intent": intent, "response": response, "action_card": card, "dashboard_data": dashboard}

        if query_result and "error" in query_result:
            response = f"I couldn't analyze that query: {query_result['error']}. Try asking: 'How much did we spend?' or 'Which supplier performed best?'"
            return {"intent": intent, "response": response, "action_card": format_action_cards(intent, query_result)}

        response = "Use the analytics tool to see your KPIs."
        return {"intent": intent, "response": response, "action_card": format_action_cards(intent, {"note": "Ask about spend, suppliers, risk, or trends."})}

    if intent == "analyze_risk":
        rfq = ai_engine.extract_rfq(message, use_llm=False)
        risk = ai_engine.assess_risk(rfq)
        card = format_action_cards(intent, risk)
        response = f"Risk assessment: score {risk.get('risk_score', 0)} with {len(risk.get('flags', []))} flags."
        return {"intent": intent, "response": response, "action_card": card}

    if intent == "ocr_process":
        card = format_action_cards(intent, {"note": "Please provide an image or PDF to process."})
        return {"intent": intent, "response": "Please upload an image or PDF document to extract RFQ information.", "action_card": card}

    llm_response = chat_with_groq([{"role": "user", "content": message}], system_prompt)
    if llm_response:
        return {"intent": intent, "response": llm_response, "action_card": format_action_cards(intent)}

    if any(word in message.lower() for word in ["chair", "laptop", "fourniture", "papeterie", "besoin", "demande", "chaise", "bureau"]):
        rfq = ai_engine.extract_rfq(message, use_llm=False)
        rag_context = search_similar_rfqs(rfq.get("raw_text") or rfq.get("title") or "", top_k=5)
        card = format_action_cards("create_requisition", rfq, {"need_text": message, "top_k": 5})
        card["rag_context"] = {"similar_rfqs": rag_context}
        items = rfq.get("items") or []
        first_item = items[0] if items else {}
        response = f"I detected a procurement request: {rfq.get('title', 'Procurement')}. "
        response += f"Found {first_item.get('name', 'items')} with {first_item.get('quantity', 'N/A')} quantity."
        return {"intent": "create_requisition", "response": response, "action_card": card}

    return {"intent": intent, "response": "I can help with procurement. Try: 'How much did we spend last year?', 'Best performing suppliers', 'Create requisition for 500 chairs'.", "action_card": format_action_cards(intent)}
