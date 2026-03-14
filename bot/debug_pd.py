import asyncio
import os
from playwright.async_api import async_playwright

async def debug():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        await page.goto("https://app.policyden.com/login")
        await page.wait_for_load_state("networkidle")
        await page.fill('input[type="email"]', "noah@valuecarehealthagency.com")
        await page.fill('input[type="password"]', "01Tekkit!")
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(5000)
        
        # Print all tables
        tables = await page.locator("table").all()
        print(f"Found {len(tables)} tables")
        for i, table in enumerate(tables):
            rows = await table.locator("tr").all()
            print(f"Table {i}: {len(rows)} rows")
            for row in rows[:5]:
                text = await row.inner_text()
                print(f"  {text[:100]}")
        
        # Print all buttons
        buttons = await page.locator("button").all()
        print(f"\nFound {len(buttons)} buttons")
        for btn in buttons[:10]:
            text = await btn.inner_text()
            print(f"  Button: {text[:50]}")
        
        # Print URL
        print(f"\nURL: {page.url}")
        
        await browser.close()

asyncio.run(debug())
