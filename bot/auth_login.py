#!/usr/bin/env python3
"""
Shared login helper for PolicyDen and WeGenerate.
Performs headless login, saves session to auth JSON, for use when session expires.
"""

import asyncio
from pathlib import Path
from typing import Optional

# Login URLs
POLICYDEN_LOGIN = "https://app.policyden.com/login"
WEGENERATE_LOGIN = "https://app.wegenerate.com/login"

# Login form selectors (try in order until one works)
LOGIN_SELECTORS_POLICYDEN = {
    "username": [
        "input[type='email']",
        "input[name='email']",
        "input[name='username']",
        "#email",
        "#username",
    ],
    "password": ["input[type='password']", "input[name='password']", "#password"],
    "submit": [
        "button[type='submit']",
        "button:has-text('Log in')",
        "button:has-text('Sign in')",
        "button:has-text('Login')",
        "input[type='submit']",
    ],
}

LOGIN_SELECTORS_WEGENERATE = {
    "username": [
        "input[type='email']",
        "input[name='email']",
        "input[name='username']",
        "#email",
        "#username",
    ],
    "password": ["input[type='password']", "input[name='password']", "#password"],
    "submit": [
        "button[type='submit']",
        "button:has-text('Log in')",
        "button:has-text('Sign in')",
        "button:has-text('Login')",
        "input[type='submit']",
    ],
}

SITE_CONFIG = {
    "policyden": {"login_url": POLICYDEN_LOGIN, "selectors": LOGIN_SELECTORS_POLICYDEN},
    "wegenerate": {"login_url": WEGENERATE_LOGIN, "selectors": LOGIN_SELECTORS_WEGENERATE},
}


def log(msg: str) -> None:
    print(msg, flush=True)


async def _try_selector_async(page, selectors: list, action: str, value: Optional[str] = None) -> bool:
    """Try each selector (async). Return True if one worked."""
    for sel in selectors:
        if not sel:
            continue
        try:
            loc = page.locator(sel).first
            if await loc.count() == 0:
                continue
            await loc.wait_for(state="visible", timeout=3000)
            if action == "fill" and value is not None:
                await loc.fill(value, timeout=2000)
            elif action == "click":
                await loc.click(timeout=2000)
            return True
        except Exception:
            continue
    return False


async def login_and_save_async(
    site_key: str,
    username: str,
    password: str,
    auth_path: Path,
    log_fn=None,
) -> bool:
    """
    Perform headless login for the given site, save session to auth_path (async).
    site_key: "policyden" | "wegenerate"
    Returns True if login succeeded and state was saved, False otherwise.
    """
    if site_key not in SITE_CONFIG:
        (log_fn or log)(f"  auth_login: unknown site_key {site_key!r}")
        return False
    config = SITE_CONFIG[site_key]
    login_url = config["login_url"]
    selectors = config["selectors"]

    from playwright.async_api import async_playwright

    out = False
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        try:
            await page.goto(login_url, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(1500)

            if not await _try_selector_async(page, selectors["username"], "fill", username):
                (log_fn or log)(f"  auth_login: could not find username field on {site_key}")
                return False
            await page.wait_for_timeout(300)
            if not await _try_selector_async(page, selectors["password"], "fill", password):
                (log_fn or log)(f"  auth_login: could not find password field on {site_key}")
                return False
            await page.wait_for_timeout(300)
            if not await _try_selector_async(page, selectors["submit"], "click"):
                (log_fn or log)(f"  auth_login: could not find submit button on {site_key}")
                return False

            for _ in range(30):
                await page.wait_for_timeout(500)
                if "/login" not in page.url:
                    break
            await page.wait_for_timeout(2000)
            if "/login" in page.url:
                (log_fn or log)(f"  auth_login: still on login page after submit (2FA/CAPTCHA or bad credentials?).")
                return False

            auth_path.parent.mkdir(parents=True, exist_ok=True)
            await context.storage_state(path=str(auth_path))
            out = True
            (log_fn or log)(f"  auth_login: re-logged in to {site_key}, session saved to {auth_path.name}")
        except Exception as e:
            (log_fn or log)(f"  auth_login: {site_key} login failed: {e}")
        finally:
            await browser.close()
    return out


def login_and_save(
    site_key: str,
    username: str,
    password: str,
    auth_path: Path,
    log_fn=None,
) -> bool:
    """
    Perform headless login for the given site, save session to auth_path.
    site_key: "policyden" | "wegenerate"
    Returns True if login succeeded and state was saved, False otherwise.
    """
    return asyncio.run(login_and_save_async(site_key, username, password, auth_path, log_fn))
