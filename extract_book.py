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


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: extract_book.py INPUT.pdf OUTPUT.json")
    reader = PdfReader(sys.argv[1])
    sections = [{"id": "author-note", "title": "Author's Note", "pages": [], "text": ""}]
    current = sections[0]
    for page_number, page in enumerate(reader.pages, start=1):
        raw = tidy(page.extract_text() or "")
        heading = title_for(raw)
        if heading:
            current = {"id": f"chapter-{len(sections)}", "title": heading, "pages": [], "text": ""}
            sections.append(current)
        current["pages"].append(page_number)
        current["text"] += ("\n\n" if current["text"] else "") + raw
    # Discard empty title/dedication leaves from the note, but retain all story pages.
    sections[0]["text"] = re.sub(r"^\[SEE PIC[^\n]*\]\s*\n*Jon\s+Krakauer\s+INTO\s+THE\s+WILD\s*", "", sections[0]["text"], flags=re.I)
    payload = {"title": "Into the Wild", "author": "Jon Krakauer", "sections": sections}
    Path(sys.argv[2]).write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
