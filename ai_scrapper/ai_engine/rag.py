from __future__ import annotations

import hashlib
import math
import os
from pathlib import Path
from typing import Any

import chromadb


ROOT = Path(__file__).resolve().parents[1]
CHROMA_DIR = ROOT / "data" / "chroma_db"

_client = None
_rfq_collection = None
_supplier_collection = None
_embedding_fn = None


def _get_client():
    global _client
    if _client is None:
        CHROMA_DIR.mkdir(parents=True, exist_ok=True)
        _client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    return _client


class SentenceTransformerEmbeddingFunction:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self._model = None
        self._model_name = model_name
        try:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(model_name)
        except Exception:
            pass

    def __call__(self, input: list[str]) -> list[list[float]]:
        if self._model is None:
            raise RuntimeError(
                f"SentenceTransformer model not available: {self._model_name}"
            )
        embeddings = self._model.encode(input, normalize_embeddings=True)
        return embeddings.tolist()


class TfEmbeddingFunction:
    def __init__(self, dim: int = 256):
        self.dim = dim

    def __call__(self, input: list[str]) -> list[list[float]]:
        result = []
        for text in input:
            tokens = _tokenize(text)
            vec = [0.0] * self.dim
            for token in tokens:
                h = int(hashlib.sha256(token.encode()).hexdigest(), 16)
                idx = h % self.dim
                vec[idx] += 1.0
            norm = math.sqrt(sum(v * v for v in vec))
            if norm > 0:
                vec = [v / norm for v in vec]
            result.append(vec)
        return result


_STOPWORDS = {
    "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "pour", "avec", "sans", "sur", "dans",
    "the", "a", "an", "and", "or", "for", "with", "without", "to", "from", "of", "in", "on", "need", "needs",
    "i", "we", "want", "would", "like", "please", "achat", "acheter", "demande", "besoin",
}


def _tokenize(text: str) -> list[str]:
    import re
    words = re.findall(r"[a-z0-9]+", (text or "").lower())
    return [word for word in words if word not in _STOPWORDS and len(word) > 1]


def _build_embedding_function():
    use_st = os.getenv("RAG_USE_SENTENCE_TRANSFORMER", "").lower() in ("1", "true", "yes", "on")
    if use_st:
        model_name = os.getenv("RAG_EMBEDDING_MODEL", "all-MiniLM-L6-v2")
        st_fn = SentenceTransformerEmbeddingFunction(model_name)
        if st_fn._model is not None:
            return st_fn
    return TfEmbeddingFunction()


def init_rag_db():
    global _client, _rfq_collection, _supplier_collection, _embedding_fn
    _embedding_fn = _build_embedding_function()
    _client = _get_client()
    _rfq_collection = _client.get_or_create_collection(
        name="rfq_knowledge",
        embedding_function=_embedding_fn,
        metadata={"hnsw:space": "cosine"},
    )
    _supplier_collection = _client.get_or_create_collection(
        name="supplier_knowledge",
        embedding_function=_embedding_fn,
        metadata={"hnsw:space": "cosine"},
    )
    return _client


def add_rfq_document(text: str, metadata: dict, doc_id: str) -> bool:
    global _rfq_collection
    try:
        if _rfq_collection is None:
            init_rag_db()
        _rfq_collection.upsert(documents=[text], metadatas=[metadata], ids=[doc_id])
        return True
    except Exception:
        return False


def add_supplier_document(text: str, metadata: dict, doc_id: str) -> bool:
    global _supplier_collection
    try:
        if _supplier_collection is None:
            init_rag_db()
        _supplier_collection.upsert(documents=[text], metadatas=[metadata], ids=[doc_id])
        return True
    except Exception:
        return False


def search_similar_rfqs(query: str, top_k: int = 5) -> list[dict]:
    global _rfq_collection
    try:
        if _rfq_collection is None:
            init_rag_db()
        results = _rfq_collection.query(query_texts=[query], n_results=top_k)
        return _format_query_results(results)
    except Exception:
        return []


def search_similar_suppliers(query: str, top_k: int = 5) -> list[dict]:
    global _supplier_collection
    try:
        if _supplier_collection is None:
            init_rag_db()
        results = _supplier_collection.query(query_texts=[query], n_results=top_k)
        return _format_query_results(results)
    except Exception:
        return []


def get_all_rfqs() -> list[dict]:
    global _rfq_collection
    try:
        if _rfq_collection is None:
            init_rag_db()
        results = _rfq_collection.get()
        return _format_get_results(results)
    except Exception:
        return []


def clear_collection(collection_name: str) -> bool:
    global _client, _rfq_collection, _supplier_collection, _embedding_fn
    try:
        if _client is None:
            init_rag_db()
        if collection_name == "rfq_knowledge":
            _client.delete_collection("rfq_knowledge")
            _rfq_collection = _client.get_or_create_collection(
                name="rfq_knowledge",
                embedding_function=_embedding_fn,
                metadata={"hnsw:space": "cosine"},
            )
        elif collection_name == "supplier_knowledge":
            _client.delete_collection("supplier_knowledge")
            _supplier_collection = _client.get_or_create_collection(
                name="supplier_knowledge",
                embedding_function=_embedding_fn,
                metadata={"hnsw:space": "cosine"},
            )
        else:
            return False
        return True
    except Exception:
        return False


def _format_query_results(results: dict[str, Any]) -> list[dict]:
    docs = []
    ids = results.get("ids", [[]])[0]
    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]
    for i in range(len(ids)):
        docs.append({
            "id": ids[i],
            "document": documents[i],
            "metadata": metadatas[i],
            "distance": distances[i],
        })
    return docs


def _format_get_results(results: dict[str, Any]) -> list[dict]:
    docs = []
    ids = results.get("ids", [])
    documents = results.get("documents", [])
    metadatas = results.get("metadatas", [])
    for i in range(len(ids)):
        docs.append({
            "id": ids[i],
            "document": documents[i] if i < len(documents) else "",
            "metadata": metadatas[i] if i < len(metadatas) else {},
        })
    return docs
