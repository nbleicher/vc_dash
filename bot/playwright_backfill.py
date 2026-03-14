#!/usr/bin/env python3
"""Playwright-based EOD backfill - using exact bot.py date picker logic."""

import asyncio
from datetime import date, timedelta
from playwright.async_api import async_playwright
import re

POLICYDEN_CREDS = ("noah@valuecarehealthagency.com", "01Tekkit!")
WEGENERATE_CREDS = ("admin@valuecarehealthagency.com", "BookBook45!")


async def set_policyden_date(page, date_str: str) -> bool:
    """Set date using PolicyDen's calendar - exact copy from bot.py"""
    from datetime import datetime
    try:
        # Click date button
        await page.locator("button#date").first.click(timeout=4000)
        await page.wait_for_timeout(1000)
        
        # Find popover
        popover = page.locator('[id^="reka-popover-content-"], [role="dialog"]').first
        await popover.wait_for(state="visible", timeout=4000)
        await page.wait_for_timeout(500)
        
        d = datetime.strptime(date_str, "%Y-%m-%d")
        month_name = d.strftime("%B")  # "January", "February", etc.
        day_label = d.strftime("%A, %B ") + str(d.day) + ","  # "Monday, January 5,"
        
        print(f"Looking for month: {month_name}, day: {day_label}")
        
        # Select month from combobox (try twice)
        for i in range(2):
            try:
                cb = page.get_by_role("combobox").nth(i)
                await cb.click(timeout=3000)
                await page.wait_for_timeout(500)
                opt = page.get_by_role("option", name=month_name)
                await opt.first.click(timeout=2000)
                await page.wait_for_timeout(500)
                print(f"Month selected: {month_name}")
                break
            except Exception as e:
                print(f"Month try {i} failed: {e}")
                continue
        
        # Select day
        day_btn = page.get_by_role("button", name=day_label)
        n = await day_btn.count()
        print(f"Day buttons found: {n}")
        
        if n >= 1:
            await day_btn.first.click(timeout=2000)
            await page.wait_for_timeout(500)
        if n >= 2:
            await day_btn.nth(1).click(timeout=2000)
            await page.wait_for_timeout(500)
        
        # Click Apply
        await page.get_by_role("button", name="Apply").click(timeout=5000)
        await page.wait_for_timeout(2000)
        print("Date applied")
        
        return True
    except Exception as e:
        print(f"Date set error: {e}")
        return False


async def extract_policyden(page) -> dict:
    """Extract agent sales from PolicyDen dashboard."""
    agents = {}
    try:
        await page.wait_for_timeout(2000)
        table = page.locator("table").first
        if await table.count() > 0:
            rows = await table.locator("tr").all()
            for row in rows[1:]:
                cells = await row.locator("td, th").all()
                if len(cells) >= 3:
                    name_cell = cells[1]
                    sales_cell = cells[2]
                    name = (await name_cell.inner_text()).strip()
                    sales_text = (await sales_cell.inner_text()).strip()
                    if name and name != "NAME" and sales_text:
                        try:
                            sales = int(sales_text.replace(",", ""))
                            agents[name] = sales
                        except ValueError:
                            pass
    except Exception as e:
        print(f"Table error: {e}")
    return agents


async def extract_wegenerate(page) -> dict:
    """Extract agent performance from WeGenerate."""
    calls = {}
    marketing = {}
    try:
        await page.wait_for_timeout(2000)
        table = page.locator("table").first
        if await table.count() > 0:
            rows = await table.locator("tbody tr").all()
            for row in rows:
                cols = await row.locator("td").all()
                if len(cols) >= 3:
                    name = (await cols[0].inner_text()).strip()
                    try:
                        calls_val = int((await cols[1].inner_text()).replace(",", ""))
                        mkt_val = float((await cols[2].inner_text()).replace("$", "").replace(",", ""))
                        calls[name] = calls_val
                        marketing[name] = mkt_val
                    except:
                        pass
    except Exception as e:
        print(f"Table error: {e}")
    return calls, marketing


async def run_backfill(start_date: str, end_date: str):
    """Run Playwright backfill for date range."""
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        current = start
        while current <= end:
            date_str = current.isoformat()
            print(f"\n=== {date_str} ===")
            
            # PolicyDen
            context = await browser.new_context()
            page = await context.new_page()
            try:
                await page.goto("https://app.policyden.com/login")
                await page.wait_for_load_state("networkidle")
                await page.fill('input[type="email"]', POLICYDEN_CREDS[0])
                await page.fill('input[type="password"]', POLICYDEN_CREDS[1])
                await page.click('button[type="submit"]')
                await page.wait_for_timeout(5000)
                
                await set_policyden_date(page, date_str)
                sales = await extract_policyden(page)
                print(f"PolicyDen: {sales}")
            except Exception as e:
                print(f"PolicyDen error: {e}")
                sales = {}
            finally:
                await context.close()
            
            # WeGenerate
            context = await browser.new_context()
            page = await context.new_page()
            try:
                await page.goto("https://app.wegenerate.com/login")
                await page.wait_for_load_state("networkidle")
                await page.fill('input[type="email"]', WEGENERATE_CREDS[0])
                await page.fill('input[type="password"]', WEGENERATE_CREDS[1])
                await page.click('button[type="submit"]')
                await page.wait_for_timeout(5000)
                
                calls, mkt = await extract_wegenerate(page)
                print(f"WeGenerate calls: {calls}")
                print(f"WeGenerate marketing: {mkt}")
            except Exception as e:
                print(f"WeGenerate error: {e}")
                calls, mkt = {}, {}
            finally:
                await context.close()
            
            current += timedelta(days=1)
        
        await browser.close()
    
    print("\nDone!")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    args = parser.parse_args()
    
    asyncio.run(run_backfill(args.start, args.end))
