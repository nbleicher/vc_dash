import re
from playwright.sync_api import Playwright, sync_playwright, expect


def run(playwright: Playwright) -> None:
    browser = playwright.chromium.launch(headless=False)
    context = browser.new_context()
    page = context.new_page()
    page.goto("https://app.policyden.com/login")
    page.get_by_role("textbox", name="Email").click()
    page.get_by_role("textbox", name="Email").fill("noah@valuecarehealthagency.com")
    page.get_by_role("textbox", name="Email").press("Tab")
    page.locator("#password").first.press("Tab")
    page.get_by_role("textbox", name="Password").fill("01Tekkit!")
    page.get_by_role("button", name="Log In").click()
    page.get_by_role("button", name="Mar - 31 Mar 2026").click()
    page.get_by_role("application", name="Event Date, March").get_by_label("Previous page").click()
    page.get_by_role("application", name="Event Date, February").get_by_label("Next page").click()
    page.get_by_role("application", name="Event Date, March").get_by_label("Previous page").click()
    page.get_by_role("application", name="Event Date, March").get_by_label("Previous page").click()
    page.get_by_role("button", name="9 Feb - 9 Feb").click()
    page.get_by_role("application", name="Event Date, February").get_by_label("Previous page").click()
    page.get_by_role("application", name="Event Date, February").get_by_label("Previous page").click()
    page.get_by_role("application", name="Event Date, January").get_by_label("Previous page").click()
    page.get_by_role("application", name="Event Date, December").get_by_label("Next page").click()
    page.get_by_role("button", name="Tuesday, January 6,").click()
    page.get_by_role("button", name="Tuesday, January 6,").click()
    page.get_by_role("button", name="Apply").click()
    page.goto("https://app.policyden.com/dashboard")
    page.get_by_role("columnheader", name="Name").click()
    page.get_by_role("table").locator("div").filter(has_text=re.compile(r"^Sales$")).click()
    page.get_by_role("columnheader", name="Sales").click()

    # ---------------------
    context.storage_state(path="auth_policyden.json")
    context.close()
    browser.close()


with sync_playwright() as playwright:
    run(playwright)
