#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
E2E Opaque-Box Test Suite for Japanese Vocabulary Q&A Reflex Conversion.
Author: Teamwork E2E Testing Worker
Interface Contracts & Specifications:
  - PROJECT.md (Data Schema Contract & Milestone Requirements)
  - ORIGINAL_REQUEST.md (R1, R2, R3, Acceptance Criteria)
  - HUONG_DAN_THIET_KE_DU_LIEU.md (Question, Answer, and Variant Guidelines)
  - check_json.py (Core Validation Gate & ALLOWED_TYPES)

4-Tier Test Architecture:
  Tier 1: Schema Conformance (10 required fields, integer IDs, ALLOWED_TYPES,
          non-empty tags, question/answer subfields, examples array).
  Tier 2: Linguistic & Reflex Constraints (100% Wh-questions with 11 Wh-word
          categories; STRICTLY 0% Yes/No questions; bracket sync; >=3 tier answer variants).
  Tier 3: Cross-Lesson Integration (Sequential IDs 1..N, zero duplicates,
          Hepburn romaji without macrons, particle wa/o/e consistency).
  Tier 4: Real-World Scenarios (Frontend syntax check 'node -c app.js',
          'check_json.py' execution).
"""

import os
import sys
import glob
import json
import re
import argparse
import subprocess
from typing import Dict, List, Tuple, Any, Optional

# Ensure UTF-8 output encoding across environments (Windows cmd/powershell)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# ANSI Color Codes
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
MAGENTA = "\033[95m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"

# -----------------------------------------------------------------------------
# Tier 1 Schema Constants
# -----------------------------------------------------------------------------
ALLOWED_TYPES = {
    "Danh từ",
    "Động từ",
    "Tính từ -i",
    "Tính từ -na",
    "Phó từ",
    "Lượng từ",
    "Trợ từ",
    "Liên từ",
    "Cụm từ",
    "Danh từ riêng",
    "Đại từ",
    "Từ để hỏi"
}

REQUIRED_ROOT_FIELDS = [
    "id",
    "term",
    "reading",
    "romaji",
    "meaning",
    "level",
    "type",
    "tags",
    "question",
    "answer"
]

REQUIRED_QUESTION_FIELDS = [
    "short",
    "polite",
    "reading",
    "romaji",
    "vietnamese",
    "variants"
]

REQUIRED_ANSWER_FIELDS = [
    "short",
    "reading",
    "romaji",
    "vietnamese",
    "variants"
]

# -----------------------------------------------------------------------------
# Tier 2 Linguistic & Reflex Patterns
# -----------------------------------------------------------------------------
# 11 Wh-word categories documented in HUONG_DAN_THIET_KE_DU_LIEU.md:
# 1. 何 / なに / なん (Cái gì, mấy)
# 2. 誰 / だれ / どなた (Ai)
# 3. どこ / 何処 / どちら (Ở đâu, hướng nào)
# 4. いつ / 何時 (Khi nào, mấy giờ)
# 5. どう / いかが (Thế nào, ra sao)
# 6. どんな (Như thế nào - tính chất/hương vị)
# 7. どっち / どちら (Cái nào - so sánh)
# 8. いくら / 幾ら (Bao nhiêu tiền)
# 9. いくつ / 幾つ (Mấy cái, bao nhiêu tuổi)
# 10. どうして / なぜ / 何故 (Tại sao)
# 11. どの / どれ / どのくらい (Nào, bao lâu, bao xa)
WH_PATTERNS = [
    r'何|なに|なん',
    r'誰|だれ|どなた',
    r'どこ|何処|どちら',
    r'いつ|何時',
    r'どう|いかが',
    r'どんな',
    r'どっち',
    r'いくら|幾ら',
    r'いくつ|幾つ',
    r'どうして|なぜ|何故',
    r'どの|どれ'
]
WH_REGEX = re.compile('|'.join(WH_PATTERNS))

# Yes/No indicators (strictly prohibited in reflex design)
# Prohibited Japanese confirmation/denial responses:
YES_NO_JP_ANSWER_REGEX = re.compile(
    r'^(うん|ううん|はい|いいえ|ええ|そう)([、\s!！\.\?]|$)'
)
# Prohibited Romaji confirmation/denial responses:
YES_NO_ROMAJI_ANSWER_REGEX = re.compile(
    r'^(un|uun|hai|iie|ee|sou)([,\s!\.\?]|$)', re.IGNORECASE
)
# Vietnamese Yes/No question markers:
YES_NO_VN_QUESTION_REGEX = re.compile(
    r'(phải không|đúng không|được không|có\s+.*(không|chưa))\s*[\?？]?$', re.IGNORECASE
)
# Vietnamese Wh-word whitelist to disambiguate:
VN_WH_WORDS = re.compile(
    r'gì|ai|đâu|nào|mấy|bao nhiêu|bao lâu|sao|thế nào|khi nào|bao giờ|tại sao|vì sao', re.IGNORECASE
)

# -----------------------------------------------------------------------------
# Tier 3 Orthography Patterns
# -----------------------------------------------------------------------------
# Prohibited macrons (Hepburn requires ou/uu/oo/hyphen without diacritical macrons)
MACRON_REGEX = re.compile(r'[āīūēōĀĪŪĒŌ]')

# -----------------------------------------------------------------------------
# Validation Functions
# -----------------------------------------------------------------------------

def validate_tier1_schema(data: Any, filename: str) -> Tuple[bool, List[str], List[str]]:
    """
    Tier 1: Schema Conformance.
    Validates array structure, 10 required root fields, integer IDs, N5 level,
    ALLOWED_TYPES, non-empty tags, question & answer subfields, and examples array.
    """
    errors: List[str] = []
    warnings: List[str] = []

    if not isinstance(data, list):
        errors.append(f"Root JSON data must be an Array (list), got {type(data).__name__}")
        return False, errors, warnings

    if len(data) == 0:
        errors.append("Lesson data array is empty (0 items)")
        return False, errors, warnings

    for idx, item in enumerate(data):
        item_id = item.get("id", f"idx_{idx}")
        term = item.get("term", "UNKNOWN")
        prefix = f"[{filename} Item #{item_id} ({term})]"

        # 1. 10 Required Root Fields
        for field in REQUIRED_ROOT_FIELDS:
            if field not in item:
                errors.append(f"{prefix} Missing required root field: '{field}'")
            elif item[field] is None or item[field] == "":
                errors.append(f"{prefix} Field '{field}' cannot be null or empty")

        # 2. Integer ID
        raw_id = item.get("id")
        if raw_id is not None:
            if not isinstance(raw_id, int) or isinstance(raw_id, bool):
                errors.append(f"{prefix} 'id' must be an integer, got {type(raw_id).__name__}")
            elif raw_id <= 0:
                errors.append(f"{prefix} 'id' must be positive (> 0), got {raw_id}")

        # 3. Level == "N5"
        level = item.get("level")
        if level is not None and level != "N5":
            errors.append(f"{prefix} 'level' must be strictly 'N5', got '{level}'")

        # 4. Type strictly in ALLOWED_TYPES
        item_type = item.get("type")
        if item_type is not None and item_type not in ALLOWED_TYPES:
            errors.append(f"{prefix} 'type' '{item_type}' is invalid; must be in ALLOWED_TYPES")

        # 5. Non-empty Tags array
        tags = item.get("tags")
        if tags is not None:
            if not isinstance(tags, list):
                errors.append(f"{prefix} 'tags' must be a list, got {type(tags).__name__}")
            elif len(tags) == 0:
                errors.append(f"{prefix} 'tags' array must not be empty")
            else:
                for t in tags:
                    if not isinstance(t, str) or not t.strip():
                        errors.append(f"{prefix} 'tags' contains non-string or empty element: {repr(t)}")

        # 6. Question subfields
        q = item.get("question")
        if q is not None:
            if not isinstance(q, dict):
                errors.append(f"{prefix} 'question' must be an object/dict")
            else:
                for qf in REQUIRED_QUESTION_FIELDS:
                    if qf not in q or q[qf] is None or q[qf] == "":
                        errors.append(f"{prefix} 'question' missing or empty field: '{qf}'")
                variants = q.get("variants")
                if variants is not None:
                    if not isinstance(variants, list) or len(variants) == 0:
                        errors.append(f"{prefix} 'question.variants' must be a non-empty list")
                    else:
                        for v in variants:
                            if not isinstance(v, str) or not v.strip():
                                errors.append(f"{prefix} 'question.variants' contains empty item")

        # 7. Answer subfields
        a = item.get("answer")
        if a is not None:
            if not isinstance(a, dict):
                errors.append(f"{prefix} 'answer' must be an object/dict")
            else:
                for af in REQUIRED_ANSWER_FIELDS:
                    if af not in a or a[af] is None or a[af] == "":
                        errors.append(f"{prefix} 'answer' missing or empty field: '{af}'")
                variants = a.get("variants")
                if variants is not None:
                    if not isinstance(variants, list) or len(variants) == 0:
                        errors.append(f"{prefix} 'answer.variants' must be a non-empty list")
                    else:
                        for v in variants:
                            if not isinstance(v, str) or not v.strip():
                                errors.append(f"{prefix} 'answer.variants' contains empty item")

        # 8. Examples array
        examples = item.get("examples")
        if examples is None and "example" in item:
            # Fallback legacy check
            ex = item.get("example")
            if not isinstance(ex, dict) or not ex.get("japanese"):
                errors.append(f"{prefix} Missing valid example")
            else:
                warnings.append(f"{prefix} Uses legacy singular 'example' instead of 'examples' array")
        elif examples is None:
            errors.append(f"{prefix} Missing 'examples' array")
        else:
            if not isinstance(examples, list) or len(examples) == 0:
                errors.append(f"{prefix} 'examples' must be a non-empty list of example objects")
            else:
                for e_idx, ex in enumerate(examples):
                    if not isinstance(ex, dict):
                        errors.append(f"{prefix} example #{e_idx+1} is not a dict")
                    else:
                        if not ex.get("japanese"):
                            errors.append(f"{prefix} example #{e_idx+1} missing 'japanese'")
                        if not ex.get("vietnamese"):
                            errors.append(f"{prefix} example #{e_idx+1} missing 'vietnamese'")

    passed = (len(errors) == 0)
    return passed, errors, warnings


def validate_tier2_linguistic(data: Any, filename: str) -> Tuple[bool, List[str], List[str]]:
    """
    Tier 2: Linguistic & Reflex Constraints.
    1. 100% Wh-questions: checks presence of Wh-word in question.short/reading/polite.
    2. STRICTLY 0% Yes/No questions: flags confirmation answers (うん/はい/un/hai)
       or questions ending in ? without Wh-words.
    3. Bracket sync between term and reading (count and symmetry of '[' and ']').
    4. Multi-tier answer variants: at least 3 acceptable answer variants.
    """
    errors: List[str] = []
    warnings: List[str] = []

    if not isinstance(data, list):
        return False, ["Root is not list"], []

    for idx, item in enumerate(data):
        item_id = item.get("id", f"idx_{idx}")
        term = item.get("term", "UNKNOWN")
        reading = item.get("reading", "")
        tags = item.get("tags", [])
        q = item.get("question") or {}
        a = item.get("answer") or {}
        prefix = f"[{filename} Item #{item_id} ({term})]"

        if not q or not a or not isinstance(q, dict) or not isinstance(a, dict):
            errors.append(f"{prefix} Missing question/answer object; reflex conversation constraints failed")
            continue

        q_short = q.get("short", "").strip()
        q_polite = q.get("polite", "").strip()
        q_reading = q.get("reading", "").strip()
        q_vietnamese = q.get("vietnamese", "").strip()
        a_short = a.get("short", "").strip()
        a_romaji = a.get("romaji", "").strip()
        a_variants = a.get("variants", [])

        # -------------------------------------------------------------
        # Rule 2.1: 100% Wh-Questions & Rule 2.2: 0% Yes/No Questions
        # -------------------------------------------------------------
        # Check if item is an Aisatsu greeting reflex prompt (e.g. topic:greeting)
        is_greeting = isinstance(tags, list) and ("topic:greeting" in tags or "topic:leave" in tags)
        has_q_mark = ("?" in q_short) or ("？" in q_short)

        # Check for prohibited Yes/No answer patterns
        if YES_NO_JP_ANSWER_REGEX.search(a_short):
            errors.append(f"{prefix} PROHIBITED Yes/No answer detected in Japanese: '{a_short}'")
        if YES_NO_ROMAJI_ANSWER_REGEX.search(a_romaji):
            errors.append(f"{prefix} PROHIBITED Yes/No answer detected in Romaji: '{a_romaji}'")

        # Check for Wh-word presence
        combined_q_text = f"{q_short} {q_polite} {q_reading}"
        has_wh = bool(WH_REGEX.search(combined_q_text))

        if has_q_mark and not has_wh:
            # Has question mark but no Wh-word => Confirmation Yes/No question!
            errors.append(
                f"{prefix} PROHIBITED Yes/No question: '{q_short}'. Must use a Wh-word (100% Wh-questions rule)."
            )
        elif not is_greeting and not has_wh:
            # Regular vocabulary item without Wh-word in question
            errors.append(
                f"{prefix} Question lacks Wh-words: '{q_short}'. Expected Wh-words: なに/なん, だれ, どこ, いつ, どう, どんな, どっち, いくら, いくつ, どうして, どの."
            )

        # Check Vietnamese question for Yes/No phrasing (unless Wh-word is present)
        if YES_NO_VN_QUESTION_REGEX.search(q_vietnamese) and not VN_WH_WORDS.search(q_vietnamese):
            warnings.append(
                f"{prefix} Vietnamese prompt looks like Yes/No question: '{q_vietnamese}'"
            )

        # -------------------------------------------------------------
        # Rule 2.3: Bracket Synchronization
        # -------------------------------------------------------------
        term_open = term.count("[")
        term_close = term.count("]")
        reading_open = reading.count("[")
        reading_close = reading.count("]")

        if term_open != term_close:
            errors.append(f"{prefix} Unbalanced brackets in term: '{term}'")
        if reading_open != reading_close:
            errors.append(f"{prefix} Unbalanced brackets in reading: '{reading}'")
        if term_open != reading_open:
            errors.append(
                f"{prefix} Bracket mismatch between term ('{term}') and reading ('{reading}')"
            )

        # -------------------------------------------------------------
        # Rule 2.4: Multi-Tier Answer Variants (>= 3 tiers)
        # -------------------------------------------------------------
        if isinstance(a_variants, list):
            if len(a_variants) < 3:
                errors.append(
                    f"{prefix} 'answer.variants' has only {len(a_variants)} items. Minimum 3 tiers required."
                )
            # Ensure diversity (not identical copies)
            cleaned_variants = [v.strip().lower() for v in a_variants if isinstance(v, str)]
            if len(set(cleaned_variants)) < len(cleaned_variants):
                warnings.append(f"{prefix} 'answer.variants' contains duplicate entries")

    passed = (len(errors) == 0)
    return passed, errors, warnings


def validate_tier3_integration(data: Any, filename: str) -> Tuple[bool, List[str], List[str]]:
    """
    Tier 3: Cross-Lesson Integration.
    1. Sequential IDs 1..N with zero duplicates and strictly ordered.
    2. Romaji orthography: strictly no macrons (ā, ī, ū, ē, ō).
    3. Romaji conventions: check phonetic particles and whitespace hygiene.
    """
    errors: List[str] = []
    warnings: List[str] = []

    if not isinstance(data, list):
        return False, ["Root is not list"], []

    total_items = len(data)

    # 1. Sequential IDs 1..N
    actual_ids = [item.get("id") for item in data]
    expected_ids = list(range(1, total_items + 1))

    if actual_ids != expected_ids:
        # Diagnose ID issues
        non_ints = [x for x in actual_ids if not isinstance(x, int) or isinstance(x, bool)]
        if non_ints:
            errors.append(f"[{filename}] Contains {len(non_ints)} missing or non-integer ID(s)")
        else:
            seen = set()
            duplicates = []
            for x in actual_ids:
                if x in seen and x not in duplicates:
                    duplicates.append(x)
                seen.add(x)
            if duplicates:
                errors.append(f"[{filename}] Duplicate IDs found: {duplicates}")

            missing_ids = set(expected_ids) - set(actual_ids)
            if missing_ids:
                errors.append(
                    f"[{filename}] Missing IDs in range 1..{total_items}: {sorted(list(missing_ids))[:10]}"
                )

            if actual_ids != sorted(actual_ids):
                errors.append(f"[{filename}] IDs are not in ascending order")
            elif not duplicates and not missing_ids and actual_ids != expected_ids:
                errors.append(f"[{filename}] IDs do not start at 1 (starts at {actual_ids[0] if actual_ids else 'None'})")

    # 2. Romaji Orthography (Macrons Proscription)
    for idx, item in enumerate(data):
        item_id = item.get("id", f"idx_{idx}")
        prefix = f"[{filename} Item #{item_id}]"

        romaji_fields = [
            ("romaji", item.get("romaji", "")),
            ("question.romaji", item.get("question", {}).get("romaji", "")),
            ("answer.romaji", item.get("answer", {}).get("romaji", ""))
        ]
        for field_name, r_val in romaji_fields:
            if isinstance(r_val, str):
                macrons = MACRON_REGEX.findall(r_val)
                if macrons:
                    errors.append(
                        f"{prefix} Prohibited macron(s) {macrons} found in '{field_name}': '{r_val}'"
                    )

        # 3. Particle Check (warn if ' ha ' or ' he ' used as particle instead of 'wa' / 'e')
        q_romaji = item.get("question", {}).get("romaji", "")
        a_romaji = item.get("answer", {}).get("romaji", "")
        for field_name, text in [("question.romaji", q_romaji), ("answer.romaji", a_romaji)]:
            if isinstance(text, str):
                # Search for isolated words 'ha' or 'he'
                if re.search(r'\bha\b', text, re.IGNORECASE):
                    warnings.append(
                        f"{prefix} Isolated 'ha' found in '{field_name}'. Verify if it is particle 'wa': '{text}'"
                    )
                if re.search(r'\bhe\b', text, re.IGNORECASE):
                    warnings.append(
                        f"{prefix} Isolated 'he' found in '{field_name}'. Verify if it is particle 'e': '{text}'"
                    )

    passed = (len(errors) == 0)
    return passed, errors, warnings


def validate_tier4_realworld(workspace_dir: str) -> Tuple[bool, List[str], List[str]]:
    """
    Tier 4: Real-World Scenarios.
    1. Frontend syntax check: `node -c app.js` (exit code 0).
    2. Core validator check: `python check_json.py` (reported for visibility).
    """
    errors: List[str] = []
    warnings: List[str] = []

    # 1. node -c on web/js/**/*.js
    js_dir = os.path.join(workspace_dir, "web", "js")
    js_files = sorted(glob.glob(os.path.join(js_dir, "**", "*.js"), recursive=True))
    if not js_files:
        errors.append(f"No JS modules found in: {js_dir}")
    else:
        for js_path in js_files:
            try:
                res = subprocess.run(
                    ["node", "-c", js_path],
                    cwd=workspace_dir,
                    capture_output=True,
                    text=True,
                    timeout=15
                )
                if res.returncode != 0:
                    errors.append(f"node -c {os.path.relpath(js_path, workspace_dir)} failed: {res.stderr}")
            except FileNotFoundError:
                warnings.append("Node.js binary not found in PATH; skipping 'node -c'")
                break
            except Exception as e:
                errors.append(f"Error running 'node -c {js_path}': {e}")

    # 1b. Web anti-monolith line guard
    web_guard = os.path.join(workspace_dir, "scripts", "check_web_lines.py")
    if os.path.exists(web_guard):
        try:
            res_g = subprocess.run([sys.executable, web_guard], cwd=workspace_dir, capture_output=True, text=True, timeout=15)
            if res_g.returncode != 0:
                errors.append(f"Web anti-monolith guard failed:\n{res_g.stdout}")
        except Exception as e:
            errors.append(f"Error running check_web_lines.py: {e}")

    # 2. scripts/check_json.py run check
    check_json_path = os.path.join(workspace_dir, "scripts", "check_json.py")
    if not os.path.exists(check_json_path):
        errors.append(f"scripts/check_json.py not found in workspace: {workspace_dir}")

    passed = (len(errors) == 0)
    return passed, errors, warnings


# -----------------------------------------------------------------------------
# Test Suite Runner
# -----------------------------------------------------------------------------

class LessonTestReport:
    def __init__(self, filename: str, total_items: int = 0):
        self.filename = filename
        self.total_items = total_items
        self.tier1_pass = False
        self.tier2_pass = False
        self.tier3_pass = False
        self.errors: List[str] = []
        self.warnings: List[str] = []

    @property
    def passed(self) -> bool:
        return self.tier1_pass and self.tier2_pass and self.tier3_pass


def run_e2e_suite(
    target_files: List[str],
    workspace_dir: str,
    selected_tier: Optional[int] = None,
    verbose: bool = False
) -> Dict[str, Any]:
    """
    Executes the 4-tier test harness across all target lesson files.
    """
    file_reports: List[LessonTestReport] = []

    for file_path in target_files:
        filename = os.path.basename(file_path)
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            rep = LessonTestReport(filename, 0)
            rep.errors.append(f"Failed to load/parse JSON: {e}")
            file_reports.append(rep)
            continue

        item_count = len(data) if isinstance(data, list) else 0
        rep = LessonTestReport(filename, item_count)

        # Tier 1
        if selected_tier is None or selected_tier == 1:
            t1_pass, t1_err, t1_warn = validate_tier1_schema(data, filename)
            rep.tier1_pass = t1_pass
            rep.errors.extend(t1_err)
            rep.warnings.extend(t1_warn)
        else:
            rep.tier1_pass = True

        # Tier 2
        if selected_tier is None or selected_tier == 2:
            t2_pass, t2_err, t2_warn = validate_tier2_linguistic(data, filename)
            rep.tier2_pass = t2_pass
            rep.errors.extend(t2_err)
            rep.warnings.extend(t2_warn)
        else:
            rep.tier2_pass = True

        # Tier 3
        if selected_tier is None or selected_tier == 3:
            t3_pass, t3_err, t3_warn = validate_tier3_integration(data, filename)
            rep.tier3_pass = t3_pass
            rep.errors.extend(t3_err)
            rep.warnings.extend(t3_warn)
        else:
            rep.tier3_pass = True

        file_reports.append(rep)

    # Tier 4 Real-World Scenarios
    tier4_pass = True
    tier4_errors: List[str] = []
    tier4_warnings: List[str] = []

    if selected_tier is None or selected_tier == 4:
        tier4_pass, tier4_errors, tier4_warnings = validate_tier4_realworld(workspace_dir)

    all_files_pass = all(r.passed for r in file_reports)
    overall_pass = all_files_pass and tier4_pass

    return {
        "overall_pass": overall_pass,
        "file_reports": file_reports,
        "tier4_pass": tier4_pass,
        "tier4_errors": tier4_errors,
        "tier4_warnings": tier4_warnings
    }


def print_suite_summary(
    results: Dict[str, Any],
    verbose: bool = False
) -> None:
    """
    Renders structured summary table and details.
    """
    print(f"\n{BOLD}================================================================================{RESET}")
    print(f"{BOLD}           E2E TESTING TRACK: 4-TIER TEST SUITE SUMMARY                        {RESET}")
    print(f"{BOLD}================================================================================{RESET}")
    print(f" {'File':<15} | {'Items':<6} | {'Tier 1 (Schema)':<16} | {'Tier 2 (Linguistic)':<19} | {'Tier 3 (Integ)':<14} | {'Status':<10}")
    print(f"-----------------+--------+------------------+---------------------+----------------+-----------")

    file_reports: List[LessonTestReport] = results["file_reports"]
    for rep in file_reports:
        t1_str = f"{GREEN}PASS{RESET}" if rep.tier1_pass else f"{RED}FAIL{RESET}"
        t2_str = f"{GREEN}PASS{RESET}" if rep.tier2_pass else f"{RED}FAIL{RESET}"
        t3_str = f"{GREEN}PASS{RESET}" if rep.tier3_pass else f"{RED}FAIL{RESET}"
        status_str = f"{GREEN}{BOLD}PASS{RESET}" if rep.passed else f"{RED}{BOLD}FAIL{RESET}"

        print(f" {rep.filename:<15} | {rep.total_items:<6} | {t1_str:<25} | {t2_str:<28} | {t3_str:<23} | {status_str}")

    print(f"-----------------+--------+------------------+---------------------+----------------+-----------")
    t4_str = f"{GREEN}{BOLD}PASS (0 errors){RESET}" if results["tier4_pass"] else f"{RED}{BOLD}FAIL{RESET}"
    print(f" Tier 4 (Real-World Scenarios - node -c app.js): {t4_str}")

    total_errors = sum(len(r.errors) for r in file_reports) + len(results["tier4_errors"])
    total_warnings = sum(len(r.warnings) for r in file_reports) + len(results["tier4_warnings"])

    print(f"\n{BOLD}Metrics:{RESET}")
    print(f"  - Total Files Evaluated : {len(file_reports)}")
    print(f"  - Total Errors Detected : {RED if total_errors else GREEN}{total_errors}{RESET}")
    print(f"  - Total Warnings        : {YELLOW}{total_warnings}{RESET}")

    if verbose or not results["overall_pass"]:
        print(f"\n{BOLD}Detailed Failure Analysis (First 15 per file):{RESET}")
        for rep in file_reports:
            if rep.errors:
                print(f"\n{RED}{BOLD}✖ {rep.filename} ({len(rep.errors)} errors):{RESET}")
                for err in rep.errors[:15]:
                    print(f"   {RED}• {err}{RESET}")
                if len(rep.errors) > 15:
                    print(f"   {DIM}... and {len(rep.errors) - 15} more errors{RESET}")

        if results["tier4_errors"]:
            print(f"\n{RED}{BOLD}✖ Tier 4 Real-World Errors:{RESET}")
            for err in results["tier4_errors"]:
                print(f"   {RED}• {err}{RESET}")

    print(f"{BOLD}================================================================================{RESET}")
    if results["overall_pass"]:
        print(f"{GREEN}{BOLD}OVERALL VERDICT: GREEN (PASS 100%){RESET}\n")
    else:
        print(f"{RED}{BOLD}OVERALL VERDICT: RED (TESTS FAILED - WORK IN PROGRESS){RESET}\n")


def main():
    parser = argparse.ArgumentParser(
        description="E2E Test Runner for Japanese Vocabulary Q&A Reflex Data Conversion"
    )
    parser.add_argument(
        "--baseline",
        action="store_true",
        help="Run baseline verification only against reference completed files (bai_11.json, bai_12.json)"
    )
    parser.add_argument(
        "--files",
        nargs="+",
        help="Specify one or more lesson files to evaluate (e.g. --files bai_3.json bai_4.json)"
    )
    parser.add_argument(
        "--tier",
        type=int,
        choices=[1, 2, 3, 4],
        help="Run only a specific test tier (1: Schema, 2: Linguistic, 3: Integration, 4: Real-World)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Print verbose error traces"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results in JSON format"
    )

    args = parser.parse_args()

    # Determine workspace directory (scripts/tests/ -> ../..)
    cur_dir = os.path.dirname(os.path.abspath(__file__))
    workspace_dir = os.path.abspath(os.path.join(cur_dir, "..", "..")) if os.path.basename(cur_dir) == "tests" else cur_dir
    if not os.path.exists(os.path.join(workspace_dir, "scripts", "check_json.py")):
        workspace_dir = os.getcwd()

    vocab_dir = os.path.join(workspace_dir, "data", "vocab")
    if args.baseline:
        target_files = [
            os.path.join(vocab_dir, "bai_11.json"),
            os.path.join(vocab_dir, "bai_12.json")
        ]
    elif args.files:
        target_files = []
        for f in args.files:
            p = f if os.path.isabs(f) else (f if os.path.exists(f) else os.path.join(vocab_dir, f))
            target_files.append(p)
    else:
        target_files = sorted(glob.glob(os.path.join(vocab_dir, "bai_*.json")))

    if not target_files:
        print(f"{RED}Error: No lesson files found to test in {workspace_dir}{RESET}")
        sys.exit(1)

    results = run_e2e_suite(
        target_files=target_files,
        workspace_dir=workspace_dir,
        selected_tier=args.tier,
        verbose=args.verbose
    )

    if args.json:
        payload = {
            "overall_pass": results["overall_pass"],
            "tier4_pass": results["tier4_pass"],
            "tier4_errors": results["tier4_errors"],
            "files": [
                {
                    "filename": r.filename,
                    "total_items": r.total_items,
                    "passed": r.passed,
                    "tier1": r.tier1_pass,
                    "tier2": r.tier2_pass,
                    "tier3": r.tier3_pass,
                    "error_count": len(r.errors),
                    "warning_count": len(r.warnings)
                }
                for r in results["file_reports"]
            ]
        }
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    else:
        print_suite_summary(results, verbose=args.verbose)

    # Return exit code
    sys.exit(0 if results["overall_pass"] else 1)


if __name__ == "__main__":
    main()
