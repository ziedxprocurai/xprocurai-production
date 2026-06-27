from __future__ import annotations

from statistics import mean
from typing import Any


def level_from_score(score: float) -> str:
    if score >= 75:
        return "high"
    if score >= 45:
        return "medium"
    return "low"


def assess_risk(
    rfq: dict[str, Any],
    supplier_matches: list[dict[str, Any]] | None = None,
    quote_comparisons: list[dict[str, Any]] | None = None,
    delivery: dict[str, Any] | None = None,
    invoices: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    supplier_matches = supplier_matches or []
    quote_comparisons = quote_comparisons or []
    delivery = delivery or {}
    invoices = invoices or []

    flags: list[dict[str, Any]] = []
    recommendations: list[str] = []

    if not rfq.get("items"):
        flags.append({"type": "rfq_incomplete", "severity": "high", "message": "RFQ has no extracted line items"})
        recommendations.append("Clarify the procurement need before launching supplier outreach")

    if rfq.get("delivery_deadline_days") is None:
        flags.append({"type": "missing_delivery_deadline", "severity": "medium", "message": "No delivery deadline was extracted"})
        recommendations.append("Ask the requester to confirm the expected delivery date")

    if supplier_matches:
        best_score = float(supplier_matches[0].get("score") or 0)
        if best_score < 55:
            flags.append({"type": "weak_supplier_fit", "severity": "medium", "message": "Best supplier fit is below 55/100"})
            recommendations.append("Expand the supplier search or refine the category")
    else:
        flags.append({"type": "no_supplier_match", "severity": "high", "message": "No suppliers were matched"})
        recommendations.append("Add suppliers to the catalog before running the workflow")

    if quote_comparisons:
        best_comparison = quote_comparisons[0]
        if best_comparison.get("coverage_score", 0) < 0.7:
            flags.append({"type": "quote_coverage_low", "severity": "medium", "message": "Best quote covers less than 70% of RFQ items"})
            recommendations.append("Request missing line items from the supplier")
        if best_comparison.get("delivery_score", 0) < 50:
            flags.append({"type": "delivery_risk", "severity": "medium", "message": "Best quote delivery score is weak"})
            recommendations.append("Confirm delivery commitments before award")

        totals = [item["quote"].get("total_amount") for item in quote_comparisons if item["quote"].get("total_amount") is not None]
        if len(totals) >= 2:
            avg_total = mean(totals)
            for item in quote_comparisons:
                total = item["quote"].get("total_amount")
                if total and total > avg_total * 1.35:
                    flags.append({"type": "price_outlier", "severity": "medium", "message": f"{item['quote'].get('supplier_name')} is more than 35% above average"})
                    recommendations.append("Ask the supplier to justify the price gap")

    promised_days = delivery.get("promised_days") or delivery.get("delivery_days")
    deadline = rfq.get("delivery_deadline_days")
    if promised_days and deadline and promised_days > deadline:
        flags.append({"type": "late_delivery", "severity": "high", "message": f"Promised delivery {promised_days} days exceeds deadline {deadline} days"})
        recommendations.append("Negotiate delivery or choose another supplier")

    for invoice in invoices:
        fraud_flags = assess_invoice_fraud(invoice)
        flags.extend(fraud_flags)

    score = sum(flag_weight(flag["severity"]) for flag in flags)
    score = min(100, score)
    return {
        "risk_score": score,
        "risk_level": level_from_score(score),
        "flags": flags,
        "recommendations": recommendations or ["Proceed with standard approval workflow"],
        "summary": summarize_risk(flags),
    }


def assess_invoice_fraud(invoice: dict[str, Any]) -> list[dict[str, Any]]:
    flags: list[dict[str, Any]] = []
    amount = float(invoice.get("amount") or 0)
    quote_total = float(invoice.get("quote_total") or 0)
    invoice_number = str(invoice.get("invoice_number") or "").strip()
    po_reference = str(invoice.get("po_reference") or "").strip()
    bank_account_changed = bool(invoice.get("bank_account_changed"))
    supplier_is_new = bool(invoice.get("supplier_is_new"))
    duplicate_invoice = bool(invoice.get("duplicate_invoice"))

    if duplicate_invoice:
        flags.append({"type": "duplicate_invoice", "severity": "high", "message": f"Duplicate invoice number {invoice_number}"})
    if quote_total and amount > quote_total * 2:
        flags.append({"type": "amount_above_quote", "severity": "high", "message": "Invoice amount is more than 2x quote total"})
    if amount >= 1000 and amount == int(amount) and amount % 100 == 0:
        flags.append({"type": "round_amount", "severity": "medium", "message": "Large round-number invoice amount"})
    if bank_account_changed:
        flags.append({"type": "bank_account_changed", "severity": "high", "message": "Supplier bank account changed"})
    if supplier_is_new and amount >= 5000:
        flags.append({"type": "new_supplier_high_amount", "severity": "medium", "message": "New supplier with high invoice amount"})
    if not po_reference:
        flags.append({"type": "missing_po_reference", "severity": "medium", "message": "Invoice has no PO reference"})
    return flags


def flag_weight(severity: str) -> int:
    return {"low": 8, "medium": 18, "high": 30}.get(severity, 10)


def summarize_risk(flags: list[dict[str, Any]]) -> str:
    if not flags:
        return "No major risk detected"
    high = sum(1 for flag in flags if flag["severity"] == "high")
    medium = sum(1 for flag in flags if flag["severity"] == "medium")
    return f"{high} high-risk flag(s), {medium} medium-risk flag(s)"
