from __future__ import annotations

import json
import math
import re
import uuid
from pathlib import Path
from typing import Any

from .rfq import RFQ, tokenize, vectorize, cosine_similarity, detect_category, CERT_POWER
from .schemas import SupplierProfile


DEFAULT_SUPPLIERS = [
    {
        "id": "supplier-office-tunis",
        "name": "Tunis Office Solutions",
        "website": "https://example.com/tunis-office",
        "country": "Tunisia",
        "city": "Tunis",
        "categories": ["office furniture", "stationery"],
        "capabilities": ["office chairs", "desks", "bulk delivery", "public sector"],
        "certifications": ["ISO 9001"],
        "description": "Fournisseur de mobilier de bureau, chaises ergonomiques, bureaux et consommables pour entreprises à Tunis.",
        "contacts": {"emails": ["contact@tunisoffice.tn"], "phones": []},
        "source": "seed",
    },
    {
        "id": "supplier-it-hub",
        "name": "IT Hub Maghreb",
        "website": "https://example.com/it-hub",
        "country": "Tunisia",
        "city": "Sfax",
        "categories": ["it hardware", "transport logistics"],
        "capabilities": ["laptops", "servers", "printers", "warranty", "nationwide delivery"],
        "certifications": ["ISO 27001"],
        "description": "Distributeur matériel informatique, laptops, serveurs, imprimantes et support technique.",
        "contacts": {"emails": ["sales@ithub.tn"], "phones": []},
        "source": "seed",
    },
    {
        "id": "supplier-safety-pro",
        "name": "Safety Pro Industrie",
        "website": "https://example.com/safety-pro",
        "country": "Tunisia",
        "city": "Sousse",
        "categories": ["safety equipment", "industrial supplies"],
        "capabilities": ["PPE", "helmets", "gloves", "industrial safety", "bulk orders"],
        "certifications": ["CE", "ISO 45001"],
        "description": "Équipements de protection individuelle, casques, gants, chaussures de sécurité et matériel industriel.",
        "contacts": {"emails": ["info@safetypro.tn"], "phones": []},
        "source": "seed",
    },
]


class SupplierStore:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.suppliers: dict[str, SupplierProfile] = {}
        self.load()
        self.seed_if_empty()

    def load(self) -> None:
        if not self.path.exists():
            return
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except Exception:
            return
        for item in data:
            profile = SupplierProfile(**item)
            if not profile.embedding:
                profile.embedding = vectorize(self._profile_text(profile))
            self.suppliers[profile.id] = profile

    def save(self) -> None:
        payload = [profile.to_dict() for profile in self.suppliers.values()]
        self.path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    def seed_if_empty(self) -> None:
        if self.suppliers:
            return
        for item in DEFAULT_SUPPLIERS:
            profile = SupplierProfile(**item)
            profile.embedding = vectorize(self._profile_text(profile))
            self.suppliers[profile.id] = profile
        self.save()

    def upsert(self, supplier: SupplierProfile | dict[str, Any]) -> SupplierProfile:
        if isinstance(supplier, dict):
            supplier_id = supplier.get("id") or f"supplier-{uuid.uuid4().hex[:8]}"
            profile = SupplierProfile(id=supplier_id, **{key: value for key, value in supplier.items() if key != "id"})
        else:
            profile = supplier
        if not profile.embedding:
            profile.embedding = vectorize(self._profile_text(profile))
        if not profile.score:
            profile.score = self._base_supplier_score(profile)
        self.suppliers[profile.id] = profile
        self.save()
        return profile

    def upsert_many(self, suppliers: list[SupplierProfile | dict[str, Any]]) -> list[SupplierProfile]:
        return [self.upsert(supplier) for supplier in suppliers]

    def list_suppliers(self) -> list[dict[str, Any]]:
        return [profile.to_dict() for profile in self.suppliers.values()]

    def match(self, rfq: RFQ, top_k: int = 5) -> list[dict[str, Any]]:
        rfq_text = self._rfq_text(rfq)
        rfq_vector = vectorize(rfq_text)
        rfq_category = detect_category(rfq_text)
        required_certifications = [cert.upper() for cert in (rfq.certifications or [])]
        results: list[dict[str, Any]] = []
        for supplier in self.suppliers.values():
            if required_certifications and not self._has_required_certifications(supplier.certifications, required_certifications):
                continue
            semantic = cosine_similarity(rfq_vector, supplier.embedding or {})
            category_score = self._category_score(rfq_category, supplier.categories)
            location_score = self._location_score(rfq.location, supplier.city, supplier.country)
            certification_score = self._certification_power_score(required_certifications, supplier.certifications)
            certification_breakdown = self._certification_breakdown(required_certifications, supplier.certifications)
            contact_score = self._contact_score(supplier.contacts)
            capability_score = self._capability_score(rfq_text, supplier.capabilities + supplier.categories)
            raw_score = (
                semantic * 0.28
                + category_score * 0.24
                + location_score * 0.14
                + certification_score * 0.16
                + contact_score * 0.08
                + capability_score * 0.10
            )
            score = round(max(0, min(100, raw_score * 100)), 1)
            results.append({
                "supplier": supplier.to_dict(),
                "score": score,
                "rank_reason": {
                    "semantic_similarity": round(semantic, 3),
                    "category_fit": round(category_score, 3),
                    "location_fit": round(location_score, 3),
                    "certification_score": round(certification_score, 3),
                    "certification_breakdown": certification_breakdown,
                    "contact_quality": round(contact_score, 3),
                    "capability_fit": round(capability_score, 3),
                },
            })
        results.sort(key=lambda item: item["score"], reverse=True)
        return results[:top_k]

    def from_crawl_result(self, crawl_result: dict[str, Any]) -> list[SupplierProfile]:
        profiles: list[SupplierProfile] = []
        target = crawl_result.get("target_url") or ""
        pages = crawl_result.get("pages") or []
        if not pages:
            return profiles
        first_page = pages[0]
        text = first_page.get("page_text") or ""
        emails = crawl_result.get("verified_emails") or []
        verified_emails = [email.get("email") for email in emails if email.get("email")]
        phones = crawl_result.get("verified_phones") or []
        verified_phones = [phone.get("parsed_e164") or phone.get("raw") for phone in phones]
        category = detect_category(text)
        profile = SupplierProfile(
            id=f"crawl-{uuid.uuid4().hex[:8]}",
            name=self._infer_name(text, target),
            website=target,
            country="",
            city="",
            categories=[category] if category != "general procurement" else [],
            capabilities=self._infer_capabilities(text),
            certifications=self._infer_certifications(text),
            description=text[:1200],
            contacts={"emails": verified_emails, "phones": verified_phones},
            source="crawler",
        )
        profile.embedding = vectorize(self._profile_text(profile))
        profile.score = self._base_supplier_score(profile)
        profiles.append(profile)
        self.upsert_many(profiles)
        return profiles

    def _rfq_text(self, rfq: RFQ) -> str:
        item_names = [item.name if hasattr(item, "name") else item.get("name", "") for item in rfq.items]
        return " ".join([rfq.title, rfq.description] + item_names)

    def _profile_text(self, profile: SupplierProfile) -> str:
        return " ".join([
            profile.name,
            profile.website,
            profile.country,
            profile.city,
            " ".join(profile.categories),
            " ".join(profile.capabilities),
            " ".join(profile.certifications),
            profile.description,
        ])

    def _base_supplier_score(self, profile: SupplierProfile) -> float:
        score = 45
        score += min(20, len(profile.categories) * 5 + len(profile.capabilities) * 2)
        score += min(15, len(profile.certifications) * 7)
        score += min(10, len((profile.contacts or {}).get("emails", [])) * 5)
        score += min(10, len((profile.contacts or {}).get("phones", [])) * 5)
        return round(max(0, min(100, score)), 1)

    def _category_score(self, rfq_category: str, supplier_categories: list[str]) -> float:
        if not rfq_category or rfq_category == "general procurement":
            return 0.5
        normalized = {category.lower() for category in supplier_categories}
        if rfq_category.lower() in normalized:
            return 1.0
        return 0.35

    def _certification_power_score(self, required: list[str], supplier_certs: list[str]) -> float:
        if not required:
            return min(1.0, len(supplier_certs) / 3) * 0.6
        supplier = [cert.upper() for cert in supplier_certs]
        scores = []
        for required_cert in required:
            scores.append(self._single_cert_power(required_cert, supplier))
        return round(sum(scores) / len(scores), 3) if scores else 0.0

    def _single_cert_power(self, required_cert: str, supplier_certs: list[str]) -> float:
        required_norm = required_cert.upper().replace(" ", "")
        supplier_norms = [cert.upper().replace(" ", "") for cert in supplier_certs]
        for supplier_cert in supplier_certs:
            supplier_norm = supplier_cert.upper().replace(" ", "")
            if supplier_norm == required_norm:
                return CERT_POWER.get(required_cert.upper(), 1.0)
            if required_norm == "ISO" and supplier_norm.startswith("ISO"):
                return 0.86
            if required_norm.startswith("ISO") and required_norm != "ISO":
                if supplier_norm == "ISO":
                    return 0.65
                continue
            if required_norm.startswith("ISO") and supplier_norm.startswith("ISO"):
                return 0.72
            if required_norm in supplier_norm or supplier_norm in required_norm:
                return 0.65
        return 0.0

    def _certification_breakdown(self, required: list[str], supplier_certs: list[str]) -> dict[str, Any]:
        breakdown: dict[str, Any] = {}
        for required_cert in required:
            required_norm = required_cert.upper().replace(" ", "")
            matched_cert = ""
            best_score = 0.0
            for supplier_cert in supplier_certs:
                score = self._single_cert_power(required_cert, [supplier_cert])
                if score > best_score:
                    best_score = score
                    matched_cert = supplier_cert
            breakdown[required_cert] = {
                "required": required_cert,
                "matched_cert": matched_cert,
                "score": round(best_score, 3),
                "cert_power": CERT_POWER.get(required_cert.upper(), 1.0),
                "status": "matched" if best_score > 0 else "missing",
                "supplier_norm": matched_cert.upper().replace(" ", "") if matched_cert else "",
                "required_norm": required_norm,
            }
        return breakdown

    def _has_required_certifications(self, supplier_certs: list[str], required: list[str]) -> bool:
        supplier = [cert.upper() for cert in supplier_certs]
        for required_cert in required:
            if self._single_cert_power(required_cert, supplier) <= 0:
                return False
        return True

    def _location_score(self, rfq_location: str, city: str, country: str) -> float:
        if not rfq_location:
            return 0.5
        lowered = rfq_location.lower()
        if city and city.lower() in lowered:
            return 1.0
        if country and country.lower() in lowered:
            return 0.75
        return 0.35

    def _contact_score(self, contacts: dict[str, Any]) -> float:
        emails = len(contacts.get("emails") or []) if isinstance(contacts, dict) else 0
        phones = len(contacts.get("phones") or []) if isinstance(contacts, dict) else 0
        return min(1.0, (emails * 0.6 + phones * 0.4) / 2)

    def _capability_score(self, rfq_text: str, capabilities: list[str]) -> float:
        if not capabilities:
            return 0.3
        lowered = rfq_text.lower()
        hits = sum(1 for capability in capabilities if capability.lower() in lowered)
        return min(1.0, hits / max(1, len(capabilities)))

    def _infer_name(self, text: str, target: str) -> str:
        domain = re.sub(r"^https?://", "", target or "").split("/")[0]
        title_match = re.search(r"(?:<title[^>]*>\s*)([^<]+)", text, flags=re.IGNORECASE)
        if title_match:
            return title_match.group(1).strip()[:120]
        return domain or "Crawled supplier"

    def _infer_capabilities(self, text: str) -> list[str]:
        keywords = ["fournisseur", "distribution", "fabrication", "import", "export", "livraison", "support", "maintenance", "grossiste", "équipement"]
        lowered = text.lower()
        return [keyword for keyword in keywords if keyword in lowered][:8]

    def _infer_certifications(self, text: str) -> list[str]:
        patterns = [r"ISO\s*\d+", r"CE\b", r"NF\b", r"EN\s*\d+"]
        certs: list[str] = []
        for pattern in patterns:
            for match in re.finditer(pattern, text, flags=re.IGNORECASE):
                cert = match.group(0).upper().replace("  ", " ")
                if cert not in certs:
                    certs.append(cert)
        return certs[:6]
