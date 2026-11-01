import { chromium } from 'playwright-core';

const executablePath = '/Users/tar/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 360, height: 1200 }, deviceScaleFactor: 2, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
await page.addInitScript(() => {
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
});
page.on('pageerror', (err) => console.log('pageerror:', err.message));

await page.goto('http://localhost:3000/lottery', { waitUntil: 'networkidle' });
console.log('TITLES:', await page.locator('.section-title').allInnerTexts());
await page.getByRole('button', { name: /ใช้ตัวอย่าง/ }).click();
await page.waitForTimeout(250);

await page.locator('#lottery-number').fill('20');
await page.locator('.lottery-table-form-row input[type="checkbox"]').check();
await page.locator('.lottery-table-add').click();
await page.waitForTimeout(150);
console.log('SUMMARY:', await page.locator('.lottery-summary-list').innerText());
console.log('TOTAL:', await page.locator('.lottery-total').innerText());
console.log('COPY:', JSON.stringify(await page.locator('.lottery-summary-card pre.raw-text').textContent()));

await page.locator('.lottery-total-discount input').check();
await page.waitForTimeout(200);
console.log('DISCOUNT SUMMARY:', await page.locator('.lottery-summary-list').innerText());
console.log('DISCOUNT TOTAL:', await page.locator('.lottery-total').innerText());
console.log('DISCOUNT COPY:', JSON.stringify(await page.locator('.lottery-summary-card pre.raw-text').textContent()));

// share summary only
await page.getByRole('button', { name: /^แชร์$/ }).click();
await page.waitForTimeout(300);
const url1 = await page.evaluate(() => navigator.clipboard.readText());
console.log('SHARE 1 HAS RESTRICTED:', decodeURIComponent(url1).includes('049-059-145'));
console.log('SHARE 1 STATUS:', await page.locator('.lottery-summary-card .notice-success').last().innerText());

// share with restricted numbers
await page.locator('.lottery-share-toggle input').check();
await page.getByRole('button', { name: /^แชร์$/ }).click();
await page.waitForTimeout(300);
const url2 = await page.evaluate(() => navigator.clipboard.readText());
console.log('SHARE 2 HAS RESTRICTED:', decodeURIComponent(url2).includes('049-059-145'));
const parsed2 = new URL(url2);
const localUrl2 = `http://localhost:3000${parsed2.pathname}${parsed2.search}`;
const shared = await browser.newContext({ viewport: { width: 360, height: 1200 }, deviceScaleFactor: 2 });
const sharedPage = await shared.newPage();
await sharedPage.goto(localUrl2, { waitUntil: 'networkidle' });
await sharedPage.waitForTimeout(500);
console.log('SHARED SUMMARY:', await sharedPage.locator('.lottery-summary-list').innerText());
console.log('SHARED TOTAL:', await sharedPage.locator('.lottery-total').innerText());
console.log('SHARED WARNING:', await sharedPage.locator('.lottery-summary-card .notice-warn').first().innerText());

const narrow = await browser.newContext({ viewport: { width: 320, height: 1200 }, deviceScaleFactor: 2 });
const narrowPage = await narrow.newPage();
await narrowPage.goto('http://localhost:3000/lottery', { waitUntil: 'networkidle' });
await narrowPage.getByRole('button', { name: /ใช้ตัวอย่าง/ }).click();
await narrowPage.waitForTimeout(200);
await narrowPage.locator('#lottery-number').fill('20');
await narrowPage.locator('.lottery-table-form-row input[type="checkbox"]').check();
await narrowPage.locator('.lottery-table-add').click();
await narrowPage.waitForTimeout(150);
console.log('320 body scrollWidth:', await narrowPage.evaluate(() => document.body.scrollWidth));
console.log('320 chips height:', (await narrowPage.locator('.lottery-chips').first().boundingBox())?.height);
console.log('320 chips scrollWidth:', await narrowPage.locator('.lottery-chips').first().evaluate((el) => el.scrollWidth));
await narrowPage.screenshot({ path: '/private/var/folders/h9/gj90ly1j5qnfm209y1q5m8sr0000gp/T/opencode/lottery-final2-320.png', fullPage: true });
await page.screenshot({ path: '/private/var/folders/h9/gj90ly1j5qnfm209y1q5m8sr0000gp/T/opencode/lottery-final2-360.png', fullPage: true });

await browser.close();
