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
console.log('DEFAULT PRICE:', await page.locator('#lottery-price').inputValue());
console.log('ADD FORM IS TABLE:', await page.locator('form.lottery-table-form table.lottery-table').count());

await page.getByRole('button', { name: /ใช้ตัวอย่าง/ }).click();
await page.waitForTimeout(250);

async function addNumber(number, reverse = false) {
  await page.locator('#lottery-number').fill(number);
  const reverseCheckbox = page.locator('.lottery-table-form-row input[type="checkbox"]');
  if ((await reverseCheckbox.isChecked()) !== reverse) await reverseCheckbox.setChecked(reverse);
  await page.locator('.lottery-table-add').click();
  await page.waitForTimeout(100);
}

await addNumber('123', false);
await addNumber('23', true);
await addNumber('940', false);

console.log('TABLE:\n' + await page.locator('.lottery-table').innerText());
console.log('SUMMARY:\n' + await page.locator('.lottery-summary-list').innerText());
console.log('COPY:', JSON.stringify(await page.locator('.lottery-summary-card pre.raw-text').textContent()));

await page.locator('#lottery-discount').selectOption('25');
await page.waitForTimeout(200);
console.log('DISCOUNT SUMMARY:\n' + await page.locator('.lottery-summary-list').innerText());
console.log('DISCOUNT COPY:', JSON.stringify(await page.locator('.lottery-summary-card pre.raw-text').textContent()));

await page.getByRole('button', { name: /^แชร์$/ }).click();
await page.waitForTimeout(300);
console.log('SHARE STATUS:', await page.locator('.lottery-summary-card .notice-success').last().innerText());
const clipboard = await page.evaluate(() => navigator.clipboard.readText());
console.log('SHARE URL:', clipboard.slice(0, 140) + '...');
console.log('SHARE URL LENGTH:', clipboard.length);

const shared = await browser.newContext({ viewport: { width: 360, height: 1200 }, deviceScaleFactor: 2 });
const sharedPage = await shared.newPage();
await sharedPage.goto(clipboard, { waitUntil: 'networkidle' });
await sharedPage.waitForTimeout(400);
console.log('SHARED TABLE:\n' + await sharedPage.locator('.lottery-table').innerText());
console.log('SHARED SUMMARY:\n' + await sharedPage.locator('.lottery-summary-list').innerText());
console.log('SHARED DISCOUNT:', await sharedPage.locator('#lottery-discount').inputValue());

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
await page.screenshot({ path: '/private/var/folders/h9/gj90ly1j5qnfm209y1q5m8sr0000gp/T/opencode/lottery-table-360.png', fullPage: true });

await browser.close();
