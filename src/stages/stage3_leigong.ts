import type { EnemyDef } from '../game/enemy';
import { PI,clamp } from './stage3_enemies';
import { LightningPillar } from './stage3_extra';
const Hammer:EnemyDef={sprite:'s3_node',hp:160,score:3000,noCollide:true,drops:'ink'};
export const Leigong:EnemyDef={sprite:'m_leigong',hp:1,score:30000,noCollide:true,drops:['1up','ink'],boss:{name:'雷公 · 原签审判',phases:2},*ai(e,g){const start=e.data.startPhase??1;e.invulnerable=true;yield* e.moveTo(450,210,1.5);g.caption('雷公','紧急原签，从未更新。',3);
    if(start <= 1){
const hs=[g.attach(e,Hammer,[-135,155]),g.attach(e,Hammer,[135,155])];hs.forEach(n=>{n.data.contentRole='part';n.data.weakWeapon='red';n.data.weakLabel='刃 · 断锤停侧击';n.data.linkTo=e.id;});
 yield* g.phase(e,{hp:1100,time:32,name:'雷公双锤 · 拆一锤留一路'},function*(){e.invulnerable=false;for(let k=0;;k++){const h=hs[k%2];if(!h.dead){const x=clamp(g.player.x);g.fx.charge(x,650,45,1,[1,.4,.3]);yield* g.wait(1);g.laser(x,0,PI/2,{warn:1,duration:.25,width:14,color:'cyan'});}if(hs.every(n=>n.dead)){e.hp=0;return;}yield* g.wait(1.2/g.difficulty.aggression);}});for(const n of hs)if(!n.dead)g.remove(n);
    }
 const drum=g.attach(e,{sprite:'e_drum',hp:260,noCollide:true,score:4000},[0,175]);drum.data.contentRole='part';drum.data.weakWeapon='purple';drum.data.weakLabel='印 · 拆鼓心';drum.data.bodyPhase='fin';drum.data.linkTo=e.id;
 yield* g.phase(e,{hp:1000,time:32,name:'鼓心原签 · 引雷或直接拆心'},function*(){e.invulnerable=true;for(let k=0;;k++){if(drum.dead){e.hp=0;return;}const p=g.spawn(LightningPillar,450,540,n=>{n.data.contentRole='prop';});g.ring(drum.x,drum.y,7,85,{color:'magenta',shape:'orb'},k*.3);yield* g.wait(4/g.difficulty.aggression);if(!p.dead)g.remove(p);}});if(!drum.dead)g.remove(drum);g.caption('雷公','原签交还，撤律有据。',2);
}};
