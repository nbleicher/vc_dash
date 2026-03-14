import asyncio
from playwright.async_api import async_playwright

async def debug():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        await page.goto("https://app.policyden.com/login")
        await page.fill('input[type="email"]', "noah@valuecarehealthagency.com")
        await page.fill('input[type="password"]', "01Tekkit!")
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(5000)
        
        # Click around to find date picker - look for button with date text
        buttons = await page.locator("button").all()
        print(f"Found {len(buttons)} buttons:")
        for btn in buttons[:20]:
            try:
                text = await btn.inner_text()
                if text and len(text.strip()) < 30:
                    print(f"  Button: {text.strip()}")
            except:
                pass
        
        # Look for clickable date elements
        print("\nLooking for date-related text...")
        for text in ["Jan", "Feb", "Mar", "2025", "2026", "select date", "date"]:
            try:
                el = page.get_by_text(text).first
                if await el.count() > 0:
                    print(f"  Found: {text}")
            except:
                pass
        
        input("Press Enter to close...")
        await browser.close()

asyncio.run(debug())
