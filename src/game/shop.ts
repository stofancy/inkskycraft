import type { World } from './world';
import type { Progression } from './progression';
import type { WeaponColor } from '../types';

/** Supply is a temporary combat preparation, separate from automatic companion growth. */
export interface ShopCompanions { supply(amount?: number): void }
export type ShopItemId = 'ink-cache' | 'arrow-kit' | 'partner-supply' | 'blank-charm' | 'switch-seal' | 'magnet-spool' | 'return-scroll' | 'tide-flask' | 'seal-pin' | 'jade-tea';
export interface ShopItem {
  id: ShopItemId; name: string; description: string; cost: number;
  category: '墨术' | '兵装' | '守备'; count: number; state: string;
}
interface Goods extends Omit<ShopItem, 'count' | 'state'> {}
export const SHOP_GOODS: readonly Goods[] = [
  { id:'ink-cache', name:'储墨匣', description:'墨低于三成时自动补四成，限一次', cost:2, category:'墨术' },
  { id:'arrow-kit', name:'改轨矢', description:'追踪矢升一级，最多四级', cost:2, category:'兵装' },
  { id:'partner-supply', name:'伙伴补给匣', description:'四位伙伴立即执行职责动作', cost:3, category:'兵装' },
  { id:'blank-charm', name:'留白护符', description:'近身险弹触发清障与半秒护体，一次', cost:3, category:'守备' },
  { id:'switch-seal', name:'换招符', description:'主武器轮换一色，立即补墨一成五', cost:1, category:'兵装' },
  { id:'magnet-spool', name:'牵星丝', description:'四十五秒内吸附二百二十步内掉落', cost:2, category:'守备' },
  { id:'return-scroll', name:'回锋笺', description:'下次命中、清弹或封印收笔补墨二成二', cost:2, category:'墨术' },
  { id:'tide-flask', name:'潮生瓶', description:'泼墨补一发，最多七发', cost:2, category:'墨术' },
  { id:'seal-pin', name:'定影针', description:'下次封印成功，在收笔处落清弹阵', cost:2, category:'墨术' },
  { id:'jade-tea', name:'镜水茶', description:'立即補墨二成五，出发护体两秒', cost:1, category:'守备' },
];
export interface ShopState { inkReserve:number; wardCharges:number; magnetSeconds:number; returnCharges:number; sealCharges:number; purchases:number }

/** One chapter visit = one purchase or skip. Score and lives never pay for goods. */
export class ShopSystem {
  credits = 0;
  offers: ShopItem[] = [];
  readonly state: ShopState = { inkReserve:0, wardCharges:0, magnetSeconds:0, returnCharges:0, sealCharges:0, purchases:0 };
  private chapter = 0;
  private visits = new Set<number>();
  private killsAtVisit = 0;
  private grazeAtVisit = 0;
  constructor(readonly world: World, readonly progression: Progression, readonly companions?: ShopCompanions) {}
  resetRun():void {
    this.credits=0; this.state.purchases=0; this.resetStage();
  }
  resetStage():void {
    this.offers=[]; this.visits.clear(); this.chapter=0;
    this.killsAtVisit=0; this.grazeAtVisit=0;
    this.state.inkReserve=0; this.state.wardCharges=0; this.state.magnetSeconds=0;
    this.state.returnCharges=0; this.state.sealCharges=0;
  }
  /** chapter is 1..4; repeated or out-of-order callbacks cannot mint supplies. */
  offerChapter(chapter:number):ShopItem[] {
    if (!Number.isInteger(chapter)||chapter<1||chapter>4||this.visits.has(chapter)||chapter<=this.chapter) return this.offers;
    if(this.offers.length) return this.offers;
    this.chapter=chapter; this.visits.add(chapter);
    const accomplished=this.world.kills-this.killsAtVisit>=12 || this.world.graze-this.grazeAtVisit>=18;
    this.credits=Math.min(6,this.credits+2+(accomplished?1:0));
    this.killsAtVisit=this.world.kills; this.grazeAtVisit=this.world.graze;
    const eligible=SHOP_GOODS.filter(g=>this.available(g.id));
    const offset=((this.world.stageIndex-1)*3+(chapter-1)*3)%Math.max(1,eligible.length);
    const selected: Goods[]=[];
    for(let i=0;i<eligible.length&&selected.length<3;i++) {
      const g=eligible[(offset+i)%eligible.length];
      if(!selected.some(s=>s.category===g.category))selected.push(g);
    }
    for(let i=0;i<eligible.length&&selected.length<3;i++) {
      const g=eligible[(offset+i)%eligible.length]; if(!selected.includes(g))selected.push(g);
    }
    // At least one affordable item survives unusual capped inventories.
    if(selected.length && !selected.some(g=>g.cost<=this.credits)) {
      const cheap=eligible.find(g=>g.cost<=this.credits); if(cheap)selected[selected.length-1]=cheap;
    }
    this.offers=selected.map(g=>({...g,count:1,state:g.cost<=this.credits?'可采购':'补给不足'}));
    return this.offers;
  }
  private available(id:ShopItemId):boolean {
    const p=this.world.player,s=this.state;
    switch(id) {
      case 'ink-cache':return s.inkReserve===0;
      case 'arrow-kit':return p.missile<4;
      case 'partner-supply':return !!this.companions;
      case 'blank-charm':return s.wardCharges===0;
      case 'magnet-spool':return s.magnetSeconds===0;
      case 'return-scroll':return s.returnCharges===0;
      case 'seal-pin':return s.sealCharges===0;
      case 'tide-flask':return p.bombs<7;
      default:return true;
    }
  }
  purchase(id:string):boolean {
    const offer=this.offers.find(g=>g.id===id);
    if(!offer||offer.count!==1||this.credits<offer.cost||!this.available(offer.id))return false;
    const p=this.world.player,s=this.state;
    switch(offer.id) {
      case 'ink-cache':s.inkReserve=.4;break;
      case 'arrow-kit':p.missile=Math.min(4,p.missile+1);break;
      case 'partner-supply':this.companions!.supply(1);break;
      case 'blank-charm':s.wardCharges=1;break;
      case 'switch-seal': {
        const cycle:WeaponColor[]=['red','blue','purple'];p.weapon=cycle[(cycle.indexOf(p.weapon)+1)%3];p.ink=Math.min(1,p.ink+.15);break;
      }
      case 'magnet-spool':s.magnetSeconds=45;break;
      case 'return-scroll':s.returnCharges=1;break;
      case 'tide-flask':p.bombs=Math.min(7,p.bombs+1);break;
      case 'seal-pin':s.sealCharges=1;break;
      case 'jade-tea':p.ink=Math.min(1,p.ink+.25);p.invuln=Math.max(p.invuln,2);break;
    }
    this.credits-=offer.cost;s.purchases++;offer.count=0;offer.state='已采购';this.offers=[];
    return true;
  }
  skip():void {this.offers=[];}
  /** Run before collision; dt uses real combat time, with no menu time passage. */
  update(dt:number):void {
    if(!Number.isFinite(dt)||dt<=0)return;
    const w=this.world,p=w.player,s=this.state;
    if(!p.alive)return;
    if(s.inkReserve>0 && p.ink<.3 && !w.brush.active){p.ink=Math.min(1,p.ink+s.inkReserve);s.inkReserve=0;}
    if(s.magnetSeconds>0) {
      s.magnetSeconds=Math.max(0,s.magnetSeconds-dt);
      for(const it of w.items.list)if(!it.dead&&Math.hypot(it.x-p.x,it.y-p.y)<=220)it.homing=true;
    }
    if(s.wardCharges>0 && p.invuln<=0 && p.bombT<=0) {
      const threatened=w.bullets.list.some(b=>!b.dead&&Math.hypot(b.x-p.x,b.y-p.y)<=b.radius+p.hitR+22);
      if(threatened) {
        s.wardCharges--;p.invuln=.5;
        for(const b of w.bullets.list)if(!b.dead&&!b.hard&&Math.hypot(b.x-p.x,b.y-p.y)<100)b.dead=true;
        w.fx.shockwave(p.x,p.y,100,6,.35);
      }
    }
  }
  /** Called only by Brush.resolve after a stroke passes its length gate. */
  onBrushRelease(pts:readonly number[],hits:number,erased:number,sealed:number):void {
    const p=this.world.player,s=this.state;
    if(!p.alive || pts.length<8)return;
    // Actual combat results, independent of ink refunds or regeneration.
    if(s.returnCharges>0 && (hits>0 || erased>0 || sealed>0)) {
      s.returnCharges--;p.ink=Math.min(1,p.ink+.22);
    }
    if(s.sealCharges>0 && sealed>0) {
      const x=pts[pts.length-2],y=pts[pts.length-1];
      s.sealCharges--;this.progression.addField(x,y,95,1.6,0,true);
    }
  }
  snapshot():{credits:number;chapter:number;offers:ShopItem[];state:ShopState} {
    return {credits:this.credits,chapter:this.chapter,offers:this.offers.map(g=>({...g})),state:{...this.state}};
  }
}
