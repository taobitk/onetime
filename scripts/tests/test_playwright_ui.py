#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Playwright E2E UI test against running minna_server (http://127.0.0.1:8000/)."""

import sys
from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:8000/"


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        errors, console_errs, failed_reqs = [], [], []
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.on("console", lambda msg: console_errs.append(msg.text) if msg.type == "error" else None)
        page.on("response", lambda res: failed_reqs.append(f"{res.status} {res.url}") if res.status >= 400 else None)

        page.goto(BASE_URL, wait_until="networkidle", timeout=15000)
        page.wait_for_timeout(800)

        assert not errors, f"Page errors: {errors}"
        assert not console_errs, f"Console errors: {console_errs}"
        assert not failed_reqs, f"Failed HTTP requests: {failed_reqs}"

        assert "Thẻ 1 /" in page.inner_text("body"), "Flashcard did not render"
        print("[PASS] Initial render + bai_4 loaded")

        page.get_by_role("button", name="Kho từ").click()
        page.wait_for_timeout(250)
        assert page.locator("text=Kho Từ Vựng").is_visible()
        page.keyboard.press("Escape")
        print("[PASS] VocabModal open/close")

        page.locator("button:has-text('ずんだもん'), button:has-text('四国めたん'), button:has-text('Edge-TTS')").first.click()
        page.wait_for_timeout(250)
        assert page.locator("text=Kho Model & Phong Cách VOICEVOX").is_visible()
        page.keyboard.press("Escape")
        print("[PASS] SpeakerModal open/close")

        inp = page.locator("input[placeholder*='Romaji hoặc Hiragana']").first
        inp.fill("~~")
        inp.press("Enter")
        page.wait_for_timeout(250)
        assert page.locator("text=ĐÃ BỎ QUA THẺ").is_visible()
        print("[PASS] Typing ~~ bypass + reveal answer")

        page.locator("select").nth(1).select_option("verbs3")
        page.wait_for_timeout(250)
        assert page.locator("text=LUYỆN GÕ 3 THỂ ĐỘNG TỪ").is_visible()
        print("[PASS] verbs3 mode render")

        page.locator("select").nth(1).select_option("vocab")
        browser.close()
    print("ALL PLAYWRIGHT E2E CHECKS PASSED!")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[FAIL] {exc}")
        sys.exit(1)
