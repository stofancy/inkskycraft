// 第一幕 · 墨山晓：中 Boss「纸龙」与 Boss「铜雀」。
import type { Co, G } from '../game/api';
import type { Enemy, EnemyDef } from '../game/enemy';
import { sayLine } from './dialogue1';

const PI = Math.PI;

// ============================================================ 中 Boss · 纸龙

const SEG_N = 12;        // 身体节数
const SEG_GAP = 62;      // 相邻节弧长间距
const SEG_FIRST = 78;    // 头到第一节的弧长

/** 龙身节：可被击破（掉 medal），伤害不计入中 Boss 血量。 */
const SerpentSeg: EnemyDef = { sprite: 'm_serpent_seg', hp: 80, score: 300, armor: 0.85, drops: 'medal', explosion: 's' };
const SerpentTail: EnemyDef = { sprite: 'm_serpent_tail', hp: 80, score: 500, armor: 0.85, drops: 'medal', explosion: 's' };

export const Serpent: EnemyDef = {
  name: '纸龙', sprite: 'm_serpent_head', hp: 1, score: 30000, drops: ['p', 'bomb'], explosion: 'l',
  boss: { name: '纸龙', phases: 2 },
  *ai(e, g) {
    const start = e.data.startPhase ?? 1;
    // 头部轨迹历史：按固定弧长回溯采样，各节沿轨迹跟随
    const trail: { x: number; y: number }[] = [{ x: e.x, y: e.y }];
    const parts: (Enemy | null)[] = [];
    let traveled = 0;
    const arcOf = (i: number) => (i < SEG_N ? SEG_FIRST + i * SEG_GAP : SEG_FIRST + (SEG_N - 1) * SEG_GAP + 78);

    const sample = (a: number): { x: number; y: number } => {
      let rem = a, px = e.x, py = e.y;
      for (let i = trail.length - 1; i >= 0; i--) {
        const q = trail[i];
        const d = Math.hypot(px - q.x, py - q.y);
        if (d >= rem && d > 0) { const k = rem / d; return { x: px + (q.x - px) * k, y: py + (q.y - py) * k }; }
        rem -= d; px = q.x; py = q.y;
      }
      return { x: px, y: py };
    };

    e.run((function* (): Co {
      let lx = e.x, ly = e.y;
      for (;;) {
        yield;
        const dx = e.x - lx, dy = e.y - ly, d = Math.hypot(dx, dy);
        if (d >= 2) {
          trail.push({ x: e.x, y: e.y });
          if (trail.length > 700) trail.splice(0, 120);
          traveled += d;
          const tgt = Math.atan2(dy, dx) - PI / 2;
          let da = tgt - e.angle;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          e.angle += da * Math.min(1, g.dt * 12);
          lx = e.x; ly = e.y;
        }
        // 随头部前进逐节生成
        while (parts.length <= SEG_N && traveled >= arcOf(parts.length)) {
          const i = parts.length;
          const s = g.spawn(i < SEG_N ? SerpentSeg : SerpentTail, e.x, e.y, part => { part.data.contentRole = 'prop'; });
          s.data.serp = true;
          s.data.weakWeapon = i % 2 ? 'blue' : 'red';
          s.data.weakLabel = '刃 · 断链缩阵';
          s.data.linkTo = e.id;
          parts.push(s);
        }
        for (let i = 0; i < parts.length; i++) {
          const s = parts[i];
          if (!s || s.dead) continue;
          const a = arcOf(i);
          const p = sample(a), f = sample(Math.max(0, a - 16)), b = sample(a + 16);
          s.x = p.x; s.y = p.y;
          s.angle = Math.atan2(f.y - b.y, f.x - b.x) - PI / 2;
        }
      }
    })());
    e.data.parts = parts;

    const alive = () => parts.slice(0, SEG_N).filter((s): s is Enemy => !!s && !s.dead);

    yield* e.moveTo(450, 200, 2.4, 'outQuad');sayLine(g,'M1-PD-IN');

    if(start <= 1){
    // 阶段 1：蛇形游走，节节依次向外吐小弹
    yield* g.phase(e, { hp: 600, time: 26 }, function* (): Co {
      g.fork((function* (): Co {
        yield* g.wait(1);
        for (let r = 0; ; r++) {
          for (const s of alive()) {
            const h = s.angle + PI / 2;
            const sp = 145 + g.rank * 40;
            g.shoot(s.x, s.y, h + PI / 2, sp, { shape: 'orb', color: 'magenta', size: 6 });
            g.shoot(s.x, s.y, h - PI / 2, sp, { shape: 'orb', color: 'magenta', size: 6 });
            yield* g.wait(0.1);
          }
          const m = e.anchor('mouth');
          if (r % 2 === 1) g.fan(m.x, m.y, g.aim(m.x, m.y), 3, 0.35, 220, { shape: 'rice', color: 'cyan' });
          yield* g.wait(1.5 / g.difficulty.aggression);
        }
      })());
      let t = 0;
      for (;;) {
        t += g.dt;
        e.x = 450 + 330 * Math.sin(0.75 * t);
        e.y = 200 + 110 * Math.sin(0.5 * t);
        yield;
      }
    });

    }
    // 阶段 2：盘绕成圈（半径缓缓收紧），口中喷扇形火，节节向外放射慢弹
    yield* g.phase(e, { hp: 650, time: 28, name: '纸龙 · 盘绕' }, function* (): Co {
      g.bgFlash(0.3);
      const cx = 450, cy = 340;
      yield* e.moveTo(cx, cy - 235, 1.2, 'inOutQuad');
      g.fork((function* (): Co {
        for (let r = 0; ; r++) {
          const m = e.anchor('mouth');
          g.fan(m.x, m.y, g.aim(m.x, m.y), alive().length > 6 ? 5 : 3, 0.8, 205 + g.rank * 30, { shape: 'flame', color: 'amber' });
          if (r % 2 === 0) {
            const segs = alive();
            for (let i = r % 4 === 0 ? 0 : 1; i < segs.length; i += 3) {
              const s = segs[i];
              g.shoot(s.x, s.y, Math.atan2(s.y - cy, s.x - cx), 125, { shape: 'orb', color: 'magenta', size: 6 });
            }
          }
          yield* g.wait(1.3 / g.difficulty.aggression);
        }
      })());
      let th = -PI / 2, t = 0;
      for (;;) {
        t += g.dt;
        const R = Math.max(115, 160 + alive().length * 6 - 2 * t);
        th += (235 / R) * g.dt;
        e.x = cx + R * Math.cos(th);
        e.y = cy + R * Math.sin(th);
        yield;
      }
    });

    // 击破：剩余龙身一并炸毁
    for (const s of parts) {
      if (s && !s.dead) { g.fx.explosion(s.x, s.y, 'm'); g.remove(s); }
    }
  },
};

// ============================================================ 守晨 · 铜雀六诀
const Wing:EnemyDef={sprite:'b_sparrow_wing',hp:250,score:6000,armor:.9,drops:'ink',explosion:'l'};
const SupplyPillar:EnemyDef={sprite:'e_arraydisc',hp:65,score:800,noCollide:true,drops:'ink'};
const Calibration:EnemyDef={sprite:'e_sealbee',hp:40,score:500,noCollide:true,drops:'ink'};
const SwordHilt:EnemyDef={sprite:'e_swordshuttle',hp:110,score:1200,noCollide:true,drops:'medal'};
function mark(part:Enemy,color:string,label:string,parent:Enemy):Enemy {
  part.data.contentRole='prop';part.data.weakWeapon=color;part.data.weakLabel=label;part.data.linkTo=parent.id;return part;
}
function* clearNodes(g:G,nodes:Enemy[],limit=20):Co {
  let elapsed=0;
  while(nodes.some(n=>!n.dead)&&elapsed<limit){
    // Sealing needs an actual completed geometry hit; the input challenge itself never clears nodes.
    for(const node of nodes)if(!node.dead&&node.sealed>0)g.damage(node,99999,node.x,node.y,false,'ink');
    elapsed+=g.dt;yield;
  }
}
export const Sparrow:EnemyDef={
  name:'守晨',sprite:'b_sparrow_body',hp:1,score:100000,explosion:'xl',drops:['p','p'],hits:[[0,48,32]],boss:{name:'铜雀 · 守晨',phases:6},
  *ai(e,g){
    const start=e.data.startPhase??1;
    const wl=mark(g.attach(e,Wing,'wingL'),'red','刃 · 左翼根',e);
    const wr=mark(g.attach(e,Wing,'wingL',{mirror:true}),'red','刃 · 右翼根',e);
    const wings=[wl,wr];
    const tail=g.attach(e,{sprite:'b_sparrow_tail',hp:1,invulnerable:true,noCollide:true},'tail');
    const core=g.attach(e,{sprite:'b_sparrow_core',hp:1,invulnerable:true,noCollide:true},'core');
    const safeX=()=>wl.dead?230:wr.dead?670:450;
    yield* e.moveTo(450,250,2.5);sayLine(g,'M1-TQ-IN');
    if(start <= 1){
    e.data.weakWeapon='red';e.data.weakLabel='刃 · 翼根先断';
    yield* g.phase(e,{hp:650,time:20,name:'验令 · 断翼留路'},function*():Co{
      for(let k=0;;k++){
        const wing=wings[k%2];if(!wing.dead){const m=wing.anchor('gun2');g.laser(m.x,m.y,PI/2,{warn:1,duration:.5,width:7,color:'amber',follow:wing,anchor:'gun2'});}
        yield* g.wait(1.8/g.difficulty.aggression);
        // Missing wing permanently removes this side's gun; the body moves away from the safe side.
        yield* e.moveTo(wl.dead?540:wr.dead?360:450+(k%2?80:-80),250,.9);
      }
    });
    }
    if(start <= 2){
    const pillars=[230,450,670].map(x=>mark(g.spawn(SupplyPillar,x,390,p=>{p.data.contentRole='prop';}),'purple','印 · 供墨桩',e));
    e.data.weakWeapon='purple';e.data.weakLabel='印 · 三桩断供';
    yield* g.phase(e,{hp:700,time:22,name:'供墨三桩 · 封桩开核'},function*():Co{
      let k=0;
      while(pillars.some(p=>!p.dead)){
        for(const p of pillars){if(p.dead)continue;if(p.sealed>0){g.damage(p,99999,p.x,p.y,false,'ink');continue;}g.laser(p.x,p.y,PI/2,{warn:1,duration:.35,width:6,color:'amber',follow:p});}
        e.data.bodyPhase=`供墨 ${pillars.filter(p=>!p.dead).length}`;
        e.data.weakLabel='印 · 清桩缩短供墨';
        g.drop('ink',safeX(),600);yield* g.wait(2.5/g.difficulty.aggression);k++;
        // Ordinary hits remain effective; each removed pillar also strips health and a firing lane.
        const deadCount=pillars.filter(p=>p.dead).length;const prior=e.data.pillarsBroken??0;
        if(deadCount>prior){g.damage(e,(deadCount-prior)*120);e.data.pillarsBroken=deadCount;}
        if(k>10)break;
      }
      e.data.bodyPhase='core';e.data.weakLabel='印 · 核心开放';core.glow=2.3;
      for(;;){g.fan(e.x,e.y,PI/2,3,.8,105,{color:'magenta',shape:'orb'});yield* g.wait(2.3/g.difficulty.aggression);}
    });
    for(const p of pillars)if(!p.dead)g.remove(p);
    }
    if(start <= 3){
    e.data.weakWeapon='blue';e.data.weakLabel='流 · 俯冲后冷却颈';
    yield* e.moveTo(450,220,1);g.fx.charge(e.x,e.y,100,1,[.2,1,1]);
    const route=Math.max(160,Math.min(740,g.player.x));
    // Input gate lives outside timed phase scope, so damage/timeout cannot leave a stale QTE.
    e.invulnerable=true;
    const focused=yield* g.challenge({action:'focus',title:'返乡剑诀',hint:'集中使俯冲落空；失手可横移避开',duration:2.4});
    e.invulnerable=false;
    const diveLasers:ReturnType<G['laser']>[]=[];
    yield* g.phase(e,{hp:650,time:22,name:'返乡剑诀 · 集中避锋'},function*():Co{
      if(focused){e.data.bodyPhase='neck';e.data.weakLabel='流 · 冷却颈四秒';g.drop('ink',safeX(),620);yield* g.wait(4);}
      else{diveLasers.push(g.laser(route,270,PI/2,{warn:1,duration:.4,width:18,color:'cyan'}));yield* g.wait(1);yield* e.moveTo(route,650,.7);e.data.bodyPhase='neck';g.drop('ink',safeX(),650);yield* g.wait(2);}
      for(;;){
        yield* e.moveTo(450,240,1);const target=Math.max(160,Math.min(740,g.player.x));
        diveLasers.push(g.laser(target,270,PI/2,{warn:1,duration:.3,width:12,color:'cyan'}));yield* g.wait(1.4);
        e.data.bodyPhase='neck';g.drop('ink',safeX(),620);yield* g.wait(3/g.difficulty.aggression);
      }
    });
    for(const laser of diveLasers)laser.kill();
    }
    if(start <= 4){
    // Three silent transformation beats total 2.4 s; no attack task survives phase scope cancellation.
    g.clearBullets();sayLine(g,'M1-TQ-STRIP');
    tail.scaleX=1.25;g.fx.charge(e.x,e.y+100,120,.8,[1,.7,.2]);yield* g.wait(.8);
    for(const w of wings)if(!w.dead){w.alpha=.5;w.offRot=w.mirror?-.25:.25;}yield* g.wait(.8);
    tail.scaleX=.35;tail.scaleY=1.5;g.fx.burst(e.x,e.y+150,24,100,[1,.7,.2]);yield* g.wait(.8);
    const hilt=mark(g.attach(e,SwordHilt,[0,145]),'red','刃 · 尾剑柄',e);
    e.data.weakWeapon='red';e.data.weakLabel='刃 · 断柄缩扫';
    yield* g.phase(e,{hp:700,time:20,name:'尾羽化剑 · 走断翼侧'},function*():Co{
      for(let k=0;;k++){
        const side=k%2?1:-1;const spread=hilt.dead?.22:.65;
        g.laser(e.x,e.y+100,PI/2+side*spread,{warn:1.1,duration:.65,width:hilt.dead?7:14,color:'amber',follow:e,sweep:-side*.16});
        yield* g.wait(2.4/g.difficulty.aggression);
        yield* e.moveTo(safeX()===230?550:safeX()===670?350:450,240,.8);
      }
    });
    if(!hilt.dead)g.remove(hilt);
    }
    if(start <= 5){
    const calibration=[-95,95].map(dx=>mark(g.attach(e,Calibration,[dx,160]),'purple','印 · 旧友校准点',e));
    e.data.weakWeapon='purple';e.data.weakLabel='印 · 双点校准';
    yield* g.phase(e,{hp:650,time:20,name:'旧友校准 · 双点拆框'},function*():Co{
      sayLine(g,'M1-TQ-SHY',{spaced:true,after:'M1-TQ-STRIP'});
      let ticks=0;
      while(calibration.some(n=>!n.dead)){
        const next=calibration.find(n=>!n.dead)!;next.glow=2.5;g.fx.charge(next.x,next.y,32,1,[.2,1,1]);
        yield* clearNodes(g,calibration,2);
        if(ticks++%2===0)g.fan(e.x,e.y,PI/2,3,.9,90,{color:'magenta',shape:'orb'});
        // Automatic partner works on the marked point; player hits/seals speed up the calibration.
        if(!next.dead)g.damage(next,10,next.x,next.y,true);
      }
      e.data.bodyPhase='frame-off';core.glow=3;g.damage(e,200);g.drop('ink',450,620);
      for(;;){yield* g.wait(2);g.shoot(e.x,e.y,PI/2,100,{color:'magenta',shape:'big'});}
    });
    for(const node of calibration)if(!node.dead)g.remove(node);
    }
    e.data.weakWeapon='purple';e.data.weakLabel='印 · 蚀核闭环';
    yield* g.phase(e,{hp:350,time:12,name:'归晨一笔 · 蚀核显形'},function*():Co{
      for(;;){g.ring(e.x,e.y+48,6,70,{color:'magenta',shape:'orb',life:4});yield* g.wait(3);}
    });
    // The boss stays phase-locked during this explicit input + geometry gate. HP depletion
    // helps clear the exposed node; it cannot complete the ending without a fresh successful input.
    let complete=false;
    while(!complete){
      e.hp=e.maxHp=180;e.invulnerable=false;g.clearBullets();g.player.ink=1;
      const seal=mark(g.attach(e,Calibration,[0,180]),'purple','印 · 圈住返光核',e);seal.hp=seal.maxHp=50;seal.glow=3;
      const ok=yield* g.challenge({action:'brush',title:'归晨一笔',hint:'落笔后圈住蚀核；也可射破核后重试',duration:3});
      yield* clearNodes(g,[seal],ok?5:2);
      complete=ok&&seal.dead;
      if(!complete){
        sayLine(g,'M1-TQ-RETRY',{repeat:true});g.ring(e.x,e.y+48,6,65,{color:'magenta',shape:'orb',life:4});
        const recovery=[-75,0,75].map(dx=>mark(g.attach(e,Calibration,[dx,120]),'purple','印 · 恢复阵眼',e));
        yield* clearNodes(g,recovery,8);for(const n of recovery)if(!n.dead)g.remove(n);
        if(!seal.dead)g.remove(seal);g.drop('ink',safeX(),650);yield* g.wait(1);
      }
    }
    for(const w of wings)if(!w.dead)g.remove(w);
    e.data.bodyPhase='dawn';tail.alpha=.5;g.clearBullets();g.bg(0,0,3);g.bg(2,1,3);
  },
};
