// 简单的导弹测试：手动操作，自动截图
import puppeteer from 'puppeteer-core';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const browser = await puppeteer.launch({
  headless: true,
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });

console.log('连接到游戏...');
try {
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await wait(2000);

  console.log('点击开始...');
  await page.mouse.click(640, 360);
  await wait(500);

  console.log('选择章节...');
  await page.keyboard.press('Enter');
  await wait(3000);

  console.log('等待游戏启动...');
  await wait(2000);

  console.log('添加导弹...');
  await page.evaluate(() => {
    const w = window.__world;
    if (w && w.player) {
      // 添加3个导弹
      w.player.missile = 3;
      console.log('导弹数量:', w.player.missile);
    }
  });

  await wait(500);

  console.log('发射导弹...');
  await page.keyboard.down('KeyZ');
  await wait(1500);

  console.log('截图...');
  const path = 'local-source/test-missile-flight.png';
  await page.screenshot({ path });
  console.log(`截图保存: ${path}`);

  await page.keyboard.up('KeyZ');

} catch (e) {
  console.error('错误:', e.message);
}

await browser.close();
