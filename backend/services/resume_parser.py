import io

import fitz  # PyMuPDF
from docx import Document

from backend.services.llm_service import extract_resume_info


def parse_resume(content: bytes, suffix: str) -> str:
    if suffix == ".pdf":
        return _parse_pdf(content)
    elif suffix in (".docx", ".doc"):
        return _parse_docx(content)
    else:
        # Image: return placeholder, will be handled by Qwen-VL
        return "[IMAGE_FILE]"


def _parse_pdf(content: bytes) -> str:
    doc = fitz.open(stream=content, filetype="pdf")
    text_parts = []
    for page in doc:
        text_parts.append(page.get_text())
    doc.close()
    return "\n".join(text_parts)


def _parse_docx(content: bytes) -> str:
    doc = Document(io.BytesIO(content))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
