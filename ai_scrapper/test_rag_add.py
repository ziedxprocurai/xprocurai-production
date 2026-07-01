import sys
sys.path.insert(0, ".")

from ai_engine.rag import init_rag_db, _rfq_collection, add_rfq_document, search_similar_rfqs

init_rag_db()

sample_text = """
GreenLeaf Procurement LLC
789 Ocean Drive, Casablanca, Morocco
Email: billing@greenleaf.ma | Tel: +212 522 000 000
TAX INVOICE
Invoice: GL-2026-004
Vendor: GreenLeaf Procurement LLC
"""

ok = add_rfq_document(
    text=sample_text,
    metadata={"doc_type": "ocr_raw", "filename": "test_shadow_audit.pdf", "extracted_by": "ocr"},
    doc_id="test-greenleaf-pdf",
)
print(f"Added: {ok}")
print(f"RFQ count after add: {_rfq_collection.count()}")

results = search_similar_rfqs("je veux savoir le email de GreenLeaf Procurement LLC", top_k=3)
print(f"Search results: {len(results)}")
for r in results:
    print(f"  dist={r['distance']:.4f} doc={r.get('document', '')[:120]}")
