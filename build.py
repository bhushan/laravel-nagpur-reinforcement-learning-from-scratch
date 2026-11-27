#!/usr/bin/env python3
"""Assemble index.html from src/ and assets/. No dependencies.

    python3 build.py

The deck ships as ONE file (GitHub Pages serves it as is). Source lives in:
  src/styles/*.css   concatenated in filename order
  src/slides/*.html  concatenated in filename order (one file per act)
  src/js/*.js        concatenated in filename order (engine first, then widgets)
  src/shell.html     page chrome: rail, overlays, notes drawer
  assets/*.b64       fonts and the portrait, inlined as base64
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"


def cat(folder, pattern):
    return "\n".join(p.read_text(encoding="utf-8") for p in sorted((SRC / folder).glob(pattern)))


def inline_assets(text):
    def repl(m):
        return (ROOT / "assets" / m.group(1)).read_text().strip()
    return re.sub(r"\{\{asset:([\w.\-]+)\}\}", repl, text)


def main():
    head = (SRC / "head.html").read_text(encoding="utf-8")
    page = (
        head.replace("{{styles}}", cat("styles", "*.css"))
        .replace("{{slides}}", cat("slides", "*.html"))
        .replace("{{shell}}", (SRC / "shell.html").read_text(encoding="utf-8"))
        .replace("{{scripts}}", cat("js", "*.js"))
    )
    page = inline_assets(page)
    (ROOT / "index.html").write_text(page, encoding="utf-8")
    print(f"index.html  {len(page) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
