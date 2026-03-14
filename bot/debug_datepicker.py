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
        
        # Find all inputs
        inputs = await page.locator("input").all()
        print(f"Found {len(inputs)} inputs:")
        for inp in inputs:
            try:
                attrs = await inp.evaluate('''el => ({
                    type: el.type,
                    id: el.id,
                    name: el.name,
                    class: el.className,
                    placeholder: el.placeholder
                })''')
                print(f"  {attrs}")
            except:
                pass
        
        # Find date-related elements
        print("\nLooking for date pickers...")
        for text in ["date", "calendar", "picker"]:
            els = await page.locator(f'[class*="{text}"], [id*="{text}"]').all()
            if els:
                print(f"Found {len(els)} with '{text}' in class/id")
        
        input()
        await browser.close()

asyncio.run(debug())
