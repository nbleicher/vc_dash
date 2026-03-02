#!/usr/bin/env python3
"""
Shared login helper for PolicyDen and WeGenerate.
Performs headless login, saves session to auth JSON, for use when session expires.
"""

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


def _try_selector(page, selectors: list, action: str, value: Optional[str] = None) -> bool:
    """Try each selector; for 'fill' pass value; for 'click' value is None. Return True if one worked."""
    for sel in selectors:
        if not sel:
            continue
        try:
            loc = page.locator(sel).first
            if loc.count() == 0:
                continue
            loc.wait_for(state="visible", timeout=3000)
            if action == "fill" and value is not None:
                loc.fill(value, timeout=2000)
            elif action == "click":
                loc.click(timeout=2000)
            return True
        except Exception:
            continue
    return False


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
    if site_key not in SITE_CONFIG:
        (log_fn or log)(f"  auth_login: unknown site_key {site_key!r}")
        return False
    config = SITE_CONFIG[site_key]
    login_url = config["login_url"]
    selectors = config["selectors"]

    from playwright.sync_api import sync_playwright

    out = False
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        try:
            page.goto(login_url, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(1500)

            if not _try_selector(page, selectors["username"], "fill", username):
                (log_fn or log)(f"  auth_login: could not find username field on {site_key}")
                return False
            page.wait_for_timeout(300)
            if not _try_selector(page, selectors["password"], "fill", password):
                (log_fn or log)(f"  auth_login: could not find password field on {site_key}")
                return False
            page.wait_for_timeout(300)
            if not _try_selector(page, selectors["submit"], "click"):
                (log_fn or log)(f"  auth_login: could not find submit button on {site_key}")
                return False

            # Wait for redirect away from /login (e.g. to /dashboard)
            for _ in range(30):
                page.wait_for_timeout(500)
                if "/login" not in page.url:
                    break
            page.wait_for_timeout(2000)
            if "/login" in page.url:
                (log_fn or log)(f"  auth_login: still on login page after submit (2FA/CAPTCHA or bad credentials?).")
                return False

            auth_path.parent.mkdir(parents=True, exist_ok=True)
            context.storage_state(path=str(auth_path))
            out = True
            (log_fn or log)(f"  auth_login: re-logged in to {site_key}, session saved to {auth_path.name}")
        except Exception as e:
            (log_fn or log)(f"  auth_login: {site_key} login failed: {e}")
        finally:
            browser.close()
    return out
