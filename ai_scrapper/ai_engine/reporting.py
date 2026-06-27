from __future__ import annotations

from typing import Any


def generate_report(
    rfq: dict[str, Any],
    supplier_matches: list[dict[str, Any]],
    quote_comparisons: list[dict[str, Any]],
    risk: dict[str, Any],
) -> dict[str, Any]:
    best_supplier = supplier_matches[0] if supplier_matches else None
    best_quote = quote_comparisons[0] if quote_comparisons else None
    return {
        "executive_summary": build_executive_summary(rfq, best_supplier, best_quote, risk),
        "recommended_supplier": best_supplier["supplier"].get("name") if best_supplier else None,
        "recommended_quote_supplier": best_quote["quote"].get("supplier_name") if best_quote else None,
        "key_points": build_key_points(rfq, supplier_matches, quote_comparisons, risk),
        "next_actions": risk.get("recommendations", [])[:5],
        "risk": risk,
    }


def build_executive_summary(
    rfq: dict[str, Any],
    best_supplier: dict[str, Any] | None,
    best_quote: dict[str, Any] | None,
    risk: dict[str, Any],
) -> str:
    title = rfq.get("title") or "Procurement request"
    items = len(rfq.get("items") or [])
    if best_supplier and best_quote:
        supplier_name = best_supplier["supplier"].get("name")
        quote_supplier = best_quote["quote"].get("supplier_name")
        score = best_quote.get("final_score")
        risk_level = risk.get("risk_level")
        return f"{title} covers {items} item(s). Best supplier fit is {supplier_name}; best quote is from {quote_supplier} with score {score}/100. Overall risk is {risk_level}."
    return f"{title} covers {items} item(s). Supplier or quote data is missing; complete the catalog and quote intake before award."


def build_key_points(
    rfq: dict[str, Any],
    supplier_matches: list[dict[str, Any]],
    quote_comparisons: list[dict[str, Any]],
    risk: dict[str, Any],
) -> list[str]:
    points: list[str] = []
    points.append(f"Extracted {len(rfq.get('items') or [])} RFQ item(s) with confidence {float(rfq.get('confidence') or 0):.0%}")
    if supplier_matches:
        points.append(f"Matched {len(supplier_matches)} supplier(s); best fit score is {supplier_matches[0].get('score')}/100")
    if quote_comparisons:
        points.append(f"Compared {len(quote_comparisons)} quote(s); best coverage is {quote_comparisons[0].get('coverage_score') * 100:.0f}%")
    points.append(f"Risk level: {risk.get('risk_level')} ({risk.get('risk_score')}/100)")
    return points
