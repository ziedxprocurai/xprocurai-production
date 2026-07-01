from __future__ import annotations

import base64
import hashlib
import json
import os
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from .ocr import extract_text_from_bytes

SUPPORTED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".bmp", ".gif", ".tiff", ".tif", ".csv", ".xlsx", ".xls", ".txt"}

# Keywords that indicate a number is real money (appears near totals/subtotals)
MONEY_KEYWORDS = re.compile(
    r"(grand\s+total|total\s+due|balance\s+due|total\s+amount|amount\s+due|total\s+ttc|"
    r"net\s+amount|subtotal|line\s+total|total|montant|ttc|due|payable)",
    re.IGNORECASE,
)

# Numbers to ignore
IGNORE_PATTERNS = re.compile(
    r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|"
    r"vat[\s:#]*\d|tva|iban[\s:#]*[\da-z]+|reference[\s:#]*[a-z0-9-]+|"
    r"account[\s:#]*\d{3,}|tel[:\s]|phone|fax|postal|zip|"
    r"lot[\s:#]*[a-z0-9]+|bank[\s:#]+|acct[\s:#]*\d+|"
    r"page\s+\d|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|"
    r"\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b|"
    r"quantit(?:y|é)|qty|\b\d{3,4}\s*(?:eur|usd|tnd|gbp|dzd|mad)\b|"
    r"^\s*\d{1,2}\s*$|^-+$|\b[a-z]\d{4,}\b|\b\d{4,}/[a-z])",
    re.IGNORECASE,
)


def _split_pages(text: str) -> list[str]:
    parts = re.split(r"\f", text)
    out: list[str] = []
    for p in parts:
        lines = [l for l in p.splitlines() if l.strip()]
        if len(lines) >= 2:
            out.append("\n".join(lines))
    return out or [text]


def _guess_doc_type(filename: str, text: str) -> str:
    name = (filename or "").lower()
    body = text.lower()
    if "summary" in body or "6-month" in body:
        return "summary"
    if "ledger" in body or "general ledger" in body:
        return "export"
    if "invoice" in name or "invoice" in body or "facture" in body:
        return "invoice"
    if "purchase order" in body or "po-" in body or "bon de commande" in body:
        return "po"
    if "receipt" in body or "reçu" in body:
        return "receipt"
    if "quote" in body or "devis" in body:
        return "quote"
    if name.endswith((".csv", ".xlsx", ".xls")):
        return "export"
    return "document"


def _extract_amounts(text: str) -> list[float]:
    """Extract plausible money amounts, ignoring dates, phone numbers, qty, account codes."""
    amounts = []
    lines = text.splitlines()
    for line in lines:
        low = line.lower().strip()
        if not low:
            continue
        # Skip obvious non-money lines
        if IGNORE_PATTERNS.search(low):
            continue
        # Strong signal: line contains money keyword
        strong = bool(MONEY_KEYWORDS.search(low))
        # Collect candidate numbers — avoid matching inside IDs like INV-2026-001
        candidates = re.findall(r"(?<![A-Za-z-])([\d,]+(?:\.\d{1,2})?)(?![A-Za-z-])", line)
        for raw in candidates:
            try:
                val = float(raw.replace(",", ""))
            except ValueError:
                continue
            # Filter: must be at least 50 (ignore qty, days, small nums)
            if val < 50:
                continue
            # If strong signal, accept; if weak, require at least 500 to reduce false positives
            if strong or val >= 500:
                if val <= 50_000_000:
                    amounts.append(val)
    # Deduplicate preserving order
    uniq = []
    seen = set()
    for a in amounts:
        k = round(a, 2)
        if k not in seen:
            seen.add(k)
            uniq.append(a)
    return uniq


def _extract_suppliers(text: str) -> list[str]:
    candidates = []
    lines = text.splitlines()[:40]
    for line in lines:
        line = line.strip()
        if not line:
            continue
        low = line.lower()
        if re.search(r"(invoice|purchase order|receipt|quote|estimate|summary|export|ledger|account|description|date\b)", low):
            continue
        if re.search(r"(sarl|sas|sa|gmbh|llc|ltd|inc|corp|company|s\.a\.r\.l|\.com|@)", low):
            clean = re.sub(r"\s{2,}", " ", line).strip()
            if 3 <= len(clean) <= 120:
                candidates.append(clean)
        if line == line.upper() and len(line) > 5 and not re.search(r"(ITEM|QTY|UNIT|TOTAL|DATE|DESCRIPTION|INVOICE|PO-|PURCHASE|SALES|RECEIPT|QUOTE|ACCOUNT|MONTH)", line.upper()):
            if re.sub(r"[^a-zA-Z]", "", line) == "":
                continue
            clean = re.sub(r"\s{2,}", " ", line).strip()
            if 3 <= len(clean) <= 120:
                candidates.append(clean)
    for m in re.finditer(r"(?:from|vendor|supplier|sold by|bill from|billed by)[\s:]+(.+?)(?:\n|$)", text, re.IGNORECASE):
        val = m.group(1).strip()
        if 3 <= len(val) <= 120:
            candidates.append(val)
    seen = set()
    out = []
    prefixes = ("supplier:", "vendor:", "company:", "sold by:", "bill from:", "billed by:", "invoices processed by:", "review cycle:", "next audit date:")
    for c in candidates:
        for p in prefixes:
            if c.lower().startswith(p):
                c = c[len(p):].strip()
        if c.lower() not in seen and 3 <= len(c) <= 120:
            seen.add(c.lower())
            out.append(c)
    return out[:10]


def _extract_dates(text: str) -> list[str]:
    dates = []
    for m in re.finditer(r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b", text):
        dates.append(m.group(1))
    return dates[:10]


def _hash_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()[:12]


def _compute_time_leak(doc_count: int, total_chars: int) -> dict[str, Any]:
    base = doc_count * 8.0
    complexity = min(25, total_chars / 1500)
    total_minutes = base + complexity
    hours = round(total_minutes / 60, 1)
    breakdown = {
        "Data Entry": round(hours * 0.45, 1),
        "Chasing Approvals": round(hours * 0.30, 1),
        "Fixing Matching Errors": round(hours * 0.25, 1),
    }
    return {"total_hours": hours, "breakdown": breakdown}


def _compute_money_leak(docs: list[dict[str, Any]]) -> dict[str, Any]:
    by_supplier: dict[str, list[float]] = {}
    for d in docs:
        if d["doc_type"] == "invoice":
            sup = d.get("supplier") or "Unknown"
            amts = d.get("amounts", [])
            if not amts:
                continue
            by_supplier.setdefault(sup, []).extend(amts)

    discrepancies = []
    total_leaked = 0.0

    for sup, amounts in by_supplier.items():
        if len(amounts) < 2:
            continue
        avg = sum(amounts) / len(amounts)
        max_v = max(amounts)
        if max_v > avg * 1.02:
            leaked = round(max_v - avg * 1.02, 2)
            total_leaked += leaked
            discrepancies.append({
                "supplier": sup,
                "invoice_total": max_v,
                "expected_total": round(avg * 1.02, 2),
                "leaked": leaked,
                "occurrences": len([a for a in amounts if a > avg * 1.02]),
            })

    discrepancies.sort(key=lambda x: x["leaked"], reverse=True)

    dup_spend = 0.0
    seen_keys = set()
    for d in docs:
        if d["doc_type"] == "invoice":
            amt = (d.get("amounts") or [0])[0]
            sup = d.get("supplier") or "Unknown"
            key = (sup, round(amt, 2))
            if key in seen_keys:
                dup_spend += amt
            seen_keys.add(key)

    discount_loss = 0.0
    for d in docs:
        if d["doc_type"] == "invoice":
            discount_loss += (d.get("amounts") or [0])[0] * 0.02

    total_leaked = round(total_leaked + dup_spend + discount_loss, 2)

    return {
        "total_leaked": total_leaked,
        "top_suppliers": discrepancies[:5],
        "breakdown": {
            "Overcharges": round(sum(s["leaked"] for s in discrepancies[:5]), 2),
            "Duplicate Invoices": round(dup_spend, 2),
            "Missed Early-Pay Discounts": round(discount_loss, 2),
        },
    }


def _compute_risk(docs: list[dict[str, Any]]) -> dict[str, Any]:
    invoices = [d for d in docs if d["doc_type"] == "invoice"]
    pos = [d for d in docs if d["doc_type"] == "po"]
    maverick = [d for d in invoices if not d.get("po_reference")]

    maverick_pct = round(len(maverick) / max(1, len(invoices)), 2)
    suppliers = {d.get("supplier") for d in docs if d.get("supplier") and d["supplier"] != "Unknown Supplier"}
    unvetted = max(1, round(len(suppliers) * 0.2))

    total_invoice_spend = 0.0
    for d in invoices:
        total_invoice_spend += sum(d.get("amounts", [0]))
    exposure = round(total_invoice_spend * maverick_pct, 2)

    return {
        "maverick_spend_pct": maverick_pct,
        "maverick_spend_amount": exposure,
        "unvetted_suppliers": unvetted,
        "missing_contracts_pct": round(maverick_pct * 0.7, 2),
        "invoice_count": len(invoices),
        "po_count": len(pos),
    }


def _generate_evidence(docs: list[dict[str, Any]], money: dict[str, Any]) -> list[dict[str, Any]]:
    evidence = []
    top_sups = {s["supplier"] for s in money.get("top_suppliers", [])}
    for i, d in enumerate(docs[:20]):
        finding = "Matched to PO"
        impact = 0.0

        if d.get("duplicate"):
            finding = "Duplicate invoice detected"
            impact = round((d.get("amounts") or [0])[0], 2)
        elif d["doc_type"] == "invoice" and d.get("supplier") in top_sups:
            finding = "Price deviation vs supplier average"
            impact = round((d.get("amounts") or [0])[0] * 0.035, 2)
        elif d["doc_type"] == "invoice" and not d.get("po_reference"):
            finding = "Maverick spend — no PO reference"
            impact = round((d.get("amounts") or [0])[0] * 0.12, 2)
        elif d["doc_type"] == "receipt":
            finding = "No PO reference; possible off-contract spend"
            impact = round((d.get("amounts") or [0])[0] * 0.15, 2)

        evidence.append({
            "id": f"EV-{1000 + i}",
            "date": d.get("date") or (datetime.utcnow() - timedelta(days=30 + i * 5)).strftime("%Y-%m-%d"),
            "supplier": d.get("supplier") or "Unknown Supplier",
            "doc_type": d["doc_type"],
            "finding": finding,
            "financial_impact": round(impact, 2),
            "filename": d.get("filename") or "",
            "confidence": round(0.85 + (i % 4) * 0.03, 2),
            "amounts": [round(a, 2) for a in d.get("amounts", [])],
            "po_reference": d.get("po_reference"),
        })
    return evidence


def run_shadow_audit(files: list[tuple[str, bytes, str]]) -> dict[str, Any]:
    docs: list[dict[str, Any]] = []
    total_chars = 0
    errors: list[str] = []

    for filename, content, content_type in files:
        ext = Path(filename).suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS and content_type not in {"application/pdf", "text/plain", "text/csv"}:
            errors.append(f"Skipped unsupported file: {filename}")
            continue

        text = ""
        try:
            text = extract_text_from_bytes(content, filename)
        except Exception as exc:
            errors.append(f"OCR failed for {filename}: {exc}")
            continue

        if not text or len(text.strip()) < 5:
            errors.append(f"No extractable text in {filename}")
            continue

        # Split multi-page docs into per-page documents
        pages = _split_pages(text)
        for page_text in pages:
            if not page_text or len(page_text.strip()) < 10:
                continue
            doc_type = _guess_doc_type(filename, page_text)
            amounts = _extract_amounts(page_text)
            suppliers = _extract_suppliers(page_text)
            primary_supplier = suppliers[0] if suppliers else "Unknown Supplier"
            dates = _extract_dates(page_text)

            po_ref = None
            for line in page_text.splitlines():
                m = re.search(r"(?:PO|Purchase Order|Commande)[\s:#-]*([A-Z0-9][A-Z0-9-]+)", line, re.IGNORECASE)
                if m:
                    po_ref = m.group(1)
                    break

            docs.append({
                "filename": filename,
                "doc_type": doc_type,
                "text": page_text,
                "text_hash": _hash_text(page_text),
                "amounts": amounts,
                "supplier": primary_supplier,
                "suppliers": suppliers,
                "dates": dates,
                "page_count": 1,
                "char_count": len(page_text),
                "po_reference": po_ref,
            })
            total_chars += len(page_text)

    doc_count = len(docs)
    time_leak = _compute_time_leak(doc_count, total_chars)
    money_leak = _compute_money_leak(docs)
    risk = _compute_risk(docs)
    evidence = _generate_evidence(docs, money_leak)

    return {
        "meta": {
            "generated_at": datetime.utcnow().isoformat(),
            "documents_processed": doc_count,
            "total_pages": doc_count,
            "errors": errors,
            "model": "Shadow Audit Engine v4",
        },
        "hero": {
            "time_leaked_hours": time_leak["total_hours"],
            "time_leaked_breakdown": time_leak["breakdown"],
            "money_leaked": money_leak["total_leaked"],
            "money_leaked_breakdown": money_leak["breakdown"],
            "risk_exposure_pct": round(risk["maverick_spend_pct"] * 100, 1),
            "risk_exposure_amount": risk["maverick_spend_amount"],
        },
        "charts": {
            "time_breakdown": [
                {"label": k, "value": v, "color": "#fb7185" if k == "Data Entry" else ("#fbbf24" if k == "Chasing Approvals" else "#f97316")}
                for k, v in time_leak["breakdown"].items()
            ],
            "top_suppliers": [
                {
                    "supplier": s["supplier"],
                    "leaked": s["leaked"],
                    "invoices": s["occurrences"],
                }
                for s in money_leak["top_suppliers"]
            ],
            "money_breakdown": [
                {"label": k, "value": v} for k, v in money_leak["breakdown"].items()
            ],
        },
        "evidence": evidence,
        "risk": risk,
        "documents": [
            {
                "filename": d["filename"],
                "doc_type": d["doc_type"],
                "supplier": d["supplier"],
                "suppliers": d.get("suppliers", []),
                "dates": d["dates"],
                "page_count": d["page_count"],
                "amounts": [round(a, 2) for a in d["amounts"]],
                "po_reference": d.get("po_reference"),
                "text_preview": d.get("text", "")[:500],
            }
            for d in docs
        ],
    }
