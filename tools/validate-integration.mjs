// P0-08 集成验收：真实 World.say 转发、演出与常驻指令同屏、Boss/QTE、菜单恢复。
// 用法：node tools/validate-integration.mjs [服务 URL] [输出目录]
// 战斗画面由真实游戏绘制；Boss/QTE 的 HUD 固定为验收样本，便于检查布局。
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5174/';
const out = process.argv[3] ?? '.shots/p0-08/integration';
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = { base, checks: [], geometry: [], errors: [] };
try {
  const page = await browser.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto('about:blank'); await delay(2000);
  for (const [width, height] of [[1600, 900], [900, 1200]]) {
    await page.setViewport({ width, height });
    await page.goto(`${base}?stage=1&god=1&autofire=1`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => window.__game?.state === 'playing'); await delay(1600);
    const forwarded = await page.evaluate(() => {
      const g = window.__game, w = g.world, ui = w.ui;
      g.update = () => {};
      const original = ui.say, calls = [], actor = { name: '曜雀', portrait: '/art/companions/yaoque.png', expressions: { 急切: '/art/companions/qingli.png' } };
      ui.say = (...args) => { calls.push(args); original(...args); };
      w.say(actor, '急切', '跟紧我，前面有伏兵。');
      w.say(actor, '坚定', '守住前方，准备出招。', 15);
      ui.say = original;
      window.integrationHud = w.hud(60);
      window.integrationHudSource = w.hud.bind(w);
      w.hud = () => window.integrationHud;
      return { defaultDuration: calls[0][3], explicitDuration: calls[1][3], actorPreserved: calls[0][0] === actor, expression: calls[0][1] };
    });
    assert.deepEqual(forwarded, { defaultDuration: 4, explicitDuration: 15, actorPreserved: true, expression: '急切' });
    report.checks.push(`${width}: World.say 参数与默认时长`);
    for (const kind of ['presentation', 'boss-qte']) {
      await page.evaluate(kind => {
        const w = window.__game.world, ui = w.ui, hs = window.integrationHud;
        if (kind === 'presentation') {
          ui.stageCard(1, '晓山返笔', '穿过群山，追上前方的敌机。', 15);
          ui.notice('弱点暴露 · 攻击核心', 15);
        } else {
          ui.warning('铜雀', '小心它的双翼');
          hs.boss = { name: '铜雀', hp: .75, phasesLeft: 3, timer: 42, hint: '集中攻击核心' };
          hs.challenge = { action: 'focus', title: '核心反制', hint: '看准时机，保持移动。', duration: 5, remaining: 4, result: null, elapsed: 1 };
          hs.activeMoves.moves.forEach(move => move.available = false);
        }
      }, kind);
      await delay(800);
      const geometry = await page.evaluate(kind => {
        const rect = selector => {
          const e = document.querySelector(selector);
          if (!e) return null;
          const r = e.getBoundingClientRect();
          return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height, visibility: getComputedStyle(e).visibility };
        };
        return { viewport: [innerWidth, innerHeight], kind, play: rect('.play'), commands: rect('.moves-dock'), dialogue: rect('.communication'), chapter: rect(kind === 'presentation' ? '.card' : '.warn'), notice: rect('.battle-notice'), left: rect('.host.l .hud'), right: rect('.host.r .hud'), boss: kind === 'boss-qte' ? rect('.boss') : null, qte: kind === 'boss-qte' ? rect('.qte') : null, rows: document.querySelectorAll('.active-move').length };
      }, kind);
      const overlaps = (a, b) => a && b && Math.min(a.right, b.right) > Math.max(a.x, b.x) && Math.min(a.bottom, b.bottom) > Math.max(a.y, b.y);
      assert.equal(geometry.commands.visibility, 'visible'); assert.equal(geometry.rows, 2);
      for (const name of ['dialogue', 'chapter', 'notice', 'left', 'right', 'boss', 'qte']) assert.ok(!overlaps(geometry.commands, geometry[name]), `指令与 ${name} 重叠 ${width}`);
      for (const name of ['dialogue', 'chapter', 'notice', 'commands']) {
        if (width === 1600) assert.ok(!overlaps(geometry.play, geometry[name]), `宽屏 ${name} 进入游戏区`);
        else assert.ok(geometry[name].bottom <= geometry.play.y + geometry.play.height * .25, `竖屏 ${name} 进入中央战斗区`);
      }
      assert.ok(geometry.right.bottom <= height, '资源 HUD 超出窗口');
      if (geometry.qte) { assert.ok(!overlaps(geometry.qte, geometry.left), 'QTE 与左 HUD 重叠'); assert.ok(!overlaps(geometry.qte, geometry.boss), 'QTE 与 Boss 血条重叠'); }
      report.geometry.push(geometry); report.checks.push(`${width}: ${kind} 演出、指令、HUD 分区`);
      await page.screenshot({ path: `${out}/${width}x${height}-${kind}.png` });
    }
    await page.evaluate(() => { const g = window.__game; g.state = 'paused'; g.ui.screen('pause'); });
    assert.equal(await page.$eval('.moves-dock', e => getComputedStyle(e).visibility), 'hidden');
    await page.evaluate(() => { const g = window.__game; g.ui.screen('none'); g.ui.hud(window.integrationHud, false); });
    assert.equal(await page.$eval('.moves-dock', e => getComputedStyle(e).visibility), 'hidden');
    await page.evaluate(() => { const g = window.__game; g.state = 'playing'; g.ui.hud(window.integrationHud, true); });
    assert.equal(await page.$eval('.moves-dock', e => getComputedStyle(e).visibility), 'visible');
    report.checks.push(`${width}: 菜单、HUD 隐藏与恢复`);
  }
  assert.deepEqual(report.errors, []);
  writeFileSync(`${out}/validation.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checks: report.checks.length, errors: report.errors, out }));
} finally { await browser.close(); }
