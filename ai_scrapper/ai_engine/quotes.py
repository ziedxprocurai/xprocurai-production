from __future__ import annotations

import re
from statistics import mean
from typing import Any

from .rfq import RFQ, parse_number, tokenize
from .schemas import Quote, QuoteLine


def _quote_to_obj(quote: Quote | dict[str, Any]) -> Quote:
    if isinstance(quote, Quote):
        return quote
    lines = [line if isinstance(line, QuoteLine) else QuoteLine(**line) for line in quote.get("lines", [])]
    return Quote(
        supplier_name=quote.get("supplier_name") or quote.get("supplier", ""),
        supplier_id=quote.get("supplier_id", ""),
        lines=lines,
        total_amount=quote.get("total_amount"),
        currency=quote.get("currency") or "TND",
        delivery_days=quote.get("delivery_days"),
        payment_terms=quote.get("payment_terms") or "",
        raw_text=quote.get("raw_text") or "",
    )


def normalize_text(text: str) -> str:
    return " ".join((text or "").replace("\n", " ").split())


def parse_number_from_price(value: str) -> float | None:
    return parse_number(value)


def extract_supplier_name(text: str, index: int) -> str:
    first_line = next((line.strip() for line in text.splitlines() if line.strip()), "")
    if first_line:
        return re.sub(r"[^A-Za-zÀ-ÿ0-9 .,'-]", " ", first_line).strip()[:80] or f"Supplier {index + 1}"
    return f"Supplier {index + 1}"


def detect_quote_currency(text: str) -> str:
    lowered = text.lower()
    if "€" in text or "eur" in lowered:
        return "EUR"
    if "$" in text or "usd" in lowered:
        return "USD"
    if "dt" in lowered or "tnd" in lowered or "dinar" in lowered:
        return "TND"
    return "TND"


def detect_delivery_days(text: str) -> int | None:
    patterns = [
        r"(\d+(?:[.,]\d+)?)\s*(?:jours|days|j)\b",
        r"(\d+(?:[.,]\d+)?)\s*(?:semaines|weeks|w)\b",
        r"délai\s*(?:de\s*)?(?:livraison\s*)?(\d+(?:[.,]\d+)?)",
        r"lead\s*time\s*(\d+(?:[.,]\d+)?)",
    ]
    for pattern in patterns:
        matches = re.findall(pattern, text, flags=re.IGNORECASE)
        if matches:
            value = parse_number(matches[0] if isinstance(matches[0], str) else matches[0][0])
            multiplier = 7 if re.search(r"semain|week", pattern, flags=re.IGNORECASE) else 1
            return int((value or 0) * multiplier) if value else None
    return None


def detect_payment_terms(text: str) -> str:
    lowered = text.lower()
    patterns = [
        (r"100%\s*(?:avance|advance)", "100% advance"),
        (r"50%\s*(?:avance|advance)", "50% advance"),
        (r"30\s*%\s*(?:avance|advance)", "30% advance"),
        (r"paiement\s*(?:à|a)\s*30\s*jours", "Net 30"),
        (r"net\s*30", "Net 30"),
        (r"net\s*60", "Net 60"),
    ]
    for pattern, label in patterns:
        if re.search(pattern, lowered):
            return label
    return ""


def parse_quote_text(text: str, supplier_name: str = "") -> Quote:
    cleaned = normalize_text(text)
    currency = detect_quote_currency(cleaned)
    name = supplier_name or extract_supplier_name(text, 0)
    lines: list[QuoteLine] = []
    patterns = [
        r"(?P<desc>[A-Za-zÀ-ÿ0-9 /_().,'-]{4,90})\s+(?P<qty>\d+(?:[.,]\d+)?)\s*(?:pcs|pieces|pièces|unités|unites|u|kg|m)?\s+(?P<price>\d+(?:[.,]\d+)?)\s*(?P<cur>TND|EUR|USD|€|\$|DT)?",
        r"(?P<desc>[A-Za-zÀ-ÿ0-9 /_().,'-]{4,90})\s+(?P<price>\d+(?:[.,]\d+)?)\s*(?P<cur>TND|EUR|USD|€|\$|DT)?\s*/\s*(?P<unit>pc|unit|u|kg|m)?",
    ]
    seen: set[tuple[str, float | None, float | None]] = set()
    for pattern in patterns:
        for match in re.finditer(pattern, cleaned, flags=re.IGNORECASE):
            description = re.sub(r"\s+", " ", match.group("desc")).strip(" ,;:-")
            if any(word in description.lower() for word in ["total", "tva", "vat", "tax", "delivery", "livraison", "payment"]):
                continue
            if len(description) < 4:
                continue
            quantity = parse_number(match.group("qty")) if match.groupdict().get("qty") else 1.0
            unit_price = parse_number(match.group("price"))
            unit = match.groupdict().get("unit") or "unit"
            line_currency = match.groupdict().get("cur") or currency
            if line_currency == "€":
                line_currency = "EUR"
            if line_currency == "$":
                line_currency = "USD"
            if line_currency in ("DT", "dt"):
                line_currency = "TND"
            key = (description.lower(), quantity, unit_price)
            if key not in seen and unit_price is not None:
                lines.append(QuoteLine(description=description, quantity=quantity, unit=unit, unit_price=unit_price, currency=line_currency, raw=match.group(0)))
                seen.add(key)
        if lines:
            break

    total_match = re.search(r"total\s*(?:ht|ttc)?\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(TND|EUR|USD|€|\$|DT)?", cleaned, flags=re.IGNORECASE)
    total = parse_number(total_match.group(1)) if total_match else None
    if total is None and lines:
        total = sum((line.unit_price or 0) * (line.quantity or 1) for line in lines)
    return Quote(
        supplier_name=name,
        lines=lines,
        total_amount=round(total, 2) if total is not None else None,
        currency=currency,
        delivery_days=detect_delivery_days(cleaned),
        payment_terms=detect_payment_terms(cleaned),
        raw_text=text,
    )


def parse_quotes(quotes: list[dict[str, Any]]) -> list[Quote]:
    parsed: list[Quote] = []
    for index, item in enumerate(quotes):
        text = item.get("text") or item.get("raw_text") or ""
        supplier_name = item.get("supplier_name") or item.get("supplier") or ""
        quote = parse_quote_text(text, supplier_name=supplier_name)
        quote.supplier_id = item.get("supplier_id", "")
        parsed.append(quote)
    return parsed


def line_similarity(rfq_item_name: str, quote_line_description: str) -> float:
    left = set(tokenize(rfq_item_name))
    right = set(tokenize(quote_line_description))
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


def compare_quotes(rfq: RFQ, quotes: list[Quote | dict[str, Any]]) -> list[dict[str, Any]]:
    comparisons: list[dict[str, Any]] = []
    quote_objects = [_quote_to_obj(quote) for quote in quotes]
    quote_totals = [quote.total_amount for quote in quote_objects if quote.total_amount is not None]
    avg_total = mean(quote_totals) if quote_totals else None
    for quote in quote_objects:
        matched_lines: list[dict[str, Any]] = []
        coverage_scores: list[float] = []
        for item in rfq.items:
            best_line = None
            best_score = 0.0
            for line in quote.lines:
                score = line_similarity(item.name, line.description)
                if score > best_score:
                    best_score = score
                    best_line = line
            if best_line:
                coverage_scores.append(best_score)
                matched_lines.append({
                    "rfq_item": item.to_dict(),
                    "quote_line": best_line.to_dict(),
                    "match_score": round(best_score, 3),
                })
        coverage = round(mean(coverage_scores), 3) if coverage_scores else 0.0
        price_score = 0.0
        if quote.total_amount and avg_total:
            price_score = round(max(0, min(100, 100 - ((quote.total_amount - avg_total) / avg_total) * 100)), 1)
        delivery_score = 0.0
        if quote.delivery_days and rfq.delivery_deadline_days:
            delivery_score = round(max(0, min(100, 100 - max(0, quote.delivery_days - rfq.delivery_deadline_days) * 4)), 1)
        elif quote.delivery_days:
            delivery_score = 70.0
        final_score = round((coverage * 45) + (price_score * 0.35) + (delivery_score * 0.20), 1)
        comparisons.append({
            "quote": quote.to_dict(),
            "matched_lines": matched_lines,
            "coverage_score": coverage,
            "price_score": price_score,
            "delivery_score": delivery_score,
            "final_score": final_score,
            "rank_reason": {
                "coverage": f"{coverage * 100:.0f}% of RFQ items matched",
                "price": "competitive" if price_score >= 75 else "average" if price_score >= 45 else "expensive",
                "delivery": "on-time" if delivery_score >= 75 else "delayed-or-unknown",
            },
        })
    comparisons.sort(key=lambda item: item["final_score"], reverse=True)
    return comparisons
