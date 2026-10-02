import { normal } from './ordinary';
// 假航灯：蜃放出的假灯把云梭的行进路线引向灯的一侧；假灯撑满 6 秒云梭扣耐久，打灭后路线复原。
// 道中第三段先教一次，Boss 第三段再考，两处共用本文件的表现。
import type { Co } from '../game/api';
import type { Enemy,EnemyDef } from '../game/enemy';
import type { World } from '../game/world';
export const BEACON_LIMIT=6;
export const BeaconLight:EnemyDef={sprite:'c2_false-beacon',hp:18,noCollide:true,score:100,radius:50,
 onDeath(e,g){const s=g.scene('c2_false-beacon',e.x,e.y);s.frame=8;s.alpha=.5;s.layer='ground';const w=g as World,at=w.real;w.root.run((function*():Co{while(w.real-at<1.5)yield;s.dead=true;})());}};
export function spawnBeacon(g:World,x:number,y:number,master=false):Enemy{
 const n=g.spawn({...BeaconLight,hp:(master?60:18)/g.difficulty.hp},x,y,e=>{e.data.contentRole='part';e.data.noSupplementFire=true;e.data.c2Beacon=!master;e.data.c2Master=master;e.data.weakWeapon=master?'blue':undefined;e.data.weakLabel=master?undefined:'假航灯';e.data.manualFrame=true;});
 if(master)n.scaleX=n.scaleY=1.6;return n;
}
/** 假灯拉动云梭：跟随模式拉云梭的偏移；停泊模式直接拉船位。dir 为 -1 左、1 右。 */
export function pullFleet(g:World,lights:Enemy[]):void{
 const fleet=g.chapter2!.fleet,live=lights.filter(n=>!n.dead);if(!live.length)return;
 const dir=live.reduce((s,n)=>s+(n.x<450?-1:1)*(n.data.c2Master?70:40),0);
 if(fleet.follow){for(const p of fleet.pull)p.x=Math.max(-240,Math.min(240,p.x+dir*1.6*g.dt));}
 else fleet.scene.x=Math.max(80,Math.min(820,fleet.scene.x+dir*g.dt));
}
/** 一波假灯：返回 true 为在限时内全部打灭，false 为撑满限时、云梭受损且假灯消散。 */
export function* beaconWave(g:World,points:[number,number][],label=false):Generator<void,boolean>{
 const c=g.chapter2!,lights=points.map(([x,y])=>spawnBeacon(g,x,y)),ordinary=normal(g)&&c.part===3;for(const n of lights)n.data.beaconTether=ordinary;c.beaconLabel=label;c.beaconActive=true;c.log('beacon.wave');
 if(label)g.caption('','打灭假航灯 · 云梭正被引偏',5);
 let t=0,ring=1.5;
 for(;;){
  t+=g.dt;ring-=g.dt;if(!ordinary||t>=.6)pullFleet(g,lights);
  if(ring<=0){ring=3;for(const n of lights)if(!n.dead)g.ring(n.x,n.y,ordinary?Math.round(6/g.difficulty.count):6,ordinary?85/g.enemyBulletSpeed:60,{shape:'orb',color:'amber'});}
  if(lights.every(n=>n.dead)){c.beaconActive=false;c.beaconLabel=false;c.log('beacon.cleared');return true;}
  if(t>=BEACON_LIMIT){for(const n of lights)if(!n.dead)g.remove(n);c.fleet.hit(12);g.fx.shake(.3);c.beaconActive=false;c.beaconLabel=false;c.log('beacon.timeout');return false;}
  yield;
 }
}
