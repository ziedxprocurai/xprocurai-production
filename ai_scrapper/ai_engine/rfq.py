from __future__ import annotations

import json
import math
import os
import re
from collections import Counter
from pathlib import Path
from typing import Any

import requests

from .schemas import RFQ, RfqItem

STOPWORDS = {
    "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "pour", "avec", "sans", "sur", "dans",
    "the", "a", "an", "and", "or", "for", "with", "without", "to", "from", "of", "in", "on", "need", "needs",
    "i", "we", "want", "would", "like", "please", "achat", "acheter", "demande", "besoin",
}

CATEGORY_KEYWORDS = {
    "office furniture": ["chaise", "chaises", "chair", "chairs", "bureau", "bureaux", "desk", "desks", "fauteuil", "table", "armoire", "meuble"],
    "it hardware": ["ordinateur", "laptop", "pc", "serveur", "imprimante", "ecran", "écran", "smartphone", "tablet"],
    "stationery": ["stylo", "cahier", "papier", "classeur", "enveloppe", "cartouche"],
    "safety equipment": ["casque", "gants", "chaussure", "sécurité", "gilet", "masque", "protection"],
    "industrial supplies": ["moteur", "pompe", "roulement", "capteur", "cable", "câble", "acier", "pièce"],
    "cleaning supplies": ["detergent", "désinfectant", "serpilliere", "serpillière", "poubelle", "savon"],
    "transport logistics": ["transport", "livraison", "camion", "logistique", "freight", "shipping"],
    "catering": ["repas", "cafe", "café", "eau", "catering", "traiteur"],
}

LOCATION_KEYWORDS = ["tunis", "sfax", "sousse", "bizerte", "nabeul", "ariana", "ben arous", "monastir", "gabes", "france", "algeria", "morocco"]

CURRENCY_MAP = {"dt": "TND", "td": "TND", "dinars": "TND", "dinar": "TND", "euro": "EUR", "euros": "EUR", "usd": "USD", "$": "USD", "€": "EUR"}

CERT_PATTERNS = {
    "ISO 9001": r"ISO\s*(?:9001|qms|quality)",
    "ISO 14001": r"ISO\s*14001",
    "ISO 27001": r"ISO\s*27001",
    "ISO 45001": r"ISO\s*45001",
    "ISO": r"ISO\s*(?:certified|certification|certif|standard)\b",
    "CE": r"\bCE\b",
    "NF": r"\bNF\b",
    "EN": r"\bEN\s*\d+",
    "HACCP": r"\bHACCP\b",
    "GMP": r"\bGMP\b",
}

CERT_POWER = {
    "ISO 9001": 1.0,
    "ISO 14001": 0.95,
    "ISO 27001": 0.92,
    "ISO 45001": 0.9,
    "ISO": 0.72,
    "CE": 0.7,
    "NF": 0.68,
    "EN": 0.65,
    "HACCP": 0.8,
    "GMP": 0.78,
}


def tokenize(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", (text or "").lower())
    return [word for word in words if word not in STOPWORDS and len(word) > 1]


def vectorize(text: str) -> dict[str, float]:
    counts = Counter(tokenize(text))
    total = sum(counts.values()) or 1
    return {token: count / total for token, count in counts.items()}


def cosine_similarity(left: dict[str, float], right: dict[str, float]) -> float:
    if not left or not right:
        return 0.0
    dot = sum(left.get(key, 0.0) * right.get(key, 0.0) for key in set(left) & set(right))
    left_norm = math.sqrt(sum(value * value for value in left.values()))
    right_norm = math.sqrt(sum(value * value for value in right.values()))
    if not left_norm or not right_norm:
        return 0.0
    return dot / (left_norm * right_norm)


def detect_category(text: str) -> str:
    lowered = text.lower()
    best_category = "general procurement"
    best_count = 0
    for category, keywords in CATEGORY_KEYWORDS.items():
        count = sum(1 for keyword in keywords if keyword in lowered)
        if count > best_count:
            best_category = category
            best_count = count
    return best_category


def detect_location(text: str) -> str:
    lowered = text.lower()
    for location in LOCATION_KEYWORDS:
        if location in lowered:
            return location.title()
    return ""


def detect_currency(text: str, default: str = "TND") -> str:
    lowered = text.lower()
    for token, currency in CURRENCY_MAP.items():
        if token in lowered:
            return currency
    return default


def detect_budget(text: str, currency: str) -> float | None:
    patterns = [
        rf"budget\s*(?:de|max|maximum|≤|<=|moins de|under)?\s*([0-9][0-9\s,.]*)\s*{re.escape(currency)}",
        rf"([0-9][0-9\s,.]*)\s*{re.escape(currency)}\s*(?:budget|max|maximum)",
        rf"moins\s+de\s+([0-9][0-9\s,.]*)\s*{re.escape(currency)}",
        rf"under\s+([0-9][0-9\s,.]*)\s*{re.escape(currency)}",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return parse_number(match.group(1))
    return None


def parse_number(value: str | float | None) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = value.strip().replace(" ", "")
    if "," in cleaned and "." in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    else:
        cleaned = cleaned.replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


def detect_deadline_days(text: str) -> int | None:
    patterns = [
        r"(\d+(?:[.,]\d+)?)\s*(?:jours|days|j)\b",
        r"(\d+(?:[.,]\d+)?)\s*(?:semaines|weeks|w)\b",
        r"delivery\s*(?:within|in)?\s*(\d+(?:[.,]\d+)?)",
    ]
    for pattern in patterns:
        matches = re.findall(pattern, text, flags=re.IGNORECASE)
        if matches:
            value = parse_number(matches[0] if isinstance(matches[0], str) else matches[0][0])
            multiplier = 7 if re.search(r"semain|week", pattern, flags=re.IGNORECASE) else 1
            return int((value or 0) * multiplier) if value else None
    return None


def detect_certifications(text: str) -> list[str]:
    lowered = text.lower()
    certs: list[str] = []
    for cert, pattern in CERT_PATTERNS.items():
        if re.search(pattern, text, flags=re.IGNORECASE):
            certs.append(cert)
    if "certif" in lowered and not certs:
        certs.append("ISO")
    return list(dict.fromkeys(certs))


def detect_urgency(text: str) -> str:
    lowered = text.lower()
    if any(word in lowered for word in ["urgent", "urgence", "asap", "immédiat", "immediat"]):
        return "urgent"
    if any(word in lowered for word in ["normal", "standard"]):
        return "normal"
    return "planned"


def clean_item_name(name: str) -> str:
    cleaned = re.sub(r"\s+", " ", name).strip(" ,;:-")
    stop_words = ["budget", "delivery", "within", "must", "should", "livraison", "délai", "avec", "for", "to"]
    lowered = cleaned.lower()
    for word in stop_words:
        index = lowered.find(word)
        if index != -1:
            cleaned = cleaned[:index].strip(" ,;:-")
            break
    for location in LOCATION_KEYWORDS:
        index = cleaned.lower().find(location)
        if index != -1:
            cleaned = cleaned[:index].strip(" ,;-")
            break
    cleaned = re.sub(r"\s+(in|for|to|with|at)\s*$", "", cleaned, flags=re.IGNORECASE).strip(" ,;-")
    return cleaned


def extract_specs(text: str) -> list[str]:
    specs: list[str] = []
    for phrase in re.split(r"[.;]\s*", text):
        if any(word in phrase.lower() for word in ["couleur", "color", "matière", "matiere", "dimension", "taille", "qualité", "qualite", "norme", "iso"]):
            cleaned = phrase.strip()
            if cleaned and len(cleaned) < 180:
                specs.append(cleaned)
    return specs[:5]


def extract_rfq_items(text: str, category: str) -> list[RfqItem]:
    items: list[RfqItem] = []
    quantity_patterns = [
        r"(?P<qty>\d+(?:[.,]\d+)?)\s*(?:pcs|pieces|pièces|unités|unites|u|kg|mètres|metres|caisses|boites|boîtes|sets)?\s+(?P<name>[a-zA-ZÀ-ÿ0-9 /_().,-]{3,80})",
        r"(?P<name>[a-zA-ZÀ-ÿ0-9 /_().,-]{3,80})\s+(?P<qty>\d+(?:[.,]\d+)?)\s*(?:pcs|pieces|pièces|unités|unites|u|kg|mètres|metres|caisses|boites|boîtes|sets)?",
    ]
    for pattern in quantity_patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            name = clean_item_name(re.sub(r"\s+", " ", match.group("name")).strip(" ,;:-"))
            quantity = parse_number(match.group("qty"))
            if not name or len(name) < 3:
                continue
            item_category = detect_category(name)
            if item_category == "general procurement" and category != "general procurement":
                item_category = category
            items.append(RfqItem(name=name, category=item_category, quantity=quantity, specs=extract_specs(match.group(0))))
            break
        if items:
            break

    if not items:
        for keyword in ["chaise", "bureau", "ordinateur", "laptop", "imprimante", "papier", "casque", "gants", "repas", "transport"]:
            if keyword in text.lower():
                qty = None
                qty_match = re.search(rf"(\d+(?:[.,]\d+)?)\s*{keyword}", text, flags=re.IGNORECASE)
                if qty_match:
                    qty = parse_number(qty_match.group(1))
                items.append(RfqItem(name=keyword.title(), category=detect_category(keyword), quantity=qty, specs=extract_specs(text)))
                break

    seen: set[str] = set()
    unique_items: list[RfqItem] = []
    for item in items:
        key = item.name.lower()
        if key not in seen:
            unique_items.append(item)
            seen.add(key)
    return unique_items[:10]


def extract_rfq(text: str, use_llm: bool = False) -> RFQ:
    if use_llm:
        llm_rfq = extract_rfq_with_llm(text)
        if llm_rfq:
            return llm_rfq

    cleaned = " ".join((text or "").split())
    currency = detect_currency(cleaned)
    budget = detect_budget(cleaned, currency)
    category = detect_category(cleaned)
    location = detect_location(cleaned)
    deadline = detect_deadline_days(cleaned)
    certifications = detect_certifications(cleaned)
    items = extract_rfq_items(cleaned, category)
    confidence = 0.88 if items else 0.45
    title = items[0].name.title() if items else "Procurement request"
    return RFQ(
        title=title,
        description=cleaned,
        items=items,
        location=location,
        budget=budget,
        currency=currency,
        delivery_deadline_days=deadline,
        certifications=certifications,
        urgency=detect_urgency(cleaned),
        raw_text=text,
        extracted_by="deterministic",
        confidence=confidence,
    )


def extract_rfq_with_llm(text: str) -> RFQ | None:
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    if not api_key:
        return None
    prompt = f"""
Extract this procurement request into strict JSON. If a field is unknown, use null or empty arrays.
Return only JSON.

Text:
{text}

Schema:
{{
  "title": "short title",
  "description": "normalized request description",
  "items": [
    {{"name": "item name", "category": "category", "quantity": 1, "unit": "pcs", "specs": [], "target_price": 100, "notes": ""}}
  ],
  "location": "",
  "budget": 1000,
  "currency": "TND",
  "delivery_deadline_days": 15,
  "certifications": ["ISO 9001"],
  "cost_center": "",
  "urgency": "normal",
  "confidence": 0.9
}}
""".strip()
    try:
        response = requests.post(
            f"{base_url}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"), "messages": [{"role": "user", "content": prompt}], "temperature": 0},
            timeout=30,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        start = content.find("{")
        end = content.rfind("}") + 1
        data = json.loads(content[start:end]) if start != -1 and end > start else {}
        items = [RfqItem(**item) for item in data.get("items", [])]
        return RFQ(
            title=data.get("title") or "Procurement request",
            description=data.get("description") or text,
            items=items,
            location=data.get("location") or "",
            budget=data.get("budget"),
            currency=data.get("currency") or "TND",
            delivery_deadline_days=data.get("delivery_deadline_days"),
            certifications=data.get("certifications") or [],
            cost_center=data.get("cost_center") or "",
            urgency=data.get("urgency") or "normal",
            raw_text=text,
            extracted_by="openai-compatible",
            confidence=float(data.get("confidence") or 0.8),
        )
    except Exception:
        return None
