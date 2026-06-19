"""
build_index.py — Parse resume PDF, chunk it, embed it, and save a FAISS vector store.

Usage:
    python build_index.py              # uses default resume.pdf
    python build_index.py myresume.pdf # uses custom path
"""

import os
import sys

from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

load_dotenv(override=True)

VECTORSTORE_DIR = os.path.join(os.path.dirname(__file__), "vectorstore")

# Using a local HuggingFace model for embeddings (free, no API key needed).
# This runs locally — first run will download the model (~90MB).
EMBEDDING_MODEL = "all-MiniLM-L6-v2"


def build_index(pdf_path: str = r"C:\Users\MEET\Desktop\IIIT_D\GenAI_Project\Meetkumar_Shah_Ai_CV.pdf"):
    """Load PDF → chunk → embed → save FAISS index."""

    # ── Phase 1: Load PDF ──────────────────────────────────────────────
    print(f"[1/4] Loading PDF: {pdf_path}")
    loader = PyPDFLoader(pdf_path)
    pages = loader.load()
    print(f"       Loaded {len(pages)} page(s).")

    # ── Phase 2: Chunk ─────────────────────────────────────────────────
    print("[2/4] Chunking text...")
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=2000,
        chunk_overlap=200,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    docs = splitter.split_documents(pages)
    print(f"       Created {len(docs)} chunks.")

    # ── Phase 3: Embed ─────────────────────────────────────────────────
    print(f"[3/4] Generating embeddings with {EMBEDDING_MODEL} (local)...")
    embeddings = HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL,
    )

    # ── Phase 4: Save FAISS ────────────────────────────────────────────
    print("[4/4] Building & saving FAISS index...")
    db = FAISS.from_documents(docs, embeddings)
    db.save_local(VECTORSTORE_DIR)
    print(f"       Vector store saved to {VECTORSTORE_DIR}/")


if __name__ == "__main__":
    pdf = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "resume.pdf")
    build_index(pdf)
