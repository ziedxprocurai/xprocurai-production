from __future__ import annotations

import base64
from pathlib import Path
from typing import Any

from .analytics import execute_analytics_query, get_dashboard_metrics
from .erp import create_purchase_order, erp_provider_status, sync_inventory_update, sync_supplier_to_erp
from .negotiation import analyze_negotiation
from .ocr import extract_text_from_bytes as _extract_text_from_bytes
from .quotes import compare_quotes, parse_quotes
from .rag import add_rfq_document, init_rag_db
from .reporting import generate_report
from .rfq import RfqItem, RFQ, extract_rfq, extract_rfq_with_llm
from .risk import assess_risk
from .database import ProcurementDatabase
from .schemas import NegotiationResult, PurchaseOrder, to_jsonable
from .suppliers import SupplierStore

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_STORE_PATH = ROOT / "data" / "suppliers.json"
DEFAULT_DB_PATH = ROOT / "data" / "procurement.db"


class ProcurementAIEngine:
    def __init__(self, store_path: str | Path = DEFAULT_STORE_PATH, db_path: str | Path = DEFAULT_DB_PATH):
        self.db = ProcurementDatabase(db_path)
        self.db.seed_suppliers_if_empty()
        self.store = SupplierStore(store_path)
        self._load_suppliers_from_database()
        init_rag_db()

    def _load_suppliers_from_database(self) -> None:
        for profile in self.db.list_suppliers():
            self.store.upsert(profile)

    def extract_rfq(self, text: str, use_llm: bool = False) -> dict[str, Any]:
        rfq = extract_rfq(text, use_llm=use_llm)
        return to_jsonable(rfq)

    def ocr_extract_rfq(self, content: bytes, filename: str, use_llm: bool = False) -> dict[str, Any]:
        text = _extract_text_from_bytes(content, filename)
        if not text:
            return {}
        if use_llm:
            rfq = extract_rfq_with_llm(text)
            if rfq:
                return to_jsonable(rfq)
        rfq = extract_rfq(text, use_llm=False)
        return to_jsonable(rfq)

    def _decode_and_extract_image(self, payload: dict[str, Any]) -> str:
        image_b64 = payload.get("image")
        pdf_b64 = payload.get("pdf")
        filename = payload.get("filename", "upload")
        content = None
        if image_b64:
            if image_b64.startswith("data:"):
                image_b64 = image_b64.split(",", 1)[1]
            content = base64.b64decode(image_b64)
            filename = f"{filename}.png" if "." not in filename else filename
        elif pdf_b64:
            if pdf_b64.startswith("data:"):
                pdf_b64 = pdf_b64.split(",", 1)[1]
            content = base64.b64decode(pdf_b64)
            filename = f"{filename}.pdf" if "." not in filename else filename
        if content is None:
            return ""
        return _extract_text_from_bytes(content, filename)

    def upsert_suppliers(self, suppliers: list[dict[str, Any]]) -> list[dict[str, Any]]:
        profiles = self.store.upsert_many(suppliers)
        self.db.upsert_many_suppliers(profiles)
        return [profile.to_dict() for profile in profiles]

    def list_suppliers(self) -> list[dict[str, Any]]:
        return [profile.to_dict() for profile in self.db.list_suppliers()]

    def match_suppliers(self, rfq_payload: dict[str, Any], top_k: int = 5) -> list[dict[str, Any]]:
        rfq = RFQ(
            title=rfq_payload.get("title") or "Procurement request",
            description=rfq_payload.get("description") or "",
            items=[
            item if isinstance(item, RfqItem) else RfqItem(**item)
            for item in rfq_payload.get("items", [])
        ],
            location=rfq_payload.get("location") or "",
            budget=rfq_payload.get("budget"),
            currency=rfq_payload.get("currency") or "TND",
            delivery_deadline_days=rfq_payload.get("delivery_deadline_days"),
            certifications=rfq_payload.get("certifications") or [],
            cost_center=rfq_payload.get("cost_center") or "",
            urgency=rfq_payload.get("urgency") or "normal",
            raw_text=rfq_payload.get("raw_text") or "",
            extracted_by=rfq_payload.get("extracted_by") or "api",
            confidence=float(rfq_payload.get("confidence") or 0.8),
        )
        return self.store.match(rfq, top_k=top_k)

    def parse_quotes(self, quotes: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [quote.to_dict() for quote in parse_quotes(quotes)]

    def compare_quotes(self, rfq_payload: dict[str, Any], quotes_payload: list[dict[str, Any]]) -> list[dict[str, Any]]:
        rfq = self._rfq_from_payload(rfq_payload)
        quotes = parse_quotes(quotes_payload)
        return compare_quotes(rfq, quotes)

    def assess_risk(
        self,
        rfq_payload: dict[str, Any],
        supplier_matches: list[dict[str, Any]] | None = None,
        quote_comparisons: list[dict[str, Any]] | None = None,
        delivery: dict[str, Any] | None = None,
        invoices: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        return assess_risk(rfq_payload, supplier_matches, quote_comparisons, delivery, invoices)

    def add_suppliers_from_crawl(self, crawl_result: dict[str, Any]) -> list[dict[str, Any]]:
        profiles = self.db.add_suppliers_from_crawl(crawl_result)
        self.store.upsert_many(profiles)
        return [profile.to_dict() for profile in profiles]

    def run_workflow(self, payload: dict[str, Any]) -> dict[str, Any]:
        use_llm = bool(payload.get("use_llm", False))
        text = payload.get("need_text") or payload.get("text") or ""
        if not text and (payload.get("image") or payload.get("pdf")):
            text = self._decode_and_extract_image(payload)
        rfq = extract_rfq(text, use_llm=use_llm)
        rfq_payload = to_jsonable(rfq)

        if payload.get("suppliers"):
            self.upsert_suppliers(payload["suppliers"])

        matches = self.match_suppliers(rfq_payload, top_k=int(payload.get("top_k", 5)))

        quote_comparisons: list[dict[str, Any]] = []
        parsed_quotes: list[dict[str, Any]] = []
        if payload.get("quotes"):
            parsed_quotes = self.parse_quotes(payload["quotes"])
            quote_comparisons = compare_quotes(rfq, parsed_quotes)

        risk = assess_risk(
            rfq_payload,
            supplier_matches=matches,
            quote_comparisons=quote_comparisons,
            delivery=payload.get("delivery") or {},
            invoices=payload.get("invoices") or [],
        )
        rfq_id = self.db.save_rfq(rfq)
        doc_id = f"rfq-{rfq_id}"
        add_rfq_document(
            text=rfq_payload.get("raw_text") or rfq_payload.get("title") or "",
            metadata={
                "rfq_id": rfq_id,
                "title": rfq_payload.get("title", ""),
                "category": (rfq_payload.get("items") or [{}])[0].get("category", ""),
                "created_at": rfq_payload.get("created_at", ""),
            },
            doc_id=doc_id,
        )
        quote_ids: list[str] = []
        comparison_ids: list[str] = []
        for parsed_quote in parsed_quotes:
            quote_ids.append(self.db.save_quote(parsed_quote, rfq_id=rfq_id))
        for index, comparison in enumerate(quote_comparisons):
            quote_id = quote_ids[index] if index < len(quote_ids) else ""
            comparison_ids.append(self.db.save_quote_comparison(comparison, rfq_id=rfq_id, quote_id=quote_id))
        self.db.save_risk(rfq_id, risk, matches, quote_comparisons)
        report = generate_report(rfq_payload, matches, quote_comparisons, risk)
        negotiation = self.analyze_negotiation(rfq_payload, matches, quote_comparisons)
        best_supplier = matches[0]["supplier"] if matches else {}
        best_quote = quote_comparisons[0]["quote"] if quote_comparisons else {}
        erp_po = self.erp_create_po(rfq_payload, best_supplier, [best_quote] if best_quote else [], provider="odoo") if best_supplier and best_quote else {}
        return {
            "rfq": rfq_payload,
            "supplier_matches": matches,
            "parsed_quotes": parsed_quotes,
            "quote_comparisons": quote_comparisons,
            "risk": risk,
            "negotiation": negotiation,
            "erp_po": erp_po,
            "report": report,
            "database": {
                "rfq_id": rfq_id,
                "quote_ids": quote_ids,
                "comparison_ids": comparison_ids,
                "suppliers_count": len(self.list_suppliers()),
            },
            "audit": {
                "extracted_by": rfq.extracted_by,
                "supplier_count": len(self.list_suppliers()),
                "quote_count": len(parsed_quotes),
            },
        }

    def erp_create_po(self, rfq: dict[str, Any], supplier: dict[str, Any], quotes: list[dict[str, Any]] | None = None, provider: str = "odoo") -> dict[str, Any]:
        return create_purchase_order(rfq, supplier, quotes, provider)

    def erp_sync_supplier(self, supplier: dict[str, Any], provider: str = "odoo") -> dict[str, Any]:
        return sync_supplier_to_erp(supplier, provider)

    def erp_sync_inventory(self, rfq: dict[str, Any]) -> dict[str, Any]:
        return sync_inventory_update(rfq, self.db.path)

    def analytics_query(self, question: str) -> dict[str, Any]:
        return execute_analytics_query(self.db.path, question)

    def dashboard(self) -> dict[str, Any]:
        return get_dashboard_metrics(self.db.path)

    def analyze_negotiation(self, rfq_payload: dict[str, Any], supplier_matches: list[dict[str, Any]] | None = None, quote_comparisons: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        return analyze_negotiation(rfq_payload, supplier_matches, quote_comparisons)

    def _rfq_from_payload(self, payload: dict[str, Any]) -> RFQ:
        items_data = payload.get("items") or []
        items = [item if isinstance(item, RfqItem) else RfqItem(**item) for item in items_data]
        return RFQ(
            title=payload.get("title") or "Procurement request",
            description=payload.get("description") or "",
            items=items,
            location=payload.get("location") or "",
            budget=payload.get("budget"),
            currency=payload.get("currency") or "TND",
            delivery_deadline_days=payload.get("delivery_deadline_days"),
            certifications=payload.get("certifications") or [],
            cost_center=payload.get("cost_center") or "",
            urgency=payload.get("urgency") or "normal",
            raw_text=payload.get("raw_text") or "",
            extracted_by=payload.get("extracted_by") or "api",
            confidence=float(payload.get("confidence") or 0.8),
        )


    def select_best_offer(
        self,
        rfq_payload: dict[str, Any],
        quote_comparisons: list[dict[str, Any]],
        supplier_matches: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        best_cmp = quote_comparisons[0] if quote_comparisons else {}
        best_quote = best_cmp.get("quote", {})
        supplier_name = best_quote.get("supplier_name") or best_quote.get("supplier", "Unknown")
        supplier_id = best_quote.get("supplier_id") or ""

        match = None
        if supplier_matches:
            for m in supplier_matches:
                sup = m.get("supplier") or {}
                if sup.get("name") == supplier_name or sup.get("id") == supplier_id:
                    match = m
                    break

        supplier = (match or {}).get("supplier") or {}
        contacts = supplier.get("contacts") or {}
        emails = contacts.get("emails") or []
        phones = contacts.get("phones") or []

        negotiation = self.analyze_negotiation(rfq_payload, supplier_matches, quote_comparisons)
        suggestions = negotiation.get("suggestions") or []
        relevant_suggestion = suggestions[0] if suggestions else {}

        decision = {
            "selected_rank": 1,
            "quote_comparison": best_cmp,
            "quote": best_quote,
            "supplier": supplier,
            "match_score": (match or {}).get("score"),
            "final_score": best_cmp.get("final_score"),
            "coverage": best_cmp.get("coverage_score"),
            "price_score": best_cmp.get("price_score"),
            "delivery_score": best_cmp.get("delivery_score"),
            "contacts": {"emails": emails, "phones": phones},
            "negotiation_insight": {
                "offered_per_unit": relevant_suggestion.get("offered_price_per_unit"),
                "counter_offer": relevant_suggestion.get("counter_offer"),
                "savings_pct": relevant_suggestion.get("savings_pct"),
                "market_range": relevant_suggestion.get("market_range"),
                "tactics": relevant_suggestion.get("tactics") or [],
                "recommendation": relevant_suggestion.get("recommendation"),
                "rationale": relevant_suggestion.get("rationale"),
            },
            "rfq": rfq_payload,
        }
        return decision


engine = ProcurementAIEngine()