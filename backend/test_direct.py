from app import get_qa_chain, llm

import sys
import traceback

print("LLM API Key:", llm.api_key)

try:
    chain = get_qa_chain("professional")
    result = chain.invoke({"query": "What is your name?"})
    print("Result:", result)
except Exception as e:
    print("DIRECT ERROR:")
    traceback.print_exc()
