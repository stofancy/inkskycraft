// 关卡巡游：快进到多个游戏时间点，只截游戏区，拼成网格图。
// 用法：node tools/tour.mjs "<url>" <out.png> <t1,t2,...> [列数=4] [单格宽=300]
// 快进时逐帧调用 game.update + render（逻辑与流体衰减都与正常游玩一致），到点后让页面真实渲染 0.4 秒再截图。
import puppeteer from 'puppeteer-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';

const [url, out, times, cols = '4', cellW = '300'] = process.argv.slice(2);
const ts = times.split(',').map(Number);
const tmp = '.shots/_tour';
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--no-first-run', '--window-size=1200,900'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  page.on('console', (m) => { const t = m.type(); if (t === 'error' || t === 'warn') { const x = m.text(); if (!x.includes('GPU stall') && !x.includes('CONTEXT_LOST')) console.log(`[${t}]`, x.slice(0, 500)); } });
  page.on('pageerror', (e) => console.log('[pageerror]', String(e.message).slice(0, 500)));
  await page.goto('about:blank');
  await new Promise((r) => setTimeout(r, 2000));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction('window.__game && window.__game.state !== "loading"', { timeout: 30000 });
  const files = [];
  for (let i = 0; i < ts.length; i++) {
    const info = await page.evaluate(async (target) => {
      const g = window.__game, w = g.world;
      while (w.t < target && g.state === 'playing') {
        for (let k = 0; k < 30 && w.t < target && g.state === 'playing'; k++) { g.input.poll(); g.update(1 / 60); g.render(); }
        await new Promise((r) => setTimeout(r, 0));
      }
      await new Promise((r) => setTimeout(r, 400));
      const h = w.hud(g.fps);
      return { t: w.t.toFixed(0), state: g.state, en: w.enemies.length, bul: w.bulletCount(), boss: h.boss ? `${h.boss.name} ${(h.boss.hp * 100).toFixed(0)}%` : '', score: w.score, lives: w.player.lives, rect: g.r.playCss };
    }, ts[i]);
    const f = `${tmp}/${String(i).padStart(2, '0')}.png`;
    await page.screenshot({ path: f, clip: { x: info.rect.x, y: info.rect.y, width: info.rect.w, height: info.rect.h } });
    files.push(f);
    console.log(`#${i} t=${info.t} ${info.state} en=${info.en} bul=${info.bul} ${info.boss} score=${info.score} lives=${info.lives}`);
    if (info.state !== 'playing') break;
  }
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
fs=sys.argv[1:]; cols=${+cols}; cw=${+cellW}
ims=[Image.open(f) for f in fs]; ch=int(cw*ims[0].height/ims[0].width)
rows=(len(ims)+cols-1)//cols; o=Image.new('RGB',(cols*cw,rows*ch))
for i,im in enumerate(ims): o.paste(im.resize((cw,ch)),((i%cols)*cw,(i//cols)*ch))
o.save('${out}')`, ...files]);
  console.log('saved', out);
} finally {
  await browser.close();
}
