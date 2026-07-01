from __future__ import annotations

import base64
import json
import os
from typing import Any

import requests

from .ocr import extract_text_from_bytes
from .rag import add_rfq_document, init_rag_db, search_similar_rfqs, search_similar_suppliers, answer_from_documents
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
    "compare_suppliers": ["compare", "comparing", "supplier", "fournisseur", "meilleure offre", "meilleur prix", "best offer", "best price", "matching", "recherche fournisseur"],
    "analyze_risk": ["risque", "risk", "danger", "fraude", "fraud", "analyser risque", "évaluation risque", "risk assessment"],
    "analytics_spend": ["spend", "spent", "dépens", "budget", "cost", "montant", "total", "combien", "analytics", "dashboard", "dashbord", "graphique", "chart", "visualiser", "comparer", "comparison", "stats", "performances", "performance", "fournisseur", "supplier", "dernier", "année", "month", "mois", "monthly", "trend", "prévisions", "forecast", "predictions"],
    "ocr_process": ["upload", "ocr", "scan", "image", "pdf", "document", "fichier", "télécharger"],
    "offer_generation": ["offre", "offer", "devis", "quote", "générer offre", "create offer", "generate quote", "prix", "price"],
    "counter_offer": ["contre-offre", "counter offer", "rester", "accepter", "négocier", "negotiate", "discussion prix"],
    "forecast": ["prévision", "forecast", "prediction", "tendance", "trend", "future spend", "spend future"],
    "supplier_discovery": ["découvrir", "discover", "nouveaux fournisseurs", "new suppliers", "supplier hunt", "find suppliers"],
    "supplier_lookup": ["email", "mail", "contact", "coordonnées", "adresse mail", "phone", "tel", "téléphone", "numero", "numéro", "fournisseur", "supplier", "comment contacter", "how to contact", "coordonnées du", "coordonnees du"],
    "buyer_insights": ["buyer", "acheteur", "performance acheteur", "buyer performance", "analytics buyer"],
    "market_intelligence": ["marché", "market", "intelligence", "benchmark", "prix moyen", "market price"],
}


def detect_intent(text: str, has_file: bool = False) -> str:
    lowered = text.lower()
    if has_file or any(kw in lowered for kw in ["upload", "image", "pdf", "document", "scan", "télécharger", "fichier"]):
        return "ocr_process"
    if any(kw in lowered for kw in ["email", "mail", "contact", "coordonnées", "adresse mail", "phone", "tel", "téléphone", "numero", "numéro", "fournisseur", "supplier", "comment contacter", "how to contact", "coordonnées du", "coordonnees du"]):
        return "supplier_lookup"
    if any(kw in lowered for kw in ["besoin", "want", "commander", "rfq", "requisition", "je veux", "j'ai besoin", "i need", "demande", "demand"]) or any(word in lowered for word in ["chaise", "chair", "bureau", "desk", "laptop", "ordinateur", "fourniture", "papeterie"]):
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
        "offer_generation": {
            "title": "Generate Offer",
            "description": "Create professional supplier offers/quote.",
            "action": "generate_offer",
            "result": result,
        },
        "counter_offer": {
            "title": "Counter Offer",
            "description": "Negotiate prices and terms with suppliers.",
            "action": "counter_offer",
            "result": result,
        },
        "forecast": {
            "title": "Spend Forecast",
            "description": "Predict future procurement trends and spend.",
            "action": "forecast",
            "result": result,
        },
        "supplier_discovery": {
            "title": "Supplier Discovery",
            "description": "Find new suppliers matching your needs.",
            "action": "discover_suppliers",
            "result": result,
        },
        "supplier_lookup": {
            "title": "Supplier Lookup",
            "description": "Find supplier contact details from documents and database.",
            "action": "supplier_lookup",
            "result": result,
        },
        "buyer_insights": {
            "title": "Buyer Insights",
            "description": "Analyze buyer performance and procurement efficiency.",
            "action": "buyer_analytics",
            "result": result,
        },
        "market_intelligence": {
            "title": "Market Intelligence",
            "description": "Get market benchmarks and price intelligence.",
            "action": "market_intel",
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
        pdf_content, pdf_filename = _decode_base64_content(pdf_base64, ".pdf")

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

    query_text = extracted_text[:500]
    similar_rfqs = search_similar_rfqs(query_text, top_k=5)
    similar_suppliers = search_similar_suppliers(query_text, top_k=5)

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

    if similar_rfqs:
        response_parts.append(f"Found {len(similar_rfqs)} related documents in knowledge base.")

    if similar_suppliers:
        response_parts.append(f"Found {len(similar_suppliers)} matching suppliers.")

    system_prompt = f"""You are an AI Business Specialist answering questions about procurement documents.
Use the following context to answer the user's question.
Context: {similar_suppliers if similar_suppliers else 'No supplier matches'} | {similar_rfqs if similar_rfqs else 'No RFQ matches'}
Document summary: {llm_analysis.get('summary', '') or 'N/A'}
Items found: {', '.join(item.get('name', '') for item in llm_analysis.get('items', [])) or 'None'}
Be concise and professional.
"""
    llm_response = chat_with_groq([{"role": "user", "content": message or "Summarize this procurement document and suggest next steps."}], system_prompt)

    result = {
        "extracted_text": extracted_text,
        "llm_analysis": llm_analysis,
        "rfq": rfq,
        "similar_documents": similar_rfqs,
    }

    card = format_action_cards("rag_process", result, {"need_text": extracted_text, "top_k": 5})
    if rfq:
        card["workflow_payload"]["rfq_data"] = rfq
    if llm_response:
        card["llm_response"] = llm_response

    return {"intent": "rag_process", "response": " ".join(response_parts), "action_card": card, "extracted_text": extracted_text, "llm_analysis": llm_analysis, "rfq": rfq, "rag_context": {"similar_documents": similar_rfqs, "similar_suppliers": similar_suppliers}}


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


def _extract_supplier_contacts_from_text(text: str, query: str) -> dict[str, Any] | None:
    import re
    query_words = [w for w in re.findall(r"[a-z0-9]+", query.lower()) if len(w) > 2]

    sections = re.split(r'\f|\n\s*\n', text)
    best_contacts = None
    best_score = -1

    for section in sections:
        lines = section.strip().splitlines()
        supplier_name = None
        email = None
        phone = None
        score = 0

        for line in lines:
            low = line.strip()
            if not low:
                continue
            matched_words = sum(1 for word in query_words if word in low.lower())
            if matched_words > 0:
                score += matched_words
                if re.search(r"(llc|inc|ltd|gmbh|sarl|sa|corp|company|procurement)", low, re.IGNORECASE):
                    if not supplier_name:
                        supplier_name = re.sub(r"\s{2,}", " ", low).strip()[:80]
            if not email:
                m = re.search(r"[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}", low, re.IGNORECASE)
                if m:
                    email = m.group(0)
            if not phone:
                m = re.search(r"(\+\d{1,3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{4}|\+\d{1,3}[\s.-]?\d{2,3}[\s.-]?\d{2,3}[\s.-]?\d{2,3})", low)
                if m:
                    phone = m.group(0)

        if (email or phone) and score > best_score:
            best_score = score
            best_contacts = {
                "name": supplier_name or "Unknown",
                "email": email or "no email",
                "phone": phone or "no phone",
            }

    return best_contacts


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

    extracted_text = ""
    if content:
        extracted_text = extract_text_from_bytes(content, actual_filename)

    if extracted_text:
        ocr_doc_id = f"ocr-raw-{abs(hash(extracted_text)) % 1000000}"
        add_rfq_document(
            text=extracted_text,
            metadata={"doc_type": "ocr_raw", "filename": actual_filename, "extracted_by": "ocr"},
            doc_id=ocr_doc_id,
        )

    msg_intent = detect_intent(message) if message else "ocr_process"
    if msg_intent != "ocr_process" and message:
        if msg_intent == "supplier_lookup":
            query = message.lower()
            doc_contacts = None
            if extracted_text:
                doc_contacts = _extract_supplier_contacts_from_text(extracted_text, query)
            if doc_contacts:
                response = f"Supplier: {doc_contacts['name']}. Email: {doc_contacts['email']}. Phone: {doc_contacts['phone']}."
                card = format_action_cards(msg_intent, [{"name": doc_contacts["name"], "contacts": {"emails": [doc_contacts["email"]], "phones": [doc_contacts["phone"]]}}])
                card["matched_suppliers"] = [{"name": doc_contacts["name"], "contacts": {"emails": [doc_contacts["email"]], "phones": [doc_contacts["phone"]]}}]
                rag_context = {
                    "similar_documents": search_similar_rfqs(message, top_k=5),
                    "similar_suppliers": search_similar_suppliers(message, top_k=5),
                }
                return {
                    "intent": msg_intent,
                    "response": response,
                    "action_card": card,
                    "extracted_text": extracted_text,
                    "rag_context": rag_context,
                }

            matched_suppliers = []
            rag_rfqs = search_similar_rfqs(message, top_k=3)
            for r in rag_rfqs:
                if r.get("distance", 1.0) < 0.75:
                    doc_text = r.get("document", "")
                    contacts = _extract_supplier_contacts_from_text(doc_text, query)
                    if contacts:
                        matched_suppliers.append({
                            "name": contacts["name"],
                            "contacts": {"emails": [contacts["email"]], "phones": [contacts["phone"]]},
                            "source": "rag_rfq",
                            "score": 1.0 - (r.get("distance", 1.0)),
                        })

            if not matched_suppliers:
                rag_suppliers = search_similar_suppliers(message, top_k=5)
                for r in rag_suppliers:
                    if r.get("distance", 1.0) < 0.65:
                        meta = r.get("metadata") or {}
                        matched_suppliers.append({
                            "id": meta.get("supplier_id"),
                            "name": meta.get("name"),
                            "contacts": {"emails": [], "phones": []},
                            "source": "rag_supplier",
                            "score": 1.0 - (r.get("distance", 1.0)),
                        })

            if not matched_suppliers:
                db_suppliers = ai_engine.list_suppliers()
                for sup in db_suppliers:
                    name = (sup.get("name") or "").lower()
                    website = (sup.get("website") or "").lower()
                    if query in name or website in query or any(word in name for word in query.split() if len(word) > 2):
                        matched_suppliers.append(sup)

            if matched_suppliers:
                best = matched_suppliers[0]
                contacts = best.get("contacts") or {}
                emails = contacts.get("emails") or []
                phones = contacts.get("phones") or []
                email_str = ", ".join(emails) if emails else "no email"
                phone_str = ", ".join(phones) if phones else "no phone"
                source = best.get("source", "database")
                response = f"Supplier: {best.get('name')}. Email: {email_str}. Phone: {phone_str}. (source: {source})"
                if len(matched_suppliers) > 1:
                    response += f" Also found {len(matched_suppliers) - 1} other match(es)."
                card = format_action_cards(msg_intent, matched_suppliers[:5])
                card["matched_suppliers"] = matched_suppliers[:5]
                rag_context = {
                    "similar_documents": search_similar_rfqs(message, top_k=5),
                    "similar_suppliers": search_similar_suppliers(message, top_k=5),
                }
                return {
                    "intent": msg_intent,
                    "response": response,
                    "action_card": card,
                    "extracted_text": extracted_text,
                    "rag_context": rag_context,
                }
            response = "I couldn't find that supplier in the document or knowledge base. Try 'supplier discovery' or provide the exact company name."
            return {"intent": msg_intent, "response": response, "action_card": format_action_cards(msg_intent), "extracted_text": extracted_text}
        chat_result = process_chat_message(message, ai_engine=ai_engine)
        chat_result.setdefault("extracted_text", extracted_text)
        if extracted_text:
            chat_result.setdefault("rag_context", {}).update({
                "extracted_document": extracted_text[:500],
                "similar_documents": search_similar_rfqs(extracted_text[:500], top_k=5),
                "similar_suppliers": search_similar_suppliers(extracted_text[:500], top_k=5),
            })
        return chat_result

    if not content:
        return {"intent": "ocr_process", "response": "No valid image or PDF content provided.", "action_card": format_action_cards("ocr_process")}

    if not extracted_text:
        return {"intent": "ocr_process", "response": "Could not extract text from the uploaded document.", "action_card": format_action_cards("ocr_process")}

    vision_fallback = False
    vision_result = None
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
    from .rag import search_similar_rfqs, search_similar_suppliers
    from .analytics import get_spend_forecast, get_buyer_performance, get_market_benchmarks

    ai_engine = ai_engine or default_engine
    intent = detect_intent(message)
    supplier_count = len(ai_engine.list_suppliers())
    context = {
        "supplier_count": supplier_count,
        "budget_context": "Available procurement budget tracking via cost center integration.",
    }

    rag_rfqs = search_similar_rfqs(message, top_k=5)
    rag_suppliers = search_similar_suppliers(message, top_k=5)

    def _format_rag(results: list[dict]) -> str:
        if not results:
            return "None"
        return "\n".join(
            f"- {r.get('metadata', {}).get('name', r.get('metadata', {}).get('title', 'Unknown'))} (dist: {r.get('distance', 0):.4f})"
            for r in results[:5]
        )

    rag_context_block = f"Similar RFQs:\n{_format_rag(rag_rfqs)}\n\nSimilar suppliers:\n{_format_rag(rag_suppliers)}"

    system_prompt = f"""You are an elite Procurement Business Specialist AI Copilot with deep expertise in B2B supply chains, vendor management, and strategic sourcing.
    You operate in both French and English seamlessly. Your expertise spans:
    - Supplier qualification and risk assessment
    - Buyer performance analytics and optimization
    - Market price intelligence and benchmarking
    - Contract negotiation and offer generation
    - Spend forecasting and cost analysis
    - RFQ creation and quote comparison
    - Both buyer (demand side) and supplier (supply side) perspectives

    Knowledge base context (use ONLY if relevant to the user's question):
    {rag_context_block}

    Provide concise, actionable insights with professional tone. Use procurement terminology.
    When analyzing data, provide specific numbers, percentages, and recommendations.
    """

    if intent == "create_requisition":
        rfq = ai_engine.extract_rfq(message, use_llm=False)
        rag_context = {
            "similar_rfqs": search_similar_rfqs(rfq.get("raw_text") or rfq.get("title") or "", top_k=5),
            "similar_suppliers": search_similar_suppliers(rfq.get("raw_text") or rfq.get("title") or "", top_k=5),
        }
        card = format_action_cards(intent, rfq, {"need_text": message, "top_k": 5})
        card["rag_context"] = rag_context
        card["suggested_prompt"] = "Would you like me to find matching suppliers for this requisition?"
        items = rfq.get("items") or []
        first_item = items[0] if items else {}
        response = f"I've extracted your requisition: {rfq.get('title', 'Procurement')}. "
        response += f"Found {first_item.get('name', 'items')} with {first_item.get('quantity', 'N/A')} quantity. "
        if rag_context.get("similar_rfqs"):
            response += f"Found {len(rag_context['similar_rfqs'])} similar historical RFQs. "
        if rag_context.get("similar_suppliers"):
            response += f"Found {len(rag_context['similar_suppliers'])} matching suppliers."
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

    if intent == "forecast":
        forecast = get_spend_forecast(ai_engine.db.path)
        card = format_action_cards(intent, forecast)
        card["forecast"] = forecast
        response = f"Spend forecast: {forecast.get('predicted_next_month', 0):,.0f} TND expected next month. "
        response += f"Trend: {forecast.get('trend_direction', 'stable')}. "
        response += f"Confidence: {forecast.get('confidence_pct', 0)}%."
        return {"intent": intent, "response": response, "action_card": card, "forecast_data": forecast}

    if intent == "buyer_insights":
        buyer_perf = get_buyer_performance(ai_engine.db.path)
        card = format_action_cards(intent, buyer_perf)
        card["buyer_analytics"] = buyer_perf
        response = f"Buyer performance analysis: {buyer_perf.get('total_buyers', 0)} buyers tracked. "
        if buyer_perf.get('top_performer'):
            response += f"Top performer: {buyer_perf.get('top_performer', {}).get('name', 'n/a')}."
        return {"intent": intent, "response": response, "action_card": card, "buyer_data": buyer_perf}

    if intent == "market_intelligence":
        benchmarks = get_market_benchmarks(ai_engine.db.path, message)
        card = format_action_cards(intent, benchmarks)
        card["market_intel"] = benchmarks
        if benchmarks.get('items'):
            response = f"Market benchmarks: {len(benchmarks.get('items', []))} items found. "
            for item in benchmarks.get('items', [])[:3]:
                response += f"{item.get('name')}: {item.get('benchmark_low', 0)}-{item.get('benchmark_high', 0)} TND/unit. "
        else:
            response = "No market benchmarks available for this item category."
        return {"intent": intent, "response": response, "action_card": card, "market_data": benchmarks}

    if intent == "offer_generation":
        rfq = ai_engine.extract_rfq(message, use_llm=False)
        card = format_action_cards(intent, rfq, {"need_text": message})
        card["suggested_prompt"] = "Would you like me to generate a professional quote for this requirement?"
        items = rfq.get("items") or []
        response = f"Ready to generate offer for: {rfq.get('title', 'Procurement')}. "
        if items:
            response += f"Items: {', '.join(i.get('name', '') for i in items[:3])}."
        return {"intent": intent, "response": response, "action_card": card}

    if intent == "counter_offer":
        rfq = ai_engine.extract_rfq(message, use_llm=False)
        negotiation = ai_engine.analyze_negotiation(rfq)
        card = format_action_cards(intent, negotiation)
        card["negotiation"] = negotiation
        response = f"Counter-offer analysis: {negotiation.get('overall_recommendation', 'negotiate')}. "
        response += f"Potential savings: {negotiation.get('potential_savings', 0):,.0f} TND ({negotiation.get('savings_pct', 0)}%)."
        return {"intent": intent, "response": response, "action_card": card, "negotiation_data": negotiation}

    if intent == "supplier_discovery":
        suppliers = ai_engine.list_suppliers()[:10]
        card = format_action_cards(intent, suppliers)
        response = f"Found {context['supplier_count']} suppliers in database. Showing top performers."
        return {"intent": intent, "response": response, "action_card": card}

    if intent == "supplier_lookup":
        query = message.lower()
        matched_suppliers = []

        rag_rfqs = search_similar_rfqs(message, top_k=3)
        for r in rag_rfqs:
            if r.get("distance", 1.0) < 0.75:
                doc_text = r.get("document", "")
                contacts = _extract_supplier_contacts_from_text(doc_text, query)
                if contacts:
                    matched_suppliers.append({
                        "name": contacts["name"],
                        "contacts": {"emails": [contacts["email"]], "phones": [contacts["phone"]]},
                        "source": "rag_rfq",
                        "score": 1.0 - (r.get("distance", 1.0)),
                    })

        if not matched_suppliers:
            rag_suppliers = search_similar_suppliers(message, top_k=5)
            for r in rag_suppliers:
                if r.get("distance", 1.0) < 0.65:
                    meta = r.get("metadata") or {}
                    matched_suppliers.append({
                        "id": meta.get("supplier_id"),
                        "name": meta.get("name"),
                        "contacts": {"emails": [], "phones": []},
                        "source": "rag_supplier",
                        "score": 1.0 - (r.get("distance", 1.0)),
                    })

        if not matched_suppliers:
            db_suppliers = ai_engine.list_suppliers()
            for sup in db_suppliers:
                name = (sup.get("name") or "").lower()
                website = (sup.get("website") or "").lower()
                if query in name or website in query or any(word in name for word in query.split() if len(word) > 2):
                    matched_suppliers.append(sup)

        if matched_suppliers:
            best = matched_suppliers[0]
            contacts = best.get("contacts") or {}
            emails = contacts.get("emails") or []
            phones = contacts.get("phones") or []
            email_str = ", ".join(emails) if emails else "no email"
            phone_str = ", ".join(phones) if phones else "no phone"
            source = best.get("source", "database")
            response = f"Supplier: {best.get('name')}. Email: {email_str}. Phone: {phone_str}. (source: {source})"
            if len(matched_suppliers) > 1:
                response += f" Also found {len(matched_suppliers) - 1} other match(es)."
            card = format_action_cards(intent, matched_suppliers[:5])
            card["matched_suppliers"] = matched_suppliers[:5]
            return {"intent": intent, "response": response, "action_card": card}

        rag_rfqs = search_similar_rfqs(message, top_k=5)
        rag_suppliers = search_similar_suppliers(message, top_k=5)
        context_parts = []
        for r in rag_rfqs:
            doc = r.get("document", "")
            if doc and doc not in context_parts:
                context_parts.append(doc)
        for r in rag_suppliers:
            doc = r.get("document", "")
            if doc and doc not in context_parts:
                context_parts.append(doc)
        context = "\n\n".join(context_parts[:5])
        if context:
            system_prompt = f"""You are a procurement assistant. Answer the user's question using ONLY the following document excerpts from the knowledge base. If the answer is not in the excerpts, say you don't know.
Documents:
{context}"""
            llm_response = chat_with_groq([{"role": "user", "content": message}], system_prompt)
            if llm_response:
                card = format_action_cards(intent, {"llm_answer": llm_response})
                card["rag_context"] = {"similar_rfqs": rag_rfqs, "similar_suppliers": rag_suppliers}
                return {"intent": intent, "response": llm_response, "action_card": card}

        response = "I couldn't find that supplier in the knowledge base or database. Try 'supplier discovery' or provide the exact company name."
        return {"intent": intent, "response": response, "action_card": format_action_cards(intent)}

    llm_response = chat_with_groq([{"role": "user", "content": message}], system_prompt)
    if llm_response:
        return {"intent": intent, "response": llm_response, "action_card": format_action_cards(intent)}

    if any(word in message.lower() for word in ["chair", "laptop", "fourniture", "papeterie", "besoin", "demande", "chaise", "bureau"]):
        rfq = ai_engine.extract_rfq(message, use_llm=False)
        rag_context = {
            "similar_rfqs": search_similar_rfqs(rfq.get("raw_text") or rfq.get("title") or "", top_k=5),
            "similar_suppliers": search_similar_suppliers(rfq.get("raw_text") or rfq.get("title") or "", top_k=5),
        }
        card = format_action_cards("create_requisition", rfq, {"need_text": message, "top_k": 5})
        card["rag_context"] = rag_context
        items = rfq.get("items") or []
        first_item = items[0] if items else {}
        response = f"I detected a procurement request: {rfq.get('title', 'Procurement')}. "
        response += f"Found {first_item.get('name', 'items')} with {first_item.get('quantity', 'N/A')} quantity."
        if rag_context.get("similar_suppliers"):
            response += f" Also found {len(rag_context['similar_suppliers'])} matching suppliers."
        return {"intent": "create_requisition", "response": response, "action_card": card}

    return {"intent": intent, "response": "I can help with procurement. Try: 'Forecast next quarter spend?', 'Buyer performance report?', 'Generate offer for 500 laptops?', 'What's the market price for office chairs?'.", "action_card": format_action_cards(intent)}
