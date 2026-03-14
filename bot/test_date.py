import asyncio
from playwright.async_api import async_playwright

async def test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        await page.goto("https://app.policyden.com/login")
        await page.fill('input[type="email"]', "noah@valuecarehealthagency.com")
        await page.fill('input[type="password"]', "01Tekkit!")
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(5000)
        
        # Click date button
        await page.locator("button#date").first.click(timeout=4000)
        await page.wait_for_timeout(2000)
        
        # Get page HTML to see what's there
        html = await page.content()
        
        # Look for reka-popover
        popover = page.locator('[id*="reka"]').first
        print(f"Reka elements: {await popover.count()}")
        
        # Look for any dialog
        dialog = page.locator('[role="dialog"]').first
        print(f"Dialog elements: {await dialog.count()}")
        
        # Get all buttons in popover
        buttons = await page.locator('button').all()
        print(f"Total buttons: {len(buttons)}")
        for b in buttons[:20]:
            try:
                text = await b.inner_text()
                if text.strip():
                    print(f"  Button: {text.strip()[:50]}")
            except:
                pass
        
        # Check for comboboxes
        combos = await page.get_by_role("combobox").all()
        print(f"Comboboxes: {len(combos)}")
        
        input("Press Enter...")
        await browser.close()

asyncio.run(test())
