// 用无头 Chrome（NVIDIA GPU / Vulkan）打开页面并截图，同时输出控制台错误与警告。
// 用法: node tools/shot.mjs <url> <out.png> [waitMs=1500] [width=900] [height=1200] [dpr=1]
// 环境变量 SHOT_EVAL: 截图前在页面里执行的 JS（可 await）。SHOT_FULL=1 截整页。
import puppeteer from 'puppeteer-core';

const [url, out = '.shots/shot.png', wait = '1500', w = '900', h = '1200', dpr = '1'] = process.argv.slice(2);
if (!url) { console.error('usage: node tools/shot.mjs <url> <out.png> [waitMs] [w] [h] [dpr]'); process.exit(1); }
const { mkdirSync } = await import('node:fs');
const { dirname } = await import('node:path');
mkdirSync(dirname(out), { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: !process.env.SHOT_HEADFUL,
  dumpio: !!process.env.SHOT_DUMPIO,
  args: [...(process.env.SHOT_DUMPIO ? ['--enable-logging=stderr', '--v=0'] : []), ...(process.env.SHOT_NOVK ? [] : ['--use-angle=vulkan', '--enable-features=Vulkan']), '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--no-first-run', `--window-size=${w},${h}`],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: +w, height: +h, deviceScaleFactor: +dpr });
  page.on('console', (m) => { const t = m.type(); const txt = m.text(); if ((t === 'error' || t === 'warn' || t === 'warning') && !txt.includes('CONTEXT_LOST_WEBGL')) console.log(`[${t}]`, txt.slice(0, 2000)); });
  page.on('pageerror', (e) => console.log('[pageerror]', String(e.message).slice(0, 2000)));
  // headless Chrome 刚启动时 GPU 通道会重建一次，过早创建的 WebGL 上下文会丢失；先空载预热
  await page.goto('about:blank');
  await new Promise((r) => setTimeout(r, +(process.env.SHOT_WARM ?? 2000)));
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await new Promise((r) => setTimeout(r, +wait));
  if (process.env.SHOT_EVAL) {
    const r = await page.evaluate(`(async () => { ${process.env.SHOT_EVAL} })()`);
    if (r !== undefined) console.log('[eval]', typeof r === 'string' ? r : JSON.stringify(r));
  }
  await page.screenshot({ path: out, fullPage: process.env.SHOT_FULL === '1' });
  console.log('saved', out);
} finally {
  await browser.close();
}
