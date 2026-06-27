from __future__ import annotations

import datetime as dt
import json
import sqlite3
import uuid
from pathlib import Path
from typing import Any

from .rfq import detect_category
from .schemas import RFQ, SupplierProfile
from .suppliers import DEFAULT_SUPPLIERS


def utc_now() -> str:
    return dt.datetime.now(dt.UTC).isoformat()


class ProcurementDatabase:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.init()

    def connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    def init(self) -> None:
        with self.connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS suppliers (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    website TEXT,
                    country TEXT,
                    city TEXT,
                    categories_json TEXT,
                    capabilities_json TEXT,
                    certifications_json TEXT,
                    description TEXT,
                    contacts_json TEXT,
                    source TEXT,
                    score REAL,
                    embedding_json TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS rfqs (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT,
                    items_json TEXT NOT NULL,
                    location TEXT,
                    budget REAL,
                    currency TEXT,
                    delivery_deadline_days INTEGER,
                    certifications_json TEXT,
                    cost_center TEXT,
                    urgency TEXT,
                    raw_text TEXT,
                    extracted_by TEXT,
                    confidence REAL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS quotes (
                    id TEXT PRIMARY KEY,
                    rfq_id TEXT,
                    supplier_name TEXT NOT NULL,
                    supplier_id TEXT,
                    lines_json TEXT NOT NULL,
                    total_amount REAL,
                    currency TEXT,
                    delivery_days INTEGER,
                    payment_terms TEXT,
                    raw_text TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(rfq_id) REFERENCES rfqs(id)
                );

                CREATE TABLE IF NOT EXISTS quote_comparisons (
                    id TEXT PRIMARY KEY,
                    rfq_id TEXT,
                    quote_id TEXT,
                    matched_lines_json TEXT,
                    coverage_score REAL,
                    price_score REAL,
                    delivery_score REAL,
                    final_score REAL,
                    rank_reason_json TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(rfq_id) REFERENCES rfqs(id),
                    FOREIGN KEY(quote_id) REFERENCES quotes(id)
                );

                CREATE TABLE IF NOT EXISTS risk_assessments (
                    id TEXT PRIMARY KEY,
                    rfq_id TEXT,
                    supplier_matches_json TEXT,
                    quote_comparisons_json TEXT,
                    risk_score REAL NOT NULL,
                    risk_level TEXT NOT NULL,
                    flags_json TEXT NOT NULL,
                    recommendations_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(rfq_id) REFERENCES rfqs(id)
                );

                CREATE TABLE IF NOT EXISTS crawl_runs (
                    id TEXT PRIMARY KEY,
                    target_url TEXT NOT NULL,
                    result_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS crawl_pages (
                    id TEXT PRIMARY KEY,
                    run_id TEXT NOT NULL,
                    url TEXT NOT NULL,
                    page_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(run_id) REFERENCES crawl_runs(id)
                );
                """
            )
            self.migrate()

    def migrate(self) -> None:
        with self.connect() as conn:
            columns = {row[1] for row in conn.execute("PRAGMA table_info(rfqs)").fetchall()}
            if "certifications_json" not in columns:
                conn.execute("ALTER TABLE rfqs ADD COLUMN certifications_json TEXT")

    def seed_suppliers_if_empty(self) -> None:
        with self.connect() as conn:
            count = conn.execute("SELECT COUNT(*) FROM suppliers").fetchone()[0]
            if count:
                return
            now = utc_now()
            for item in DEFAULT_SUPPLIERS:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO suppliers (
                        id, name, website, country, city, categories_json, capabilities_json,
                        certifications_json, description, contacts_json, source, score,
                        embedding_json, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        item["id"],
                        item["name"],
                        item.get("website", ""),
                        item.get("country", ""),
                        item.get("city", ""),
                        json.dumps(item.get("categories", []), ensure_ascii=False),
                        json.dumps(item.get("capabilities", []), ensure_ascii=False),
                        json.dumps(item.get("certifications", []), ensure_ascii=False),
                        item.get("description", ""),
                        json.dumps(item.get("contacts", {}), ensure_ascii=False),
                        item.get("source", "seed"),
                        50.0,
                        "{}",
                        now,
                        now,
                    ),
                )

    def upsert_supplier(self, profile: SupplierProfile) -> SupplierProfile:
        now = utc_now()
        with self.connect() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO suppliers (
                    id, name, website, country, city, categories_json, capabilities_json,
                    certifications_json, description, contacts_json, source, score,
                    embedding_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM suppliers WHERE id = ?), ?), ?)
                """,
                (
                    profile.id,
                    profile.name,
                    profile.website,
                    profile.country,
                    profile.city,
                    json.dumps(profile.categories, ensure_ascii=False),
                    json.dumps(profile.capabilities, ensure_ascii=False),
                    json.dumps(profile.certifications, ensure_ascii=False),
                    profile.description,
                    json.dumps(profile.contacts, ensure_ascii=False),
                    profile.source,
                    float(profile.score or 0),
                    json.dumps(profile.embedding, ensure_ascii=False),
                    profile.id,
                    now,
                    now,
                ),
            )
        return profile

    def upsert_many_suppliers(self, profiles: list[SupplierProfile]) -> list[SupplierProfile]:
        for profile in profiles:
            self.upsert_supplier(profile)
        return profiles

    def list_suppliers(self) -> list[SupplierProfile]:
        with self.connect() as conn:
            rows = conn.execute("SELECT * FROM suppliers ORDER BY updated_at DESC").fetchall()
        return [self._supplier_from_row(row) for row in rows]

    def save_rfq(self, rfq: RFQ) -> str:
        rfq_id = f"rfq-{uuid.uuid4().hex[:12]}"
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO rfqs (
                    id, title, description, items_json, location, budget, currency,
                    delivery_deadline_days, certifications_json, cost_center, urgency, raw_text,
                    extracted_by, confidence, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    rfq_id,
                    rfq.title,
                    rfq.description,
                    json.dumps([item.to_dict() for item in rfq.items], ensure_ascii=False),
                    rfq.location,
                    rfq.budget,
                    rfq.currency,
                    rfq.delivery_deadline_days,
                    json.dumps(rfq.certifications, ensure_ascii=False),
                    rfq.cost_center,
                    rfq.urgency,
                    rfq.raw_text,
                    rfq.extracted_by,
                    rfq.confidence,
                    utc_now(),
                ),
            )
        return rfq_id

    def save_quote(self, quote: dict[str, Any], rfq_id: str | None = None) -> str:
        quote_id = f"quote-{uuid.uuid4().hex[:12]}"
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO quotes (
                    id, rfq_id, supplier_name, supplier_id, lines_json, total_amount,
                    currency, delivery_days, payment_terms, raw_text, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    quote_id,
                    rfq_id,
                    quote.get("supplier_name") or quote.get("supplier", ""),
                    quote.get("supplier_id") or "",
                    json.dumps(quote.get("lines", []), ensure_ascii=False),
                    quote.get("total_amount"),
                    quote.get("currency") or "TND",
                    quote.get("delivery_days"),
                    quote.get("payment_terms") or "",
                    quote.get("raw_text") or "",
                    utc_now(),
                ),
            )
        return quote_id

    def save_quote_comparison(self, comparison: dict[str, Any], rfq_id: str, quote_id: str) -> str:
        comparison_id = f"cmp-{uuid.uuid4().hex[:12]}"
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO quote_comparisons (
                    id, rfq_id, quote_id, matched_lines_json, coverage_score,
                    price_score, delivery_score, final_score, rank_reason_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    comparison_id,
                    rfq_id,
                    quote_id,
                    json.dumps(comparison.get("matched_lines", []), ensure_ascii=False),
                    comparison.get("coverage_score"),
                    comparison.get("price_score"),
                    comparison.get("delivery_score"),
                    comparison.get("final_score"),
                    json.dumps(comparison.get("rank_reason", {}), ensure_ascii=False),
                    utc_now(),
                ),
            )
        return comparison_id

    def save_risk(self, rfq_id: str, risk: dict[str, Any], supplier_matches: list[dict[str, Any]], quote_comparisons: list[dict[str, Any]]) -> str:
        risk_id = f"risk-{uuid.uuid4().hex[:12]}"
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO risk_assessments (
                    id, rfq_id, supplier_matches_json, quote_comparisons_json,
                    risk_score, risk_level, flags_json, recommendations_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    risk_id,
                    rfq_id,
                    json.dumps(supplier_matches, ensure_ascii=False),
                    json.dumps(quote_comparisons, ensure_ascii=False),
                    risk.get("risk_score"),
                    risk.get("risk_level"),
                    json.dumps(risk.get("flags", []), ensure_ascii=False),
                    json.dumps(risk.get("recommendations", []), ensure_ascii=False),
                    utc_now(),
                ),
            )
        return risk_id

    def save_crawl_result(self, crawl_result: dict[str, Any]) -> str:
        run_id = f"crawl-{uuid.uuid4().hex[:12]}"
        now = utc_now()
        with self.connect() as conn:
            conn.execute(
                "INSERT INTO crawl_runs (id, target_url, result_json, created_at) VALUES (?, ?, ?, ?)",
                (run_id, crawl_result.get("target_url") or "", json.dumps(crawl_result, ensure_ascii=False), now),
            )
            for page in crawl_result.get("pages", []):
                conn.execute(
                    "INSERT INTO crawl_pages (id, run_id, url, page_json, created_at) VALUES (?, ?, ?, ?, ?)",
                    (f"page-{uuid.uuid4().hex[:12]}", run_id, page.get("url") or "", json.dumps(page, ensure_ascii=False), now),
                )
        return run_id

    def _supplier_from_row(self, row: sqlite3.Row) -> SupplierProfile:
        return SupplierProfile(
            id=row["id"],
            name=row["name"],
            website=row["website"] or "",
            country=row["country"] or "",
            city=row["city"] or "",
            categories=json.loads(row["categories_json"] or "[]"),
            capabilities=json.loads(row["capabilities_json"] or "[]"),
            certifications=json.loads(row["certifications_json"] or "[]"),
            description=row["description"] or "",
            contacts=json.loads(row["contacts_json"] or "{}"),
            source=row["source"] or "database",
            score=float(row["score"] or 0),
            embedding=json.loads(row["embedding_json"] or "{}"),
        )

    def add_suppliers_from_crawl(self, crawl_result: dict[str, Any]) -> list[SupplierProfile]:
        self.save_crawl_result(crawl_result)
        profiles: list[SupplierProfile] = []
        target = crawl_result.get("target_url") or ""
        pages = crawl_result.get("pages") or []
        if not pages:
            return profiles
        first_page = pages[0]
        text = first_page.get("page_text") or ""
        emails = [email.get("email") for email in (crawl_result.get("verified_emails") or []) if email.get("email")]
        phones = [(phone.get("parsed_e164") or phone.get("raw")) for phone in (crawl_result.get("verified_phones") or [])]
        profile = SupplierProfile(
            id=f"crawl-{uuid.uuid4().hex[:12]}",
            name=self._infer_name(text, target),
            website=target,
            country="",
            city="",
            categories=[detect_category(text)] if detect_category(text) != "general procurement" else [],
            capabilities=self._infer_capabilities(text),
            certifications=self._infer_certifications(text),
            description=text[:1200],
            contacts={"emails": emails, "phones": phones},
            source="crawler",
        )
        profiles.append(profile)
        self.upsert_many_suppliers(profiles)
        return profiles

    def _infer_name(self, text: str, target: str) -> str:
        import re
        domain = re.sub(r"^https?://", "", target or "").split("/")[0]
        title_match = re.search(r"(?:<title[^>]*>\s*)([^<]+)", text, flags=re.IGNORECASE)
        if title_match:
            return title_match.group(1).strip()[:120]
        return domain or "Crawled supplier"

    def _infer_capabilities(self, text: str) -> list[str]:
        import re
        keywords = ["fournisseur", "distribution", "fabrication", "import", "export", "livraison", "support", "maintenance", "grossiste", "équipement"]
        lowered = text.lower()
        return [keyword for keyword in keywords if keyword in lowered][:8]

    def _infer_certifications(self, text: str) -> list[str]:
        import re
        patterns = [r"ISO\s*\d+", r"CE\b", r"NF\b", r"EN\s*\d+"]
        certs: list[str] = []
        for pattern in patterns:
            for match in re.finditer(pattern, text, flags=re.IGNORECASE):
                cert = match.group(0).upper().replace("  ", " ")
                if cert not in certs:
                    certs.append(cert)
        return certs[:6]
