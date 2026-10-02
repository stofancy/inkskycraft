// P0-10：真实鼠标闭环产出封印，检查实际渲染参数、减少动态效果、生命周期及两种尺寸阶段截图。
// 用法：node tools/validate-seal-motion.mjs [dev 服务 URL] [输出目录]
// P4 落印0.1秒由1.6倍缩到1倍，0.2秒淡出；世界更新冻结后只定位已有印章年龄；性能样本保持完整 render，印章年龄按帧推进。
import {paintStroke} from './mouse-paint.mjs';
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5174/';
const out = process.argv[3] ?? '.shots/p0-10/seal';
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const report = { base, cases: [], performance: [], errors: [] };
try {
  const page = await browser.newPage(); page.on('pageerror', e => report.errors.push(e.message));
  await page.goto('about:blank'); await new Promise(r => setTimeout(r, 2000));
  for (const [width, height] of [[1600, 900], [900, 1200]]) {
    for (const reduced of [false, true]) {
      await page.setViewport({ width, height });
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]);
      await page.goto(`${base}?stage=1&god=1`, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => window.__game?.state === 'playing'); await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => {
        const g = window.__game, w = g.world;
        g.update = () => {}; w.resetStage(); w.root.cancel(); w.enemies = []; w.bullets.clear();
        w.player.weapon = 'blue'; w.player.entering = 0; w.player.ink = 1; w.player.x = 450; w.player.y = 1050;
        window.sealTarget = w.spawn({ sprite: 'e_arraydisc', hp: 1000, noCollide: true }, 450, 620);
      });
      await paintStroke(page,Array.from({length:97},(_,i)=>[450+Math.cos(i/96*Math.PI*2)*70,620+Math.sin(i/96*Math.PI*2)*70]));
      const result = await page.evaluate(async () => {
        const g = window.__game, w = g.world, brush = w.brush;
        g.input.poll(); w.tick(1 / 60);
        const stamp = brush.stamps[0];
        if (!stamp) throw new Error('真实闭环未产生印章');
        const add = g.r.top.add.bind(g.r.top);
        g.r.top.add = (id, params) => { if (id === 'fx_seal') window.sealDraw = { ...params }; add(id, params); };
        const samples = [];
        for (let i = 0; i <= 460; i++) {
          stamp.t = i / 1000; g.r.top.clear(); brush.draw(g.r, w.real);
          const ratio = window.sealDraw.sx / stamp.scale;
          samples.push({ age: stamp.t, ratio, alpha: window.sealDraw.alpha });
        }
        return { sealed: brush.sealed, targetFrozen: window.sealTarget.sealed>0, reduced: stamp.reduced, baseScale: stamp.scale,
          angleDegrees: stamp.rot * 180 / Math.PI, samples };
      });
      assert.ok(result.sealed >= 1); assert.equal(result.targetFrozen, true); assert.equal(result.reduced, reduced);
      assert.ok(Math.abs(result.angleDegrees) <= 3);
      assert.ok(result.samples.every(s => s.ratio >= 1 - 1e-9 && s.ratio <= 1.6 + 1e-9));
      if (reduced) assert.ok(result.samples.every(s => s.ratio === 1));
      else { assert.ok(Math.abs(result.samples[0].ratio - 1.6) < 1e-9); assert.equal(result.samples.at(-1).ratio, 1); assert.equal(result.samples[100].ratio,1); }
      const phases = [];
      for (const [name, age] of [['entry', .02], ['impact', .10], ['exit', .16], ['gone', .21]]) {
        const drawn = await page.evaluate(age => {
          const g = window.__game; g.world.brush.stamps[0].t = age; g.render(); return window.sealDraw;
        }, age);
        if(name==='gone')assert.equal(drawn.alpha,0);else assert.ok(drawn.alpha>0); if (reduced) assert.equal(drawn.flash, 0);
        phases.push({ name, age, ...drawn });
        await page.screenshot({ path: `${out}/${width}x${height}-${reduced ? 'reduced' : 'normal'}-${name}.png` });
      }
      assert.equal(phases[0].alpha,.92);assert.equal(phases[1].alpha,.92);assert.ok(phases[2].alpha<phases[1].alpha);assert.equal(phases[3].alpha,0);
      // 偏好按新战果记录；已有印章继续本次时间轴。
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduced ? 'no-preference' : 'reduce' }]);
      assert.equal(await page.evaluate(() => window.__game.world.brush.stamps[0].reduced), reduced);
      await page.evaluate(() => { const b = window.__game.world.brush; b.stamps[0].t = 1.59; b.update(.02); });
      assert.equal(await page.evaluate(() => window.__game.world.brush.stamps.length), 0);
      report.cases.push({ viewport: [width, height], ...result, phases, lifecycleRemoved: true });
    }
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    const performanceSamples = await page.evaluate(async () => {
      const g = window.__game, brush = g.world.brush, render = g.render.bind(g);
      const stamp = { x: 450, y: 620, t: 0, scale: .6, rot: 0, reduced: false, color: 'blue', radius: 70, white: false };
      const result = []; let costs = [];
      g.render = () => { const start = performance.now(); render(); costs.push(performance.now() - start); };
      const run = (animated, count) => new Promise(resolve => {
        let n = 0, last = 0; const intervals = []; costs = [];
        const frame = now => {
          if (last) intervals.push(now - last); last = now;
          stamp.t = animated ? (n % 96) / 60 : .46; brush.stamps = [stamp];
          if (++n < count) requestAnimationFrame(frame); else {
            const stats = values => { const sorted = [...values].sort((a, b) => a - b); return { count: values.length, mean: values.reduce((a, b) => a + b, 0) / values.length,
              p95: sorted[Math.floor(sorted.length * .95)], over33ms: values.filter(v => v > 33.3).length }; };
            resolve({ animated, raf: stats(intervals), renderCpu: stats(costs) });
          }
        }; requestAnimationFrame(frame);
      });
      await run(false, 120);
      for (const animated of [false, true, true, false]) result.push(await run(animated, 180));
      g.render = render; brush.stamps = []; return result;
    });
    report.performance.push({ viewport: [width, height], samples: performanceSamples });
  }
  assert.deepEqual(report.errors, []);
  writeFileSync(`${out}/validation.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ cases: report.cases.length, performanceViewports: report.performance.length, errors: report.errors, out }));
} finally { await browser.close(); }
