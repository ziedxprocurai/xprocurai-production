from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any

import requests


def _get_groq_client() -> dict[str, Any]:
    api_key = os.getenv("GROQ_API_KEY")
    base_url = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    return {"api_key": api_key, "base_url": base_url, "model": model}


def generate_professional_offer(rfq: dict[str, Any], suppliers: list[dict[str, Any]], db_path: str) -> dict[str, Any]:
    items = rfq.get("items") or []
    if not items:
        return {"error": "No items in RFQ to generate offer"}
    offer_lines = []
    total = 0.0
    currency = rfq.get("currency", "TND")
    for item in items:
        item_name = item.get("name") or item.get("description") or "Item"
        quantity = int(item.get("quantity") or 1)
        unit_price = _estimate_unit_price(item_name, quantity)
        line_total = unit_price * quantity
        total += line_total
        offer_lines.append({
            "description": item_name,
            "quantity": quantity,
            "unit_price": unit_price,
            "line_total": round(line_total, 2),
        })
    supplier_name = suppliers[0].get("name") if suppliers else "Market Supplier"
    offer = {
        "offer_id": f"OFF-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "rfq_title": rfq.get("title", "Procurement"),
        "supplier_name": supplier_name,
        "currency": currency,
        "lines": offer_lines,
        "subtotal": round(total, 2),
        "vat_rate": 19,
        "vat_amount": round(total * 0.19, 2),
        "total_amount": round(total * 1.19, 2),
        "delivery_days": rfq.get("delivery_deadline_days", 30),
        "payment_terms": "30 days net",
        "validity_days": 30,
        "generated_at": datetime.utcnow().isoformat(),
    }
    return offer


def _estimate_unit_price(item_name: str, quantity: int) -> float:
    item_lower = item_name.lower()
    benchmarks = {
        "chair": (60, 180),
        "chaise": (60, 180),
        "desk": (150, 500),
        "bureau": (150, 500),
        "laptop": (600, 2500),
        "ordinateur": (600, 2500),
        "serveur": (2000, 15000),
        "papier": (5, 30),
        "stylo": (1, 10),
        "cahier": (3, 15),
    }
    for keyword, (low, high) in benchmarks.items():
        if keyword in item_lower:
            base = (low + high) // 2
            if quantity > 1000:
                base = int(base * 0.85)
            elif quantity > 100:
                base = int(base * 0.92)
            return float(base)
    return 100.0


def generate_counter_offer(rfq: dict[str, Any], original_offer: dict[str, Any], supplier: dict[str, Any]) -> dict[str, Any]:
    items = rfq.get("items") or []
    original_total = original_offer.get("total_amount", 0)
    currency = rfq.get("currency", "TND")
    counter_lines = []
    total_savings = 0.0
    for line in original_offer.get("lines", []):
        unit_price = line.get("unit_price", 0)
        counter_price = unit_price * 0.85
        line_savings = (unit_price - counter_price) * line.get("quantity", 1)
        total_savings += line_savings
        counter_lines.append({
            "description": line.get("description"),
            "quantity": line.get("quantity"),
            "original_price": unit_price,
            "counter_price": round(counter_price, 2),
            "savings": round(line_savings, 2),
        })
    counter_offer = {
        "counter_offer_id": f"COUNTER-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "original_offer": original_offer.get("offer_id"),
        "supplier_name": supplier.get("name") or original_offer.get("supplier_name"),
        "currency": currency,
        "lines": counter_lines,
        "original_total": original_total,
        "counter_total": round(original_total * 0.85, 2),
        "total_savings": round(total_savings, 2),
        "savings_pct": 15.0,
        "negotiation_strategy": [
            "Bulk discount applied",
            "Extended payment terms (45 days)",
            "Volume commitment for future orders",
        ],
        "status": "pending_acceptance",
        "generated_at": datetime.utcnow().isoformat(),
    }
    return counter_offer