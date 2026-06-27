from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class RfqItem:
    name: str
    category: str = ""
    quantity: float | None = None
    unit: str = ""
    specs: list[str] = field(default_factory=list)
    target_price: float | None = None
    notes: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class RFQ:
    title: str
    description: str
    items: list[RfqItem] = field(default_factory=list)
    location: str = ""
    budget: float | None = None
    currency: str = "TND"
    delivery_deadline_days: int | None = None
    certifications: list[str] = field(default_factory=list)
    cost_center: str = ""
    urgency: str = "normal"
    raw_text: str = ""
    extracted_by: str = "deterministic"
    confidence: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["items"] = [item.to_dict() if hasattr(item, "to_dict") else asdict(item) for item in self.items]
        return data


@dataclass
class SupplierProfile:
    id: str
    name: str
    website: str = ""
    country: str = ""
    city: str = ""
    categories: list[str] = field(default_factory=list)
    capabilities: list[str] = field(default_factory=list)
    certifications: list[str] = field(default_factory=list)
    description: str = ""
    contacts: dict[str, Any] = field(default_factory=dict)
    source: str = "manual"
    score: float = 0.0
    embedding: dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class QuoteLine:
    description: str
    quantity: float | None = None
    unit: str = ""
    unit_price: float | None = None
    currency: str = "TND"
    vat_rate: float | None = None
    raw: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Quote:
    supplier_name: str
    supplier_id: str = ""
    lines: list[QuoteLine] = field(default_factory=list)
    total_amount: float | None = None
    currency: str = "TND"
    delivery_days: int | None = None
    payment_terms: str = ""
    raw_text: str = ""

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["lines"] = [line.to_dict() if hasattr(line, "to_dict") else asdict(line) for line in self.lines]
        return data


def to_jsonable(value: Any) -> Any:
    if hasattr(value, "to_dict"):
        return value.to_dict()
    if isinstance(value, dict):
        return {key: to_jsonable(item) for key, item in value.items()}
    if isinstance(value, list):
        return [to_jsonable(item) for item in value]
    return value
