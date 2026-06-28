from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from .schemas import to_jsonable
from .database import utc_now

ERP_PROVIDERS = {
    "odoo": {"name": "Odoo", "version": "17.0", "models": ["purchase.order", "res.partner", "product.product", "stock.quant"]},
    "sap": {"name": "SAP S/4HANA", "version": "2023", "models": ["EKPO", "EKKO", "LFA1", "MARA"]},
    "netsuite": {"name": "Oracle NetSuite", "version": "2024.1", "models": ["purchaseorder", "vendor", "item", "inventoryitem"]},
    "dynamics": {"name": "Microsoft Dynamics 365", "version": "2024", "models": ["PurchLine", "PurchTable", "VendTable", "InventTable"]},
}


def erp_provider_status() -> dict[str, Any]:
    return {
        "supported_providers": [
            {"key": key, **value} for key, value in ERP_PROVIDERS.items()
        ],
        "mode": "simulated",
        "note": "ERP connectors are simulated. Real integrations require Odoo XML-RPC/REST, SAP RFC/ODATA, NetSuite SuiteTalk, or Dynamics 365 Web API credentials.",
    }


def sync_supplier_to_erp(supplier: dict[str, Any], provider: str = "odoo") -> dict[str, Any]:
    normalized = _normalize_supplier(supplier, provider)
    if provider not in ERP_PROVIDERS:
        return {"success": False, "error": f"Unsupported ERP provider: {provider}"}
    record_id = f"ERP-{provider[:3].upper()}-{uuid.uuid4().hex[:8]}"
    sync_log = {
        "record_id": record_id,
        "provider": ERP_PROVIDERS[provider]["name"],
        "direction": "outbound",
        "action": "create_or_update",
        "model": ERP_PROVIDERS[provider]["models"][1],
        "payload": normalized,
        "status": "simulated",
        "message": f"Would create/update {ERP_PROVIDERS[provider]['name']} vendor record for {supplier.get('name', 'Unknown')}",
        "field_mappings": _build_field_mapping("supplier", provider),
        "created_at": utc_now(),
    }
    return {"success": True, "sync": sync_log}


def create_purchase_order(
    rfq: dict[str, Any],
    supplier: dict[str, Any],
    quotes: list[dict[str, Any]] | None = None,
    provider: str = "odoo",
) -> dict[str, Any]:
    if provider not in ERP_PROVIDERS:
        return {"success": False, "error": f"Unsupported ERP provider: {provider}"}
    best_quote = (quotes or [{}])[0] if quotes else {}
    if not best_quote.get("total_amount"):
        return {"success": False, "error": "No valid quote to create purchase order"}

    erp_info = ERP_PROVIDERS[provider]
    normalized_rfq = _normalize_rfq(rfq, provider)
    normalized_supplier = _normalize_supplier(supplier, provider)
    normalized_lines = _normalize_quote_lines(rfq, best_quote, provider)

    po_id = f"PO-{provider[:3].upper()}-{uuid.uuid4().hex[:8]}"
    po_payload = {
        "id": po_id,
        "rfq_title": rfq.get("title") or "Procurement",
        "supplier_name": supplier.get("name"),
        "supplier_id": normalized_supplier.get("erp_id"),
        "total_amount": best_quote.get("total_amount"),
        "currency": best_quote.get("currency") or rfq.get("currency") or "TND",
        "delivery_days": best_quote.get("delivery_days"),
        "payment_terms": best_quote.get("payment_terms") or "Net 30",
        "order_date": datetime.now().strftime("%Y-%m-%d"),
        "lines": normalized_lines,
        "model": erp_info["models"][0],
    }
    sync_log = {
        "record_id": po_id,
        "provider": erp_info["name"],
        "direction": "outbound",
        "action": "create",
        "model": erp_info["models"][0],
        "payload": po_payload,
        "status": "simulated",
        "message": f"Would create purchase order {po_id} in {erp_info['name']}",
        "field_mappings": _build_field_mapping("po", provider),
        "created_at": utc_now(),
    }
    return {"success": True, "po_id": po_id, "sync": sync_log}


def sync_inventory_update(rfq: dict[str, Any], db_path: str | Path) -> dict[str, Any]:
    items = rfq.get("items") or []
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    updates: list[dict[str, Any]] = []
    try:
        for item in items:
            item_name = item.get("name") or "unknown"
            qty = int(item.get("quantity") or 1)
            updates.append({
                "item_name": item_name,
                "quantity_delta": -qty,
                "reason": "purchase_order_created",
                "rfq_title": rfq.get("title") or "Procurement",
                "simulated": True,
                "message": f"Would reduce inventory of {item_name} by {qty} units in ERP",
            })
        return {"success": True, "provider": "local_db", "updates": updates, "count": len(updates)}
    finally:
        conn.close()


def _normalize_supplier(supplier: dict[str, Any], provider: str) -> dict[str, Any]:
    base = {k: supplier.get(k) for k in ["name", "website", "country", "city", "description"] if supplier.get(k)}
    base["erp_id"] = f"ERP-{uuid.uuid4().hex[:8]}"
    base["categories"] = supplier.get("categories", [])
    base["capabilities"] = supplier.get("capabilities", [])
    base["certifications"] = supplier.get("certifications", [])
    base["contacts"] = supplier.get("contacts", {})
    base["score"] = supplier.get("score", 0)
    return base


def _normalize_rfq(rfq: dict[str, Any], provider: str) -> dict[str, Any]:
    return {
        "title": rfq.get("title") or "Procurement",
        "description": rfq.get("description") or "",
        "location": rfq.get("location") or "",
        "budget": rfq.get("budget"),
        "currency": rfq.get("currency") or "TND",
        "delivery_deadline_days": rfq.get("delivery_deadline_days"),
        "urgency": rfq.get("urgency") or "normal",
        "items": [to_jsonable(item) if hasattr(item, "to_dict") else item for item in (rfq.get("items") or [])],
        "extracted_by": rfq.get("extracted_by") or "erp",
    }


def _normalize_quote_lines(rfq: dict[str, Any], quote: dict[str, Any], provider: str) -> list[dict[str, Any]]:
    rfq_items = rfq.get("items") or []
    quote_lines = quote.get("lines") or []
    lines: list[dict[str, Any]] = []
    for index, item in enumerate(rfq_items):
        best_line = None
        best_score = 0.0
        for line in quote_lines:
            desc = (line.get("description") or "").lower()
            item_name = (item.get("name") or "").lower()
            score = len(set(desc.split()) & set(item_name.split()))
            if score > best_score:
                best_score = score
                best_line = line
        unit_price = (best_line or {}).get("unit_price")
        if unit_price is None and quote.get("total_amount") and rfq_items:
            qty = item.get("quantity") or 1
            unit_price = round(quote["total_amount"] / qty, 2)
        unit_price = unit_price or 0.0
        qty = item.get("quantity") or 1
        lines.append({
            "line_index": index + 1,
            "item_name": item.get("name"),
            "description": (best_line or {}).get("description") or item.get("name"),
            "quantity": int(qty),
            "unit_price": unit_price,
            "line_total": round(unit_price * qty, 2),
            "currency": quote.get("currency") or rfq.get("currency") or "TND",
        })
    return lines


def _build_field_mapping(kind: str, provider: str) -> dict[str, str]:
    if kind == "supplier":
        return {
            "Odoo": {"name": "name", "email": "email", "phone": "phone", "city": "city", "country": "country", "category": "category_id"},
            "SAP S/4HANA": {"name": "LFA1.NAME1", "city": "LFA1.ORT01", "country": "LFA1.LAND1"},
            "Oracle NetSuite": {"name": "companyname", "email": "email", "country": "country"},
            "Microsoft Dynamics 365": {"name": "Name", "city": "AddressCity", "country": "AddressCountryRegionId"},
        }.get(ERP_PROVIDERS.get(provider, {}).get("name", provider), {})
    if kind == "po":
        return {
            "Odoo": {"order_ref": "name", "supplier": "partner_id", "total": "amount_total", "lines": "order_line"},
            "SAP S/4HANA": {"order_ref": "EKKO.EBELN", "supplier": "EKKO.LIFNR", "total": "EKKO.GROSS_VALUE"},
            "Oracle NetSuite": {"order_ref": "tranid", "supplier": "entity", "total": "total"},
            "Microsoft Dynamics 365": {"order_ref": "PurchId", "supplier": "VendorAccount", "total": "TotalMiscCharges"},
        }.get(ERP_PROVIDERS.get(provider, {}).get("name", provider), {})
    return {}
