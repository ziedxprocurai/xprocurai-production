#!/usr/bin/env python3
"""
Expert Business Deep Crawler - Scrapes parent page + all child pages
Now with integrated credibility verification for emails and phones.
Change only TARGET_URL and MAX_PAGES
"""
import os
import json
import sqlite3
import requests
import datetime
import re
import time
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage

import verifier  # ← new: email/phone credibility verification module

load_dotenv()

# ============================================================
# ✅ CHANGE ONLY THESE
TARGET_URL = "https://fr.solutions.kompass.com/solutions/solution-prospection-easybusiness/"
MAX_PAGES = 20        # max pages to crawl (increase if you want more)
SAME_DOMAIN_ONLY = True  # True = only crawl links on same domain
DELAY_SECONDS = 1     # delay between requests (be polite)

# ── Verification settings ──────────────────────────────────
VERIFY_CONTACTS = True       # set False to skip verification entirely
SMTP_VERIFY = True           # set False to skip SMTP mailbox probing (syntax+MX only, much faster)
PHONE_DEFAULT_REGION = "FR"  # used when a phone number has no country code
# ============================================================

print(f"🕷️  Expert Business Deep Crawler")
print(f"   Start URL : {TARGET_URL}")
print(f"   Max Pages : {MAX_PAGES}")
print(f"   Verify contacts : {VERIFY_CONTACTS} (SMTP: {SMTP_VERIFY})")
print("=" * 60)

# ── Helpers ───────────────────────────────────────────────
BASE_DOMAIN = urlparse(TARGET_URL).netloc

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

def fetch_page(url):
    """Fetch a page and return soup + raw html"""
    try:
        session = requests.Session()
        response = session.get(url, headers=headers, timeout=20)
        if response.status_code != 200:
            print(f"    ⚠️ Status {response.status_code} for {url}")
            return None, None, None
        soup = BeautifulSoup(response.text, "html.parser")
        # Remove noise
        for tag in soup(["script", "style", "nav", "footer", "iframe", "noscript"]):
            tag.decompose()
        page_text = soup.get_text(separator="\n", strip=True)[:15000]
        return soup, page_text, response.text
    except Exception as e:
        print(f"    ✗ Failed: {e}")
        return None, None, None

def extract_links(soup, base_url):
    """Extract all valid links from a page"""
    links = set()
    for a in soup.find_all('a', href=True):
        href = a.get('href', '')
        full_url = urljoin(base_url, href)
        parsed = urlparse(full_url)
        # Filter: only http/https, same domain if required, no files
        if parsed.scheme not in ('http', 'https'):
            continue
        if SAME_DOMAIN_ONLY and parsed.netloc != BASE_DOMAIN:
            continue
        if any(full_url.endswith(ext) for ext in ['.pdf', '.jpg', '.png', '.zip', '.doc', '.xls']):
            continue
        if '#' in full_url:
            full_url = full_url.split('#')[0]
        if full_url:
            links.add(full_url)
    return links

def extract_contact_info(raw_html):
    """Extract emails and phones directly from HTML"""
    emails = list(set(re.findall(r'[\w\.-]+@[\w\.-]+\.\w+', raw_html)))
    phones = list(set(re.findall(r'[\+\(]?[0-9][0-9\s\-\(\)]{7,}[0-9]', raw_html)))
    return emails, phones

def verify_contacts(emails, phones):
    """
    Run credibility verification on extracted emails/phones.
    Returns (verified_emails, verified_phones, summary) where the verified lists
    are lists of result dicts (see verifier.py for schema), and summary is a
    quick counts dict useful for logging.
    """
    if not VERIFY_CONTACTS:
        return [], [], {}

    verified_emails = verifier.verify_emails(emails, do_smtp=SMTP_VERIFY)
    verified_phones = verifier.verify_phones(phones, default_region=PHONE_DEFAULT_REGION)

    summary = {
        "emails_high": sum(1 for e in verified_emails if e["credibility"] == "high"),
        "emails_medium": sum(1 for e in verified_emails if e["credibility"] == "medium"),
        "emails_low_or_rejected": sum(1 for e in verified_emails if e["credibility"] in ("low", "rejected")),
        "phones_high": sum(1 for p in verified_phones if p["credibility"] == "high"),
        "phones_rejected": sum(1 for p in verified_phones if p["credibility"] in ("low", "rejected")),
    }
    return verified_emails, verified_phones, summary

# ── Step 1: Setup LLMs ────────────────────────────────────
print("\n✓ Setting up LLMs...")
groq_api_key = os.getenv("GROQ_API_KEY")
google_api_key = os.getenv("GOOGLE_API_KEY")

scraping_llm = None
cleaner_llm = None

if groq_api_key:
    try:
        from langchain_groq import ChatGroq
        scraping_llm = ChatGroq(model="llama-3.3-70b-versatile", api_key=groq_api_key, temperature=0)
        cleaner_llm = ChatGroq(model="llama-3.3-70b-versatile", api_key=groq_api_key, temperature=0)
        print("  ✓ LLMs ready (Groq - Llama 3.3 70B)")
    except Exception as e:
        print(f"  ⚠️ Groq failed: {e}")

if not scraping_llm and google_api_key:
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        scraping_llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", google_api_key=google_api_key, temperature=0)
        cleaner_llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", google_api_key=google_api_key, temperature=0)
        print("  ✓ LLMs ready (Google Gemini 2.0 Flash)")
    except Exception as e:
        print(f"  ⚠️ Gemini failed: {e}")

if not scraping_llm:
    try:
        from langchain_ollama import ChatOllama
        scraping_llm = ChatOllama(model="llama3.2", temperature=0)
        cleaner_llm = ChatOllama(model="llama3.2", temperature=0)
        print("  ✓ LLMs ready (Ollama - local)")
    except Exception as e:
        print(f"  ✗ All LLM options failed: {e}")
        exit(1)

# ── Step 2: Setup ScrapeGraphAI ───────────────────────────
from scrapegraphai.graphs import SmartScraperGraph

graph_config = {
    "llm": {
        "model_instance": scraping_llm,
        "model_tokens": 8192,
    },
    "verbose": False,  # quiet mode for bulk crawling
    "headless": True,
}

BUSINESS_EXTRACT_PROMPT = """
You are an expert business data extractor. Extract ALL business information from this page.

Extract every piece of data including:
- Company name, brand names, taglines, description
- Industry, sector, categories
- Year founded, number of employees, revenue, company size
- Legal form, registration number, VAT, SIRET/SIREN
- Certifications, awards
- Full address (street, city, postal code, country)
- ALL phone numbers and fax numbers
- ALL email addresses
- Website URLs and social media links
- ALL products and services with descriptions and prices
- Names and titles of key people (CEO, Director, Manager)
- Keywords, target markets, regions served, export countries
- Any pricing, statistics, dates, partnerships
- Any links to documents or downloads

Extract EVERYTHING. Never return NA or None for fields that have data.
"""

def scrape_single_page(url, page_text, emails, phones, links):
    """Run AI extraction on a single page"""
    try:
        scraper = SmartScraperGraph(
            prompt=BUSINESS_EXTRACT_PROMPT,
            source=page_text,
            config=graph_config,
        )
        raw_result = scraper.run()
        if isinstance(raw_result, dict):
            raw_text = json.dumps(raw_result, ensure_ascii=False)
        else:
            raw_text = str(raw_result)
        return raw_text
    except Exception as e:
        print(f"    ⚠️ ScrapeGraphAI error: {e}, using raw text")
        return page_text[:5000]

def clean_to_json(url, raw_text, page_text, emails, phones, links):
    """Clean raw extraction into structured business JSON"""
    CLEAN_PROMPT = f"""
You are an expert business data formatter.
Convert this raw extracted business data into a clean complete JSON object.

EXTRACTED DATA:
{raw_text}

RAW PAGE TEXT:
{page_text[:3000]}

EMAILS FOUND: {emails}
PHONES FOUND: {phones}

Output ONLY a JSON object. No markdown, no backticks, no explanation.
Start directly with {{ and end with }}.

{{
    "url": "{url}",
    "scraped_at": "{datetime.datetime.now().isoformat()}",
    "company": {{
        "name": "",
        "brand_names": [],
        "tagline": "",
        "description": "",
        "industry": "",
        "sector": "",
        "categories": [],
        "year_founded": "",
        "employees": "",
        "revenue": "",
        "company_size": "",
        "legal_form": "",
        "registration_number": "",
        "vat_number": "",
        "certifications": [],
        "awards": []
    }},
    "contact": {{
        "address": {{
            "street": "",
            "city": "",
            "postal_code": "",
            "country": "",
            "full_address": ""
        }},
        "phones": [],
        "fax": [],
        "emails": [],
        "website": "",
        "social_media": {{
            "linkedin": "",
            "facebook": "",
            "twitter": "",
            "instagram": "",
            "youtube": ""
        }}
    }},
    "products_services": [
        {{"name": "", "description": "", "price": "", "category": ""}}
    ],
    "people": [
        {{"name": "", "title": "", "department": "", "email": "", "phone": ""}}
    ],
    "business_details": {{
        "keywords": [],
        "target_markets": [],
        "regions_served": [],
        "export_countries": [],
        "number_of_clients": "",
        "partnerships": [],
        "affiliations": []
    }},
    "statistics": [],
    "dates": [],
    "documents": [],
    "page_links": {json.dumps(links[:10])}
}}

Fill every field from the data. Empty string for missing text, [] for missing lists.
Keep original language. Start with {{ directly.
"""
    try:
        response = cleaner_llm.invoke([HumanMessage(content=CLEAN_PROMPT)])
        cleaned_text = response.content.strip()
        start = cleaned_text.find("{")
        end = cleaned_text.rfind("}") + 1
        if start != -1 and end > start:
            return json.loads(cleaned_text[start:end])
    except Exception as e:
        print(f"    ⚠️ JSON cleaning failed: {e}")
    return {"url": url, "error": "failed to parse", "raw": raw_text[:1000]}

# ── Step 3: Setup SQLite DB ───────────────────────────────
db_path = "business_scraper.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("""
    CREATE TABLE IF NOT EXISTS businesses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT UNIQUE,
        scraped_at TEXT,
        company_name TEXT,
        industry TEXT,
        city TEXT,
        country TEXT,
        phones TEXT,
        emails TEXT,
        website TEXT,
        description TEXT,
        products_services TEXT,
        people TEXT,
        social_media TEXT,
        raw_json TEXT,
        verified_emails TEXT,
        verified_phones TEXT,
        verification_summary TEXT
    )
""")
# Backward-compatible: add the new columns if this DB already existed from a prior run
for col in ["verified_emails", "verified_phones", "verification_summary"]:
    try:
        cursor.execute(f"ALTER TABLE businesses ADD COLUMN {col} TEXT")
    except sqlite3.OperationalError:
        pass  # column already exists
conn.commit()

# ── Step 4: Deep Crawl ────────────────────────────────────
print(f"\n✓ Starting deep crawl from: {TARGET_URL}")
print(f"  Max pages: {MAX_PAGES} | Same domain only: {SAME_DOMAIN_ONLY}")
print("-" * 60)

visited = set()
to_visit = [TARGET_URL]
all_results = []
page_count = 0

while to_visit and page_count < MAX_PAGES:
    url = to_visit.pop(0)

    if url in visited:
        continue
    visited.add(url)
    page_count += 1

    print(f"\n[{page_count}/{MAX_PAGES}] Scraping: {url}")

    # Fetch page
    soup, page_text, raw_html = fetch_page(url)
    if not soup:
        continue

    # Extract contact info directly
    emails, phones = extract_contact_info(raw_html)
    child_links = extract_links(soup, url)

    # Add new links to queue
    new_links = child_links - visited - set(to_visit)
    to_visit.extend(list(new_links))
    print(f"  Found {len(child_links)} links, {len(new_links)} new to queue")
    print(f"  Emails: {emails[:3]} | Phones: {phones[:3]}")

    # Verify contact credibility (new step)
    verified_emails, verified_phones, verify_summary = [], [], {}
    if emails or phones:
        print(f"  Verifying {len(emails)} email(s), {len(phones)} phone(s)...")
        verified_emails, verified_phones, verify_summary = verify_contacts(emails, phones)
        if verify_summary:
            print(f"  Verification: {verify_summary}")

    # AI extraction
    print(f"  Running AI extraction...")
    raw_text = scrape_single_page(url, page_text, emails, phones, list(child_links)[:10])

    # Clean to JSON
    print(f"  Cleaning to JSON...")
    result = clean_to_json(url, raw_text, page_text, emails, phones, list(child_links)[:10])

    # Attach verification results to the result object
    result["contact_verification"] = {
        "emails": verified_emails,
        "phones": verified_phones,
        "summary": verify_summary,
    }
    all_results.append(result)

    # Save to DB
    try:
        company = result.get("company", {})
        contact = result.get("contact", {})
        cursor.execute("""
            INSERT OR REPLACE INTO businesses (
                url, scraped_at, company_name, industry,
                city, country, phones, emails, website,
                description, products_services, people,
                social_media, raw_json,
                verified_emails, verified_phones, verification_summary
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            result.get("url", url),
            result.get("scraped_at", datetime.datetime.now().isoformat()),
            company.get("name", ""),
            company.get("industry", ""),
            contact.get("address", {}).get("city", ""),
            contact.get("address", {}).get("country", ""),
            json.dumps(contact.get("phones", []), ensure_ascii=False),
            json.dumps(contact.get("emails", []), ensure_ascii=False),
            contact.get("website", ""),
            company.get("description", ""),
            json.dumps(result.get("products_services", []), ensure_ascii=False),
            json.dumps(result.get("people", []), ensure_ascii=False),
            json.dumps(contact.get("social_media", {}), ensure_ascii=False),
            json.dumps(result, ensure_ascii=False),
            json.dumps(verified_emails, ensure_ascii=False),
            json.dumps(verified_phones, ensure_ascii=False),
            json.dumps(verify_summary, ensure_ascii=False),
        ))
        conn.commit()
        print(f"  ✅ Saved to DB")
    except Exception as e:
        print(f"  ⚠️ DB save error: {e}")

    # Delay between requests
    time.sleep(DELAY_SECONDS)

conn.close()

# ── Step 5: Save all results to JSON ─────────────────────
domain = urlparse(TARGET_URL).netloc
timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
json_filename = f"crawl_{domain}_{timestamp}.json"

with open(json_filename, "w", encoding="utf-8") as f:
    json.dump({
        "crawl_info": {
            "start_url": TARGET_URL,
            "pages_crawled": page_count,
            "crawled_at": datetime.datetime.now().isoformat(),
            "verification_enabled": VERIFY_CONTACTS,
            "smtp_verification_enabled": SMTP_VERIFY,
        },
        "pages": all_results
    }, f, indent=4, ensure_ascii=False)

print(f"\n{'=' * 60}")
print(f"✅ Crawl complete!")
print(f"  Pages crawled : {page_count}")
print(f"  JSON saved    : {json_filename}")
print(f"  DB saved      : {db_path}")
print(f"{'=' * 60}")