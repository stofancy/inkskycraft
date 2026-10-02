// 测试导弹系统
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  headless: true,
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });

console.log('启动 dev server...');
await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForTimeout(1500);

// 开始游戏
await page.click('body');
await page.waitForTimeout(300);
await page.keyboard.press('Enter');
await page.waitForTimeout(2000);

console.log('进入游戏...');

// 等待游戏加载
await page.waitForFunction(() => window.__world?.player?.alive, { timeout: 10000 });
await page.waitForTimeout(1000);

// 添加导弹道具
console.log('添加导弹道具...');
await page.evaluate(() => {
  const w = window.__world;
  if (w) {
    w.items.spawn('missile', w.player.x - 40, w.player.y - 50);
    w.items.spawn('missile', w.player.x + 40, w.player.y - 50);
  }
});

await page.waitForTimeout(800);

// 检查导弹数量
const missileCount = await page.evaluate(() => window.__world?.player?.missile ?? 0);
console.log(`导弹数量: ${missileCount}`);

// 按住射击键，让导弹发射
console.log('发射导弹...');
await page.keyboard.down('KeyZ');
await page.waitForTimeout(2500);
await page.keyboard.up('KeyZ');

await page.waitForTimeout(300);

// 截图
const screenshotPath = 'local-source/test-missile-gameplay.png';
await page.screenshot({ path: screenshotPath });
console.log(`截图: ${screenshotPath}`);

await browser.close();
