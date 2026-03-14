import asyncio
from playwright.async_api import async_playwright

async def check():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        # Capture API calls
        api_calls = []
        page.on("response", lambda resp: api_calls.append(resp.url) if "/api" in resp.url else None)
        
        await page.goto("https://app.policyden.com/login")
        await page.fill('input[type="email"]', "noah@valuecarehealthagency.com")
        await page.fill('input[type="password"]', "01Tekkit!")
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(5000)
        
        print("API calls made:")
        for url in set(api_calls):
            print(f"  {url}")
        
        # Check for date in cookies or localStorage
        print("\nCookies:", await page.context.cookies())
        
        input()
        await browser.close()

asyncio.run(check())
