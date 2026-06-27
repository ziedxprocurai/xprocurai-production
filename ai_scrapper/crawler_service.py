from __future__ import annotations

import datetime as dt
import json
import re
import time
from dataclasses import dataclass, field
from typing import Callable, Any
from urllib.parse import urljoin, urlparse, urldefrag

import requests
import phonenumbers
from bs4 import BeautifulSoup

import verifier

EventType = Callable[[str, dict[str, Any]], None]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Connection": "close",
}

SKIP_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".zip", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"}
PHONE_RE = re.compile(r"(?<![\w.])(?:\+?\d[\d\s().-]{6,}\d)(?![\w.])")


def looks_like_phone(value: str, default_region: str = "FR") -> bool:
    stripped = value.strip()
    compact = re.sub(r"\D", "", stripped)
    if not compact or "." in stripped:
        return False
    if len(compact) < 7 or len(compact) > 15:
        return False
    if re.fullmatch(r"17\d{8}", compact):
        return False
    try:
        parsed = phonenumbers.parse(stripped, default_region)
        return phonenumbers.is_valid_number(parsed)
    except Exception:
        pass
    if stripped.startswith("+") and not compact.startswith("00"):
        return True
    if any(sep in stripped for sep in (" ", "(", ")")) and 7 <= len(compact) <= 15:
        return True
    if re.fullmatch(r"\+?\d{7,15}", stripped):
        return True
    return False


@dataclass
class CrawlConfig:
    target_url: str
    max_pages: int = 20
    same_domain_only: bool = True
    delay_seconds: float = 1.0
    timeout_seconds: int = 20
    verify_contacts: bool = True
    smtp_verify: bool = True
    deep_email_verify: bool = True
    phone_default_region: str = "FR"


@dataclass
class CrawlResult:
    target_url: str
    pages: list[dict[str, Any]] = field(default_factory=list)
    started_at: str = field(default_factory=lambda: dt.datetime.now(dt.UTC).isoformat())
    finished_at: str | None = None
    pages_crawled: int = 0
    pages_failed: int = 0
    emails_found: int = 0
    phones_found: int = 0
    verified_emails: list[dict[str, Any]] = field(default_factory=list)
    verified_phones: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "target_url": self.target_url,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "pages_crawled": self.pages_crawled,
            "pages_failed": self.pages_failed,
            "emails_found": self.emails_found,
            "phones_found": self.phones_found,
            "verified_emails": self.verified_emails,
            "verified_phones": self.verified_phones,
            "pages": self.pages,
        }


class CrawlerService:
    def __init__(self, emit: EventType | None = None):
        self.emit = emit
        self.session = requests.Session()
        self.config: CrawlConfig | None = None
        self.result = CrawlResult(target_url="")

    def run(self, config: CrawlConfig) -> CrawlResult:
        self.config = config
        self.result = CrawlResult(target_url=config.target_url)
        self._emit("crawl_started", {"target_url": config.target_url, "max_pages": config.max_pages})

        visited: set[str] = set()
        to_visit: list[str] = [config.target_url]
        page_count = 0

        while to_visit and page_count < config.max_pages:
            url = to_visit.pop(0)
            url, _ = urldefrag(url)
            if url in visited:
                continue

            visited.add(url)
            page_count += 1
            self._emit("page_started", {"page": page_count, "url": url})

            fetched = self._fetch_page(url)
            if not fetched:
                self.result.pages_failed += 1
                self._emit("page_failed", {"page": page_count, "url": url})
                continue

            soup, page_text, raw_html = fetched
            emails, phones = self._extract_contacts(raw_html)
            child_links = self._extract_links(soup, url)
            new_links = child_links - visited - set(to_visit)

            self.result.emails_found += len(emails)
            self.result.phones_found += len(phones)

            self._emit(
                "page_extracted",
                {
                    "page": page_count,
                    "url": url,
                    "links_found": len(child_links),
                    "new_links": len(new_links),
                    "emails": emails,
                    "phones": phones,
                },
            )

            to_visit.extend(sorted(new_links))

            verified_emails: list[dict[str, Any]] = []
            verified_phones: list[dict[str, Any]] = []
            verification_summary: dict[str, Any] = {}
            if config.verify_contacts and (emails or phones):
                self._emit("verification_started", {"page": page_count, "emails": len(emails), "phones": len(phones)})
                verified_emails, verified_phones, verification_summary = self._verify_contacts(emails, phones)
                self._emit("verification_completed", {"page": page_count, "summary": verification_summary})

            page_result = {
                "url": url,
                "page_text": page_text,
                "links": sorted(child_links),
                "emails": emails,
                "phones": phones,
                "contact_verification": {
                    "emails": verified_emails,
                    "phones": verified_phones,
                    "summary": verification_summary,
                },
            }
            self.result.pages.append(page_result)
            self._append_unique_verified_emails(verified_emails)
            self._append_unique_verified_phones(verified_phones)
            self._emit("page_completed", {"page": page_count, "url": url, "summary": verification_summary})

            if config.delay_seconds > 0:
                time.sleep(config.delay_seconds)

        self.result.pages_crawled = page_count
        self.result.finished_at = dt.datetime.now(dt.UTC).isoformat()
        self._emit("crawl_completed", self.result.to_dict())
        return self.result

    def _emit(self, kind: str, payload: dict[str, Any] | None = None):
        if self.emit:
            self.emit(kind, payload or {})

    def _append_unique_verified_emails(self, emails: list[dict[str, Any]]):
        existing = {email.get("email") for email in self.result.verified_emails}
        for email in emails:
            key = email.get("email")
            if key and key not in existing:
                self.result.verified_emails.append(email)
                existing.add(key)

    def _append_unique_verified_phones(self, phones: list[dict[str, Any]]):
        existing = {phone.get("raw") for phone in self.result.verified_phones}
        for phone in phones:
            key = self._phone_key(phone.get("raw", ""))
            if key and key not in existing:
                self.result.verified_phones.append(phone)
                existing.add(key)

    def _phone_key(self, raw: str) -> str:
        digits = re.sub(r"\D", "", raw or "")
        if not digits:
            return ""
        region = self.config.phone_default_region if self.config else "FR"
        try:
            parsed = phonenumbers.parse(raw, region)
            if phonenumbers.is_possible_number(parsed):
                return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
        except Exception:
            pass
        if len(digits) >= 8 and digits.startswith("00"):
            return "+" + digits[2:]
        return digits

    def _fetch_page(self, url: str) -> tuple[Any, str, str] | None:
        self._emit("fetch_started", {"url": url})
        try:
            response = self.session.get(url, headers=HEADERS, timeout=self.config.timeout_seconds if self.config else 20)
            response.raise_for_status()
            content_type = response.headers.get("content-type", "")
            if "text/html" not in content_type and not response.text.strip().startswith("<"):
                self._emit("fetch_skipped", {"url": url, "content_type": content_type})
                return None
            soup = BeautifulSoup(response.text, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "iframe", "noscript"]):
                tag.decompose()
            page_text = soup.get_text(separator="\n", strip=True)[:15000]
            self._emit("fetch_completed", {"url": url, "status": response.status_code, "bytes": len(response.content)})
            return soup, page_text, response.text
        except Exception as exc:
            self._emit("fetch_failed", {"url": url, "error": str(exc)})
            return None

    def _extract_links(self, soup: BeautifulSoup, base_url: str) -> set[str]:
        base_netloc = urlparse(base_url).netloc
        links: set[str] = set()
        for a in soup.find_all("a", href=True):
            href = a.get("href", "")
            full_url = urljoin(base_url, href)
            full_url, _ = urldefrag(full_url)
            parsed = urlparse(full_url)
            if parsed.scheme not in ("http", "https"):
                continue
            if self.config.same_domain_only and parsed.netloc != base_netloc:
                continue
            if any(parsed.path.lower().endswith(ext) for ext in SKIP_EXTENSIONS):
                continue
            if full_url:
                links.add(full_url)
        return links

    def _extract_contacts(self, raw_html: str) -> tuple[list[str], list[str]]:
        emails = sorted(set(re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", raw_html)))
        region = self.config.phone_default_region if self.config else "FR"
        phones = sorted(set(phone for phone in PHONE_RE.findall(raw_html) if looks_like_phone(phone, region)))
        return emails, phones

    def _verify_contacts(self, emails: list[str], phones: list[str]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
        def email_emit(kind: str, payload: dict[str, Any]):
            self._emit(kind, payload)

        def phone_emit(kind: str, payload: dict[str, Any]):
            self._emit(kind, payload)

        verified_emails = verifier.verify_emails(emails, do_smtp=self.config.smtp_verify, emit=email_emit, check_catch_all=self.config.deep_email_verify)
        verified_phones = verifier.verify_phones(phones, default_region=self.config.phone_default_region, emit=phone_emit)
        scores = [int(e.get("score", 0)) for e in verified_emails]
        summary = {
            "emails_high": sum(1 for e in verified_emails if e["credibility"] == "high"),
            "emails_medium": sum(1 for e in verified_emails if e["credibility"] == "medium"),
            "emails_low": sum(1 for e in verified_emails if e["credibility"] == "low"),
            "emails_rejected": sum(1 for e in verified_emails if e["credibility"] == "rejected"),
            "emails_confirmed": sum(1 for e in verified_emails if e.get("deliverability") == "confirmed"),
            "emails_likely": sum(1 for e in verified_emails if e.get("deliverability") == "likely"),
            "emails_uncertain": sum(1 for e in verified_emails if e.get("deliverability") == "uncertain"),
            "emails_risky": sum(1 for e in verified_emails if e.get("deliverability") == "risky"),
            "emails_average_score": round(sum(scores) / len(scores), 1) if scores else 0,
            "smtp_valid": sum(1 for e in verified_emails if e.get("smtp_status") == "valid"),
            "smtp_invalid": sum(1 for e in verified_emails if e.get("smtp_status") == "invalid"),
            "smtp_unknown": sum(1 for e in verified_emails if e.get("smtp_status") == "unknown"),
            "smtp_skipped": sum(1 for e in verified_emails if e.get("smtp_status") == "skipped"),
            "spf_present": sum(1 for e in verified_emails if e.get("checks", {}).get("spf") == "present"),
            "dmarc_present": sum(1 for e in verified_emails if e.get("checks", {}).get("dmarc") == "present"),
            "catch_all_detected": sum(1 for e in verified_emails if e.get("checks", {}).get("catch_all") is True),
            "phones_high": sum(1 for p in verified_phones if p["credibility"] == "high"),
            "phones_low": sum(1 for p in verified_phones if p["credibility"] == "low"),
            "phones_rejected": sum(1 for p in verified_phones if p["credibility"] == "rejected"),
        }
        return verified_emails, verified_phones, summary


def run_crawl(payload: dict[str, Any], emit: EventType | None = None) -> CrawlResult:
    phone_default_region = payload.get("phone_default_region")
    if not phone_default_region and (".tn" in (payload.get("url") or payload.get("target_url") or "").lower()):
        phone_default_region = "TN"

    config = CrawlConfig(
        target_url=payload.get("url") or payload.get("target_url"),
        max_pages=int(payload.get("max_pages", 5)),
        same_domain_only=bool(payload.get("same_domain_only", True)),
        delay_seconds=float(payload.get("delay_seconds", 0.5)),
        timeout_seconds=int(payload.get("timeout_seconds", 20)),
        verify_contacts=bool(payload.get("verify_contacts", True)),
        smtp_verify=bool(payload.get("smtp_verify", True)),
        deep_email_verify=bool(payload.get("deep_email_verify", True)),
        phone_default_region=phone_default_region or "FR",
    )
    if not config.target_url:
        raise ValueError("url is required")
    if not config.target_url.startswith(("http://", "https://")):
        config.target_url = "https://" + config.target_url
    return CrawlerService(emit=emit).run(config)


def result_to_json(result: CrawlResult) -> str:
    return json.dumps(result.to_dict(), ensure_ascii=False)
