import os
import io
from pathlib import Path
from typing import Optional

SUPPORTED_IMAGE_EXTENSIONS = {".png", ".jpeg", ".jpg", ".bmp", ".gif", ".tiff", ".tif"}
SUPPORTED_PDF_EXTENSIONS = {".pdf"}


def _get_file_extension(file_path: str) -> str:
    return Path(file_path).suffix.lower()


def _is_image_file(file_path: str) -> bool:
    return _get_file_extension(file_path) in SUPPORTED_IMAGE_EXTENSIONS


def _is_pdf_file(file_path: str) -> bool:
    return _get_file_extension(file_path) in SUPPORTED_PDF_EXTENSIONS


def _guess_extension_from_mime(filename: str, content: bytes) -> str:
    ext = _get_file_extension(filename)
    if ext:
        return ext
    header = content[:8] if len(content) >= 8 else content
    if header[:4] == b"\x89PNG":
        return ".png"
    if header[:2] == b"\xff\xd8":
        return ".jpeg"
    if header[:4] == b"BM":
        return ".bmp"
    if header[:6] in (b"GIF87a", b"GIF89a"):
        return ".gif"
    if header[:4] == b"%PDF":
        return ".pdf"
    return ""


def _extract_text_with_tesseract(image) -> str:
    try:
        import pytesseract
    except ImportError:
        return ""
    try:
        return pytesseract.image_to_string(image)
    except Exception:
        return ""


def _extract_text_from_pdf_native(pdf_path: str) -> str:
    errors = []
    # Try PyMuPDF (fitz)
    try:
        import fitz
    except ImportError:
        errors.append("fitz not installed")
    else:
        if not os.path.isfile(pdf_path):
            return ""
        try:
            document = fitz.open(pdf_path)
            text_parts = []
            for page in document:
                page_text = page.get_text()
                if page_text and page_text.strip():
                    text_parts.append(page_text.strip())
            document.close()
            if text_parts:
                return "\f".join(text_parts)
        except Exception as exc:
            errors.append(f"fitz error: {exc}")

    # Try pypdf
    try:
        from pypdf import PdfReader
    except ImportError:
        errors.append("pypdf not installed")
    else:
        try:
            reader = PdfReader(pdf_path)
            text_parts = []
            for page in reader.pages:
                try:
                    page_text = page.extract_text()
                except Exception:
                    page_text = ""
                if page_text and page_text.strip():
                    text_parts.append(page_text.strip())
            if text_parts:
                return "\f".join(text_parts)
        except Exception as exc:
            errors.append(f"pypdf error: {exc}")

    # Try PyPDF2
    try:
        from PyPDF2 import PdfReader
    except ImportError:
        pass
    else:
        try:
            reader = PdfReader(pdf_path)
            text_parts = []
            for page in reader.pages:
                try:
                    page_text = page.extract_text()
                except Exception:
                    page_text = ""
                if page_text and page_text.strip():
                    text_parts.append(page_text.strip())
            if text_parts:
                return "\f".join(text_parts)
        except Exception as exc:
            errors.append(f"PyPDF2 error: {exc}")

    return ""


def _extract_text_from_pdf_ocr(pdf_path: str) -> str:
    try:
        import pdf2image
        import pytesseract
    except ImportError:
        return ""
    if not os.path.isfile(pdf_path):
        return ""
    try:
        pil_images = pdf2image.convert_from_path(pdf_path, dpi=300)
        text_parts = []
        for pil_image in pil_images:
            page_text = pytesseract.image_to_string(pil_image)
            if page_text and page_text.strip():
                text_parts.append(page_text.strip())
            pil_image.close()
        return "\n".join(text_parts)
    except Exception:
        return ""


def _open_image(path_or_stream):
    try:
        from PIL import Image
    except ImportError:
        return None
    try:
        return Image.open(path_or_stream)
    except Exception:
        return None


def extract_text_from_image(image_path: str) -> str:
    if not os.path.isfile(image_path):
        return ""
    image = _open_image(image_path)
    if image is None:
        return ""
    try:
        return _extract_text_with_tesseract(image)
    finally:
        try:
            image.close()
        except Exception:
            pass


def extract_text_from_pdf(pdf_path: str) -> str:
    if not os.path.isfile(pdf_path):
        return ""
    native_text = _extract_text_from_pdf_native(pdf_path)
    if native_text and native_text.strip():
        return native_text
    return _extract_text_from_pdf_ocr(pdf_path)


def extract_text_from_file(file_path: str) -> str:
    if not file_path or not os.path.isfile(file_path):
        return ""
    if _is_image_file(file_path):
        return extract_text_from_image(file_path)
    if _is_pdf_file(file_path):
        return extract_text_from_pdf(file_path)
    return ""


def extract_text_from_bytes(content: bytes, filename: str = "upload") -> str:
    if not content:
        return ""
    ext = _guess_extension_from_mime(filename, content)
    if not ext:
        return ""
    if ext in SUPPORTED_IMAGE_EXTENSIONS:
        image = _open_image(io.BytesIO(content))
        if image is None:
            return "[EMPTY_OCR]"
        try:
            text = _extract_text_with_tesseract(image)
            if not text:
                return "[EMPTY_OCR]"
            return text
        finally:
            try:
                image.close()
            except Exception:
                pass
    if ext in SUPPORTED_PDF_EXTENSIONS:
        temp_path = os.path.join(os.environ.get("TEMP", "/tmp"), f"kilo_ocr_{os.getpid()}.pdf")
        try:
            with open(temp_path, "wb") as f:
                f.write(content)
            text = extract_text_from_pdf(temp_path)
            if not text:
                return "[EMPTY_OCR]"
            return text
        except Exception:
            return ""
        finally:
            try:
                if os.path.isfile(temp_path):
                    os.remove(temp_path)
            except Exception:
                pass
    return ""
