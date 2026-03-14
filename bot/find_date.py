import asyncio
from playwright.async_api import async_playwright

async def find():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        await page.goto("https://app.policyden.com/login")
        await page.fill('input[type="email"]', "noah@valuecarehealthagency.com")
        await page.fill('input[type="password"]', "01Tekkit!")
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(5000)
        
        # Get all clickable elements with date-related text
        print("Looking for date elements...")
        
        # Take screenshot
        await page.screenshot(path="pd_dashboard.png")
        print("Screenshot saved")
        
        # List all visible text on page
        content = await page.content()
        
        # Look for date patterns
        import re
        dates = re.findall(r'\d{4}-\d{2}-\d{2}', content)
        print(f"Dates in page: {set(dates)}")
        
        # Check for any button/spans with numbers
        spans = await page.locator("span, button, div").all()
        for s in spans[:50]:
            try:
                text = await s.inner_text()
                if "202" in text or "Jan" in text or "Feb" in text:
                    print(f"  {text[:50]}")
            except:
                pass
        
        input()
        await browser.close()

asyncio.run(find())
