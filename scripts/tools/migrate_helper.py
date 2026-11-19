#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tools/migrate_helper.py

Shared migration and validation utilities for Minna Q&A Reflex Data Conversion.
Supports Lessons 3 to 10 conversion, cleaning, scaffolding, and verification.
Conforms to PROJECT.md architecture and check_json.py specifications.
"""

from typing import List, Dict, Any, Tuple, Optional, Set
import copy
import glob
import json
import os
import re
import sys

# Ensure UTF-8 output encoding on Windows console
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# ANSI Color Codes for terminal reporting
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

# ---------------------------------------------------------------------------
# Strict Constants & Rulebook (from check_json.py & HUONG_DAN_THIET_KE_DU_LIEU.md)
# ---------------------------------------------------------------------------

ALLOWED_TYPES: Set[str] = {
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

REQUIRED_VOCAB_FIELDS: List[str] = [
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

QUESTION_REQUIRED_FIELDS: List[str] = ["short", "reading", "romaji", "vietnamese"]
ANSWER_REQUIRED_FIELDS: List[str] = ["short", "reading", "romaji", "vietnamese"]

DEFAULT_ROGUE_FIELDS: List[str] = ["meanings"]

# Specific term groups for suffix remapping
COUNTER_SUFFIX_TERMS: Set[str] = {
    '－階',
    '－階（－がい）',
    '－円',
    '－段目',
    '～階',
    '～円',
    '～段目'
}

NOUN_SUFFIX_TERMS: Set[str] = {
    '～屋',
    '-屋'
}

# Wh-Question detection regex (for pedagogical reflex validation)
WH_QUESTION_REGEX = re.compile(
    r"(どう|いかが|どんな|どっち|どちら|どれ|どのくらい|どのぐらい|どの|"
    r"何[かでにをもが]?|なに|なん|いつ|どこ|だれ|どなた|いくら|いくつ|"
    r"どうして|なぜ)"
)


# ---------------------------------------------------------------------------
# 1. Type Remapping
# ---------------------------------------------------------------------------

def remap_type(term: str, current_type: str) -> str:
    """
    Remap invalid or legacy vocabulary types to ALLOWED_TYPES.

    Rules:
    - 'Đại từ chỉ định' -> 'Đại từ'
    - 'Từ nghi vấn' -> 'Từ để hỏi'
    - 'Hậu tố':
        - if term in ['－階', '－階（－がい）', '－円', '－段目'] -> 'Lượng từ'
        - if term in ['～屋'] -> 'Danh từ'
        - general fallback based on counters / nouns
    - 'Thán từ' -> 'Cụm từ'
    - 'Danh tự' -> 'Danh từ'
    - Any type already in ALLOWED_TYPES is kept unchanged.
    """
    if not current_type:
        return "Danh từ"

    clean_type = current_type.strip()
    clean_term = term.strip() if term else ""

    if clean_type in ALLOWED_TYPES:
        return clean_type

    if clean_type == "Đại từ chỉ định":
        return "Đại từ"

    if clean_type == "Từ nghi vấn":
        return "Từ để hỏi"

    if clean_type == "Thán từ":
        return "Cụm từ"

    if clean_type == "Danh tự":
        return "Danh từ"

    if clean_type == "Hậu tố":
        if clean_term in COUNTER_SUFFIX_TERMS:
            return "Lượng từ"
        if clean_term in NOUN_SUFFIX_TERMS or clean_term.endswith("屋"):
            return "Danh từ"
        # Heuristic for other counter suffixes with numbers/units
        if any(c in clean_term for c in ['階', '円', '段', '人', '本', '枚', '個', 'つ', '番', '日', '月', '年', '時', '分']):
            return "Lượng từ"
        return "Lượng từ"

    return clean_type


def remap_item_type(item: Dict[str, Any]) -> Dict[str, Any]:
    """Remap type in-place or on item dict."""
    item["type"] = remap_type(item.get("term", ""), item.get("type", ""))
    return item


# ---------------------------------------------------------------------------
# 2. Sequential ID Assignment
# ---------------------------------------------------------------------------

def assign_sequential_ids(
    data: List[Dict[str, Any]],
    start_id: int = 1,
    force: bool = False
) -> List[Dict[str, Any]]:
    """
    Assign 1..N sequential integer IDs to vocabulary items.

    - If force is True: reassigns IDs for all items starting from start_id.
    - If force is False: assigns sequential IDs only if any item lacks an integer ID.
    - Preserves deep copies of the original items.
    """
    needs_assignment = force or any(
        "id" not in item or item["id"] is None or not isinstance(item["id"], int)
        for item in data
    )

    result = []
    for idx, item in enumerate(data):
        item_copy = copy.deepcopy(item)
        if needs_assignment:
            item_copy["id"] = start_id + idx
        result.append(item_copy)

    return result


# ---------------------------------------------------------------------------
# 3. Rogue Field Cleanup
# ---------------------------------------------------------------------------

def clean_rogue_fields(
    item: Dict[str, Any],
    rogue_fields: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Remove rogue fields (such as 'meanings') from a vocabulary item.
    """
    fields_to_remove = rogue_fields if rogue_fields is not None else DEFAULT_ROGUE_FIELDS
    for field in fields_to_remove:
        item.pop(field, None)
    return item


def clean_rogue_fields_list(
    data: List[Dict[str, Any]],
    rogue_fields: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """Remove rogue fields from all items in a list."""
    return [clean_rogue_fields(item, rogue_fields) for item in data]


# ---------------------------------------------------------------------------
# 4. Examples Standardization
# ---------------------------------------------------------------------------

def standardize_examples(item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Standardize examples representation in item.

    - If item has `example` (dict) but no `examples`, converts to `examples: [example]`.
    - If both exist, merges and deduplicates by (japanese, vietnamese).
    - Removes deprecated `example` field.
    - Ensures `examples` is a valid list of dicts with 'japanese' and 'vietnamese'.
    """
    example_single = item.get("example")
    examples_multi = item.get("examples")

    merged: List[Dict[str, str]] = []
    seen: Set[Tuple[str, str]] = set()

    def add_ex(ex: Any):
        if isinstance(ex, dict):
            jp = str(ex.get("japanese", "")).strip()
            vn = str(ex.get("vietnamese", "")).strip()
            key = (jp, vn)
            if key not in seen and (jp or vn):
                seen.add(key)
                merged.append({"japanese": jp, "vietnamese": vn})

    if isinstance(examples_multi, list):
        for ex in examples_multi:
            add_ex(ex)

    if isinstance(example_single, dict):
        add_ex(example_single)

    item["examples"] = merged
    item.pop("example", None)
    return item


def standardize_examples_list(data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Standardize examples for all items in a list."""
    return [standardize_examples(item) for item in data]


# ---------------------------------------------------------------------------
# 5. Bracket Consistency
# ---------------------------------------------------------------------------

def ensure_bracket_consistency(term: str, reading: str) -> str:
    """
    Ensure that if term contains '[', reading contains corresponding '['.

    Patterns handled:
    - Adjective ending: [な] (e.g. 好き[な] -> すき[な])
    - Interjection/particle: [ね], [など] (e.g. 残念です[ね]。 -> ざんねんです[ね]。)
    - Prefixes: [お], [～を], [～は] (e.g. [お]国 -> [お]くに)
    - Generic bracketed content fallback
    """
    if not term or "[" not in term:
        return reading

    if not reading:
        return reading

    # Already has brackets
    if "[" in reading:
        return reading

    updated = reading

    # 1. Prefix [お]
    if term.startswith("[お]"):
        if updated.startswith("お"):
            updated = "[お]" + updated[1:]
        else:
            updated = "[お]" + updated

    # 2. Prefix [～を]
    if term.startswith("[～を]"):
        if not updated.startswith("[～を]"):
            updated = "[～を] " + updated.lstrip()

    # 3. Prefix [～は]
    if term.startswith("[～は]"):
        if not updated.startswith("[～は]"):
            updated = "[～は] " + updated.lstrip()

    # 4. Suffix [な]
    if term.endswith("[な]"):
        if updated.endswith("な") and not updated.endswith("[な]"):
            updated = updated[:-1] + "[な]"
        elif not updated.endswith("[な]"):
            updated = updated + "[な]"

    # 5. [ね]
    if "[ね]" in term:
        if "ね" in updated and "[ね]" not in updated:
            updated = re.sub(r'ね(?=[。！？]|$)', '[ね]', updated)
            if "[ね]" not in updated:
                updated = updated.replace("ね", "[ね]", 1)
        elif "[ね]" not in updated:
            updated = updated + "[ね]"

    # 6. [など]
    if "[など]" in term:
        if "など" in updated and "[など]" not in updated:
            updated = updated.replace("など", "[など]", 1)
        elif "[など]" not in updated:
            updated = updated + "[など]"

    # 7. Generic fallback for any remaining bracketed tokens in term
    if "[" not in updated:
        bracketed_tokens = re.findall(r'\[(.*?)\]', term)
        for token in bracketed_tokens:
            if token and token in updated:
                updated = updated.replace(token, f"[{token}]", 1)
                break
        if "[" not in updated and bracketed_tokens:
            updated = updated + f"[{bracketed_tokens[0]}]"

    return updated


def fix_bracket_consistency_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """Fix bracket consistency for an item in place."""
    term = item.get("term", "")
    reading = item.get("reading", "")
    if "[" in term and "[" not in reading:
        item["reading"] = ensure_bracket_consistency(term, reading)
    return item


# ---------------------------------------------------------------------------
# 6. Scaffold Generator (bai_12 Model)
# ---------------------------------------------------------------------------

def generate_scaffold(
    raw_item: Dict[str, Any],
    default_id: Optional[int] = None,
    use_placeholders: bool = False
) -> Dict[str, Any]:
    """
    Takes a raw vocabulary item and outputs a complete Q&A reflex template
    with empty/placeholder reflex slots structured cleanly according to the bai_12 model.

    - Preserves existing valid fields if present.
    - Remaps invalid types to ALLOWED_TYPES.
    - Synchronizes brackets in reading.
    - Standardizes examples to list of dicts.
    - Deletes rogue fields (e.g. meanings).
    """
    item = copy.deepcopy(raw_item)

    # 1. ID
    if "id" in item and item["id"] is not None and isinstance(item["id"], int):
        assigned_id = item["id"]
    elif default_id is not None:
        assigned_id = default_id
    else:
        assigned_id = 1

    # 2. Term & Reading
    term = str(item.get("term", "")).strip()
    raw_reading = str(item.get("reading", "")).strip()
    reading = ensure_bracket_consistency(term, raw_reading)
    romaji = str(item.get("romaji", "")).strip()
    meaning = str(item.get("meaning", "")).strip()
    level = str(item.get("level", "N5")).strip() or "N5"

    # 3. Type
    vocab_type = remap_type(term, str(item.get("type", "Danh từ")))

    # 4. Tags
    tags = item.get("tags")
    if not isinstance(tags, list) or len(tags) == 0:
        tags = ["topic:daily_life", "tone:casual"]

    # 5. Question structure
    existing_q = item.get("question")
    if isinstance(existing_q, dict):
        question = {
            "short": str(existing_q.get("short", "")),
            "polite": str(existing_q.get("polite", "")),
            "reading": str(existing_q.get("reading", "")),
            "romaji": str(existing_q.get("romaji", "")),
            "vietnamese": str(existing_q.get("vietnamese", "")),
            "variants": list(existing_q.get("variants", []))
        }
    else:
        if use_placeholders:
            placeholder_term = term or "これ"
            placeholder_romaji = romaji or "kore"
            question = {
                "short": f"{placeholder_term}はどう？",
                "polite": f"{placeholder_term}はいかがですか？",
                "reading": f"{reading or placeholder_term}はどう？",
                "romaji": f"{placeholder_romaji} wa dou?",
                "vietnamese": f"{meaning or 'Cái này'} thế nào",
                "variants": [
                    f"{placeholder_romaji} wa dou",
                    f"{placeholder_romaji} dou"
                ]
            }
        else:
            question = {
                "short": "",
                "polite": "",
                "reading": "",
                "romaji": "",
                "vietnamese": "",
                "variants": []
            }

    # 6. Answer structure
    existing_a = item.get("answer")
    if isinstance(existing_a, dict):
        answer = {
            "short": str(existing_a.get("short", "")),
            "reading": str(existing_a.get("reading", "")),
            "romaji": str(existing_a.get("romaji", "")),
            "vietnamese": str(existing_a.get("vietnamese", "")),
            "variants": list(existing_a.get("variants", []))
        }
    else:
        if use_placeholders:
            placeholder_term = term or "これ"
            placeholder_romaji = romaji or "kore"
            answer = {
                "short": f"{placeholder_term}だよ！",
                "reading": f"{reading or placeholder_term}だよ！",
                "romaji": f"{placeholder_romaji} da yo!",
                "vietnamese": f"Là {meaning or 'cái này'}",
                "variants": [
                    f"{placeholder_romaji} da yo",
                    f"{placeholder_romaji} da",
                    f"{placeholder_romaji}"
                ]
            }
        else:
            answer = {
                "short": "",
                "reading": "",
                "romaji": "",
                "vietnamese": "",
                "variants": []
            }

    # 7. Examples
    standardized = standardize_examples(item)
    examples = standardized.get("examples", [])
    if not examples:
        if use_placeholders:
            examples = [
                {
                    "japanese": f"{term}。",
                    "vietnamese": f"{meaning}."
                }
            ]
        else:
            examples = [
                {
                    "japanese": "",
                    "vietnamese": ""
                }
            ]

    scaffold = {
        "id": assigned_id,
        "term": term,
        "reading": reading,
        "romaji": romaji,
        "meaning": meaning,
        "level": level,
        "type": vocab_type,
        "tags": tags,
        "question": question,
        "answer": answer,
        "examples": examples
    }

    clean_rogue_fields(scaffold)
    return scaffold


def generate_scaffold_list(
    data: List[Dict[str, Any]],
    start_id: int = 1,
    use_placeholders: bool = False
) -> List[Dict[str, Any]]:
    """Generate scaffolds for a list of vocabulary items with sequential IDs."""
    return [
        generate_scaffold(item, default_id=start_id + idx, use_placeholders=use_placeholders)
        for idx, item in enumerate(data)
    ]


# ---------------------------------------------------------------------------
# Migration Pipeline Helper
# ---------------------------------------------------------------------------

def migrate_item(
    item: Dict[str, Any],
    new_id: Optional[int] = None,
    use_scaffold: bool = False,
    use_placeholders: bool = False
) -> Dict[str, Any]:
    """
    Apply migration transformation to a single item.
    """
    if use_scaffold:
        return generate_scaffold(item, default_id=new_id, use_placeholders=use_placeholders)

    it = copy.deepcopy(item)
    if new_id is not None:
        it["id"] = new_id

    clean_rogue_fields(it)
    it["type"] = remap_type(it.get("term", ""), it.get("type", "Danh từ"))
    it["reading"] = ensure_bracket_consistency(it.get("term", ""), it.get("reading", ""))
    standardize_examples(it)
    return it


def migrate_data(
    data: List[Dict[str, Any]],
    start_id: int = 1,
    assign_ids: bool = True,
    use_scaffold: bool = False,
    use_placeholders: bool = False
) -> List[Dict[str, Any]]:
    """
    Migrate an entire list of vocabulary items.
    """
    result = []
    needs_id = assign_ids and any(
        "id" not in item or item["id"] is None or not isinstance(item["id"], int)
        for item in data
    )

    for idx, item in enumerate(data):
        target_id = (start_id + idx) if needs_id else item.get("id")
        result.append(
            migrate_item(
                item,
                new_id=target_id,
                use_scaffold=use_scaffold,
                use_placeholders=use_placeholders
            )
        )
    return result


# ---------------------------------------------------------------------------
# 7. Verification Functions (Incorporating check_json.py)
# ---------------------------------------------------------------------------

def is_wh_question(text: str) -> bool:
    """Check if Japanese text contains at least one Wh-question word."""
    if not text:
        return False
    return bool(WH_QUESTION_REGEX.search(text))


def check_vocab_item(
    item: Dict[str, Any],
    idx: int = 0,
    filename: str = "",
    strict_polite: bool = False,
    strict_wh: bool = False
) -> Tuple[List[str], List[str]]:
    """
    Validate a single vocabulary item against check_json.py specifications.

    Parameters:
    - item: The dictionary representing the item.
    - idx: The 0-based index of the item.
    - filename: The source filename (for logging context).
    - strict_polite: If True, also validates presence of 'question.polite'.
    - strict_wh: If True, validates that 'question.short' is a Wh-question (100% Wh rule).

    Returns:
    - (errors, warnings): List of error strings and list of warning strings.
    """
    errors: List[str] = []
    warnings: List[str] = []

    # 1. Required root fields
    for field in REQUIRED_VOCAB_FIELDS:
        if field not in item or item[field] is None or item[field] == "":
            errors.append(f"Thiếu trường bắt buộc '{field}'")

    # 2. Check ID
    item_id = item.get("id")
    if item_id is None:
        errors.append("Thiếu 'id'")
    elif not isinstance(item_id, int):
        errors.append(f"'id' phải là số nguyên (nhận được: {type(item_id).__name__})")

    # 3. Check Type against ALLOWED_TYPES
    item_type = item.get("type")
    if item_type and item_type not in ALLOWED_TYPES:
        errors.append(f"Loại từ không hợp lệ: '{item_type}' (Phải thuộc ALLOWED_TYPES)")

    # 4. Check Tags
    tags = item.get("tags")
    if tags is None or not isinstance(tags, list) or len(tags) == 0:
        errors.append("Trường 'tags' phải là mảng (list) không rỗng")

    # 5. Check Examples
    has_single_ex = isinstance(item.get("example"), dict) and item["example"].get("japanese")
    has_multi_ex = isinstance(item.get("examples"), list) and len(item.get("examples", [])) > 0
    if not has_single_ex and not has_multi_ex:
        errors.append("Thiếu câu ví dụ (cần có 'example' hoặc 'examples')")

    # 6. Bracket synchronization check
    term = str(item.get("term", ""))
    reading = str(item.get("reading", ""))
    if "[" in term and "[" not in reading:
        warnings.append("Khung ngoặc vuông '[' trong 'term' và 'reading' không đồng bộ")

    # 7. Check Question structure
    q = item.get("question")
    if q is not None:
        if not isinstance(q, dict):
            errors.append("Trường 'question' phải là một object (dict)")
        else:
            for q_f in QUESTION_REQUIRED_FIELDS:
                if not q.get(q_f):
                    errors.append(f"Trường 'question' thiếu thông tin '{q_f}'")
            if not isinstance(q.get("variants"), list) or len(q.get("variants", [])) == 0:
                errors.append("Trường 'question.variants' phải là danh sách biến thể chấp nhận không rỗng")
            if strict_polite and not q.get("polite"):
                errors.append("Trường 'question' thiếu thông tin 'polite'")
            if strict_wh:
                q_short = q.get("short", "")
                if q_short and not is_wh_question(q_short):
                    errors.append(f"Câu hỏi không chứa Wh-word (vi phạm quy tắc 100% Wh): '{q_short}'")

    # 8. Check Answer structure
    a = item.get("answer")
    if a is not None:
        if not isinstance(a, dict):
            errors.append("Trường 'answer' phải là một object (dict)")
        else:
            for a_f in ANSWER_REQUIRED_FIELDS:
                if not a.get(a_f):
                    errors.append(f"Trường 'answer' thiếu thông tin '{a_f}'")
            if not isinstance(a.get("variants"), list) or len(a.get("variants", [])) == 0:
                errors.append("Trường 'answer.variants' phải là danh sách biến thể chấp nhận không rỗng")

    return errors, warnings


# Alias for drop-in compatibility with check_json.py
validate_vocab_item = check_vocab_item


def validate_data(
    data: Any,
    filename: str = "<data>",
    strict_polite: bool = False,
    strict_wh: bool = False
) -> Tuple[bool, List[str], List[str]]:
    """
    Validate a complete dataset (JSON list).

    Returns:
    - (is_valid, errors, warnings)
    """
    errors: List[str] = []
    warnings: List[str] = []

    if not isinstance(data, list):
        errors.append(f"Dữ liệu gốc phải là một Danh sách (Array), nhận được: {type(data).__name__}")
        return False, errors, warnings

    seen_ids: Set[int] = set()

    for idx, item in enumerate(data):
        item_id = item.get("id", f"index_{idx}")
        term = item.get("term", "UNKNOWN")

        # Duplicate ID check
        if item_id in seen_ids:
            errors.append(f"[{idx+1}] ID trùng lặp: #{item_id} (Từ: {term})")
        if isinstance(item_id, int):
            seen_ids.add(item_id)

        item_errors, item_warnings = check_vocab_item(
            item,
            idx=idx,
            filename=filename,
            strict_polite=strict_polite,
            strict_wh=strict_wh
        )

        for err in item_errors:
            errors.append(f"[{idx+1}] ID #{item_id} ({term}): {err}")
        for warn in item_warnings:
            warnings.append(f"[{idx+1}] ID #{item_id} ({term}): {warn}")

    is_valid = (len(errors) == 0)
    return is_valid, errors, warnings


def validate_file(
    file_path: str,
    strict_polite: bool = False,
    strict_wh: bool = False
) -> Tuple[bool, List[str], List[str]]:
    """
    Validate a JSON file from disk.
    """
    filename = os.path.basename(file_path)
    if not os.path.isfile(file_path):
        return False, [f"Tệp không tồn tại: {file_path}"], []

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        return False, [f"LỖI PARSE JSON ({filename}): {e}"], []

    return validate_data(data, filename=filename, strict_polite=strict_polite, strict_wh=strict_wh)


def check_file(
    file_path: str,
    strict_polite: bool = False,
    strict_wh: bool = False,
    verbose: bool = True
) -> Tuple[bool, int, int]:
    """
    CLI reporting format compatible with check_json.py check_file.
    Returns (passed, total_errors, total_warnings).
    """
    filename = os.path.basename(file_path)
    if verbose:
        print(f"\n{BOLD}{CYAN}▶ Đang kiểm tra file: {filename}{RESET}")

    passed, errors, warnings = validate_file(
        file_path,
        strict_polite=strict_polite,
        strict_wh=strict_wh
    )

    if verbose:
        for err in errors:
            print(f"  {RED}✖ {err}{RESET}")
        for warn in warnings:
            print(f"  {YELLOW}⚠ {warn}{RESET}")

        if not passed:
            print(f"  {RED}{BOLD}==> KẾT QUẢ: RED (FAIL) - {len(errors)} lỗi, {len(warnings)} cảnh báo{RESET}")
        else:
            if warnings:
                print(f"  {YELLOW}{BOLD}==> KẾT QUẢ: YELLOW (PASS WITH WARNINGS) - {len(warnings)} cảnh báo{RESET}")
            else:
                print(f"  {GREEN}{BOLD}==> KẾT QUẢ: GREEN (PASS 100%){RESET}")

    return passed, len(errors), len(warnings)


# ---------------------------------------------------------------------------
# CLI Entrypoint
# ---------------------------------------------------------------------------

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Minna Q&A Reflex Migration & Validation Helper")
    subparsers = parser.add_subparsers(dest="command", help="Sub-commands")

    # check command
    check_p = subparsers.add_parser("check", help="Validate one or more JSON files")
    check_p.add_argument("files", nargs="+", help="File paths or globs to check")
    check_p.add_argument("--strict-polite", action="store_true", help="Enforce question.polite presence")
    check_p.add_argument("--strict-wh", action="store_true", help="Enforce 100% Wh-questions")

    # scaffold command
    scaffold_p = subparsers.add_parser("scaffold", help="Generate Q&A reflex scaffold from raw vocabulary JSON")
    scaffold_p.add_argument("input", help="Input JSON file")
    scaffold_p.add_argument("--output", "-o", help="Output JSON file (defaults to stdout)")
    scaffold_p.add_argument("--with-placeholders", action="store_true", help="Fill slots with sample placeholders")
    scaffold_p.add_argument("--start-id", type=int, default=1, help="Starting integer ID")

    # clean command
    clean_p = subparsers.add_parser("clean", help="Clean rogue fields and standardize types and examples")
    clean_p.add_argument("input", help="Input JSON file")
    clean_p.add_argument("--output", "-o", help="Output JSON file")
    clean_p.add_argument("--assign-ids", action="store_true", help="Assign sequential IDs if missing")

    args = parser.parse_args()

    if args.command == "check":
        overall_errors = 0
        overall_warnings = 0
        for pattern in args.files:
            matched = glob.glob(pattern) or [pattern]
            for file_path in matched:
                passed, errs, warns = check_file(
                    file_path,
                    strict_polite=args.strict_polite,
                    strict_wh=args.strict_wh,
                    verbose=True
                )
                overall_errors += errs
                overall_warnings += warns
        sys.exit(0 if overall_errors == 0 else 1)

    elif args.command == "scaffold":
        with open(args.input, "r", encoding="utf-8") as f:
            data = json.load(f)
        scaffolded = generate_scaffold_list(
            data,
            start_id=args.start_id,
            use_placeholders=args.with_placeholders
        )
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                json.dump(scaffolded, f, ensure_ascii=False, indent=2)
            print(f"Scaffold written to {args.output} ({len(scaffolded)} items)")
        else:
            print(json.dumps(scaffolded, ensure_ascii=False, indent=2))

    elif args.command == "clean":
        with open(args.input, "r", encoding="utf-8") as f:
            data = json.load(f)
        cleaned = migrate_data(
            data,
            assign_ids=args.assign_ids,
            use_scaffold=False
        )
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                json.dump(cleaned, f, ensure_ascii=False, indent=2)
            print(f"Cleaned data written to {args.output} ({len(cleaned)} items)")
        else:
            print(json.dumps(cleaned, ensure_ascii=False, indent=2))

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
