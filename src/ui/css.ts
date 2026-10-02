// UI 样式。写法约定：`24u` = 24 * 游戏区缩放(--u)，`24h` = 24 * HUD 缩放(--hu)。
import { FONT_CSS } from './fonts';

const RAW = /* css */ `
.overclock-clock{position:absolute;transform:translate(-50%,-100%);width:92px;text-align:center;color:#fff4d8;font:12px var(--font-number);text-shadow:0 1px 3px #000;background:#1b1111d9;padding:3px;border:1px solid #ffae69;pointer-events:none}.overclock-clock[hidden]{display:none}.overclock-clock i{display:block;height:4px;background:#ff743e;transform-origin:left}.overclock-clock b{font-weight:normal}
.skillbar{width:100%;display:flex;flex-direction:column;gap:12h;padding-top:12h;border-top:1px solid #bfa46745}
.presentation-hidden .skillbar{visibility:hidden}
.skill-row{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6h;min-height:64h}
.skill-slot{position:relative;display:flex;flex-direction:column;align-items:center;gap:2h;color:var(--paper2);opacity:.75;min-width:0}
.skill-slot.ready{opacity:1}.skill-slot:not(.ready) .skill-icon img{filter:grayscale(.7) brightness(.45)}.skill-slot.ready-pulse .skill-icon{animation:skill-unlock .45s ease-out}.skill-slot.ready .skill-icon img{filter:drop-shadow(0 0 3px #e6ba5e)}.skill-slot.active{color:#fff0b5}.skill-slot.unlocking{animation:skill-unlock 1s ease-out}
.skill-key{font-size:12h;color:var(--gold);line-height:1.2;white-space:nowrap}
.skill-icon{position:relative;width:36h;height:36h}.skill-icon img{width:100%;height:100%;object-fit:contain}
.skill-icon svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);fill:none;stroke:#d5c080;stroke-width:2.5;filter:drop-shadow(0 0 2px #000);stroke-dasharray:100}
.skill-seconds{position:absolute;inset:0;display:grid;place-items:center;font:16h var(--font-number);color:#fff;line-height:1;text-shadow:0 1px 3px #000,1px 0 3px #000}
.skill-name{font-size:12h;white-space:nowrap}.skill-value{font:11h var(--font-number);color:var(--gold);min-height:12h}
.skill-fill{position:absolute;bottom:0;left:0;width:100%;height:2h;background:var(--gold);transform-origin:left}
.host.c .skillbar{position:absolute;top:620u;right:14u;width:280u;gap:8u;background:#081215b8;padding:8u;border:1px solid #bfa46745}
.host.c .skill-row{min-height:64u;gap:6u}.host.c .skill-key,.host.c .skill-name{font-size:12u}.host.c .skill-value{font-size:11u;min-height:12u}.host.c .skill-icon{width:36u;height:36u}.host.c .skill-seconds{font-size:16u}
.host.c .passive-dock{top:780u}
@keyframes skill-unlock{0%{filter:brightness(3);transform:scale(1.18)}100%{filter:brightness(1);transform:scale(1)}}
@media(prefers-reduced-motion:reduce){.skill-slot.unlocking{animation:none;filter:brightness(1.5)}}

.opening-controls{position:absolute;left:28u;right:28u;top:180u;z-index:15;padding:10u 16u;color:var(--gold);background:#100e0dde;font-size:20u;line-height:1.6;pointer-events:none}
.opening-controls[hidden],.presentation-hidden .opening-controls{display:none}

.hero-letter{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:96%;display:flex;justify-content:center;align-items:center;gap:16px;pointer-events:none;z-index:8;padding:22px 0;background:linear-gradient(90deg,transparent,#121719bd 12%,#121719bd 88%,transparent);line-height:1}
/* P3-03 浅纸签色，仅用于强敌警告；朱砂与闪烁沿用原演出。 */
.hero-letter.hero-warning-paper{background:none;isolation:isolate;padding-bottom:68px}
.hero-warning-paper .warning-boss-name{position:absolute;left:50%;bottom:16px;transform:translateX(-50%)}
.hero-warning-paper:before{content:'';position:absolute;inset:0;z-index:-1;opacity:.92;background-color:#f1f2ee;background-image:repeating-linear-gradient(7deg,transparent 0 3px,#161a1d06 4px,transparent 5px 9px);clip-path:polygon(0 4%,5% 1%,11% 3%,19% 0,28% 2%,37% 0,48% 3%,59% 0,69% 2%,79% 0,89% 3%,96% 1%,100% 4%,99% 23%,100% 42%,99% 62%,100% 81%,99% 97%,93% 100%,85% 97%,74% 100%,64% 98%,53% 100%,43% 97%,32% 100%,22% 98%,12% 100%,4% 97%,0 99%,1% 78%,0 59%,1% 39%,0 21%)}
.hero-seal{display:flex;align-items:center;justify-content:center;border:3px solid #b3422c;border-radius:6px;padding:8px;box-sizing:border-box}.hero-seal img{width:100%!important;height:100%!important;object-fit:contain}.hero-letter img{max-width:none!important}.hero-letter span{flex:none}
.brush-letter-unlock{filter:none!important;text-shadow:none!important}
.brush-letter-unlock:before{inset:-45%;background:radial-gradient(ellipse,#050909ee 0%,#182323b0 32%,#18232350 55%,transparent 75%);animation:brush-ink-halo 1.2s ease-out both}
.brush-letter-description{display:block;font:20px var(--font-text);letter-spacing:0;white-space:normal;color:#eee9d6;max-width:90vw;text-align:center;margin-top:20px;text-shadow:0 2px 5px #000}

.battle-lettered{letter-spacing:0!important}.chapter-seal.battle-lettered,.warning-seal.battle-lettered{border:0;filter:none}
.brush-letter-unlock{font-size:clamp(42px,7cqh,76px)!important;isolation:isolate}
.brush-letter-unlock:before{content:'';position:absolute;inset:-45%;z-index:-1;border-radius:50%;background:radial-gradient(ellipse,#050909ee 0%,#182323b0 32%,#18232350 55%,transparent 75%);animation:brush-ink-halo 1.2s ease-out both}
@keyframes brush-ink-halo{from{opacity:0;transform:scale(.65)}to{opacity:1;transform:scale(1)}}

.passive-preview{position:relative;border-bottom:1px solid #d8ba6933;padding:8u 0;height:150u}
.passive-preview>span{font-size:12u;color:var(--paper2)}
.passive-preview svg{display:block;width:100%;height:120u}
.passive-preview text{font:12px var(--f);text-anchor:middle;fill:#eee6d2;stroke:none}
.preview-sway{transform-origin:120px 105px;animation:preview-sway 2.5s ease-in-out infinite alternate}
@keyframes preview-sway{from{transform:rotate(-14deg)}to{transform:rotate(14deg)}}
.passive-dock{margin-top:6h;max-width:100%}
.host.r .passive-dock{display:flex;flex-wrap:wrap;gap:8h}.host.r .passive-dock .kh,.host.r .passive-status strong,.host.r .passive-status small{display:none}.host.r .passive-status{padding:0}.host.r .passive-icon{width:22h;height:22h}.host.r .partners{gap:4h 8h;padding-top:0}.host.r .partner:not(.effect-on) .partner-info small{display:none}
.passive-status{display:flex;align-items:center;gap:7h;padding:4h 0;font-size:clamp(12px,16h,16px);color:var(--paper2)}
.passive-status strong{font-weight:400;flex:1}.passive-status small{font-size:11h}
.passive-icon{display:grid;place-items:center;width:25h;height:25h;border:1px solid var(--gold2);border-radius:50%;color:var(--gold)}
.passive-icon img{width:100%;height:100%;object-fit:contain}
.passive-status.triggered,.partner.effect-on{color:var(--paper);text-shadow:0 0 8px #d8ba6966}
.partner[data-companion] .partner-info{font-size:clamp(13px,18h,18px)}
.partner-info small{font-size:clamp(11px,14h,14px);color:var(--paper2)}
@media(prefers-reduced-motion:reduce){.preview-sway{animation:none}}

.ik{position:absolute;inset:0;pointer-events:none;overflow:hidden;color:var(--paper);
  --f:var(--font-body);
  --paper:#efe6d2;--paper2:#b3a88f;--gold:#dcb75e;--gold2:#8d7333;--red:#e2452f;--red2:#a9241a;--ink:#0b0908;--ink2:#17120f;
  --u:1;--hu:1;font-family:var(--f);user-select:none;-webkit-user-select:none;text-rendering:optimizeLegibility}
.ik *{box-sizing:border-box;margin:0;padding:0}
.ik svg.defs{position:absolute;width:0;height:0}

/* 字体角色：标题书写感、正文阅读、数字整齐排列；占位家族由配置生成。 */
.ttl,.c-t,.w-name,.ph1,.big,.stage .sm,.res .rh .n,.end .ln.b,.load .ld,.wseal,.chapter-seal,.warning-seal{font-family:var(--font-title)}
.digits,.mv,.gv,.bn .tm,.cnt .cn,.rr .rv,.qte-clock b,.sv{font-family:var(--font-number);font-variant-numeric:tabular-nums}
/* ---------- HUD 宿主 ---------- */
.host{position:absolute;transition:opacity .5s;display:flex;justify-content:center;align-items:flex-start;padding-top:64h}
.host.off{opacity:0}
.hud{display:flex;flex-direction:column;gap:24h;width:100%;max-width:290h;padding:0 4h;text-shadow:0 1px 3px #000c}
.lbl{font-size:14h;letter-spacing:.32em;color:var(--gold);opacity:.9;display:flex;align-items:baseline;gap:8h;white-space:nowrap}
.lbl i{font-style:normal;font-size:.72em;letter-spacing:.18em;color:var(--paper2);opacity:.6}
.blk{display:flex;flex-direction:column;gap:6h;position:relative}
.blk::after{content:"";position:absolute;left:0;right:0;bottom:-11h;height:1px;background:linear-gradient(90deg,var(--gold2),transparent 85%);opacity:.55}
.blk.nl::after{display:none}
.digits{display:flex;font-size:46h;line-height:1.05;font-weight:700;color:var(--paper);text-shadow:0 0 14h #dcb75e40,0 1px 3px #000}
.digits.sm{font-size:24h;font-weight:600;color:var(--paper2)}
.d{display:inline-block;width:.66em;text-align:center}
.d.z{opacity:.25}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:18h}
.mv{font-size:34h;font-weight:900;line-height:1;color:var(--gold);transition:color .3s}
.mv small{font-size:.5em;font-weight:600;margin-left:2h;opacity:.8}
.mv.hot{color:#ffd76a;text-shadow:0 0 14h #ff9a3a90,0 1px 3px #000}
.gv{font-size:30h;font-weight:700;line-height:1;color:var(--paper)}
.medal{flex-direction:row;align-items:center;gap:10h}
.medal .mm{display:flex;flex-direction:column;gap:6h}
.medal svg{width:34h;height:34h;flex:none}
.medal .gv{color:var(--gold)}
.fps{font-size:12h;color:var(--paper2);opacity:.7;font-family:var(--font-number)}
.stage{display:flex;flex-direction:column;gap:2h;align-items:flex-start;padding-bottom:12h;position:relative}
.stage::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:linear-gradient(90deg,var(--gold),transparent);opacity:.7}
.stage .sn{font-size:14h;letter-spacing:.4em;color:var(--gold)}
.stage .sm{font-size:34h;font-weight:900;letter-spacing:.14em;color:var(--paper)}
.icons{display:flex;flex-wrap:wrap;gap:5h;min-height:28h;align-items:center}
.icons svg{width:28h;height:28h;filter:drop-shadow(0 1px 2px #000a)}
.icons b{font-size:20h;margin-left:4h;color:var(--gold)}
.inkrow{display:flex;gap:24h;align-items:center}
.ink{position:relative;width:29h;height:116h;flex:none}
.ink img{position:absolute;inset:0;width:100%;height:100%;display:block}
.b-clip{position:absolute;inset:0;transition:clip-path .18s linear}
.b-ready{opacity:0;transition:opacity .25s}
.ink.ready .b-ready,.ink.brush .b-ready{opacity:1}
.ink .il{position:absolute;left:0;right:0;bottom:-26h;text-align:center;font-size:14h;letter-spacing:.3em;color:var(--gold);transition:color .3s;padding-left:.3em}
.ink.ready .il{color:#ff8a70}
.icons.armor{margin-top:2h;min-height:28h;gap:4h}
.icons.armor img{width:28h;height:28h}
.icons.armor img.off,.lat i:not(.on),.mis i:not(.on),.icons img[src$='life-off.png']{opacity:.3;filter:grayscale(1)}
.icons.armor img.broke{animation:armor-break .3s ease-out}
@keyframes armor-break{0%{opacity:1;filter:brightness(4);transform:scale(1.5)}60%{opacity:.8;filter:brightness(2);transform:scale(1.15) rotate(8deg)}100%{opacity:.3;filter:grayscale(1);transform:none}}
.icons img{filter:drop-shadow(0 1px 2px #000a)}
.ink-hint{font-size:11h;letter-spacing:.06em;color:var(--paper2);opacity:.65;margin-top:3h}
.ink-score-dots{display:flex;gap:10h;font-size:13h;margin-top:2h}
.hurt-edge{position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,#0000 55%,#d8201a66 100%);z-index:30}
.hurt-edge.on{animation:hurt-edge .45s ease-out}
@keyframes hurt-edge{0%{opacity:1}100%{opacity:0}}
.wp{display:flex;flex-direction:column;gap:12h;align-items:center;justify-content:center;align-self:stretch}
.wseal{width:56h;height:56h;display:flex;align-items:center;justify-content:center;font-size:44h;font-weight:900;color:var(--paper);
  position:relative;}
.wseal img{position:absolute;inset:0;width:100%;height:100%;display:none}
.wseal.w-red .seal-red,.wseal.w-blue .seal-blue,.wseal.w-purple .seal-purple{display:block}
.w-red{--wc:#d8382a}.w-blue{--wc:#1f9fc0}.w-purple{--wc:#8f5be8}
.lat{display:grid;grid-template-columns:repeat(4,18h);gap:4h}
.lat i{width:18h;height:18h;background:url('/art/ui/hud/level-off.png') center/100% 100%;transition:all .2s}
.lat i.on{background-image:url('/art/ui/hud/level-on.png')}
.wl{display:flex;align-items:center;gap:8h;font-size:14h;color:var(--paper2);letter-spacing:.2em}
.wl b{font-size:20h;color:var(--paper);letter-spacing:0}
.mis{display:flex;align-items:center;gap:8h;font-size:14h;color:var(--paper2)}
.mis .arrows{display:flex;gap:4h}.mis i{width:18h;height:18h;background:url('/art/ui/hud/arrow-off.png') center/100% 100%}
.mis i.on{background-image:url('/art/ui/hud/arrow-on.png')}

/* 窄屏：HUD 收进游戏区顶部 */
.stage .dn{font-size:12h;letter-spacing:.3em;color:var(--paper2);opacity:.6;margin-top:2h}
/* 按键图例（左侧栏底部） */
.keyhost{position:absolute;display:flex;justify-content:center;align-items:flex-end;padding-bottom:30h;transition:opacity .5s}
.keyhost.off{opacity:0}
.keys{width:100%;max-width:290h;padding:0 4h;opacity:.5;text-shadow:0 1px 3px #000c}
.kh{font-size:12h;letter-spacing:.4em;color:var(--gold);padding-bottom:6h;margin-bottom:6h;border-bottom:1px solid #8d733380}
.kr{display:flex;justify-content:space-between;align-items:baseline;gap:10h;font-size:14h;line-height:1.85;color:var(--paper2);transition:color .2s}
.ka{letter-spacing:.2em;white-space:nowrap}
.kk{color:var(--paper);white-space:nowrap;opacity:.85;font-size:.92em}
.kr.rdy{color:var(--red);font-weight:700;position:relative}
.kr.rdy .kk{color:#ff7a5a;opacity:1}
.kr.rdy::before{content:"";position:absolute;left:-12h;top:50%;width:6h;height:6h;background:var(--red);transform:translateY(-50%) rotate(45deg);box-shadow:0 0 8h var(--red)}
.keys:has(.kr.rdy){opacity:.9}
.ik:not(.compact) .host.r .hud{gap:11h}.ik:not(.compact) .host.r .ink{height:116h;width:29h}.ik:not(.compact) .host.r .inkrow{margin-bottom:26h}
.ik:not(.compact) .host .hud,.ik:not(.compact) .keys{width:var(--column-width);max-width:none;padding:0}
.host.r:not(.c){background:linear-gradient(90deg,#090807,#070707 80%,#080808)}
/* 标题底部按键行 / 暂停按键表 */
.tkeys{position:absolute;bottom:82u;left:0;right:0;display:flex;justify-content:center;flex-wrap:wrap;gap:6u 26u;padding:0 40u;font-size:17u;letter-spacing:.14em;color:var(--paper2);opacity:.7;text-shadow:0 1px 3px #000}
.tkeys b{color:var(--gold);font-weight:700;margin-left:4u;letter-spacing:.06em}
.pkeys{margin:18u 0 0;padding:12u 18u;border-top:1px solid var(--gold2);border-bottom:1px solid #8d733360;display:grid;grid-template-columns:1fr 1fr;column-gap:40u}
.pkeys .kr{font-size:19u;line-height:1.9}
.pkeys .kr.kb{color:var(--paper2)}
.pkeys .ka{color:var(--gold)}
.mi .tg[data-d=easy]{color:#8fc9a0}.mi .tg[data-d=hard]{color:var(--red)}

.host.c{padding-top:0;display:block}
.host.c .hud{position:absolute;width:auto;max-width:none;gap:8h}
.host.c.l .hud{left:16u;top:12u}
.host.c.r .hud{right:14u;top:12u;align-items:flex-end}
.host.c.r .lbl{padding:2px 5px;background:#081215b8;border-radius:2px;color:#f1d597;text-shadow:0 1px 2px #000}
.host.c.r .icons{padding:2px 4px;background:#0812157a;border-radius:2px}
.host.c.r .growth-mini,.host.c.r .partner-info{background:#081215b8;color:#efe6d2;text-shadow:0 1px 2px #000}
.host.c .lbl{font-size:12h;gap:0}.host.c .lbl i{display:none}.host.c .medal .lbl{display:none}
.host.c .blk::after{display:none}
.host.c .digits{font-size:40h}
.host.c .digits.sm{font-size:19h}
.host.c .row2{display:flex;flex-direction:row;gap:16h;align-items:flex-end}.host.c .blk{gap:2h}.host.c .medal{flex-direction:row}
.host.c .mv{font-size:26h}.host.c .gv{font-size:20h}
.host.c .medal svg{width:22h;height:22h}
.host.c .stage{display:none}
.host.c .icons{justify-content:flex-end;min-height:22h}
.host.c .icons svg,.host.c .icons img{width:22h;height:22h}.host.c .icons.armor img{width:18h;height:18h}.host.c .ink-hint{display:none}
.host.c .inkrow{flex-direction:column;align-items:flex-end;gap:36h;margin-top:6h}
.host.c .ink{width:46h;height:184h;opacity:.92}
.host.c .wp{align-items:flex-end}
.host.c .wseal{width:44h;height:44h}
.host.c .lat{grid-template-columns:repeat(4,14h);gap:3h}.host.c .lat i{width:14h;height:14h}
.host.c .wl{display:none}
.host.c.l::before{content:"";position:absolute;left:0;right:0;top:0;height:170h;background:linear-gradient(#000a,#0000);pointer-events:none}

/* ---------- 游戏区覆盖层 ---------- */
.play{position:absolute;overflow:hidden;container-type:size}
.play>div{position:absolute}
.fx,.cardl,.warnl,.capl,.boss{inset:0;pointer-events:none}
.scr{inset:0;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:calc(var(--u)*1px)}
.scr.on{pointer-events:auto;z-index:40;}
.scr.dim{background:radial-gradient(ellipse at center,#100c0ae0 0%,#080505f2 100%)}
.scr.ttl-bg{background:linear-gradient(#0000 40%,#0009 78%,#000c)}

.pop{position:absolute;left:0;top:0;white-space:nowrap;font-weight:700;pointer-events:none;will-change:transform,opacity;
  transform:translate(-50%,-50%);font-size:22u;text-shadow:0 1px 3px #000,0 0 8u #000a;display:none;line-height:1}
.pop.score{color:var(--paper);font-size:22u}
.pop[class*="damage-"]{font-family:var(--font-number);font-weight:900;font-variant-numeric:tabular-nums;letter-spacing:.02em;text-shadow:0 2u 2u #171015,-1u 0 #171015,1u 0 #171015,0 -1u #171015;filter:none}
.pop[class*="damage-red"]{color:#ff8e5b}.pop[class*="damage-blue"]{color:#8cffe0}.pop[class*="damage-purple"]{color:#e8c5ff}
.pop[class$="-small"]{font-size:25u}.pop[class$="-medium"]{font-size:37u}.pop[class$="-large"]{font-size:52u}
.pop.graze{color:#bff6ff;font-size:15u;font-weight:600;opacity:.9}
.pop.info{color:var(--paper);font-size:26u;letter-spacing:.1em}
.pop.chain{color:#ffd76a;font-size:30u;font-weight:900;font-style:italic;text-shadow:0 0 12u #ff9a3a80,0 2px 3px #000}
.pop.extend{color:#ffe08a;font-size:38u;font-weight:900;letter-spacing:.12em;text-shadow:0 0 16u #ffbf4080,0 2px 4px #000}
.pop.seal{color:var(--red);font-size:74u;font-weight:900;letter-spacing:.06em;filter:url(#ik-rough-s);
  text-shadow:0 0 1px #fff4,0 0 18u #ff3a1f70,0 2px 2px #000}

/* Boss 血条 */
.boss{top:26u;bottom:auto;height:60u;padding:0 40u;opacity:0}
.boss.on{opacity:1}
.boss.c2{top:10u;height:46u}
.bs .host.c .hud{top:78u}.host.c .hud{transition:top .3s}
.bn{display:flex;align-items:baseline;gap:14u;font-size:22u;letter-spacing:.24em;color:var(--paper);text-shadow:0 1px 4px #000}
.bn .ph{margin-left:auto;display:flex;gap:7u;align-items:center}
.bn .ph i{width:11u;height:11u;transform:rotate(45deg);background:var(--red);box-shadow:0 0 6u var(--red);border:1px solid #fff5}
.bn .tm{font-size:24u;letter-spacing:0;color:var(--gold);min-width:2.2em;text-align:right;font-weight:700}
.bar{margin-top:8u;height:12u;position:relative;background:#0009;border:1.5px solid var(--gold2);box-shadow:0 0 0 1px #000a,0 2px 8u #000a;overflow:hidden}
.bar b{position:absolute;inset:0;transform-origin:left;transform:scaleX(1)}
.bar .tr{background:#fff;transition:transform .08s linear}
.bar .hp{background:#e45e49;transition:transform .06s linear}
.phase-ticks{position:absolute;inset:0;z-index:3}.phase-ticks i{position:absolute;top:0;bottom:0;width:2px;background:#312b2a}.phase-ticks i:first-child{left:33.333%}.phase-ticks i:last-child{left:66.667%}
.bar::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,#0000 0 calc(10% - 1px),#000a calc(10% - 1px) 10%)}
.bar:has(.phase-ticks)::after{display:none}



/* ---------- 菜单 / 面板 ---------- */
.ttl{position:relative;display:flex;align-items:flex-start;justify-content:center;filter:url(#ik-rough)}
.ttl .ch{font-size:330u;font-weight:900;line-height:1.05;color:var(--paper);display:block;padding:0 6u;
    }


.tw{position:relative;display:flex;flex-direction:column;align-items:center}
.tseal{position:absolute;right:-40u;top:250u;}

.inkseal{display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--red2);color:var(--paper);font-weight:900;
  width:70u;height:110u;border-radius:5u;font-size:44u;line-height:1.15;filter:url(#ik-seal);box-shadow:0 0 0 2px #0008,0 0 24u #e2452f60;transform:rotate(3deg);position:relative}
.inkseal::after{content:"";position:absolute;inset:5u;border:2px solid #0005;border-radius:3u}
.tsub{display:flex;align-items:center;gap:22u;margin-top:-6u;font-size:30u;letter-spacing:.5em;color:var(--gold);text-shadow:0 2px 6u #000}
.tsub i{width:90u;height:2px;background:linear-gradient(90deg,#0000,var(--gold))}.tsub i:last-of-type{transform:scaleX(-1)}
.tsub b{font-weight:700;letter-spacing:.42em;color:var(--paper)}

.ttlwrap{display:flex;flex-direction:column;align-items:center;gap:0;margin-top:-90u}
.menu{display:flex;flex-direction:column;gap:6u;margin-top:96u;min-width:380u}

.menu.h{flex-direction:row;gap:30u;margin-top:34u;min-width:0}
.mi{position:relative;display:flex;align-items:center;gap:16u;padding:10u 34u 10u 26u;cursor:pointer;font-size:38u;letter-spacing:.34em;color:var(--paper2);
  transition:color .15s,background .15s,transform .15s;text-shadow:0 2px 6u #000}
.mi .mk{width:14u;height:14u;background:var(--red);transform:rotate(45deg) scale(0);transition:transform .18s cubic-bezier(.3,1.6,.5,1);flex:none;box-shadow:0 0 10u var(--red)}
.mi .ml{flex:1;padding:0;white-space:nowrap}
.mi .ms{font-size:.5em;letter-spacing:.2em;color:var(--paper2);opacity:.7}
.mi.on{color:var(--paper);background:linear-gradient(90deg,#e2452f38,#0000 92%)}
.mi.on .mk{transform:rotate(45deg) scale(1)}
.mi.on::after{content:"";position:absolute;left:26u;right:0;bottom:2u;height:2px;background:linear-gradient(90deg,var(--gold),#0000)}
.menu.h .mi{padding:10u 30u;background:none;border:1.5px solid #dcb75e50}
.menu.h .mi.on{background:linear-gradient(#e2452f30,#e2452f10);border-color:var(--gold);transform:none}
.menu.h .mi::after{display:none}
.menu.h .mi .ml{padding:0}
.hint{position:absolute;bottom:46u;left:0;right:0;text-align:center;font-size:19u;letter-spacing:.2em;color:var(--paper2);opacity:.75;text-shadow:0 1px 3px #000}
.hint b{color:var(--gold);font-weight:700;margin:0 2u}
.foot{position:absolute;bottom:16u;left:0;right:0;text-align:center;font-size:14u;letter-spacing:.3em;color:var(--paper2);opacity:.4}

.panel{position:relative;width:660u;padding:44u 54u 34u;background:linear-gradient(#17120ff0,#0b0908f4);border:1px solid var(--gold2);
  box-shadow:0 0 0 5u #0b0908,0 0 0 6u #8d733380,0 20u 60u #000c;}
.panel::before,.panel::after{content:"";position:absolute;width:30u;height:30u;border:2px solid var(--gold)}
.panel::before{left:-8u;top:-8u;border-right:0;border-bottom:0}
.panel::after{right:-8u;bottom:-8u;border-left:0;border-top:0}
.ph1{font-size:54u;font-weight:900;letter-spacing:.5em;padding-left:.5em;text-align:center;color:var(--paper);filter:url(#ik-rough-s);margin-bottom:6u}
.pline{height:2px;background:linear-gradient(90deg,#0000,var(--gold),#0000);margin:12u 0 20u}
.panel .menu{min-width:0;margin-top:0}
.panel .mi{font-size:34u}
.title-menu{width:440u}.title-menu .st{font-size:38u}
.st{font-size:27u;letter-spacing:.2em;padding-block:9u}
.st .ml{flex:1;padding:0}
.sl{flex:1;height:26u;position:relative;cursor:ew-resize;touch-action:none;display:flex;align-items:center}
.sl::before{content:"";position:absolute;left:0;right:0;height:5u;background:#ffffff1c;border-radius:3u}
.sl-f{position:absolute;left:0;height:5u;background:linear-gradient(90deg,var(--red2),var(--red));border-radius:3u;box-shadow:0 0 8u #e2452f80}
.sl-k{position:absolute;width:16u;height:16u;margin-left:-8u;background:var(--gold);transform:rotate(45deg);border:2px solid #0b0908;top:5u}
.sv{width:3.6em;text-align:right;font-size:.86em;letter-spacing:.06em;color:var(--gold);font-weight:700}
.st .tg{margin-left:auto;font-size:.95em;letter-spacing:.3em;color:var(--gold);font-weight:700}
.st .tg.off{color:var(--paper2);opacity:.6}
.pfoot{margin-top:22u;text-align:center;font-size:17u;letter-spacing:.18em;color:var(--paper2);opacity:.7}
.pfoot b{color:var(--gold)}

.how{display:grid;grid-template-columns:auto 1fr 1fr;column-gap:26u;row-gap:9u;font-size:22u;letter-spacing:.06em;align-items:baseline}
.how .hh{color:var(--gold);letter-spacing:.3em;font-size:17u;border-bottom:1px solid var(--gold2);padding-bottom:6u;margin-bottom:2u}
.how .k{color:var(--paper);white-space:nowrap}.how .a{color:var(--gold);font-weight:700;letter-spacing:.14em;white-space:nowrap}
.how .g{color:var(--paper2)}
.hnote{margin:20u 0 12u;padding:14u 18u;border-left:3px solid var(--red);background:#ffffff08;font-size:20u;line-height:1.7;letter-spacing:.06em;color:var(--paper2)}
.hnote b{color:var(--paper)}
.test-panel{width:760u;padding:28u 40u;max-height:1080u}
.test-panel .mi{font-size:24u;letter-spacing:.06em;padding:7u 14u;gap:14u;min-height:38u}
.test-panel .mi .ml{flex:0 0 240u}
.test-panel .mi .ms{font-size:20u;letter-spacing:0;opacity:1;margin-left:auto;text-align:right}
.test-panel .mi .mk{width:9u;height:9u}
.test-panel .menu{gap:2u}
.test-panel .test-disabled{opacity:.38;cursor:default}
.test-note{font-size:18u;line-height:1.4;color:var(--paper2);margin:10u 0}
.panel.wide{width:760u}

/* 续关 */
.cnt{position:relative;width:260u;height:260u;margin:6u 0 8u}
.cnt svg{width:100%;height:100%;transform:rotate(-90deg)}
.cnt .rg{stroke:var(--gold);stroke-width:5;fill:none;stroke-linecap:round;transition:stroke-dashoffset .25s linear,stroke .3s}
.cnt .rb{stroke:#ffffff18;stroke-width:5;fill:none}
.cnt.low .rg{stroke:var(--red)}
.cnt .cn{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:150u;font-weight:900;color:var(--paper);line-height:1;padding-bottom:8u;filter:url(#ik-rough-s)}
.cnt.low .cn{color:#ff6a4a}
.big{font-size:104u;font-weight:900;letter-spacing:.3em;padding-left:.3em;color:var(--paper);filter:url(#ik-rough);line-height:1.15}
.big.red{color:var(--red)}
.sub1{font-size:24u;letter-spacing:.4em;padding-left:.4em;color:var(--paper2);margin-bottom:10u}

/* 结算 */
.res .rh{display:flex;align-items:center;gap:20u;justify-content:center;margin-bottom:8u}
.res .rh .t{font-size:24u;letter-spacing:.5em;color:var(--gold)}
.res .rh .n{font-size:64u;font-weight:900;letter-spacing:.2em;filter:url(#ik-rough-s)}
.rr{display:flex;align-items:baseline;justify-content:space-between;padding:8u 0;border-bottom:1px solid #dcb75e28;font-size:28u;letter-spacing:.2em;opacity:0}
.rr.on{opacity:1;transform:none}
.rr .rl{color:var(--paper2)}
.rr .rv{font-weight:700;color:var(--paper);font-variant-numeric:tabular-nums;letter-spacing:.06em;min-width:4em;text-align:right}
.rr.tot{border-bottom:0;border-top:2px solid var(--gold);margin-top:6u;padding-top:14u;font-size:36u}
.rr.tot .rv{color:var(--gold);font-size:1.25em}
.rr .stampx{display:inline-block;color:var(--red);border:2px solid var(--red);padding:0 12u;border-radius:3u;font-size:.8em;transform:rotate(-4deg);letter-spacing:.2em;filter:url(#ik-seal)}
.rr .none{color:var(--paper2);opacity:.6}
.rnext{margin-top:22u;text-align:center;font-size:24u;letter-spacing:.4em;color:var(--gold);opacity:0;transition:opacity .4s;cursor:pointer;}
.rnext.on{opacity:1}

/* 结束 */
.gov{position:relative}.gov .rec{position:absolute;right:-90u;top:236u;width:64u;height:150u;font-size:34u;}
.scoreb{display:flex;flex-direction:column;gap:6u;align-items:center;margin:18u 0 12u}
.scoreb .digits{font-size:70u}.scoreb .lbl{font-size:18u;justify-content:center}
.scoreb .hi{font-size:22u;letter-spacing:.2em;color:var(--paper2);margin-top:8u}
.scoreb .hi b{color:var(--gold);font-weight:700}

/* 尾声 */
.end{position:absolute;inset:0;container-type:size;overflow:hidden}
.end .roll{position:absolute;left:0;right:0;top:0;display:flex;flex-direction:column;align-items:center;gap:40u;padding:0 90u;text-align:center;
  transform:none;text-shadow:0 2px 8u #000}
.end .ln{font-size:32u;line-height:1.9;letter-spacing:.24em;color:var(--paper)}
.end .ln.s{font-size:22u;color:var(--gold);letter-spacing:.5em}
.end .ln.b{font-size:96u;font-weight:900;letter-spacing:.3em;filter:url(#ik-rough);line-height:1.2}
.end .ln.r{color:var(--red);font-weight:900;font-size:70u;letter-spacing:.3em}
.end .go{position:absolute;bottom:0;left:0;right:0;padding:70u 0 40u;background:linear-gradient(#0b090800,#0b0908f0 60%);text-align:center;font-size:20u;letter-spacing:.4em;color:var(--paper2);opacity:1;cursor:pointer;pointer-events:auto}

/* 载入 */
.load .ld{font-size:78u;font-weight:900;letter-spacing:.6em;padding-left:.6em;filter:url(#ik-rough);color:var(--paper)}
.lbar{width:420u;height:6u;background:#ffffff18;margin-top:36u;position:relative;overflow:hidden;border-radius:3u}
.lbar b{position:absolute;inset:0;transform-origin:left;transform:scaleX(0);background:linear-gradient(90deg,var(--red2),var(--gold));transition:transform .2s linear}
.lpct{margin-top:14u;font-size:20u;letter-spacing:.3em;color:var(--paper2)}
.load{background:radial-gradient(ellipse at center,#17120f 0,#080605 100%)}

.rest-panel.book-open .choice-card{min-height:138u;padding:12u 14u}.rest-panel.book-open .choice-head{margin-bottom:8u}.rest-panel.book-open .choice-card p{display:none}.rest-panel.book-open .choice-card strong{font-size:24u}.rest-panel.book-open .choice-state{padding-top:8u}.rest-panel.book-open .skip-card{min-height:52u}.rest-panel.book-open .skip-card .choice-state{padding:0}.rest-panel.book-open .ph1{font-size:32u}.rest-panel.book-open .rest-topline{display:none}.rest-panel.book-open .rest-sub{font-size:17u;margin-top:6u}
.panel.wide.book-open .how,.panel.wide.book-open .hnote,.panel.wide.gallery-open .how,.panel.wide.gallery-open .hnote{display:none}
/* 三垣成长与反制：墨骨铜金框架 */

.rest-screen{background:linear-gradient(#080a0ece,#09090edb),url('/art/direction/rest-background.png') center/cover!important}
.panel{max-height:calc(1120 * var(--u) * 1px);overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--gold2) #0b0908}
.rest-panel{width:830u;padding:30u 36u;background:linear-gradient(145deg,#161c1ef5,#100f13f5 60%,#1d1711f5);border-color:#c3a26480}
.rest-panel .ph1{font-size:40u;letter-spacing:.14em;padding:0;margin-top:16u;filter:none}
.rest-topline{display:flex;justify-content:space-between;font-size:14u;color:var(--gold);letter-spacing:.18em;border-bottom:1px solid #b3904440;padding-bottom:12u}
.rest-topline span{font-size:12u;color:var(--paper2)}
.rest-sub{margin-top:12u;text-align:center;font-size:20u;color:var(--paper2);line-height:1.5}
.choice-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14u}
.choice-card{position:relative;min-height:244u;padding:20u 18u;cursor:pointer;border:1px solid #8d733370;background:linear-gradient(150deg,#23313460,#100f16d0);transition:background .15s,border-color .15s,transform .15s;display:flex;flex-direction:column}
.choice-card::after{content:"";position:absolute;inset:5u;pointer-events:none;border-top:1px solid #dcb75e25;border-bottom:1px solid #dcb75e25}
.choice-card.on{border-color:var(--gold);background:linear-gradient(145deg,#38505280,#312118d9);box-shadow:0 0 22u #c6a56918;transform:translateY(-3u)}
.choice-head{display:flex;align-items:center;gap:8u;font-size:13u;color:var(--paper2);margin-bottom:20u}
.choice-no{width:30u;height:30u;border:1px solid var(--gold2);display:grid;place-items:center;font-size:20u;color:var(--gold);flex:none}
.choice-route{letter-spacing:.06em}.choice-cost{margin-left:auto;color:#f0ce81;white-space:nowrap}
.choice-card strong{font-size:28u;letter-spacing:.06em;color:var(--paper);line-height:1.4}
.choice-card p{font-size:18u;line-height:1.7;color:#cbc3ae;margin-top:12u}
.choice-state{margin-top:auto;padding-top:16u;font-size:14u;color:var(--gold);letter-spacing:.06em}
.choice-card.unavailable{background:#171518;border-style:dashed}.choice-card.unavailable strong,.choice-card.unavailable p{color:#938b7d}.choice-card.unavailable .choice-state{color:#efb2a0}
.rest-menu{margin-top:16u!important}.rest-menu .mi{font-size:23u}.rest-panel .pfoot{opacity:1;font-size:16u}
.art-gallery{margin-top:20u;display:grid;grid-template-columns:1.3fr 1fr;gap:16u}.art-gallery figure{min-width:0}.art-gallery img{width:100%;max-height:420u;object-fit:contain;border:1px solid #b69a5f55;background:#0b0b12}.art-gallery figcaption{font-size:14u;line-height:1.6;color:var(--paper2);margin-top:8u}
.panel.wide{padding:28u 30u;width:820u}.panel.wide .ph1{font-size:40u}.panel.wide .how{font-size:18u;column-gap:14u;row-gap:8u}.panel.wide .hnote{font-size:17u;line-height:1.6;margin:15u 0;padding:10u 14u}.panel.wide .mi{font-size:24u}
.panel:has(.pkeys){width:660u;padding:44u 54u 34u}.panel:has(.pkeys) .ph1{font-size:54u}.panel:has(.pkeys) .mi{font-size:34u}
.growth-mini{font-size:14h;line-height:1.6;color:var(--gold);letter-spacing:.05em}
.host.c .partners{display:flex}.partners{display:grid;grid-template-columns:1fr 1fr;gap:8h 8h;padding-top:5h}.partner-info b{margin-left:6h}.partner-info small{display:block;white-space:nowrap}.partner{display:flex;align-items:center;gap:10h}.partner-seal{display:grid;place-items:center;width:31h;height:31h;border:1px solid #bb965860;background:#181417;color:#f2b66b;font-size:20h}.p1 .partner-seal{color:#8edacc}.p2 .partner-seal{color:#c3b2e0}.partner-info{flex:1;font-size:15h;letter-spacing:.08em}.partner-info b{float:right;font-size:12h;font-weight:400;color:var(--paper2)}.partner-xp{height:3h;background:#ffffff15;margin-top:6h;overflow:hidden}.partner-xp i{display:block;height:100%;background:var(--gold);transform-origin:left}
.host.c .partners{flex-direction:column;gap:4u;position:absolute;right:0;top:474u;width:104u}.host.c .partner{gap:3u;flex:1;min-width:0}.host.c .partner-seal{display:none}.host.c .partner-info{font-size:13u;letter-spacing:0}.host.c .partner-info b{float:right;font-size:11u}.host.c .growth-mini{font-size:12u;position:absolute;right:0;top:430u;width:104u;white-space:normal}
.combo-banner{top:166u;left:50%;transform:translateX(-50%);padding:8u 22u;border:1px solid #dcb75e66;background:#101015e8;color:#f4cd7e;font-size:23u;letter-spacing:.15em;opacity:0;pointer-events:none;white-space:nowrap}.combo-banner.on{opacity:1}
.qte{top:156u;left:130u;right:130u;display:flex;gap:18u;align-items:center;padding:15u 18u;border:1px solid #d9ba7590;border-left:4px solid var(--gold);background:linear-gradient(120deg,#121d20f5,#171116f5);opacity:0;pointer-events:none;box-shadow:0 8u 24u #0008}.qte.on{opacity:1}.qte-copy{flex:1;min-width:0}.qte-title{font-size:18u;color:var(--gold);letter-spacing:.14em}.qte-action{font-size:25u;line-height:1.4;font-weight:700;margin:5u 0}.qte-hint{font-size:16u;color:#eee2c7;line-height:1.45}.qte-note{font-size:13u;color:#aaa999;margin-top:5u}.qte-clock{width:75u;height:75u;position:relative;flex:none}.qte-clock svg{width:100%;height:100%;transform:rotate(-90deg);fill:none;stroke-width:3}.qte-track{stroke:#ffffff25}.qte-ring{stroke:#f3d18a;stroke-dasharray:100;stroke-linecap:round}.qte-clock b{position:absolute;inset:0;display:grid;place-items:center;font-size:26u;font-variant-numeric:tabular-nums;color:#ffe1a0}.qte.urgent{border-color:#e6a08a}.qte.urgent .qte-ring{stroke:#eea88a}
.boss-target{font-size:17u;color:#efd6a2;line-height:1.4;padding:7u 10u;background:#0a0d12df;border-left:2px solid var(--gold);margin-top:7u;width:fit-content;max-width:100%;letter-spacing:.06em}.boss-target:empty{display:none}

.rest-panel.book-open .choice-card.skip-card{min-height:52u}
.qte{z-index:10}.bs .host.c .hud{top:116u}.challenging .host.c .partners,.challenging .host.c .growth-mini{visibility:hidden}
/* 演出边签：宽屏独立侧栏，窄屏顶部三行。尺寸采用 CSS 像素保证可读性。 */
.presentation-dock{position:absolute;pointer-events:none;z-index:12;display:grid;grid-template-rows:60px 194px 32px;gap:4px;color:var(--paper)}
.presentation-hidden .presentation-dock{visibility:hidden}
.presentation-dock>div{position:relative;min-width:0;inset:auto}
.presentation-dock .cardl,.presentation-dock .warnl{grid-row:1;grid-column:1}
.presentation-dock .capl{grid-row:2}.presentation-dock .noticel{grid-row:3}
.presenting .keyhost{visibility:hidden}
.card,.warn{height:100%;display:flex;align-items:center;gap:12px;padding:0;background:none;border:0;position:relative;isolation:isolate;text-shadow:0 1px 3px #000;}
.card .ink-brush,.warn .ink-brush{position:absolute;inset:-16px -20px;background:url('/art/ui/ink-brush-v1.png') center/100% 100% no-repeat;pointer-events:none;z-index:-1}
.chapter-seal,.warning-seal{width:30px;height:36px;border:1px solid #cb4836;color:#ef6f55;display:grid;place-items:center;flex:none;font-size:24px;font-weight:900;filter:url(#ik-seal)}
.chapter-copy,.warning-copy{min-width:0}.c-no,.w-en{font-size:12px;letter-spacing:.15em;color:var(--gold);margin-bottom:3px}
.c-t,.w-name{font-size:27px;font-weight:900;letter-spacing:.08em;line-height:1.2;overflow-wrap:anywhere}
.c-s,.w-sub{font-size:14px;line-height:1.4;color:var(--paper2);margin-top:4px}
.warn .ink-brush{background-image:url('/art/ui/ink-brush-v2.png')}.w-en{color:#f28c70}
.communication{display:flex;align-items:center;gap:14px;height:100%;padding:0;border:0;position:relative;isolation:isolate}
.communication::before{content:"";position:absolute;inset:-20px -38px;background:radial-gradient(ellipse at 60% 50%,#141311ef 15%,#11110fc9 45%,transparent 74%);z-index:-1;pointer-events:none}
.portrait{position:relative;flex:none;width:96px;height:148px;display:grid;place-items:center;color:#88745a;overflow:hidden}
.ik:not(.compact) .communication::before{right:calc(-1 * var(--column-gutter))}
.ik:not(.compact) .portrait{position:absolute;right:calc(24px - var(--column-gutter));top:12px;width:128px;height:170px}
.ik:not(.compact) .communication-copy{padding-right:84px}
.portrait svg{width:100%;height:100%;opacity:.85}.portrait img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center bottom}
.communication-copy{min-width:0;flex:1}.speaker{display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px;margin-bottom:8px}.speaker b{font-size:22px;color:var(--gold);letter-spacing:.1em}.speaker span{font-size:20px;color:var(--paper2)}
.dialogue-text{font-size:22px;line-height:1.6;min-height:70px;line-break:strict;overflow-wrap:normal;text-shadow:0 1px 3px #000}
.dialogue-unit{display:inline-block;white-space:nowrap}
.speech-signal{position:absolute;left:var(--speech-x);top:var(--speech-y);width:3px;height:64px;background:linear-gradient(transparent,#ecd69b,transparent);box-shadow:0 0 8px #dcb75e30;pointer-events:none}
.battle-notice{padding:4px 0;background:linear-gradient(90deg,#15120fcc,transparent);font-size:17px;line-height:24px;color:#f4dc9e}
.presentation-dock .combo-banner{position:absolute;inset:0;transform:none;padding:4px 0;font-size:17px;line-height:24px;letter-spacing:.06em;border:0;background:linear-gradient(90deg,#15120fcc,transparent)}
.noticel:has(.battle-notice) .combo-banner{visibility:hidden}
.compact .presentation-dock{grid-template-rows:48px 116px 30px;gap:4px}
.compact .card,.compact .warn{gap:12px}.compact .chapter-copy,.compact .warning-copy{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.compact .c-no,.compact .w-en{font-size:12px;margin:0}.compact .c-t,.compact .w-name{font-size:24px}.compact .c-s,.compact .w-sub{font-size:13px;margin:0}
.compact .portrait{width:96px;height:104px}.compact .communication-copy{display:block}.compact .speaker{margin:0 0 4px;gap:12px;flex-direction:row;align-items:center}
.compact .speaker b{font-size:22px}.compact .speaker span{font-size:20px}.compact .dialogue-text{font-size:22px;line-height:1.5;min-height:0}
.compact .host.c .hud{top:12u}.compact.bs .host.c .hud{top:354px}.compact .boss.c2{top:306px}
.compact .qte{top:430px;left:260u;right:130u}.compact .qte-action{font-size:21u}


/* P3 收尾：信息占各自列，瞬时提示保留独立空间。 */
.combat-status{display:flex;flex-direction:column;gap:8h;font-size:17h;line-height:1.5;color:var(--gold);width:100%}
.combat-status>div:empty,.combat-status:not(:has(>div:not(:empty))){display:none}
.combat-status>div{width:100%;border-left:2px solid var(--gold2);padding-left:8h}
.growth-mini{white-space:pre-line}
.ik:not(.compact) .host.r .hud{gap:12h}
.ik:not(.compact) .partners{grid-template-columns:1fr}
.ik:not(.compact) .partner-info{min-width:0}
.ik:not(.compact) .partner-info>div{display:flex;justify-content:space-between;align-items:baseline;gap:8h}
.ik:not(.compact) .partner-info b{float:none;white-space:nowrap}
.host.c .combat-status{position:absolute;left:0;top:212u;width:200u;font-size:16u}
.host.c .growth-mini{width:150u;white-space:pre-line}
.host.c .partners{top:540u}
.host.c .passive-dock{position:absolute;right:0;top:640u;width:150u}
.title-menu .mi{min-height:68u;line-height:1.3}
.title-menu .st{padding-block:10u}
.panel .mi{line-height:1.3}
.test-panel .mi .ms{min-width:0;white-space:normal;line-height:1.3}
.panel::before{left:0;top:0}.panel::after{right:0;bottom:0}


/* 菜单期间统一遮住底层画布的两侧装饰；战场边界由 play 的矩形决定。 */
.presentation-hidden .host:not(.c){opacity:1;background:var(--ink);box-shadow:0 0 0 2px var(--ink)}
.presentation-hidden .host:not(.c) .hud{visibility:hidden}
.ttl.lettered{font-size:330u;filter:none}
.ph1.lettered{padding-left:0;letter-spacing:0;filter:none;display:flex;align-items:center;justify-content:center}
.menu-lettering{display:block;object-fit:contain;max-width:100%;flex:none}

.motion-glyph{display:inline-block;white-space:pre;transform-origin:center}
@media(prefers-reduced-motion:reduce){.ik *{transition:none!important}.end{overflow-y:auto;pointer-events:auto}.end .roll{position:relative;transform:none;top:0}.end .go{position:sticky}}


.roll-charge{display:inline-block;margin-left:10px;color:var(--gold);font-size:14px;white-space:nowrap}
.mission-brief{position:absolute;left:15%;top:12%;width:70%;box-sizing:border-box;padding:calc(18px*var(--u)) calc(26px*var(--u));background:rgba(20,22,23,.88);border-block:1px solid #b19a63;color:#ddd6bf;font-family:var(--font-body);z-index:35;font-size:calc(24px*var(--u));line-height:1.6;pointer-events:none}
.play:has(.mission-brief:not([hidden])) .opening-controls{visibility:hidden}
.mission-brief[hidden],.ship-label[hidden]{display:none}
.brief-title{display:flex;gap:calc(24px*var(--u));align-items:baseline}.brief-title small{letter-spacing:.25em;font-size:.65em;color:#b5a071}.brief-title b{font-weight:400;font-size:1.4em}.mission-brief p{margin:.3em 0 0;font-size:.8em;color:#b9b3a3}
@keyframes mission-air{0%{opacity:0;transform:translateY(-20%)}6.85%{opacity:1;transform:none}89%{opacity:1}100%{opacity:0}}
.ship-label{position:absolute;transform:translate(-50%,-100%);color:#ded6bb;font-size:calc(18px*var(--u));pointer-events:none}.ship-durability{font-size:calc(16px*var(--hu));color:#bdab7c}
.communication.memory .portrait{filter:sepia(.85) saturate(.35)}.communication .dialogue-text{max-height:none}.communications{width:90%;max-height:85%;box-sizing:border-box}.communication-history{max-height:calc(600px*var(--u));overflow-y:auto;overscroll-behavior:contain;scrollbar-color:#a38c59 #202020}.record-line{padding:12px 0;border-bottom:1px solid #6f6346;font-size:calc(22px*var(--u));line-height:1.7}.record-line b{font-weight:400;color:#bda879}.record-line p{margin:4px 0;color:#ddd4bc}.communications .pfoot{cursor:pointer}

/* V1 的战场下沿对白，暂停期间允许大立绘进入战场。 */
.story-dialogue{position:absolute;inset:0;z-index:24;pointer-events:auto;cursor:pointer}
.story-dialogue[hidden]{display:none}
.story-shade{position:absolute;inset:0;background:rgba(0,0,0,.4)}
.story-faces{position:absolute;left:0;right:0;bottom:280u;height:660u;overflow:hidden;pointer-events:none}
.story-portrait{position:absolute;bottom:0;width:470u;height:650u;object-fit:contain;object-position:bottom;filter:drop-shadow(0 8u 14u #000a);transition:filter .25s,opacity .25s}
.story-portrait img,.story-portrait svg{width:100%;height:100%;object-fit:contain;object-position:bottom}
.story-portrait.side-0{left:-40u}.story-portrait.side-1{right:-40u}
.story-portrait.dimmed{filter:brightness(.35) saturate(.45);opacity:.65}
.story-portrait.speaking{animation:story-pop .3s ease-out both}
.story-portrait.side-1.speaking{animation-name:story-pop-right}
.story-box{position:absolute;left:24u;right:24u;bottom:22u;height:270u;padding:20u 28u 16u;border-top:2u solid #b49557;border-bottom:1u solid #756344;background:linear-gradient(110deg,#151511f5,#1f211bf5);box-shadow:0 -12u 38u #0006}
.story-speaker small{font-family:var(--font-body);font-size:20u;letter-spacing:.04em;color:var(--paper2);margin-left:16u}
.story-speaker{font-family:var(--font-title);font-size:30u;letter-spacing:.12em;color:var(--gold);height:46u}
.story-text{font-family:var(--font-body);font-size:28u;line-height:1.65;letter-spacing:0;height:139u;color:var(--paper);white-space:pre-wrap;line-break:strict;overflow:hidden;text-shadow:0 1u 3u #000}
.story-text.overflowing{overflow-y:auto;scrollbar-width:thin}
.story-footer{display:flex;align-items:center;gap:20u;padding-top:10u;font-size:18u;color:var(--paper2)}
.story-next{color:var(--gold);flex:1}.story-skip{font-size:16u}
.story-dialogue.memory .story-portrait{filter:sepia(.6) saturate(.45)}
.story-dialogue.memory .story-portrait.dimmed{filter:sepia(.6) brightness(.35)}
.play:has(.story-dialogue:not([hidden])) .opening-controls,.play:has(.story-dialogue:not([hidden])) .qte{visibility:hidden}
@keyframes story-pop{from{opacity:0;transform:translateX(-80u)}to{opacity:1;transform:none}}
@keyframes story-pop-right{from{opacity:0;transform:translateX(80u)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.story-portrait.speaking{animation:none}}
`;

export const CSS = FONT_CSS + RAW.replace(/(?<![\w#.-])(-?\d*\.?\d+)([uh])(?![\w-])/g, (_m, n, k) => `calc(${n} * var(--${k === 'u' ? 'u' : 'hu'}) * 1px)`);
