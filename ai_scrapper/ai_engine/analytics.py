from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from .database import utc_now


def _sql_generate(question: str) -> str | None:
    q = question.lower()
    if any(kw in q for kw in ["spend", "spent", "dépens", "budget", "cost", "montant", "total", "combien"]):
        if "packaging" in q or "emballage" in q:
            return "SELECT SUM(total_amount) as total_spend, currency, COUNT(*) as tx_count FROM quotes WHERE strftime('%Y', created_at) = ?"
        if "supplier" in q or "fournisseur" in q:
            return "SELECT supplier_name, SUM(total_amount) as total_spend, COUNT(*) as tx_count, AVG(total_amount) as avg_amount FROM quotes GROUP BY supplier_name ORDER BY total_spend DESC"
        if "month" in q or "mois" in q or "monthly" in q:
            return "SELECT strftime('%Y-%m', created_at) as month, SUM(total_amount) as total_spend, COUNT(*) as tx_count FROM quotes GROUP BY month ORDER BY month DESC"
        if "category" in q or "catégorie" in q:
            return "SELECT c.category, SUM(q.total_amount) as total_spend, COUNT(*) as tx_count FROM rfqs r JOIN quotes q ON r.id = q.rfq_id, json_each(r.items_json) je, json_extract(je.value, '$.category') c GROUP BY c ORDER BY total_spend DESC"
        if "last year" in q or "année dernière" in q or "dernière année" in q:
            return "SELECT SUM(total_amount) as total_spend, COUNT(*) as tx_count, AVG(total_amount) as avg_amount FROM quotes WHERE strftime('%Y', created_at) = ?"
        return "SELECT SUM(total_amount) as total_spend, COUNT(*) as tx_count, AVG(total_amount) as avg_amount, currency FROM quotes"
    if any(kw in q for kw in ["best", "meilleur", "top", "performance", "performant"]):
        if "supplier" in q or "fournisseur" in q:
            return "SELECT s.name, s.score, s.categories_json, COUNT(q.id) as quote_count, SUM(q.total_amount) as total_spend FROM suppliers s LEFT JOIN quotes q ON s.id = q.supplier_id GROUP BY s.id ORDER BY s.score DESC, total_spend DESC"
        return "SELECT supplier_name, SUM(total_amount) as total_spend, COUNT(*) as tx_count, AVG(total_amount) as avg_amount FROM quotes GROUP BY supplier_name ORDER BY avg_amount ASC, total_spend DESC"
    if any(kw in q for kw in ["risk", "risque", "assessment", "risk_assessments"]):
        return "SELECT rfq_id, risk_score, risk_level, flags_json, created_at FROM risk_assessments ORDER BY risk_score DESC, created_at DESC LIMIT 20"
    if any(kw in q for kw in ["recent", "dernier", "récent", "latest", "history"]):
        return "SELECT r.title, q.supplier_name, q.total_amount, q.currency, q.created_at FROM rfqs r JOIN quotes q ON r.id = q.rfq_id ORDER BY q.created_at DESC LIMIT 20"
    if any(kw in q for kw in ["list", "lister", "all", "tous"]):
        if "rfq" in q or "demande" in q:
            return "SELECT title, budget, currency, urgency, created_at FROM rfqs ORDER BY created_at DESC LIMIT 50"
        if "supplier" in q or "fournisseur" in q:
            return "SELECT name, city, country, score, source FROM suppliers ORDER BY score DESC"
        return "SELECT r.title, q.supplier_name, q.total_amount, q.created_at FROM rfqs r JOIN quotes q ON r.id = q.rfq_id ORDER BY q.created_at DESC LIMIT 30"
    return None


def execute_analytics_query(db_path: str | Path, question: str) -> dict[str, Any]:
    sql = _sql_generate(question)
    if not sql:
        return {"error": "Could not generate SQL for this question. Try asking about spend, suppliers, RFQs, or risk."}

    params: list[Any] = []
    q = question.lower()
    if "last year" in q or "année dernière" in q or "dernière année" in q:
        last_year = str(datetime.now().year - 1)
        params = [last_year]

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.execute(sql, params)
        rows = [dict(row) for row in cursor.fetchall()]
        conn.close()
        summary = _summarize_results(rows, question)
        return {"sql": sql, "params": params, "rows": rows, "row_count": len(rows), "summary": summary}
    except Exception as exc:
        return {"sql": sql, "params": params, "error": str(exc)}


def _summarize_results(rows: list[dict[str, Any]], question: str) -> str:
    if not rows:
        return "No records found matching your query."

    first = rows[0]
    parts: list[str] = []

    if "total_spend" in first:
        val = first.get("total_spend")
        currency = first.get("currency", "")
        if val is not None:
            parts.append(f"Total spend: {val:,.2f} {currency}".strip())
    if "avg_amount" in first and first.get("avg_amount") is not None:
        parts.append(f"Average: {first['avg_amount']:,.2f}")
    if "tx_count" in first:
        parts.append(f"{first['tx_count']} transaction(s)")
    if "supplier_name" in first:
        parts.append(f"Top supplier: {first.get('supplier_name')}")
    if "risk_score" in first:
        parts.append(f"Risk score: {first.get('risk_score')}")
    if "month" in first:
        parts.append(f"Period: {first.get('month')}")

    narrative = "; ".join(parts) if parts else f"{len(rows)} record(s) returned."
    return narrative


def get_dashboard_metrics(db_path: str | Path) -> dict[str, Any]:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        total_spend = conn.execute("SELECT COALESCE(SUM(total_amount),0) as v FROM quotes").fetchone()["v"]
        total_rfqs = conn.execute("SELECT COUNT(*) as v FROM rfqs").fetchone()["v"]
        total_quotes = conn.execute("SELECT COUNT(*) as v FROM quotes").fetchone()["v"]
        total_suppliers = conn.execute("SELECT COUNT(*) as v FROM suppliers").fetchone()["v"]
        avg_quote = conn.execute("SELECT COALESCE(AVG(total_amount),0) as v FROM quotes").fetchone()["v"]
        top_supplier = conn.execute("SELECT supplier_name, SUM(total_amount) as total FROM quotes GROUP BY supplier_name ORDER BY total DESC LIMIT 1").fetchone()
        recent_risk = conn.execute("SELECT AVG(risk_score) as v FROM risk_assessments").fetchone()["v"]
        monthly = conn.execute(
            "SELECT strftime('%Y-%m', created_at) as month, SUM(total_amount) as total FROM quotes GROUP BY month ORDER BY month DESC LIMIT 6"
        ).fetchall()
        monthly_data = [{"month": r["month"], "total": r["total"]} for r in monthly]
        return {
            "total_spend": round(total_spend, 2),
            "total_rfqs": total_rfqs,
            "total_quotes": total_quotes,
            "total_suppliers": total_suppliers,
            "average_quote_amount": round(avg_quote, 2),
            "top_supplier": dict(top_supplier) if top_supplier else None,
            "average_risk_score": round(recent_risk, 1) if recent_risk is not None else None,
            "monthly_spend": list(reversed(monthly_data)),
        }
    finally:
        conn.close()
