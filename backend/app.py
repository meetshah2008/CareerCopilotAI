"""
app.py — FastAPI backend for CareerCopilot AI.

Endpoints:
    POST /answer   → Takes a form question, retrieves resume context via FAISS,
                     generates a professional answer using an LLM.
    POST /upload   → Upload a new resume PDF and rebuild the vector index.
    GET  /health   → Simple health check.
    # Hot-reload trigger
"""

import os

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from langchain_openai import ChatOpenAI
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate

load_dotenv(override=True)

# ── Config ──────────────────────────────────────────────────────────────
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
VECTORSTORE_DIR = os.path.join(os.path.dirname(__file__), "vectorstore")
RESUME_PATH = os.path.join(os.path.dirname(__file__), "resume.pdf")
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# ── FastAPI App ─────────────────────────────────────────────────────────
app = FastAPI(title="CareerCopilot AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Chrome extension needs this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Shared resources (loaded once) ─────────────────────────────────────
# Local HuggingFace embeddings — free, no API key needed.
embeddings = HuggingFaceEmbeddings(
    model_name=EMBEDDING_MODEL,
)

llm = ChatOpenAI(
    api_key=OPENROUTER_API_KEY,
    base_url="https://openrouter.ai/api/v1",
    model="deepseek/deepseek-chat-v3-0324",
    temperature=0.3,
    max_tokens=300,
)


def load_vectorstore():
    """Load the persisted FAISS index."""
    return FAISS.load_local(
        VECTORSTORE_DIR,
        embeddings,
        allow_dangerous_deserialization=True,
    )


def get_qa_chain(tone: str = "professional"):
    """Build a RetrievalQA chain with the loaded vector store."""
    db = load_vectorstore()
    retriever = db.as_retriever(search_kwargs={"k": 10})

    tone_instructions = {
        "professional": "Write in a professional, first-person tone. Keep the answer concise (under 80 words).",
        "short": "Write a very brief answer in 1-2 sentences maximum.",
        "detailed": "Write a detailed, comprehensive answer. Can be up to 150 words.",
        "ats_friendly": "Write in an ATS-friendly style using relevant keywords. Keep under 100 words.",
        "formal": "Write in a highly formal, corporate tone. Keep under 80 words.",
    }

    instruction = tone_instructions.get(tone, tone_instructions["professional"])

    prompt = PromptTemplate(
        input_variables=["context", "question"],
        template=f"""You are an AI Career Assistant helping a job applicant fill out application forms.

Your task: Answer the SPECIFIC form field question using ONLY the relevant information from the candidate's resume provided below.

Resume Context:
{{context}}

Form Field Question: {{question}}

CRITICAL INSTRUCTIONS:
1. {instruction}
2. Answer ONLY what is being asked. Do NOT provide a general summary of the resume or introduce the candidate ("I am an M.Tech student...") unless the question specifically asks for a summary or "About Me".
3. If the question asks about a specific company (e.g., Matrix Comsec), ONLY detail the work done at that company.
4. Do NOT fabricate or assume any information. If the resume does not contain relevant information for the specific question, reply exactly with: "Information not found in resume."

Answer:""",
    )

    return RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=retriever,
        return_source_documents=True,
        chain_type_kwargs={"prompt": prompt},
    )


# ── Request / Response Models ──────────────────────────────────────────
class QueryRequest(BaseModel):
    query: str
    tone: str = "professional"


class QueryResponse(BaseModel):
    answer: str
    sources: list[str]


# ── Endpoints ──────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "CareerCopilot AI",
        "endpoints": ["/health", "/answer", "/upload"],
    }


@app.get("/health")
def health():
    return {"status": "ok", "service": "CareerCopilot AI"}


from fastapi import HTTPException
import traceback

@app.post("/answer", response_model=QueryResponse)
def answer_question(req: QueryRequest):
    """
    Phase 5-7: Retrieve relevant resume chunks → build prompt → LLM generates answer.
    """
    try:
        chain = get_qa_chain(tone=req.tone)
        result = chain.invoke({"query": req.query})

        source_texts = [
            doc.page_content[:120] + "..." for doc in result.get("source_documents", [])
        ]

        return QueryResponse(
            answer=result["result"],
            sources=source_texts,
        )
    except Exception as e:
        print("====== BACKEND ERROR ======")
        traceback.print_exc()
        print("===========================")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload")
async def upload_resume(file: UploadFile = File(...)):
    """Upload a new resume and rebuild the vector index."""
    contents = await file.read()
    with open(RESUME_PATH, "wb") as f:
        f.write(contents)

    # Rebuild index
    from build_index import build_index
    build_index(RESUME_PATH)

    return {"status": "ok", "message": "Resume uploaded and index rebuilt."}
