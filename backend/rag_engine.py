import os
from typing import Optional
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate

CHROMA_DIR = "./chroma_db"

EMBEDDINGS = None

def get_embeddings():
    global EMBEDDINGS
    if EMBEDDINGS is None:
        EMBEDDINGS = HuggingFaceEmbeddings(
            model_name="all-MiniLM-L6-v2",
            model_kwargs={"device": "cpu"},
        )
    return EMBEDDINGS

PROMPT_TEMPLATE = """You are a financial analyst assistant helping users understand SEC filings.
Use the following excerpts from the SEC filing to answer the question accurately.
If the information is not in the excerpts, say so clearly. Always cite which part of the document supports your answer.

Context from SEC filing:
{context}

Question: {question}

Answer (be specific and reference the filing where relevant):"""

def index_document(text: str, collection_name: str) -> Chroma:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=150,
        separators=["\n\n", "\n", " ", ""],
    )
    chunks = splitter.split_text(text)

    embeddings = get_embeddings()
    vectorstore = Chroma.from_texts(
        texts=chunks,
        embedding=embeddings,
        collection_name=collection_name,
        persist_directory=CHROMA_DIR,
    )
    return vectorstore

def load_vectorstore(collection_name: str) -> Optional[Chroma]:
    embeddings = get_embeddings()
    try:
        vectorstore = Chroma(
            collection_name=collection_name,
            embedding_function=embeddings,
            persist_directory=CHROMA_DIR,
        )
        if vectorstore._collection.count() == 0:
            return None
        return vectorstore
    except Exception:
        return None

def ask_question(question: str, collection_name: str, groq_api_key: str) -> dict:
    vectorstore = load_vectorstore(collection_name)
    if vectorstore is None:
        return {"answer": "Document not indexed yet. Please load a filing first.", "sources": []}

    llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        api_key=groq_api_key,
        temperature=0,
    )

    prompt = PromptTemplate(
        template=PROMPT_TEMPLATE,
        input_variables=["context", "question"],
    )

    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=vectorstore.as_retriever(search_kwargs={"k": 5}),
        return_source_documents=True,
        chain_type_kwargs={"prompt": prompt},
    )

    result = qa_chain.invoke({"query": question})
    sources = [doc.page_content[:300] for doc in result.get("source_documents", [])]

    return {
        "answer": result["result"],
        "sources": sources,
    }

def collection_exists(collection_name: str) -> bool:
    vs = load_vectorstore(collection_name)
    return vs is not None
