#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tools/test_migrate_helper.py

Comprehensive unit tests for tools/migrate_helper.py.
Verifies type remapping, sequential ID assignment, rogue field cleanup,
examples standardization, bracket consistency, scaffolding, and verification logic.
"""

import os
import sys
import unittest

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from tools.migrate_helper import (
    ALLOWED_TYPES,
    REQUIRED_VOCAB_FIELDS,
    remap_type,
    remap_item_type,
    assign_sequential_ids,
    clean_rogue_fields,
    clean_rogue_fields_list,
    standardize_examples,
    standardize_examples_list,
    ensure_bracket_consistency,
    fix_bracket_consistency_item,
    generate_scaffold,
    generate_scaffold_list,
    migrate_item,
    migrate_data,
    is_wh_question,
    check_vocab_item,
    validate_vocab_item,
    validate_data,
    validate_file,
    check_file
)


class TestTypeRemapping(unittest.TestCase):
    """Test remapping of invalid or legacy vocabulary types."""

    def test_dai_tu_chi_dinh_remapped_to_dai_tu(self):
        demonstratives = ["ここ", "そこ", "あそこ", "こちら", "そちら", "あちら"]
        for term in demonstratives:
            self.assertEqual(remap_type(term, "Đại từ chỉ định"), "Đại từ")

    def test_tu_nghi_van_remapped_to_tu_de_hoi(self):
        interrogatives = ["どこ", "どちら", "何階", "いくら", "どうして"]
        for term in interrogatives:
            self.assertEqual(remap_type(term, "Từ nghi vấn"), "Từ để hỏi")

    def test_hau_to_counters_remapped_to_luong_tu(self):
        counter_terms = ['－階', '－階（－がい）', '－円', '－段目', '～階', '～円', '～段目']
        for term in counter_terms:
            self.assertEqual(remap_type(term, "Hậu tố"), "Lượng từ")

    def test_hau_to_store_remapped_to_danh_tu(self):
        store_terms = ['～屋', '-屋', '本屋']
        for term in store_terms:
            self.assertEqual(remap_type(term, "Hậu tố"), "Danh từ")

    def test_than_tu_remapped_to_cum_tu(self):
        self.assertEqual(remap_type("えーと", "Thán từ"), "Cụm từ")
        self.assertEqual(remap_type("あのう", "Thán từ"), "Cụm từ")

    def test_danh_tu_typo_remapped_to_danh_tu(self):
        self.assertEqual(remap_type("１０日", "Danh tự"), "Danh từ")

    def test_allowed_types_remain_unchanged(self):
        for allowed in ALLOWED_TYPES:
            self.assertEqual(remap_type("any_term", allowed), allowed)

    def test_empty_or_none_type_fallback(self):
        self.assertEqual(remap_type("something", ""), "Danh từ")
        self.assertEqual(remap_type("something", None), "Danh từ")

    def test_remap_item_type_modifies_dict(self):
        item = {"term": "ここ", "type": "Đại từ chỉ định"}
        remap_item_type(item)
        self.assertEqual(item["type"], "Đại từ")


class TestSequentialIDAssignment(unittest.TestCase):
    """Test 1..N sequential ID assignment for datasets."""

    def test_assign_ids_to_items_lacking_id(self):
        data = [
            {"term": "朝", "meaning": "buổi sáng"},
            {"term": "昼", "meaning": "buổi trưa"},
            {"term": "晩", "meaning": "buổi tối"}
        ]
        assigned = assign_sequential_ids(data, start_id=1)
        self.assertEqual([item["id"] for item in assigned], [1, 2, 3])
        # Verify original data was not modified
        self.assertNotIn("id", data[0])

    def test_assign_ids_with_none_ids(self):
        data = [
            {"id": None, "term": "一"},
            {"id": None, "term": "二"}
        ]
        assigned = assign_sequential_ids(data, start_id=1)
        self.assertEqual([item["id"] for item in assigned], [1, 2])

    def test_custom_start_id(self):
        data = [{"term": "A"}, {"term": "B"}]
        assigned = assign_sequential_ids(data, start_id=10)
        self.assertEqual([item["id"] for item in assigned], [10, 11])

    def test_keep_existing_ids_when_force_false(self):
        data = [
            {"id": 101, "term": "A"},
            {"id": 102, "term": "B"}
        ]
        assigned = assign_sequential_ids(data, start_id=1, force=False)
        self.assertEqual([item["id"] for item in assigned], [101, 102])

    def test_force_reassign_ids(self):
        data = [
            {"id": 101, "term": "A"},
            {"id": 102, "term": "B"}
        ]
        assigned = assign_sequential_ids(data, start_id=1, force=True)
        self.assertEqual([item["id"] for item in assigned], [1, 2])

    def test_ids_are_integers(self):
        data = [{"term": "Word"}]
        assigned = assign_sequential_ids(data)
        self.assertIsInstance(assigned[0]["id"], int)


class TestRogueFieldCleanup(unittest.TestCase):
    """Test deletion of rogue fields like 'meanings'."""

    def test_clean_meanings_field(self):
        item = {
            "term": "切ります",
            "meaning": "cắt, gọt",
            "meanings": ["cắt, thái, gọt...", "cúp máy..."]
        }
        cleaned = clean_rogue_fields(item)
        self.assertNotIn("meanings", cleaned)
        self.assertEqual(cleaned["meaning"], "cắt, gọt")

    def test_clean_item_without_rogue_fields(self):
        item = {"term": "本", "meaning": "sách"}
        cleaned = clean_rogue_fields(item)
        self.assertEqual(cleaned, {"term": "本", "meaning": "sách"})

    def test_clean_rogue_fields_list(self):
        data = [
            {"term": "A", "meanings": ["a1", "a2"]},
            {"term": "B", "meaning": "b"}
        ]
        cleaned_list = clean_rogue_fields_list(data)
        for it in cleaned_list:
            self.assertNotIn("meanings", it)

    def test_custom_rogue_fields(self):
        item = {"term": "A", "notes": "draft", "meanings": ["m"]}
        clean_rogue_fields(item, rogue_fields=["notes"])
        self.assertNotIn("notes", item)
        self.assertIn("meanings", item)


class TestExamplesStandardization(unittest.TestCase):
    """Test standardization of example and examples fields."""

    def test_convert_single_example_to_examples_list(self):
        item = {
            "term": "学校",
            "example": {
                "japanese": "ここは学校です。",
                "vietnamese": "Đây là trường học."
            }
        }
        standardized = standardize_examples(item)
        self.assertNotIn("example", standardized)
        self.assertIn("examples", standardized)
        self.assertEqual(len(standardized["examples"]), 1)
        self.assertEqual(
            standardized["examples"][0],
            {"japanese": "ここは学校です。", "vietnamese": "Đây là trường học."}
        )

    def test_both_example_and_examples_identical_deduplicated(self):
        item = {
            "term": "ここ",
            "example": {
                "japanese": "ここは、教室です。",
                "vietnamese": "Đây là phòng học."
            },
            "examples": [
                {
                    "japanese": "ここは、教室です。",
                    "vietnamese": "Đây là phòng học."
                },
                {
                    "japanese": "ここに、座ってください。",
                    "vietnamese": "Xin hãy ngồi ở chỗ này."
                }
            ]
        }
        standardized = standardize_examples(item)
        self.assertNotIn("example", standardized)
        self.assertEqual(len(standardized["examples"]), 2)
        self.assertEqual(standardized["examples"][0]["japanese"], "ここは、教室です。")
        self.assertEqual(standardized["examples"][1]["japanese"], "ここに、座ってください。")

    def test_both_example_and_examples_different_merged(self):
        item = {
            "term": "本",
            "example": {
                "japanese": "本を読む。",
                "vietnamese": "Đọc sách."
            },
            "examples": [
                {
                    "japanese": "本を買う。",
                    "vietnamese": "Mua sách."
                }
            ]
        }
        standardized = standardize_examples(item)
        self.assertNotIn("example", standardized)
        self.assertEqual(len(standardized["examples"]), 2)
        jps = [ex["japanese"] for ex in standardized["examples"]]
        self.assertIn("本を読む。", jps)
        self.assertIn("本を買う。", jps)

    def test_neither_example_nor_examples_gives_empty_list(self):
        item = {"term": "空"}
        standardized = standardize_examples(item)
        self.assertEqual(standardized["examples"], [])

    def test_standardize_examples_list(self):
        data = [
            {"term": "A", "example": {"japanese": "A。", "vietnamese": "A."}},
            {"term": "B", "examples": [{"japanese": "B。", "vietnamese": "B."}]}
        ]
        res = standardize_examples_list(data)
        for item in res:
            self.assertNotIn("example", item)
            self.assertIsInstance(item.get("examples"), list)
            self.assertEqual(len(item["examples"]), 1)


class TestBracketConsistency(unittest.TestCase):
    """Test synchronization of brackets '[' between term and reading."""

    def test_adjective_ending_na(self):
        # When reading has 'na' but lacks '['
        self.assertEqual(
            ensure_bracket_consistency("好き[な]", "すきな"),
            "すき[な]"
        )
        self.assertEqual(
            ensure_bracket_consistency("嫌い[な]", "きらいな"),
            "きらい[な]"
        )
        # When reading does not even have 'na'
        self.assertEqual(
            ensure_bracket_consistency("好き[な]", "すき"),
            "すき[な]"
        )

    def test_honorific_prefix_o(self):
        self.assertEqual(
            ensure_bracket_consistency("[お]国", "おくに"),
            "[お]くに"
        )
        self.assertEqual(
            ensure_bracket_consistency("[お]国", "くに"),
            "[お]くに"
        )

    def test_prefix_particles(self):
        self.assertEqual(
            ensure_bracket_consistency("[～を] 見せて ください。", "みせて ください。"),
            "[～を] みせて ください。"
        )
        self.assertEqual(
            ensure_bracket_consistency("[～は] ちょっと……。", "ちょっと……。"),
            "[～は] ちょっと……。"
        )

    def test_suffix_ne_and_nado(self):
        self.assertEqual(
            ensure_bracket_consistency("残念です[ね]。", "ざんねんですね。"),
            "ざんねんです[ね]。"
        )
        self.assertEqual(
            ensure_bracket_consistency("～や ～[など]", "～や ～など"),
            "～や ～[など]"
        )

    def test_already_consistent_unchanged(self):
        self.assertEqual(
            ensure_bracket_consistency("いろいろ[な]", "いろいろ[な]"),
            "いろいろ[な]"
        )
        self.assertEqual(
            ensure_bracket_consistency("[お]国", "[お]くに"),
            "[お]くに"
        )

    def test_no_brackets_in_term_unchanged(self):
        self.assertEqual(
            ensure_bracket_consistency("簡単", "かんたん"),
            "かんたん"
        )

    def test_fix_bracket_consistency_item(self):
        item = {"term": "上手[な]", "reading": "じょうずな"}
        fix_bracket_consistency_item(item)
        self.assertEqual(item["reading"], "じょうず[な]")


class TestScaffoldGenerator(unittest.TestCase):
    """Test generating complete Q&A reflex templates adhering to bai_12 model."""

    def test_scaffold_from_minimal_raw_item(self):
        raw = {
            "term": "ここ",
            "reading": "ここ",
            "romaji": "koko",
            "meaning": "chỗ này, đây",
            "type": "Đại từ chỉ định",
            "example": {
                "japanese": "ここは、教室です。",
                "vietnamese": "Đây là phòng học."
            }
        }
        scaffold = generate_scaffold(raw, default_id=1, use_placeholders=False)

        # Check all required root fields
        for field in REQUIRED_VOCAB_FIELDS:
            self.assertIn(field, scaffold)

        self.assertEqual(scaffold["id"], 1)
        self.assertEqual(scaffold["type"], "Đại từ")
        self.assertEqual(scaffold["level"], "N5")
        self.assertEqual(scaffold["tags"], ["topic:daily_life", "tone:casual"])
        self.assertNotIn("example", scaffold)
        self.assertIn("examples", scaffold)
        self.assertEqual(len(scaffold["examples"]), 1)

        # Check question subfields
        q = scaffold["question"]
        for q_f in ["short", "polite", "reading", "romaji", "vietnamese", "variants"]:
            self.assertIn(q_f, q)
        self.assertEqual(q["short"], "")
        self.assertEqual(q["variants"], [])

        # Check answer subfields
        a = scaffold["answer"]
        for a_f in ["short", "reading", "romaji", "vietnamese", "variants"]:
            self.assertIn(a_f, a)
        self.assertEqual(a["short"], "")
        self.assertEqual(a["variants"], [])

    def test_scaffold_with_placeholders_passes_validator(self):
        raw = {
            "term": "簡単",
            "reading": "かんたん",
            "romaji": "kantan",
            "meaning": "Đơn giản, dễ",
            "type": "Tính từ -na",
            "tags": ["topic:study", "tone:casual"]
        }
        scaffold = generate_scaffold(raw, default_id=5, use_placeholders=True)
        self.assertTrue(scaffold["question"]["short"])
        self.assertTrue(scaffold["answer"]["short"])
        self.assertGreater(len(scaffold["question"]["variants"]), 0)
        self.assertGreater(len(scaffold["answer"]["variants"]), 0)

        # Validate with check_vocab_item
        errs, warns = check_vocab_item(scaffold, idx=0)
        self.assertEqual(errs, [])
        self.assertEqual(warns, [])

    def test_scaffold_preserves_existing_qa_and_tags(self):
        raw = {
            "id": 12,
            "term": "海",
            "reading": "うみ",
            "romaji": "umi",
            "meaning": "biển",
            "type": "Danh từ",
            "tags": ["topic:places", "topic:nature"],
            "question": {
                "short": "休みの日、どこへ行きたい？",
                "polite": "お休みの日はどちらへ行きたいですか？",
                "reading": "やすみのひ、どこへいきたい？",
                "romaji": "yasumi no hi, doko e ikitai?",
                "vietnamese": "Ngày nghỉ muốn đi đâu",
                "variants": ["yasumi no hi doko e ikitai"]
            },
            "answer": {
                "short": "海へ行きたいよ！",
                "reading": "うみへいきたいよ！",
                "romaji": "umi e ikitai yo!",
                "vietnamese": "Muốn đi biển",
                "variants": ["umi e ikitai yo", "umi"]
            },
            "examples": [
                {"japanese": "海で泳ぎます。", "vietnamese": "Bơi ở biển."}
            ]
        }
        scaffold = generate_scaffold(raw)
        self.assertEqual(scaffold["id"], 12)
        self.assertEqual(scaffold["question"]["short"], "休みの日、どこへ行きたい？")
        self.assertEqual(scaffold["answer"]["short"], "海へ行きたいよ！")
        self.assertEqual(scaffold["tags"], ["topic:places", "topic:nature"])

    def test_generate_scaffold_list(self):
        raw_list = [
            {"term": "A", "type": "Danh từ"},
            {"term": "B", "type": "Động từ"}
        ]
        scaffolded = generate_scaffold_list(raw_list, start_id=1)
        self.assertEqual(len(scaffolded), 2)
        self.assertEqual(scaffolded[0]["id"], 1)
        self.assertEqual(scaffolded[1]["id"], 2)


class TestVerificationFunction(unittest.TestCase):
    """Test validation rules incorporating check_json.py."""

    def setUp(self):
        self.valid_item = {
            "id": 1,
            "term": "簡単",
            "reading": "かんたん",
            "romaji": "kantan",
            "meaning": "Đơn giản, dễ",
            "level": "N5",
            "type": "Tính từ -na",
            "tags": ["topic:study", "tone:casual"],
            "question": {
                "short": "テストどうだった？",
                "polite": "試験はいかがでしたか？",
                "reading": "てすとどうだった？",
                "romaji": "tesuto dou datta?",
                "vietnamese": "Bài thi thế nào",
                "variants": ["tesuto dou datta", "tesuto dou"]
            },
            "answer": {
                "short": "テストは簡単だったよ！",
                "reading": "てすとはかんたんだったよ！",
                "romaji": "tesuto wa kantan datta yo!",
                "vietnamese": "Bài thi đã rất dễ",
                "variants": ["tesuto wa kantan datta yo", "kantan"]
            },
            "examples": [
                {
                    "japanese": "きのうの試験は、とても簡単でした。",
                    "vietnamese": "Kỳ thi hôm qua rất đơn giản (dễ)."
                }
            ]
        }

    def test_valid_item_passes(self):
        errs, warns = check_vocab_item(self.valid_item)
        self.assertEqual(errs, [])
        self.assertEqual(warns, [])

    def test_missing_required_root_field(self):
        item = copy_dict = dict(self.valid_item)
        del item["meaning"]
        errs, _ = check_vocab_item(item)
        self.assertTrue(any("Thiếu trường bắt buộc 'meaning'" in e for e in errs))

    def test_invalid_id_not_int(self):
        item = dict(self.valid_item, id="1")
        errs, _ = check_vocab_item(item)
        self.assertTrue(any("'id' phải là số nguyên" in e for e in errs))

    def test_invalid_type_outside_allowed(self):
        item = dict(self.valid_item, type="Hậu tố")
        errs, _ = check_vocab_item(item)
        self.assertTrue(any("Loại từ không hợp lệ" in e for e in errs))

    def test_empty_tags_error(self):
        item = dict(self.valid_item, tags=[])
        errs, _ = check_vocab_item(item)
        self.assertTrue(any("Trường 'tags' phải là mảng (list) không rỗng" in e for e in errs))

    def test_missing_examples_error(self):
        item = dict(self.valid_item, examples=[])
        errs, _ = check_vocab_item(item)
        self.assertTrue(any("Thiếu câu ví dụ" in e for e in errs))

    def test_bracket_mismatch_warning(self):
        item = dict(self.valid_item, term="好き[な]", reading="すきな")
        _, warns = check_vocab_item(item)
        self.assertTrue(any("Khung ngoặc vuông '['" in w for e, w in [(None, warns[0])] if warns))

    def test_question_missing_variants_error(self):
        item = copy_dict = dict(self.valid_item)
        item["question"] = dict(item["question"], variants=[])
        errs, _ = check_vocab_item(item)
        self.assertTrue(any("question.variants" in e for e in errs))

    def test_answer_missing_variants_error(self):
        item = copy_dict = dict(self.valid_item)
        item["answer"] = dict(item["answer"], variants=[])
        errs, _ = check_vocab_item(item)
        self.assertTrue(any("answer.variants" in e for e in errs))

    def test_validate_data_detects_duplicate_id(self):
        item1 = dict(self.valid_item, id=1)
        item2 = dict(self.valid_item, id=1, term="次")
        is_valid, errs, warns = validate_data([item1, item2])
        self.assertFalse(is_valid)
        self.assertTrue(any("ID trùng lặp" in e for e in errs))

    def test_validate_data_requires_list(self):
        is_valid, errs, _ = validate_data({"not": "a list"})
        self.assertFalse(is_valid)
        self.assertTrue(any("Dữ liệu gốc phải là một Danh sách" in e for e in errs))

    def test_wh_question_detection(self):
        self.assertTrue(is_wh_question("テストどうだった？"))
        self.assertTrue(is_wh_question("駅までどのくらい？"))
        self.assertTrue(is_wh_question("何時ですか？"))
        self.assertTrue(is_wh_question("どこへ行く？"))
        self.assertTrue(is_wh_question("誕生日はいつ？"))
        self.assertTrue(is_wh_question("どれがいい？"))
        self.assertTrue(is_wh_question("どうして遅刻した？"))
        # Yes/No questions should return False
        self.assertFalse(is_wh_question("あの人ハンサム？"))
        self.assertFalse(is_wh_question("部屋きれい？"))
        self.assertFalse(is_wh_question("寮は静か？"))

    def test_strict_wh_flag(self):
        item = dict(self.valid_item)
        item["question"] = dict(item["question"], short="あの人ハンサム？")
        errs, _ = check_vocab_item(item, strict_wh=True)
        self.assertTrue(any("Câu hỏi không chứa Wh-word" in e for e in errs))

    def test_strict_polite_flag(self):
        item = dict(self.valid_item)
        item["question"] = dict(item["question"], polite="")
        errs, _ = check_vocab_item(item, strict_polite=True)
        self.assertTrue(any("thiếu thông tin 'polite'" in e for e in errs))


class TestReferenceFilesIntegrity(unittest.TestCase):
    """Test validate_file on canonical reference files."""

    def test_bai_11_passes(self):
        ref_path = os.path.join(PROJECT_ROOT, "bai_11.json")
        if os.path.exists(ref_path):
            is_valid, errs, warns = validate_file(ref_path)
            self.assertTrue(is_valid, f"bai_11.json failed with errors: {errs}")
            self.assertEqual(errs, [])
            self.assertEqual(warns, [])

    def test_bai_12_passes(self):
        ref_path = os.path.join(PROJECT_ROOT, "bai_12.json")
        if os.path.exists(ref_path):
            is_valid, errs, warns = validate_file(ref_path)
            self.assertTrue(is_valid, f"bai_12.json failed with errors: {errs}")
            self.assertEqual(errs, [])
            self.assertEqual(warns, [])


if __name__ == "__main__":
    unittest.main()
