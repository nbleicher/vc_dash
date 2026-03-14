import asyncio
from playwright.async_api import async_playwright

async def check():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        # Go to URL with date param if possible
        await page.goto("https://app.policyden.com/dashboard?date=2026-01-05")
        await page.wait_for_timeout(3000)
        
        print(f"URL: {page.url}")
        
        # Check localStorage
        ls = await page.evaluate("() => JSON.stringify(localStorage)")
        print(f"LocalStorage: {ls[:500]}")
        
        input()
        await browser.close()

asyncio.run(check())
