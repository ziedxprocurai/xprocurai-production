from __future__ import annotations

import json
import os
import re
from collections import Counter
from datetime import datetime
from statistics import mean
from typing import Any

import requests

from .rfq import tokenize, vectorize


BENCHMARK_PRICES = {
    "office furniture": {"chair": (60, 180), "desk": (150, 500), "bureau": (150, 500)},
    "it hardware": {"laptop": (600, 2500), "ordinateur": (600, 2500), "pc": (400, 2000), "serveur": (2000, 15000)},
    "stationery": {"stylo": (1, 10), "papier": (5, 30), "cahier": (3, 15)},
    "safety equipment": {"casque": (10, 50), "gants": (5, 25)},
    "industrial supplies": {"moteur": (200, 3000), "pompe": (150, 2500), "acier": (1.5, 8)},
}


def _get_groq_client() -> dict[str, Any]:
    api_key = os.getenv("GROQ_API_KEY")
    base_url = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    return {"api_key": api_key, "base_url": base_url, "model": model}


def _llm_negotiate(supplier_name: str, item: str, offered_price: float, currency: str = "TND", quantity: int = 1) -> dict[str, Any]:
    client = _get_groq_client()
    if not client["api_key"]:
        return {}

    prompt = f"""You are a procurement negotiation assistant for a Tunisian public-sector buyer.
Supplier: {supplier_name}
Item: {item}
Quantity: {quantity}
Offered price: {offered_price} {currency}

Your task:
1. Give a market benchmark unit price range for this item in Tunisia (realistic, not estimation).
2. Propose a specific counter-offer price per unit.
3. Propose 2-3 negotiation tactics (e.g., bulk discount, payment term leverage).
4. Give a one-line recommendation on whether to accept, negotiate, or reject.

Return STRICT JSON only:
{{
    "market_range_low": 0,
    "market_range_high": 0,
    "counter_offer": 0,
    "savings_pct": 0,
    "tactics": ["tactic 1", "tactic 2"],
    "recommendation": "accept|negotiate|reject",
    "rationale": "short rationale"
}}
No markdown, no extra text.
"""
    try:
        response = requests.post(
            f"{client['base_url']}/chat/completions",
            headers={"Authorization": f"Bearer {client['api_key']}", "Content-Type": "application/json"},
            json={"model": client["model"], "messages": [{"role": "user", "content": prompt}], "temperature": 0.3, "max_tokens": 512},
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


def _market_benchmark(item_name: str) -> tuple[float, float] | None:
    lowered = item_name.lower()
    for category, items in BENCHMARK_PRICES.items():
        for keyword, (low, high) in items.items():
            if keyword in lowered:
                return (float(low), float(high))
    return None


def analyze_negotiation(
    rfq: dict[str, Any],
    supplier_matches: list[dict[str, Any]] | None = None,
    quote_comparisons: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    supplier_matches = supplier_matches or []
    quote_comparisons = quote_comparisons or []
    items = rfq.get("items") or []
    suggestions: list[dict[str, Any]] = []
    total_offered = 0.0
    total_counter = 0.0
    total_quantity = 0
    currency = rfq.get("currency") or "TND"

    for item in items:
        item_name = item.get("name") or item.get("description") or "item"
        quantity = int(item.get("quantity") or 1)

        matching_quotes: list[dict[str, Any]] = []
        for comp in quote_comparisons:
            comp_item_name = comp.get("quote", {}).get("supplier_name", "")
            matching_quotes.append(comp)

        relevant_quote = None
        supplier_name = "Unknown supplier"
        if quote_comparisons:
            relevant_quote = quote_comparisons[0]["quote"]
            supplier_name = relevant_quote.get("supplier_name", "Unknown")

        unit_price = None
        if relevant_quote and relevant_quote.get("lines"):
            for line in relevant_quote["lines"]:
                if item_name.lower() in (line.get("description") or "").lower() or (line.get("description") or "").lower() in item_name.lower():
                    unit_price = line.get("unit_price")
                    break
        if unit_price is None and relevant_quote and relevant_quote.get("total_amount") and items:
            avg_qty = sum(int(i.get("quantity") or 1) for i in items)
            if avg_qty:
                unit_price = relevant_quote["total_amount"] / avg_qty

        if unit_price is None and supplier_matches:
            for match in supplier_matches[:3]:
                caps = match.get("supplier", {}).get("capabilities", [])
                if any(item_name.lower() in cap.lower() for cap in caps):
                    supplier_name = match.get("supplier", {}).get("name", supplier_name)
                    break

        if unit_price is None:
            continue

        total_offered += unit_price * quantity
        total_quantity += quantity
        llm_suggestion = _llm_negotiate(supplier_name, item_name, unit_price, currency, quantity)
        benchmark = _market_benchmark(item_name)
        market_low = llm_suggestion.get("market_range_low") or (benchmark[0] if benchmark else None)
        market_high = llm_suggestion.get("market_range_high") or (benchmark[1] if benchmark else None)
        counter_offer = llm_suggestion.get("counter_offer")
        if counter_offer is None and benchmark:
            counter_offer = round(benchmark[0] * 1.05, 2)

        if counter_offer is not None:
            total_counter += counter_offer * quantity

        suggestion = {
            "item": item_name,
            "quantity": quantity,
            "supplier": supplier_name,
            "offered_price_per_unit": unit_price,
            "currency": currency,
            "market_range": {"low": market_low, "high": market_high} if benchmark else None,
            "counter_offer": counter_offer,
            "savings_pct": llm_suggestion.get("savings_pct") or (
                round(((unit_price - counter_offer) / unit_price) * 100, 1) if counter_offer and unit_price else 0
            ),
            "tactics": llm_suggestion.get("tactics") or [],
            "recommendation": llm_suggestion.get("recommendation") or "negotiate",
            "rationale": llm_suggestion.get("rationale") or "Benchmark analysis suggests negotiation room.",
        }
        suggestions.append(suggestion)

    potential_savings = total_offered - total_counter if total_offered and total_counter else 0
    overall_recommendation = "accept"
    if suggestions:
        recs = [s["recommendation"] for s in suggestions]
        if recs.count("negotiate") > len(recs) / 2:
            overall_recommendation = "negotiate"
        elif recs.count("reject") > len(recs) / 2:
            overall_recommendation = "reject"

    return {
        "rfq_title": rfq.get("title") or "Procurement",
        "currency": currency,
        "total_items_analyzed": len(suggestions),
        "total_offered_amount": round(total_offered, 2),
        "total_counter_offer_amount": round(total_counter, 2),
        "potential_savings": round(potential_savings, 2),
        "savings_pct": round((potential_savings / total_offered) * 100, 1) if total_offered else 0,
        "overall_recommendation": overall_recommendation,
        "suggestions": suggestions,
        "summary": _build_negotiation_summary(suggestions, overall_recommendation, potential_savings, currency),
    }


def _build_negotiation_summary(suggestions: list[dict[str, Any]], overall_recommendation: str, potential_savings: float, currency: str) -> str:
    if not suggestions:
        return "No price data available for negotiation analysis."
    high = [s for s in suggestions if s["recommendation"] == "negotiate"]
    action = "proceed with current offers" if overall_recommendation == "accept" else "negotiate counter-offers" if overall_recommendation == "negotiate" else "reject and re-tender"
    return (
        f"Analyzed {len(suggestions)} line items. {len(high)} items have negotiation potential "
        f"with estimated savings of {potential_savings:,.2f} {currency} ({round((potential_savings / sum(s['offered_price_per_unit'] * s['quantity'] for s in suggestions)) * 100, 1) if suggestions else 0}%). "
        f"Recommendation: {action}."
    )
