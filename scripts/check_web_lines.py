#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Anti-Monolith Guard for Web Frontend (HTML, JS, CSS).
Ensures no file in web/ (excluding standalone legacy pages if desired) grows into a monolith.
"""

import os
import sys
from pathlib import Path

MAX_LINES = 250


def check_web_lines(web_dir: Path, max_lines: int = MAX_LINES):
    targets = []
    for ext in ("*.html", "*.js", "*.css"):
        for p in sorted(web_dir.rglob(ext)):
            rel = p.relative_to(web_dir).as_posix()
            if rel.startswith("pages/"):
                continue
            targets.append((rel, p))

    failures = []
    print("=" * 72)
    print(f"WEB ANTI-MONOLITH GUARD (Max {max_lines} lines/file)")
    print("=" * 72)
    for rel, p in targets:
        lines = len(p.read_text(encoding="utf-8", errors="ignore").splitlines())
        status = "PASS" if lines <= max_lines else "FAIL"
        print(f"  {rel:<40} | {lines:>4} / {max_lines} | {status}")
        if lines > max_lines:
            failures.append(f"{rel}: {lines} lines (limit {max_lines})")

    print("=" * 72)
    if failures:
        print("FAILED: Monolith files detected:")
        for f in failures:
            print(f"  - {f}")
        return False, failures
    print(f"ALL {len(targets)} WEB FILES PASS!")
    return True, []


if __name__ == "__main__":
    root = Path(__file__).resolve().parent.parent / "web"
    ok, _ = check_web_lines(root)
    sys.exit(0 if ok else 1)
