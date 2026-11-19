#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unit and Integration Tests for E2E Test Suite Harness.
Ensures the test harness correctly validates good data and detects all defects.
"""

import os
import sys
import json
import unittest

# Ensure workspace root is in path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from tests.run_e2e_tests import (
    validate_tier1_schema,
    validate_tier2_linguistic,
    validate_tier3_integration,
    validate_tier4_realworld,
    ALLOWED_TYPES,
    WH_REGEX,
    YES_NO_JP_ANSWER_REGEX,
    MACRON_REGEX
)


class TestE2EBaselineAndHarness(unittest.TestCase):
    def setUp(self):
        self.workspace_dir = ROOT_DIR

    def test_tier4_frontend_syntax(self):
        """Tier 4: node -c app.js must pass with 0 syntax errors."""
        passed, errors, warnings = validate_tier4_realworld(self.workspace_dir)
        self.assertTrue(passed, f"Tier 4 failed: {errors}")
        self.assertEqual(len(errors), 0)

    def test_baseline_bai_11_passes_all_tiers(self):
        """Reference file bai_11.json must pass Tiers 1, 2, and 3."""
        file_path = os.path.join(self.workspace_dir, "bai_11.json")
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        t1_pass, t1_err, _ = validate_tier1_schema(data, "bai_11.json")
        self.assertTrue(t1_pass, f"bai_11.json failed Tier 1: {t1_err[:5]}")

        t2_pass, t2_err, _ = validate_tier2_linguistic(data, "bai_11.json")
        self.assertTrue(t2_pass, f"bai_11.json failed Tier 2: {t2_err[:5]}")

        t3_pass, t3_err, _ = validate_tier3_integration(data, "bai_11.json")
        self.assertTrue(t3_pass, f"bai_11.json failed Tier 3: {t3_err[:5]}")

    def test_baseline_bai_12_passes_all_tiers(self):
        """Reference file bai_12.json must pass Tiers 1, 2, and 3."""
        file_path = os.path.join(self.workspace_dir, "bai_12.json")
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        t1_pass, t1_err, _ = validate_tier1_schema(data, "bai_12.json")
        self.assertTrue(t1_pass, f"bai_12.json failed Tier 1: {t1_err[:5]}")

        t2_pass, t2_err, _ = validate_tier2_linguistic(data, "bai_12.json")
        self.assertTrue(t2_pass, f"bai_12.json failed Tier 2: {t2_err[:5]}")

        t3_pass, t3_err, _ = validate_tier3_integration(data, "bai_12.json")
        self.assertTrue(t3_pass, f"bai_12.json failed Tier 3: {t3_err[:5]}")

    def test_adversarial_detects_prohibited_yes_no(self):
        """Test harness must catch prohibited Yes/No answer patterns."""
        bad_item = [{
            "id": 1,
            "term": "カレー辛い？",
            "reading": "かれーからい？",
            "romaji": "kare- karai?",
            "meaning": "Cà ri có cay không?",
            "level": "N5",
            "type": "Tính từ -i",
            "tags": ["topic:food"],
            "question": {
                "short": "カレー辛い？",
                "polite": "カレーは辛いですか？",
                "reading": "かれーからい？",
                "romaji": "kare- karai?",
                "vietnamese": "cà ri cay không",
                "variants": ["kare- karai?"]
            },
            "answer": {
                "short": "うん、辛いよ！",
                "reading": "うん、からいよ！",
                "romaji": "un, karai yo!",
                "vietnamese": "ừ cay lắm",
                "variants": ["un, karai yo", "karai yo", "karai"]
            },
            "examples": [{"japanese": "ex", "vietnamese": "vd"}]
        }]
        t2_pass, errors, _ = validate_tier2_linguistic(bad_item, "test_bad.json")
        self.assertFalse(t2_pass)
        error_blob = " ".join(errors)
        self.assertIn("PROHIBITED Yes/No", error_blob)

    def test_adversarial_detects_bracket_mismatch(self):
        """Test harness must catch bracket mismatches between term and reading."""
        mismatched_item = [{
            "id": 1,
            "term": "いろいろ[な]",
            "reading": "いろいろな",
            "romaji": "iroirona",
            "meaning": "Nhiều, phong phú",
            "level": "N5",
            "type": "Tính từ -na",
            "tags": ["topic:general"],
            "question": {
                "short": "どんな本がある？",
                "polite": "どんな本がございますか？",
                "reading": "どんなほんがある？",
                "romaji": "donna hon ga aru?",
                "vietnamese": "có loại sách gì",
                "variants": ["donna hon ga aru"]
            },
            "answer": {
                "short": "いろいろな本があるよ。",
                "reading": "いろいろなほんがあるよ。",
                "romaji": "iroirona hon ga aru yo.",
                "vietnamese": "có đủ loại sách",
                "variants": ["iroirona hon ga aru yo", "iroirona hon", "iroiro"]
            },
            "examples": [{"japanese": "ex", "vietnamese": "vd"}]
        }]
        t2_pass, errors, _ = validate_tier2_linguistic(mismatched_item, "bracket_test.json")
        self.assertFalse(t2_pass)
        self.assertTrue(any("Bracket mismatch" in e for e in errors))

    def test_adversarial_detects_macrons(self):
        """Test harness must catch forbidden macrons (Hepburn requires kana letters)."""
        macron_item = [{
            "id": 1,
            "term": "東京",
            "reading": "とうきょう",
            "romaji": "Tōkyō",
            "meaning": "Tokyo",
            "level": "N5",
            "type": "Danh từ riêng",
            "tags": ["topic:location"],
            "question": {
                "short": "どこへ行く？",
                "polite": "どちらへいらっしゃいますか？",
                "reading": "どこへいく？",
                "romaji": "doko e iku?",
                "vietnamese": "đi đâu đấy",
                "variants": ["doko e iku"]
            },
            "answer": {
                "short": "東京へ行くよ。",
                "reading": "とうきょうへいくよ。",
                "romaji": "Tōkyō e iku yo.",
                "vietnamese": "đi tokyo",
                "variants": ["tokyo e iku", "tokyo", "di tokyo"]
            },
            "examples": [{"japanese": "ex", "vietnamese": "vd"}]
        }]
        t3_pass, errors, _ = validate_tier3_integration(macron_item, "macron_test.json")
        self.assertFalse(t3_pass)
        self.assertTrue(any("macron" in e.lower() for e in errors))

    def test_adversarial_detects_less_than_3_variants(self):
        """Test harness must reject answers with fewer than 3 variants."""
        item = [{
            "id": 1,
            "term": "何食べる？",
            "reading": "なにたべる？",
            "romaji": "nani taberu?",
            "meaning": "Ăn gì?",
            "level": "N5",
            "type": "Động từ",
            "tags": ["topic:food"],
            "question": {
                "short": "何食べる？",
                "polite": "何を召し上がりますか？",
                "reading": "なにたべる？",
                "romaji": "nani taberu?",
                "vietnamese": "ăn gì",
                "variants": ["nani taberu"]
            },
            "answer": {
                "short": "ラーメン食べるよ。",
                "reading": "らーめんたべるよ。",
                "romaji": "ra-men taberu yo.",
                "vietnamese": "ăn ramen",
                "variants": ["ra-men taberu yo", "ra-men"]
            },
            "examples": [{"japanese": "ex", "vietnamese": "vd"}]
        }]
        t2_pass, errors, _ = validate_tier2_linguistic(item, "variants_test.json")
        self.assertFalse(t2_pass)
        self.assertTrue(any("Minimum 3 tiers required" in e for e in errors))


if __name__ == "__main__":
    unittest.main()
