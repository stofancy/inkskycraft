import type { Co, G } from '../game/api';
import type { Enemy, EnemyDef } from '../game/enemy';
const PI=Math.PI;
const Node:EnemyDef={sprite:'s2_node',hp:90,score:600,noCollide:true,explosion:'s'};
const Pearl:EnemyDef={sprite:'b_mirage_pearl',hp:100000,score:0,noCollide:true};
const Shell:EnemyDef={sprite:'b_mirage_shell',hp:1,invulnerable:true,noCollide:true};
const Head:EnemyDef={sprite:'b_mirage_head',hp:1,invulnerable:true,noCollide:true};
function part(g:G,e:Enemy,x:number,y:number,weapon:'red'|'blue'|'purple',label:string,hp=90):Enemy {
 const n=g.attach(e,Node,[x,y]);n.hp=n.maxHp=hp;n.data.weakWeapon=weapon;n.data.weakLabel=label;n.data.linkTo=e;n.data.contentRole='part';return n;
}
const finished=(n:Enemy)=>n.dead||n.sealed>0;
function erase(g:G,n:Enemy):void{if(!n.dead)g.remove(n);}
/** 结构目标必须真实击破/圈封，时限只结束常规攻击，收尾保留安全可击窗口。 */
function* resolve(g:G,nodes:Enemy[],label:string):Co {
 g.clearBullets();g.caption('青璃',label,2.4);g.player.ink=Math.max(g.player.ink,0.7);
 while(nodes.some(n=>!finished(n))){yield* g.wait(0.5);}
 nodes.forEach(n=>erase(g,n));
}
function* aimed(e:Enemy,g:G,interval=2.8):Co {
 for(;;){g.fx.charge(e.x,e.y+150,50,0.9,[0.2,1.2,1.4]);yield* g.wait(0.9);g.fan(e.x,e.y+150,g.aim(e.x,e.y+150),3,0.7,160,{shape:'rice',color:'cyan'});yield* g.wait(interval/g.difficulty.aggression);}
}
export const Pagoda:EnemyDef={sprite:'m_pagoda',hp:1,score:30000,drops:['medal','ink'],explosion:'xl',invulnerable:true,boss:{name:'宝塔 · 锁名断链',phases:3},
 *ai(e,g):Co {const start=e.data.startPhase??1;yield* e.moveTo(450,210,2);
    if(start <= 1){
const chains=[part(g,e,-220,160,'red','下层链'),part(g,e,220,180,'red','中层链'),part(g,e,0,225,'purple','上层锁')];
 yield* g.phase(e,{hp:650,time:20,name:'逐层断链'},function*():Co{for(;;){for(let i=0;i<chains.length;i++){if(!finished(chains[i]))g.laser(chains[i].x,chains[i].y,PI/2,{warn:1,duration:0.6,width:7,color:'violet',follow:chains[i]});else{chains[i].alpha=0.25;e.scaleY=1-0.12*chains.filter(finished).length;}}yield* g.wait(3/g.difficulty.aggression);}});
 yield* resolve(g,chains,'射断三链，塔层才会下沉。');
    }
    if(start <= 2){
 yield* g.phase(e,{hp:300,time:6,name:'断层下沉'},function*():Co{e.scaleY=0.6;g.fx.burst(e.x,e.y,25,120,[0.5,1.2,1.3]);yield* g.wait(1);yield* e.moveTo(450,300,1);yield* g.wait(4);});
    }
 const core=part(g,e,0,140,'blue','塔心散热',200);yield* g.phase(e,{hp:500,time:18,name:'原契塔心'},function*():Co{yield* aimed(e,g,3);});yield* resolve(g,[core],'塔心已露，取回原契。');e.scaleY=1;
 }};
export const Mirage:EnemyDef={sprite:'b_mirage_body',hp:1,score:80000,explosion:'xl',invulnerable:true,boss:{name:'蜃 · 藏灯',phases:6},
 *ai(e,g):Co {
 const start=e.data.startPhase??1;let dock=-1;
 yield* e.moveTo(450,230,2.4);
 const left=g.attach(e,Shell,[-255,-25]);const right=g.attach(e,Shell,[255,-25],{mirror:true});g.attach(e,Head,[0,-65]);
 const pearl=g.attach(e,Pearl,[0,185]);pearl.phaseLock=true;pearl.data.weakWeapon='blue';pearl.data.weakLabel='实珠 · 双波纹';pearl.data.linkTo=e;
 e.run((function*():Co{for(;;){const d=pearl.maxHp-pearl.hp;pearl.hp=pearl.maxHp;if(!pearl.invulnerable)e.hp-=d;yield;}})());
 const open=(yes:boolean)=>{pearl.invulnerable=!yes;pearl.alpha=yes?1:0.45;};
    if(start <= 1){
 // 一：实珠始终有无遮挡窗口，空框幻珠可射/可封，消失后削减扰射。
 const phantoms=[part(g,e,-240,190,'purple','虚珠 · 空框',65),part(g,e,240,190,'purple','虚珠 · 空框',65)];phantoms.forEach(n=>{n.alpha=0.45;});open(true);
 yield* g.phase(e,{hp:700,time:20,name:'听潮辨珠'},function*():Co{for(;;){for(const p of phantoms)if(!finished(p))g.shoot(p.x,p.y,PI/2,100,{shape:'orb',color:'violet'});g.fan(pearl.x,pearl.y,g.aim(pearl.x,pearl.y),3,0.6,150,{shape:'rice',color:'cyan'});yield* g.wait(2.8/g.difficulty.aggression);}});phantoms.forEach(n=>erase(g,n));
    }
    if(start <= 2){
 // 二：首次破壳永久决定安全侧；剩余壳只压自身一侧。
 open(false);const hinges=[part(g,e,-290,210,'red','左壳铰链',150),part(g,e,290,210,'red','右壳铰链',150)];let chosen=false;
 yield* g.phase(e,{hp:650,time:22,name:'拆壳渡口'},function*():Co{for(;;){for(let i=0;i<2;i++){if(finished(hinges[i])){if(!chosen){dock=i===0?-1:1;chosen=true;} (i===0?left:right).alpha=0.22;}else g.laser(hinges[i].x,hinges[i].y,PI/2,{warn:1.1,duration:0.55,width:10,color:'red',follow:hinges[i]});}yield* g.wait(3.5/g.difficulty.aggression);}});
 // 在阶段超时后继续接收破壳顺序，影响救舟侧。
 while(hinges.every(n=>!finished(n)))yield* g.wait(0.2);if(!chosen){dock=finished(hinges[0])?-1:1;chosen=true;}
 yield* resolve(g,hinges,'两侧壳可拆，水道将永久开放。');left.alpha=right.alpha=0.18;
    }
 const shellExit=dock;
 if(start>=3)left.alpha=right.alpha=.18;
    if(start <= 3){
 // 三：首个节点决定资源停靠位置，逐点断链反馈。
 const towers=[part(g,e,-245,230,'purple','西楼锁名',100),part(g,e,0,265,'purple','中楼锁名',100),part(g,e,245,230,'purple','东楼锁名',100)];let supply=false;const released=new Set<number>();
 const release=()=>{towers.forEach((n,i)=>{if(finished(n)&&!released.has(i)){released.add(i);g.fx.burst(n.x,n.y,24,150,[0.5,1.3,1.4]);if(!supply){supply=true;dock=i===0?-1:i===2?1:dock;g.drop('ink',n.x,n.y+200);}erase(g,n);}});};
 yield* g.phase(e,{hp:700,time:20,name:'三楼锁名'},function*():Co{for(;;){release();for(const n of towers)if(!finished(n))g.shoot(n.x,n.y,PI/2,115,{shape:'orb',color:'violet'});yield* g.wait(2.7/g.difficulty.aggression);}});
 g.clearBullets();g.player.ink=1;while(towers.some(n=>!finished(n))){release();yield* g.wait(0.2);}release();
    }
 // 四：新按集中稳住倒影；失败潮墙预告后缓推向先破壳渡口，玩家可逆流横移。
 for(let round=0;round<2;round++){
 if(start>4+round)continue;
 g.clearBullets();open(false);const success=yield* g.challenge({action:'focus',title:'潮声反制',hint:'新按集中稳住倒影；失手沿破壳侧绕潮',duration:2.4});
 if(!success){
  g.caption('青璃',shellExit<0?'潮流将推向左侧渡口。':'潮流将推向右侧渡口。',2.5);
  g.fx.charge(450,740,150,1,[0.2,1.2,1.4]);
  g.fx.push(450,740,shellExit*90,0,160);
  g.laser(shellExit<0?650:250,440,PI/2,{warn:1.1,duration:0.6,width:35,color:'cyan'});
  g.player.ink=Math.max(g.player.ink,0.65);
  yield* g.wait(1);
  g.force({x:450,y:760,radius:950,strength:55,duration:1.5,mode:'wind',vx:shellExit,vy:0});
  yield* g.wait(1.5);
 }
 open(true);yield* g.phase(e,{hp:success?480:380,time:success?9:7,name:'潮声 · 开珠'},function*():Co{yield* aimed(e,g,3.5);});}
 // 五：三拍停火变形，全程保留移动。
 g.clearBullets();open(false);g.caption('藏灯','壳开成镜，灯舟入河。',2.4);
 left.offRot=-0.55;right.offRot=0.55;yield* g.wait(0.8);pearl.offY=240;g.fx.burst(pearl.x,pearl.y,25,130,[0.5,1.3,1.8]);yield* g.wait(0.8);
 const rescue=g.spawn({sprite:'s2_rescueboat',hp:1,invulnerable:true,noCollide:true},450+dock*220,640,n=>{n.data.contentRole='prop';});yield* g.wait(0.8);
 const saved=yield* g.challenge({action:'bomb',title:'断镜救舟',hint:'新按爆发破镜；失手射断两座镜架',duration:2.2});
 if(!saved){const braces=[part(g,e,-230,285,'red','左镜架',90),part(g,e,230,285,'red','右镜架',90)];g.laser(450,410,PI/2,{warn:1.2,duration:0.45,width:12,color:'red'});yield* g.wait(1.8);yield* resolve(g,braces,'射断镜架，救舟航线仍可打开。');}else{g.drop('ink',rescue.x,rescue.y);e.data.rescueBoost=true;}
 rescue.vy=-70;e.data.rescueSide=dock;open(true);
 yield* g.phase(e,{hp:600,time:14,name:'灯舟开路'},function*():Co{for(;;){g.fan(450-dock*220,400,PI/2,3,0.7,140,{shape:'rice',color:'cyan'});yield* g.wait(3/g.difficulty.aggression);}});
 // 六：输入与可见封阵都完成后才退出。失败清三眼补墨重试，时限不能结算。
 open(false);for(;;){g.clearBullets();g.player.ink=1;
 const success=yield* g.challenge({action:'brush',title:'还名一笔',hint:'有效落笔后圈封姓名珠；失手清三眼回墨重试',duration:3});
 if(success){const name=part(g,e,0,280,'purple','姓名圆阵 · 圈封',95);yield* resolve(g,[name],'圈住姓名圆阵，把名字归还本人。');break;}
 const retry=[part(g,e,-240,285,'purple','姓名阵眼',60),part(g,e,0,320,'purple','姓名阵眼',60),part(g,e,240,285,'purple','姓名阵眼',60)];
 g.laser(450-dock*200,410,PI/2,{warn:1.2,duration:0.4,width:8,color:'violet'});yield* g.wait(1.7);yield* resolve(g,retry,'三眼可射可封，清除后再落笔。');
 }
 erase(g,pearl);erase(g,rescue);g.clearBullets();g.caption('藏灯','让他们自己选归处。',2.4);g.fx.burst(e.x,e.y,70,200,[0.4,1.5,1.7]);
 }};
