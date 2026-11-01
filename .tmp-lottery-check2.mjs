import { chromium } from 'playwright-core';

const executablePath = '/Users/tar/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 360, height: 1200 }, deviceScaleFactor: 2, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
await page.addInitScript(() => {
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
});
await page.goto('http://localhost:3000/lottery', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /ใช้ตัวอย่าง/ }).click();
await page.waitForTimeout(200);
await page.locator('#lottery-number').fill('123');
await page.locator('.lottery-table-add').click();
await page.locator('#lottery-number').fill('23');
await page.locator('.lottery-table-form-row input[type="checkbox"]').check();
await page.locator('.lottery-table-add').click();
await page.locator('#lottery-number').fill('940');
await page.locator('.lottery-table-form-row input[type="checkbox"]').uncheck();
await page.locator('.lottery-table-add').click();
await page.locator('#lottery-discount').selectOption('25');
await page.waitForTimeout(200);
await page.getByRole('button', { name: /^แชร์$/ }).click();
await page.waitForTimeout(300);
const clipboard = await page.evaluate(() => navigator.clipboard.readText());
const parsed = new URL(clipboard);
const localUrl = `http://localhost:3000${parsed.pathname}${parsed.search}`;
console.log('LOCAL SHARE URL LENGTH:', localUrl.length);

const shared = await browser.newContext({ viewport: { width: 360, height: 1200 }, deviceScaleFactor: 2 });
const sharedPage = await shared.newPage();
await sharedPage.goto(localUrl, { waitUntil: 'networkidle' });
await sharedPage.waitForTimeout(500);
console.log('SHARED TABLE:\n' + await sharedPage.locator('.lottery-table').innerText());
console.log('SHARED SUMMARY:\n' + await sharedPage.locator('.lottery-summary-list').innerText());
console.log('SHARED DISCOUNT:', await sharedPage.locator('#lottery-discount').inputValue());
await sharedPage.screenshot({ path: '/private/var/folders/h9/gj90ly1j5qnfm209y1q5m8sr0000gp/T/opencode/lottery-shared-360.png', fullPage: true });

const narrow = await browser.newContext({ viewport: { width: 320, height: 1200 }, deviceScaleFactor: 2 });
const narrowPage = await narrow.newPage();
await narrowPage.goto('http://localhost:3000/lottery', { waitUntil: 'networkidle' });
await narrowPage.getByRole('button', { name: /ใช้ตัวอย่าง/ }).click();
await narrowPage.waitForTimeout(150);
await narrowPage.locator('#lottery-number').fill('123');
await narrowPage.locator('.lottery-table-add').click();
await narrowPage.waitForTimeout(150);
console.log('320 body scrollWidth:', await narrowPage.evaluate(() => document.body.scrollWidth));
console.log('320 table width:', (await narrowPage.locator('.lottery-table').boundingBox())?.width);
console.log('320 form row box:', await narrowPage.locator('.lottery-table-form-row').boundingBox());
await narrowPage.screenshot({ path: '/private/var/folders/h9/gj90ly1j5qnfm209y1q5m8sr0000gp/T/opencode/lottery-table-320.png', fullPage: true });

await browser.close();
