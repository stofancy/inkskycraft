// 真实 WebGL2 管线回归、雷弧缓存复现与 5 秒动画截图。独立临时 Chrome。
// 用法：node tools/validate-pipeline.mjs [http://127.0.0.1:5174/] [证据目录]
// 可对 vite preview 或挂载在子路径的生产产物运行。
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = process.argv[2] ?? 'http://127.0.0.1:5174/';
const out = process.argv[3] ?? '.shots/p0-01';
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--no-first-run'] });
const report = { base, errors: [], frames: [], console: [] };
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  page.on('pageerror', e => report.errors.push(e.stack ?? e.message));
  page.on('console', m => { if (['error', 'warn'].includes(m.type()) && !/GPU stall|CONTEXT_LOST/.test(m.text())) report.console.push(m.text()); });
  await page.goto('about:blank');
  await new Promise(r => setTimeout(r, 2000));
  await page.goto(new URL('index.html?stage=1&god=1', base).href);
  await page.waitForFunction('window.__game?.state === "playing"');
  report.crashRegression = await page.evaluate(() => {
    const g = window.__game, w = g.world, p = w.player;
    g.update = () => {};
    const result = [];
    for (const remaining of [0, 1, 2]) {
      w.resetStage(); p.reset(false); p.entering = 0; p.invuln = 100;
      p.weapon = 'purple'; p.power = 8; p.x = 450; p.y = 1000;
      g.input.down = a => a === 'shoot';
      const enemies = Array.from({ length: 3 }, (_, i) => w.spawn({ sprite: 'e_hornet', hp: 10000, noCollide: true }, 450, 800 - i * 90));
      for (let i = 0; i < 15; i++) w.tick(1 / 60);
      g.render();
      const old = p.bolts[0];
      enemies.slice(remaining).forEach(e => e.dead = true);
      w.tick(1 / 60); g.render();
      if (p.bolts[0] !== old) throw new Error('未进入缓存雷弧与新目标交错窗口');
      if (old[2].from !== enemies[1] || old[2].to !== enemies[2]) throw new Error('缓存端点引用被目标数组变化替换');
      result.push({ before: 3, after: p.thunderTargets.length, bolts: old.length, cachedEndpointsStable: true });
    }
    return result;
  });
  report.atlas = await page.evaluate(async () => {
    const g = window.__game, a = new g.r.atlas.constructor(g.r.gl);
    await a.build([
      { id: 'sequence', w: 48, h: 48, image: ['art/companions/qingli.png', 'art/companions/yaoque.png'], pivot: [5, 8], anchors: { root: [0, 0] } },
      { id: 'fallback', w: 40, h: 40, image: 'art/pipeline/does-not-exist.png', draw(ctx) { ctx.fillRect(-8, -8, 16, 16); } },
      { id: 'placeholder', w: 40, h: 40, image: 'art/pipeline/does-not-exist.png' },
    ], 1.25);
    const infos = ['sequence', 'fallback', 'placeholder'].map(id => {
      const s = a.get(id);
      if (!s.mask.some(v => v)) throw new Error(`未烘焙 alpha 遮罩 ${id}`);
      return { id, frames: s.frames.length, maskCells: s.mask.reduce((n, v) => n + v, 0), pivot: s.pivot, maskR: s.maskR };
    });
    if (infos[0].frames !== 2 || a.get('unknown').id !== '__missing') throw new Error('序列帧或缺图回退失败');
    g.r.gl.deleteTexture(a.albedo); g.r.gl.deleteTexture(a.glow);
    return infos;
  });
  report.legacyJoint = await page.evaluate(() => {
    const w = window.__game.world;
    w.resetStage();
    const parent = w.spawn({ sprite: 'b_sparrow_body', hp: 100 }, 450, 450);
    parent.angle = .7; parent.scaleX = 1.3; parent.scaleY = .8; parent.mirror = true;
    const child = w.attach(parent, { sprite: 'b_sparrow_wing', hp: 100 }, 'wingL', { mirror: true, rot: .35 });
    child.scaleX = 1.7; child.scaleY = .9; child.syncToParent();
    const root = child.anchor('root'), joint = parent.local(child.offX, child.offY);
    const error = Math.hypot(root.x - joint.x, root.y - joint.y);
    if (error > 1e-7 || child.jointRoot.every(v => v === 0)) throw new Error('旧精灵非零 root 在镜像/缩放/旋转后失去对齐');
    return { root: child.jointRoot, error, mirrored: true, scaled: true };
  });
  await page.goto(new URL('tools/anim.html', base).href);
  await page.waitForFunction('document.querySelector("#scene").contentWindow?.__anim && document.querySelector("#status").hidden');
  const scene = page.frames().find(f => f.url().includes('pipeline=1'));
  assert.ok(scene);
  // 先采集真实运行时间，再逐帧固定采样以便重放比较。
  report.liveAnimation = await scene.evaluate(async () => {
    const g = window.__game, a = window.__anim;
    const start = { time: g.world.time, rot: a.left.angle };
    await new Promise(r => setTimeout(r, 5000));
    const end = { time: g.world.time, rot: a.left.angle };
    if (end.time - start.time < 3 || Math.abs(end.rot - start.rot) < .005) throw new Error('实时动画没有持续推进');
    g.update = () => {};
    return { start, end };
  });
  for (let t = 0; t <= 5; t += .5) {
    const data = await scene.evaluate(time => {
      const g = window.__game, w = g.world, a = window.__anim;
      w.time = w.real = time;
      a.body.age = time; a.body.angle = Math.PI + .12 * Math.sin(time);
      for (const e of a.body.children) { e.age = time; e.syncToParent(); }
      const errors = a.body.children.map(e => {
        const root = e.anchor('root');
        const target = a.body.local(e.offX, e.offY + (e.def.bone?.y ? 5 * Math.sin(time * Math.PI * 2 / 1.4 + (e.def.bone.y.phase ?? 0)) : 0));
        return Math.hypot(root.x - target.x, root.y - target.y);
      });
      if (Math.max(...errors) > 1e-7) throw new Error('翼根失去对齐');
      // 把 alpha 遮罩实心格转换到世界空间，验证 pivot、镜像、旋转共用坐标系。
      for (const e of a.body.children) {
        const s = e.info, k = s.mask.findIndex(v => v);
        const point = e.local(-s.w / 2 + (k % s.maskW) * 4 + 2 - s.pivot[0], -s.h / 2 + Math.floor(k / s.maskW) * 4 + 2 - s.pivot[1]);
        if (!w.hitMask(e, point.x, point.y, .1)) throw new Error('图片遮罩坐标与挂点不同步');
      }
      g.render();
      return { time, leftAngle: a.left.angle, rightAngle: a.right.angle, maxJointError: Math.max(...errors), glError: g.r.gl.getError() };
    }, t);
    assert.equal(data.glError, 0);
    report.frames.push(data);
    await page.screenshot({ path: `${out}/anim-${t.toFixed(1)}.png` });
  }
  await scene.evaluate(() => { window.__anim.setDeform(false); window.__game.render(); });
  await page.screenshot({ path: `${out}/deform-off.png` });
  report.breakPart = await scene.evaluate(() => {
    const a = window.__anim, g = window.__game;
    a.breakWing(); g.render();
    if (!a.left.dead || a.right.dead || a.body.dead || a.tail.dead) throw new Error('独立击破影响到其他部件');
    return { leftDead: a.left.dead, rightAlive: !a.right.dead, bodyAlive: !a.body.dead, tailAlive: !a.tail.dead };
  });
  await page.screenshot({ path: `${out}/wing-broken.png` });
  report.gpu = await scene.evaluate(() => window.__game.r.gpuName());
  report.frameTime = await scene.evaluate(async () => {
    const r = window.__game.r, timer = r.startTimer('frame'), samples = [];
    for (let i = 0; i < 180; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (i >= 60 && timer.ms.frame > 0) samples.push(timer.ms.frame);
    }
    r.timer = null;
    if (!samples.length) throw new Error('GPU timer 未返回样本');
    return { viewport: [innerWidth, innerHeight], renderScale: r.renderScale, quality: window.__game.settings.quality,
      sampleCount: samples.length, gpuMovingMeanMs: samples.reduce((a, b) => a + b, 0) / samples.length,
      scene: '击破左翼后的静态演示场景，形变关闭，60帧预热，120帧滑动均值采样' };
  });
  assert.deepEqual(report.errors, []);
  assert.equal(report.console.filter(s => !/does-not-exist|404|缺少精灵: unknown/.test(s)).length, 0);
  report.ok = true;
} finally {
  writeFileSync(`${out}/validation.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
