# Recorded WeGenerate UI steps (codegen). Use for selector reference; backfill_watch.py uses env/auth JSON for credentials.
import re
from playwright.sync_api import Playwright, sync_playwright, expect


def run(playwright: Playwright) -> None:
    browser = playwright.chromium.launch(headless=False)
    context = browser.new_context()
    page = context.new_page()
    page.goto("https://app.wegenerate.com/login")
    page.get_by_role("textbox", name="Email address").click()
    page.get_by_role("textbox", name="Email address").fill("YOUR_EMAIL")  # use env in bot
    page.get_by_role("textbox", name="Email address").press("Tab")
    page.get_by_role("textbox", name="Password").fill("YOUR_PASSWORD")  # use env in bot
    page.get_by_role("textbox", name="Password").press("Enter")
    page.get_by_role("button", name="Log in").click()
    page.get_by_role("button", name="Mar 13, 2026 - Mar 13,").click()
    page.get_by_role("button", name="Tuesday, March 10,").click()
    page.get_by_role("button", name="Tuesday, March 10,").click()
    page.get_by_role("button", name="Apply").click()
    page.get_by_role("columnheader", name="Agent").click()
    page.get_by_role("columnheader", name="Billable").nth(2).click()
    page.get_by_role("columnheader", name="Marketing").nth(1).click()
    page.get_by_role("button", name="Mar 10, 2026 - Mar 10,").click()
    page.get_by_role("button", name="Previous page").click()
    page.get_by_role("button", name="Tuesday, February 10,").click()
    page.get_by_role("button", name="Tuesday, February 10,").click()
    page.get_by_role("button", name="Apply").click()
    page.get_by_role("columnheader", name="Agent").click()
    page.get_by_role("columnheader", name="Billable").nth(2).click()
    page.get_by_role("columnheader", name="Marketing").nth(1).click()
    page.get_by_role("button", name="Feb 10, 2026 - Feb 10,").click()
    page.get_by_role("button", name="Previous page").click()
    page.get_by_role("button", name="Monday, January 12,").click()
    page.get_by_role("button", name="Monday, January 12,").click()
    page.get_by_role("button", name="Apply").click()
    page.get_by_role("columnheader", name="Agent").click()
    page.get_by_role("columnheader", name="Billable").nth(2).click()
    page.get_by_role("columnheader", name="Marketing").nth(1).click()
    page.get_by_text("Alexander Vielot").click()
    page.get_by_role("cell", name="14", exact=True).click()
    page.get_by_role("cell", name="$210.00").click()

    # ---------------------
    context.storage_state(path="auth_wegenerate.json")
    context.close()
    browser.close()


with sync_playwright() as playwright:
    run(playwright)
