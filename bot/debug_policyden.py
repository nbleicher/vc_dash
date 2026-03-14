import asyncio
from playwright.async_api import async_playwright

async def debug():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        await page.goto("https://app.policyden.com/login")
        await page.wait_for_load_state("networkidle")
        await page.fill('input[type="email"]', "noah@valuecarehealthagency.com")
        await page.fill('input[type="password"]', "01Tekkit!")
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(5000)
        
        # Get page content for debugging
        content = await page.content()
        print("Page loaded. Check the browser for login.")
        print("Press Enter in browser to continue...")
        
        input()
        await browser.close()

asyncio.run(debug())
