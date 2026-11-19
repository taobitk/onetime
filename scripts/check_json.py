#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script kiểm tra tính hợp lệ và chuẩn hóa cấu trúc JSON của các bài học (bai_*.json).
Phục vụ TDD (Test-Driven Development) và tái cấu trúc dữ liệu.
"""

import os
import sys
import glob
import json
import re

# Đảm bảo in UTF-8 không lỗi trên console Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# ANSI Color Codes
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

# Danh mục Loại từ chuẩn (Bộ lọc loại từ nghiêm ngặt)
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

# Danh mục các trường bắt buộc trong mô hình Hội thoại phản xạ Q&A
REQUIRED_VOCAB_FIELDS = ["id", "term", "reading", "romaji", "meaning", "level", "type", "tags", "question", "answer"]

def check_vocab_item(item, idx, filename):
    errors = []
    warnings = []

    # 1. Kiểm tra các trường cơ bản bắt buộc
    for field in REQUIRED_VOCAB_FIELDS:
        if field not in item or item[field] is None or item[field] == "":
            errors.append(f"Thiếu trường bắt buộc '{field}'")

    # 2. Kiểm tra ID
    item_id = item.get("id")
    if item_id is None:
        errors.append("Thiếu 'id'")
    elif not isinstance(item_id, int):
        errors.append(f"'id' phải là số nguyên (nhận được: {type(item_id).__name__})")

    # 3. Kiểm tra Loại từ (Type) theo chuẩn bộ lọc
    item_type = item.get("type")
    if item_type and item_type not in ALLOWED_TYPES:
        errors.append(f"Loại từ không hợp lệ: '{item_type}' (Phải thuộc ALLOWED_TYPES)")

    # 4. Kiểm tra Tags
    tags = item.get("tags")
    if tags is None or not isinstance(tags, list) or len(tags) == 0:
        errors.append("Trường 'tags' phải là mảng (list) không rỗng")

    # 5. Kiểm tra ví dụ
    has_single_ex = isinstance(item.get("example"), dict) and item["example"].get("japanese")
    has_multi_ex = isinstance(item.get("examples"), list) and len(item.get("examples", [])) > 0
    if not has_single_ex and not has_multi_ex:
        errors.append("Thiếu câu ví dụ (cần có 'example' hoặc 'examples')")

    # 6. Kiểm tra romaji / reading / term hợp lệ
    term = item.get("term", "")
    reading = item.get("reading", "")
    romaji = item.get("romaji", "")
    
    if " - " in term:
        errors.append("Trường 'term' chứa chuỗi ' - ' (nghi vấn bị gộp cả cặp câu thoại Hỏi - Đáp vào từ vựng đơn)")
    if term.endswith("？") or term.endswith("?"):
        if item.get("type") not in ("Từ để hỏi", "Cụm từ"):
            warnings.append("Trường 'term' kết thúc bằng dấu hỏi '?' (nghi vấn là câu hỏi chứ không phải từ đơn)")

    if "[" in term and not "[" in reading:
        warnings.append("Khung ngoặc vuông '[' trong 'term' và 'reading' không đồng bộ")

    # 7. Kiểm tra chi tiết cấu trúc Cặp Hội thoại Phản xạ Q&A (Question - Answer)
    q = item.get("question")
    if q is not None:
        if not isinstance(q, dict):
            errors.append("Trường 'question' phải là một object (dict)")
        else:
            for q_f in ["short", "reading", "romaji", "vietnamese"]:
                if not q.get(q_f):
                    errors.append(f"Trường 'question' thiếu thông tin '{q_f}'")
            if not isinstance(q.get("variants"), list) or len(q.get("variants", [])) == 0:
                errors.append("Trường 'question.variants' phải là danh sách biến thể chấp nhận không rỗng")

    a = item.get("answer")
    if a is not None:
        if not isinstance(a, dict):
            errors.append("Trường 'answer' phải là một object (dict)")
        else:
            for a_f in ["short", "reading", "romaji", "vietnamese"]:
                if not a.get(a_f):
                    errors.append(f"Trường 'answer' thiếu thông tin '{a_f}'")
            if not isinstance(a.get("variants"), list) or len(a.get("variants", [])) == 0:
                errors.append("Trường 'answer.variants' phải là danh sách biến thể chấp nhận không rỗng")

    return errors, warnings

def check_file(file_path):
    filename = os.path.basename(file_path)
    print(f"\n{BOLD}{CYAN}▶ Đang kiểm tra file: {filename}{RESET}")

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"  {RED}{BOLD}✖ LỖI PARSE JSON: {e}{RESET}")
        return False, 1, 0

    if not isinstance(data, list):
        print(f"  {RED}{BOLD}✖ Dữ liệu gốc phải là một Danh sách (Array), nhận được: {type(data).__name__}{RESET}")
        return False, 1, 0

    total_errors = 0
    total_warnings = 0
    seen_ids = set()

    for idx, item in enumerate(data):
        item_id = item.get("id", f"index_{idx}")
        term = item.get("term", "UNKNOWN")

        # Kiểm tra trùng lặp ID
        if item_id in seen_ids:
            total_errors += 1
            print(f"  {RED}✖ [{idx+1}] ID trùng lặp: #{item_id} (Từ: {term}){RESET}")
        seen_ids.add(item_id)

        errors, warnings = check_vocab_item(item, idx, filename)

        if errors:
            total_errors += len(errors)
            print(f"  {RED}✖ [{idx+1}] ID #{item_id} ({term}):{RESET}")
            for err in errors:
                print(f"      {RED}- {err}{RESET}")

        if warnings:
            total_warnings += len(warnings)
            for warn in warnings:
                print(f"      {YELLOW}⚠ {warn}{RESET}")

    if total_errors > 0:
        print(f"  {RED}{BOLD}==> KẾT QUẢ: RED (FAIL) - {total_errors} lỗi, {total_warnings} cảnh báo{RESET}")
        return False, total_errors, total_warnings
    else:
        if total_warnings > 0:
            print(f"  {YELLOW}{BOLD}==> KẾT QUẢ: YELLOW (PASS WITH WARNINGS) - {total_warnings} cảnh báo{RESET}")
        else:
            print(f"  {GREEN}{BOLD}==> KẾT QUẢ: GREEN (PASS 100%){RESET}")
        return True, 0, total_warnings

def main():
    workspace_dir = os.path.dirname(os.path.abspath(__file__))
    target_files = sorted(glob.glob(os.path.join(workspace_dir, "bai_*.json")))

    if not target_files:
        print(f"{RED}Không tìm thấy file bai_*.json nào trong {workspace_dir}{RESET}")
        sys.exit(1)

    print(f"{BOLD}============================================================{RESET}")
    print(f"{BOLD}   TRÌNH KIỂM TRA CHUẨN HÓA DỮ LIỆU BÀI HỌC (JSON VALIDATOR)   {RESET}")
    print(f"{BOLD}============================================================{RESET}")
    print(f"Tìm thấy {len(target_files)} file bài học cần kiểm tra.\n")

    summary = []
    overall_errors = 0

    for file_path in target_files:
        passed, err_cnt, warn_cnt = check_file(file_path)
        overall_errors += err_cnt
        summary.append({
            "file": os.path.basename(file_path),
            "passed": passed,
            "errors": err_cnt,
            "warnings": warn_cnt
        })

    print(f"\n{BOLD}============================================================{RESET}")
    print(f"{BOLD}                    BẢNG TỔNG KẾT KIỂM TRA                   {RESET}")
    print(f"{BOLD}============================================================{RESET}")
    
    for s in summary:
        status = f"{GREEN}PASS{RESET}" if s["passed"] else f"{RED}FAIL (RED){RESET}"
        print(f"  {s['file']:<15} | Trạng thái: {status:<15} | Lỗi: {RED if s['errors'] else GREEN}{s['errors']:<3}{RESET} | Cảnh báo: {YELLOW}{s['warnings']:<3}{RESET}")

    print(f"{BOLD}============================================================{RESET}")
    if overall_errors > 0:
        print(f"{RED}{BOLD}KẾT QUẢ CHUNG: ĐỎ RỰC (RED) - Tổng cộng có {overall_errors} lỗi cần tái cấu trúc!{RESET}\n")
        sys.exit(1)
    else:
        print(f"{GREEN}{BOLD}KẾT QUẢ CHUNG: XANH (GREEN) - Toàn bộ file đều chuẩn chỉ!{RESET}\n")
        sys.exit(0)

if __name__ == "__main__":
    main()
