from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Any


class RfqItemModel(BaseModel):
    name: str = ""
    category: str = ""
    quantity: float | None = None
    unit: str = ""
    specs: list[str] = Field(default_factory=list)
    target_price: float | None = None
    notes: str = ""


class RFQModel(BaseModel):
    title: str = "Procurement request"
    description: str = ""
    items: list[RfqItemModel] = Field(default_factory=list)
    location: str = ""
    budget: float | None = None
    currency: str = "TND"
    delivery_deadline_days: int | None = None
    certifications: list[str] = Field(default_factory=list)
    cost_center: str = ""
    urgency: str = "normal"
    raw_text: str = ""
    extracted_by: str = "api"
    confidence: float = 0.8


class SupplierProfileModel(BaseModel):
    id: str
    name: str
    website: str = ""
    country: str = ""
    city: str = ""
    categories: list[str] = Field(default_factory=list)
    capabilities: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    description: str = ""
    contacts: dict[str, Any] = Field(default_factory=dict)
    source: str = "manual"
    score: float = 0.0


class QuoteLineModel(BaseModel):
    description: str = ""
    quantity: float | None = None
    unit: str = ""
    unit_price: float | None = None
    currency: str = "TND"
    vat_rate: float | None = None
    raw: str = ""


class QuoteModel(BaseModel):
    supplier_name: str = ""
    supplier_id: str = ""
    lines: list[QuoteLineModel] = Field(default_factory=list)
    total_amount: float | None = None
    currency: str = "TND"
    delivery_days: int | None = None
    payment_terms: str = ""
    raw_text: str = ""


class NegotiationRequest(BaseModel):
    rfq: dict[str, Any] = Field(default_factory=dict)
    supplier_matches: list[dict[str, Any]] = Field(default_factory=list)
    quote_comparisons: list[dict[str, Any]] = Field(default_factory=list)


class AnalyticsQueryRequest(BaseModel):
    question: str = ""
    query: str = ""


class ERPSyncSupplierRequest(BaseModel):
    supplier: dict[str, Any] = Field(default_factory=dict)
    provider: str = "odoo"


class ERPCreatePORequest(BaseModel):
    rfq: dict[str, Any] = Field(default_factory=dict)
    supplier: dict[str, Any] = Field(default_factory=dict)
    quotes: list[dict[str, Any]] = Field(default_factory=list)
    provider: str = "odoo"
