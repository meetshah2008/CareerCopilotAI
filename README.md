# CareerCopilot AI

This repository contains CareerCopilot AI — a local FastAPI backend that answers form-field questions using a candidate's resume and a browser extension frontend (Chrome/Edge) that calls the backend.

This workspace already contains the project files in the parent folder. This README documents how to import, configure and run the project from this repository root.

## What this repo expects

- `backend/` — FastAPI server, index builder, and requirements.
- `extension/` — Chrome extension (popup) that queries the backend.

If your project files currently live outside this folder (for example in the sibling folder `GenAI_Project`), copy or move the `backend/` and `extension/` directories into this repository root.

## Quick setup (Windows)

1. Create and activate a Python virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # PowerShell
# or .\.venv\Scripts\activate   # cmd.exe
```

2. Install backend dependencies:

```bash
pip install -r backend/requirements.txt
```

3. Configure environment variables

- Create `backend/.env` (copy from `backend/.env.example` if present).
- Set `OPENROUTER_API_KEY` to your OpenRouter/OpenAI-compatible key.

Example `backend/.env`:

```
OPENROUTER_API_KEY=sk-...yourkey...
```

4. Add or upload a resume

- Place a PDF at `backend/resume.pdf` or use the extension / API to upload a resume via `POST /upload`.

5. Build the vector index (embeddings)

```bash
python backend/build_index.py backend/resume.pdf
```

6. Start the backend server

```bash
uvicorn backend.app:app --reload --port 8000
```

7. Load the Chrome extension

- Open `chrome://extensions` → Load unpacked → select the `extension/` folder in this repo.
- The extension expects the backend at `http://localhost:8000` by default. Update `extension/popup.js` if your backend runs elsewhere.

## Notes and recommendations

- Do NOT commit `backend/.env` or the `backend/vectorstore/` directory (it contains binary index files). `.gitignore` in this repo already excludes them.
- If results look poor, common culprits are:
  - Wrong or empty `resume.pdf` (PDF parsing failures).
  - The local embedding model download failing or using a mismatched model.
  - The LLM API key misconfigured or the chosen model returning low-quality answers.

If you'd like, I can copy the current `backend/` and `extension/` files into this repo for you and make a few small adjustments (update paths, add `.env.example`, improve prompt). Reply `Yes — copy files` to continue.

## Use case

CareerCopilot AI is built to help applicants complete job application form fields automatically by extracting precise, relevant answers from a single resume PDF. The typical user flow is:

- User opens a job application form in the browser.
- The extension detects the focused form field and extracts the visible question/label.
- The extension asks the backend for an answer (via `/answer`).
- The backend runs a RAG pipeline over the resume to provide a concise, resume-grounded response which the extension inserts into the field.

This is intentionally conservative: the system is designed to only return information present in the resume and to reply with the literal string "Information not found in resume." when the resume lacks the requested detail.

## Pipeline (implementation details)

1. PDF ingestion: `backend/build_index.py` uses `PyPDFLoader` to load `backend/resume.pdf`.
2. Chunking: `RecursiveCharacterTextSplitter` splits the document into overlapping chunks (default chunk_size=2000, overlap=200).
3. Embeddings: `HuggingFaceEmbeddings` computes vector embeddings using `all-MiniLM-L6-v2` (local, free).
4. Vector store: Chunks + embeddings are persisted to a FAISS index in `backend/vectorstore/`.
5. Retrieval & generation: `backend/app.py` builds a `RetrievalQA` chain that retrieves top-k chunks and calls the LLM (`ChatOpenAI` via OpenRouter) with a strict prompt that forbids hallucination.
6. Client: the extension (`extension/`) calls `/answer` and fills the form field with the returned answer.

Simple pipeline diagram:

Resume.pdf -> PyPDFLoader -> Chunker -> Embeddings -> FAISS index -> Retriever -> LLM -> Generated answer -> Browser extension

## Tuning & troubleshooting tips

- If answers are missing or irrelevant:
  - Verify `backend/resume.pdf` is the correct, up-to-date PDF and not a scanned image. Scanned PDFs need OCR (e.g., `pytesseract`) before building the index.
  - Rebuild the index with `python backend/build_index.py backend/resume.pdf` and watch the chunking output to confirm non-empty chunks were produced.
  - Check `backend/vectorstore/index.pkl` loadability by running `python backend/test_direct.py` (it will print the LLM key and try a sample retrieval).

- If results are too short/long or miss specifics:
  - Adjust the `k` used by the retriever in `get_qa_chain()` (lower `k`=3–5 for more focused answers).
  - Reduce `chunk_size` to 500–1000 to create smaller, more targeted chunks when the resume has many short sections.
  - Consider using a different embedding model (e.g., `sentence-transformers/all-MiniLM-L6-v2` or a domain-tuned model) if semantic matches are poor.

- If the LLM returns low-quality or off-topic text:
  - Confirm `OPENROUTER_API_KEY` in `backend/.env` is valid and that your chosen model is available.
  - Try an alternate LLM provider (OpenAI, or another OpenRouter-compatible model) and experiment with `temperature` and `max_tokens`.

## Security & repo hygiene

- Keep `backend/.env` private. Use `backend/.env.example` as a template.
- Do not commit `backend/vectorstore/` — it contains binary index files and can be large.

## Next steps I can help with

- Run a sanity check locally: build the index and run `uvicorn backend.app:app` to reproduce the failing case you showed.
- Replace the local HuggingFace embedding with a hosted embedding API if you prefer faster, more consistent vectors.
- Add a light-weight OCR step in `build_index.py` for scanned resumes.

If you want me to proceed with any of the above, tell me which one and I will run it (I can run the index build and a quick test if you allow using your `backend/.env` locally). 
