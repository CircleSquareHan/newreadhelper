"""Extract the user-supplied PDF into the reader's local data file."""
import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader


def tidy(text: str) -> str:
    text = text.replace("\u00ad", "").replace("\x00", "")
    text = re.sub(r"(?<=\w)-\s*\n\s*(?=\w)", "", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def title_for(page_text: str):
    match = re.search(r"CHAPTER\s+([A-Z]+)\s*\n+([A-Z][A-Z \-']{2,})", page_text)
    if match:
        numeral = match.group(1).title()
        heading = " ".join(match.group(2).split()).title()
        return f"Chapter {numeral} - {heading}"
    return None


def visual_paragraphs(page):
    """Preserve both spaces and first-line indentation from the PDF layout."""
    # Layout mode recombines PDF glyph fragments, preserving spaces which the
    # default extractor can lose (for example, "and introduced").
    lines = page.extract_text(extraction_mode="layout").splitlines()
    result = []
    blank_before = True
    for raw_line in lines:
        if not raw_line.strip():
            blank_before = True
            continue
        line = raw_line.strip()
        if line.isdigit():  # printed page number
            continue
        leading_spaces = len(raw_line) - len(raw_line.lstrip())
        # Main-text paragraphs use a 4-space first-line indent in this edition.
        is_first_line = 3 <= leading_spaces <= 6
        starts_new = not result or is_first_line or blank_before
        if starts_new:
            result.append({"text": line, "indented": is_first_line})
        else:
            prior = result[-1]["text"]
            if prior.endswith("-") and line and line[0].islower():
                result[-1]["text"] = prior[:-1] + line
            else:
                result[-1]["text"] = prior + " " + line
        blank_before = False
    return result


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: extract_book.py INPUT.pdf OUTPUT.json")
    reader = PdfReader(sys.argv[1])
    sections = [{"id": "author-note", "title": "Author's Note", "pages": [], "paragraphs": []}]
    current = sections[0]
    for page_number, page in enumerate(reader.pages, start=1):
        raw = tidy(page.extract_text() or "")
        heading = title_for(raw)
        if heading:
            current = {"id": f"chapter-{len(sections)}", "title": heading, "pages": [], "paragraphs": []}
            sections.append(current)
        current["pages"].append(page_number)
        for paragraph in visual_paragraphs(page):
            paragraph["page"] = page_number
            current["paragraphs"].append(paragraph)
    for section in sections:
        # A paragraph that starts flush-left at a new PDF page is a continuation,
        # not a new paragraph. Join it to the prior paragraph when possible.
        merged = []
        for paragraph in section["paragraphs"]:
            if merged and paragraph["page"] != merged[-1]["page"] and not paragraph["indented"]:
                merged[-1]["text"] += " " + paragraph["text"]
            else:
                merged.append(paragraph)
        section["text"] = "\n\n".join(item["text"] for item in merged)
        del section["paragraphs"]
    # Discard empty title/dedication leaves from the note, but retain all story pages.
    sections[0]["text"] = re.sub(r"^\[SEE PIC[^\n]*\]\s*\n*Jon\s+Krakauer\s+INTO\s+THE\s+WILD\s*", "", sections[0]["text"], flags=re.I)
    payload = {"title": "Into the Wild", "author": "Jon Krakauer", "sections": sections}
    Path(sys.argv[2]).write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
