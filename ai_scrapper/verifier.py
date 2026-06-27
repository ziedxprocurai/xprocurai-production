"""
verifier.py — Email & phone credibility verification for scraped business data.

Email verification (in order, cheapest first — stops early on a clear fail):
  1. Syntax check (regex)
  2. Disposable/fake-pattern check (test@, example.com, noreply@, etc.)
  3. MX record lookup (does the domain even accept mail?)
  4. SMTP RCPT TO probe (does the mailbox itself exist?)

Phone verification (via the `phonenumbers` library, Google's libphonenumber port):
  1. Parse with a default region hint
  2. is_valid_number() — correct length/structure for that region
  3. number_type() — mobile / fixed line / voip / etc.
  4. region/carrier description

Design notes:
- SMTP checks are unreliable by nature: many providers (Gmail, Outlook, Microsoft 365)
  greylist or block probing connections, or accept-all to avoid leaking which addresses
  are real. Results include an explicit "unknown" status — never silently coerced to
  True or False.
- SMTP checks are rate-limited separately from page-crawl delays to avoid getting the
  scraping IP flagged by mail servers.
- MX/SMTP results are cached per-domain within a run, since many emails on one company
  page usually share a domain — no need to repeat the same MX lookup or SMTP handshake.
"""

import re
import secrets
import smtplib
import socket
import time
from collections.abc import Callable
import dns.resolver
import phonenumbers
from phonenumbers import number_type, PhoneNumberType, geocoder, carrier as ph_carrier

# ============================================================
# Config
# ============================================================
DEFAULT_REGION = "FR"          # used to parse phone numbers with no country code
SMTP_TIMEOUT = 8                # seconds per SMTP connection attempt
SMTP_DELAY_SECONDS = 1.5        # politeness delay between SMTP probes (separate from page delay)
SMTP_FROM_ADDRESS = "verify@example.com"   # used in MAIL FROM during the probe
SMTP_HELO_DOMAIN = "example.com"

DISPOSABLE_OR_FAKE_PATTERNS = [
    r"^test@", r"^example@", r"^demo@", r"^sample@", r"^noreply@", r"^no-reply@",
    r"^donotreply@", r"^admin@example\.", r"^user@", r"^foo@", r"^bar@",
    r"@example\.(com|org|net)$", r"@test\.(com|local)$", r"@domain\.(com|tld)$",
    r"@yourcompany\.", r"@yourdomain\.", r"@company\.com$",
]

EMAIL_REGEX = re.compile(r"^[\w\.\-+]+@[\w\.\-]+\.\w+$")

FREE_EMAIL_DOMAINS = {
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.fr", "outlook.com", "live.com", "hotmail.com",
    "icloud.com", "me.com", "proton.me", "protonmail.com", "aol.com", "yandex.com", "gmx.com",
    "mail.com", "zoho.com", "tuta.io", "tutanota.com",
}

DISPOSABLE_DOMAINS = {
    "mailinator.com", "yopmail.com", "tempmail.com", "10minutemail.com", "guerrillamail.com",
    "throwaway.email", "fakeinbox.com", "trashmail.com", "maildrop.cc", "getnada.com",
    "temp-mail.org", "sharklasers.com", "disposable.com",
}

ROLE_BASED_LOCAL_PARTS = {
    "admin", "administration", "contact", "info", "support", "sales", "vente", "secretariat",
    "secretaire", "direction", "dg", "rh", "hr", "compta", "finance", "accueil", "standard",
    "noreply", "no-reply", "donotreply",
}

_mx_cache = {}      # domain -> (has_mx: bool, mx_host: str|None)
_smtp_cache = {}     # email -> result dict (avoid re-probing same address twice in a run)
_txt_cache = {}      # domain -> list[str]


# ============================================================
# Email verification
# ============================================================
def _email_domain(email: str) -> str:
    return email.split("@")[-1].lower()


def _looks_fake(email: str) -> bool:
    email_lower = email.lower()
    domain = _email_domain(email)
    return any(re.search(p, email_lower) for p in DISPOSABLE_OR_FAKE_PATTERNS) or domain in DISPOSABLE_DOMAINS


def _is_free_provider(domain: str) -> bool:
    return domain in FREE_EMAIL_DOMAINS


def _is_role_based(email: str) -> bool:
    local_part = email.split("@")[0].lower()
    normalized = re.sub(r"[^a-z0-9]", "", local_part)
    return normalized in ROLE_BASED_LOCAL_PARTS or any(re.search(rf"(^|[^a-z0-9]){re.escape(part)}([^a-z0-9]|$)", local_part) for part in ROLE_BASED_LOCAL_PARTS)


def _get_txt_records(domain: str) -> list[str]:
    if domain in _txt_cache:
        return _txt_cache[domain]
    try:
        answers = dns.resolver.resolve(domain, "TXT", lifetime=8)
        _txt_cache[domain] = [str(answer).strip('"') for answer in answers]
    except Exception:
        _txt_cache[domain] = []
    return _txt_cache[domain]


def _has_spf(domain: str) -> bool:
    return any(record.startswith("v=spf1") for record in _get_txt_records(domain))


def _has_dmarc(domain: str) -> bool:
    try:
        answers = dns.resolver.resolve(f"_dmarc.{domain}", "TXT", lifetime=8)
        return any(str(answer).strip('"').lower().startswith("v=dmarc1") for answer in answers)
    except Exception:
        return False


def _get_mx_host(domain: str):
    """Look up MX record for a domain. Cached. Returns (has_mx, mx_host)."""
    if domain in _mx_cache:
        return _mx_cache[domain]
    try:
        answers = dns.resolver.resolve(domain, "MX", lifetime=8)
        mx_hosts = sorted(answers, key=lambda r: r.preference)
        mx_host = str(mx_hosts[0].exchange).rstrip(".")
        _mx_cache[domain] = (True, mx_host)
    except Exception:
        _mx_cache[domain] = (False, None)
    return _mx_cache[domain]


def _smtp_probe(email: str, mx_host: str):
    """
    Connect to the mail server and ask if the mailbox exists, without sending mail.
    Returns one of: "valid", "invalid", "unknown" (+ a human-readable reason).

    This is inherently unreliable — many providers won't give a straight answer.
    "unknown" is a legitimate, expected outcome, not an error state.
    """
    if email in _smtp_cache:
        return _smtp_cache[email]

    result = {"smtp_status": "unknown", "smtp_detail": ""}
    server = None
    try:
        time.sleep(SMTP_DELAY_SECONDS)  # politeness / avoid being flagged
        server = smtplib.SMTP(timeout=SMTP_TIMEOUT)
        server.connect(mx_host)
        server.helo(SMTP_HELO_DOMAIN)
        server.mail(SMTP_FROM_ADDRESS)
        code, message = server.rcpt(email)

        if code == 250:
            result = {"smtp_status": "valid", "smtp_detail": "mailbox accepted"}
        elif code in (550, 551, 553):
            result = {"smtp_status": "invalid", "smtp_detail": f"rejected (code {code})"}
        else:
            result = {"smtp_status": "unknown", "smtp_detail": f"ambiguous response (code {code})"}

    except (smtplib.SMTPServerDisconnected, smtplib.SMTPConnectError, socket.timeout, OSError) as e:
        result = {"smtp_status": "unknown", "smtp_detail": f"server blocked probe or unreachable: {e}"}
    except smtplib.SMTPRecipientsRefused:
        result = {"smtp_status": "invalid", "smtp_detail": "recipient refused"}
    except Exception as e:
        result = {"smtp_status": "unknown", "smtp_detail": f"probe failed: {e}"}
    finally:
        if server:
            try:
                server.quit()
            except Exception:
                pass

    _smtp_cache[email] = result
    return result


def _smtp_probe_random(mx_host: str, domain: str) -> dict:
    random_email = f"kilo_verify_{secrets.token_hex(4)}@{domain}"
    return _smtp_probe(random_email, mx_host)


def _score_email(checks: dict) -> tuple[int, str, str, str]:
    if checks["disposable_or_fake"]:
        return 0, "invalid", "high", "disposable or fake-pattern domain"
    if not checks["syntax_valid"]:
        return 0, "invalid", "high", "invalid email syntax"
    if not checks["mx_record"]:
        return 20, "invalid", "high", "domain has no MX record"

    score = 40
    if checks["spf"] == "present":
        score += 8
    elif checks["spf"] == "missing":
        score -= 5
    if checks["dmarc"] == "present":
        score += 7
    elif checks["dmarc"] == "missing":
        score -= 3
    if checks["free_provider"]:
        score -= 5
    if checks["role_based"]:
        score -= 3

    smtp_status = checks["smtp_status"]
    catch_all = checks["catch_all"]
    if smtp_status == "valid":
        score += 35
        if catch_all:
            score -= 10
            deliverability = "risky"
            reason = "SMTP accepted, but domain appears catch-all"
        else:
            deliverability = "confirmed"
            reason = "SMTP accepted the mailbox"
    elif smtp_status == "invalid":
        return 0, "invalid", "high", "SMTP rejected the mailbox"
    elif smtp_status == "unknown":
        score += 18
        deliverability = "uncertain"
        reason = "SMTP probe was inconclusive"
    else:
        deliverability = "likely" if checks["spf"] == "present" and checks["dmarc"] == "present" else "uncertain"
        reason = "Syntax + MX verified; SMTP not run"

    score = max(0, min(100, score))
    if score >= 80:
        credibility = "high"
    elif score >= 65:
        credibility = "medium"
    elif score >= 40:
        credibility = "low"
    else:
        credibility = "rejected"

    risk = "low" if score >= 80 else "medium" if score >= 55 else "high"
    return score, deliverability, risk, reason


def credibility_from_score(score: int) -> str:
    if score >= 80:
        return "high"
    if score >= 65:
        return "medium"
    if score >= 40:
        return "low"
    return "rejected"


def verify_email(email: str, do_smtp: bool = True, emit: Callable | None = None, check_catch_all: bool = True) -> dict:
    """
    Returns a dict:
    {
        "email": str,
        "syntax_valid": bool,
        "is_disposable_or_fake_pattern": bool,
        "has_mx_record": bool | None,
        "mx_host": str | None,
        "smtp_status": "valid" | "invalid" | "unknown" | "skipped",
        "smtp_detail": str,
        "credibility": "high" | "medium" | "low" | "rejected",
        "score": int,
        "deliverability": "confirmed" | "likely" | "uncertain" | "risky" | "invalid",
        "risk": "low" | "medium" | "high",
        "reason": str,
        "checks": dict,
    }
    """
    email = email.strip()
    out = {
        "email": email,
        "syntax_valid": False,
        "is_disposable_or_fake_pattern": False,
        "has_mx_record": None,
        "mx_host": None,
        "smtp_status": "skipped",
        "smtp_detail": "",
        "credibility": "rejected",
        "score": 0,
        "deliverability": "uncertain",
        "risk": "high",
        "reason": "",
        "checks": {},
    }

    def notify(kind: str, payload: dict | None = None):
        if emit:
            emit(kind, {"email": email, **(payload or {})})

    # 1. Syntax
    out["syntax_valid"] = bool(EMAIL_REGEX.match(email))
    if not out["syntax_valid"]:
        notify("email_syntax_failed")
        out["credibility"] = "rejected"
        return out
    notify("email_syntax_valid")

    # 2. Fake/disposable pattern check
    out["is_disposable_or_fake_pattern"] = _looks_fake(email)
    if out["is_disposable_or_fake_pattern"]:
        notify("email_fake_pattern")
        out["credibility"] = "rejected"
        return out

    # 3. MX record
    domain = _email_domain(email)
    has_mx, mx_host = _get_mx_host(domain)
    spf_present = _has_spf(domain) if has_mx else False
    dmarc_present = _has_dmarc(domain) if has_mx else False
    free_provider = _is_free_provider(domain)
    role_based = _is_role_based(email)
    out["has_mx_record"] = has_mx
    out["mx_host"] = mx_host
    notify("email_mx_checked", {"domain": domain, "has_mx_record": has_mx, "mx_host": mx_host})
    notify("email_dns_checked", {"domain": domain, "spf": spf_present, "dmarc": dmarc_present, "free_provider": free_provider, "role_based": role_based})

    checks = {
        "syntax_valid": out["syntax_valid"],
        "disposable_or_fake": out["is_disposable_or_fake_pattern"],
        "free_provider": free_provider,
        "role_based": role_based,
        "mx_record": bool(has_mx),
        "mx_host": mx_host,
        "spf": "present" if spf_present else "missing" if has_mx else "unchecked",
        "dmarc": "present" if dmarc_present else "missing" if has_mx else "unchecked",
        "smtp_status": "skipped",
        "smtp_detail": "",
        "catch_all": None,
    }

    if not has_mx:
        notify("email_no_mx")
        score, deliverability, risk, reason = _score_email(checks)
        out.update({"credibility": "low", "score": score, "deliverability": deliverability, "risk": risk, "reason": reason, "checks": checks})
        return out

    # 4. SMTP probe (optional — slower, sometimes blocked)
    if do_smtp:
        notify("email_smtp_probe_start")
        smtp_result = _smtp_probe(email, mx_host)
        checks["smtp_status"] = smtp_result["smtp_status"]
        checks["smtp_detail"] = smtp_result["smtp_detail"]
        out["smtp_status"] = smtp_result["smtp_status"]
        out["smtp_detail"] = smtp_result["smtp_detail"]
        notify("email_smtp_probe_done", {"smtp_status": smtp_result["smtp_status"], "smtp_detail": smtp_result["smtp_detail"]})

        if smtp_result["smtp_status"] == "valid" and check_catch_all:
            notify("email_catch_all_probe_start")
            catch_all_result = _smtp_probe_random(mx_host, domain)
            checks["catch_all"] = catch_all_result["smtp_status"] == "valid"
            notify("email_catch_all_probe_done", {"catch_all": checks["catch_all"], "probe_status": catch_all_result["smtp_status"], "probe_detail": catch_all_result["smtp_detail"]})
    else:
        notify("email_smtp_skipped")

    score, deliverability, risk, reason = _score_email(checks)
    out.update({"credibility": credibility_from_score(score), "score": score, "deliverability": deliverability, "risk": risk, "reason": reason, "checks": checks})
    notify("email_scored", {"score": score, "credibility": out["credibility"], "deliverability": deliverability, "risk": risk, "reason": reason})

    return out


# ============================================================
# Phone verification
# ============================================================
_TYPE_NAMES = {
    PhoneNumberType.FIXED_LINE: "fixed_line",
    PhoneNumberType.MOBILE: "mobile",
    PhoneNumberType.FIXED_LINE_OR_MOBILE: "fixed_line_or_mobile",
    PhoneNumberType.TOLL_FREE: "toll_free",
    PhoneNumberType.PREMIUM_RATE: "premium_rate",
    PhoneNumberType.SHARED_COST: "shared_cost",
    PhoneNumberType.VOIP: "voip",
    PhoneNumberType.PERSONAL_NUMBER: "personal_number",
    PhoneNumberType.PAGER: "pager",
    PhoneNumberType.UAN: "uan",
    PhoneNumberType.VOICEMAIL: "voicemail",
    PhoneNumberType.UNKNOWN: "unknown",
}


def verify_phone(raw_number: str, default_region: str = DEFAULT_REGION, emit: Callable | None = None) -> dict:
    """
    Returns a dict:
    {
        "raw": str,
        "parsed_e164": str | None,
        "is_valid": bool,
        "is_possible": bool,
        "number_type": str,
        "region": str | None,
        "carrier": str | None,
        "credibility": "high" | "medium" | "rejected",
    }
    """
    out = {
        "raw": raw_number,
        "parsed_e164": None,
        "is_valid": False,
        "is_possible": False,
        "number_type": "unknown",
        "region": None,
        "carrier": None,
        "credibility": "rejected",
    }

    def notify(kind: str, payload: dict | None = None):
        if emit:
            emit(kind, {"raw": raw_number, **(payload or {})})

    try:
        parsed = phonenumbers.parse(raw_number, default_region)
    except phonenumbers.NumberParseException as e:
        notify("phone_parse_failed", {"error": str(e)})
        out["credibility"] = "rejected"
        return out

    out["is_possible"] = phonenumbers.is_possible_number(parsed)
    out["is_valid"] = phonenumbers.is_valid_number(parsed)
    notify("phone_parsed", {"is_possible": out["is_possible"], "is_valid": out["is_valid"]})

    if not out["is_valid"]:
        out["credibility"] = "rejected" if not out["is_possible"] else "low"
        notify("phone_invalid")
        return out

    out["parsed_e164"] = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    out["number_type"] = _TYPE_NAMES.get(number_type(parsed), "unknown")
    out["region"] = geocoder.description_for_number(parsed, "en") or None

    try:
        out["carrier"] = ph_carrier.name_for_number(parsed, "en") or None
    except Exception:
        out["carrier"] = None

    notify("phone_verified", {"parsed_e164": out["parsed_e164"], "number_type": out["number_type"], "region": out["region"], "carrier": out["carrier"]})

    # Valid + real structure = high confidence. (No live reachability check, that's a paid-API tier.)
    out["credibility"] = "high"
    return out


# ============================================================
# Batch helpers — used by the crawler
# ============================================================
def verify_emails(emails: list, do_smtp: bool = True, emit: Callable | None = None, check_catch_all: bool = True) -> list:
    return [verify_email(e, do_smtp=do_smtp, emit=emit, check_catch_all=check_catch_all) for e in emails]


def verify_phones(phones: list, default_region: str = DEFAULT_REGION, emit: Callable | None = None) -> list:
    return [verify_phone(p, default_region=default_region, emit=emit) for p in phones]


if __name__ == "__main__":
    # Quick manual test
    test_emails = ["contact@kompass.com", "test@example.com", "fake@nonexistentdomain12345.com"]
    test_phones = ["+33 1 42 68 53 00", "0142685300", "not a phone"]

    print("--- Email tests ---")
    for e in test_emails:
        print(verify_email(e, do_smtp=True))

    print("\n--- Phone tests ---")
    for p in test_phones:
        print(verify_phone(p))
