#!/usr/bin/env python3
"""
Capture browser session for PolicyDen and WeGenerate.
Run locally (Mac/PC), then upload the generated auth_*.json files to your VPS.

Usage:
  python capture.py policyden   # Save auth_policyden.json
  python capture.py wegenerate  # Save auth_wegenerate.json
  python capture.py             # Interactive: choose which site
"""

import asyncio
import sys
from pathlib import Path

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("Install Playwright first: pip install playwright && playwright install chromium")
    sys.exit(1)

SITES = {
    "policyden": {
        "url": "https://app.policyden.com/login",
        "out": "auth_policyden.json",
    },
    "wegenerate": {
        "url": "https://app.wegenerate.com/login",
        "out": "auth_wegenerate.json",
    },
}


async def capture(site_key: str) -> None:
    if site_key not in SITES:
        print(f"Unknown site: {site_key}. Use one of: {list(SITES)}")
        sys.exit(1)
    site = SITES[site_key]
    out_path = Path(__file__).resolve().parent / site["out"]

    print(f"Opening browser for {site_key}...")
    print(f"  Login URL: {site['url']}")
    print()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        await page.goto(site["url"])
        print("  Log in in the browser window. When you're on the dashboard, come back here.")
        input("  Press Enter here to save the session... ")
        await context.storage_state(path=str(out_path))
        await browser.close()

    print(f"Saved session to {out_path}")
    print(f"Upload this file to your VPS at e.g. ~/bot/{site['out']}")


def main() -> None:
    if len(sys.argv) >= 2:
        key = sys.argv[1].lower().strip()
        asyncio.run(capture(key))
        return
    print("Which site do you want to capture?")
    for i, key in enumerate(SITES, 1):
        print(f"  {i}. {key} - {SITES[key]['url']}")
    choice = input("Enter number or name: ").strip()
    if choice.isdigit() and 1 <= int(choice) <= len(SITES):
        key = list(SITES)[int(choice) - 1]
    else:
        key = choice.lower() if choice in SITES else ""
    if not key or key not in SITES:
        print("Invalid choice. Exiting.")
        sys.exit(1)
    asyncio.run(capture(key))


if __name__ == "__main__":
    main()
