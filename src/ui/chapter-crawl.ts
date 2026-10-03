// 原文：studio/specs/story.md「每关开头的旁白滚屏」。
const CHAPTERS = [
  {
    "title": "第一章 出镖",
    "paragraphs": [
      "很久以前，大地沉进了云海。人们住在一座座浮山上，靠山根里的雷石浮在天上。雷石用完了，山就会往下沉。",
      "青石屿的雷石快用完了。屿上三百多口人挤上一艘旧云梭，要飞到天门之上的高天去，重新安家。",
      "这趟镖没有钱，大镖局都不肯接。最后接下它的，是快要关门的朱雀镖局，和镖局里最后一位镖师——十七岁的小满。",
      "从青石屿到天门，先要穿过风筝帮占着的浮石林。风筝帮帮主雷公，已经盯上了这艘云梭……"
    ]
  },
  {
    "title": "第二章 蜃海",
    "paragraphs": [
      "小满打退了风筝帮，闯过了铜雀关。路上，她的师姐赤燕和守关的老镖师老盾，都加入了护镖的队伍。",
      "关外是一片望不到边的云海。海里住着一只蜃，会吐出假的灯火和港口。船要是跟着假灯走，就再也出不来了。",
      "在雾里采光为生的机械鸟墨鸢，认得真灯和假灯。只有跟着她，云梭才能穿过蜃海……"
    ]
  },
  {
    "title": "第三章 天门",
    "paragraphs": [
      "云梭穿过了蜃海，天门已经不远了。",
      "可天门前横着一片雷场，风筝帮帮主雷公就守在那里。他把天上的雷石都收进自己手里，谁给得起钱，他才放谁过去。",
      "就算闯过雷场，天门底下还有守门的鲲鹏。只有在它面前写下完整的镖局字号，天门才会打开。",
      "小满和伙伴们，要护着三百多口人，走完这最后一段路……"
    ]
  }
];

/** 一次开章只创建一组 DOM；文字沿倾斜平面退向云海深处。 */
export class ChapterCrawl {
  private root = document.createElement('div');
  private text = document.createElement('div');
  private elapsed = 0;
  private travel = 0;
  private height = 0;
  readonly duration = 30;
  constructor(chapter: number) {
    const story = CHAPTERS[chapter - 1];
    this.root.className = 'chapter-crawl';
    Object.assign(this.root.style, {
      position: 'fixed', inset: '0', zIndex: '50', overflow: 'hidden',
      background: 'linear-gradient(#071418bb, #101b20a8 65%, #11191bdd)',
      color: '#eddaa4', fontFamily: 'InkskyFangsong, serif', pointerEvents: 'none',
    });
    const view = document.createElement('div');
    Object.assign(view.style, {
      position: 'absolute', inset: '0', perspective: '650px', perspectiveOrigin: '50% 28%',
      maskImage: 'linear-gradient(transparent 8%, #000 28%, #000 90%, transparent)',
    });
    const plane = document.createElement('div');
    Object.assign(plane.style, {
      position: 'absolute', top: '0', left: '50%', width: 'min(78vw, 650px)', height: '100%',
      transform: 'translateX(-50%) rotateX(32deg)', transformOrigin: '50% 75%', transformStyle: 'preserve-3d',
    });
    Object.assign(this.text.style, {
      fontSize: 'clamp(24px, 3.6vh, 38px)', lineHeight: '1.85', letterSpacing: '.08em',
      textAlign: 'justify', textShadow: '0 2px 8px #000', willChange: 'transform',
    });
    const title = document.createElement('h1');
    title.textContent = story.title;
    Object.assign(title.style, { fontSize: '1.35em', textAlign: 'center', fontWeight: '400', margin: '0 0 1.4em', letterSpacing: '.2em' });
    this.text.append(title);
    for (const paragraph of story.paragraphs) {
      const p = document.createElement('p'); p.textContent = paragraph;
      p.style.margin = '0 0 1.2em'; this.text.append(p);
    }
    const hint = document.createElement('div'); hint.textContent = '任意键跳过';
    Object.assign(hint.style, { position: 'absolute', bottom: '4%', width: '100%', textAlign: 'center', fontSize: '16px', letterSpacing: '.25em', color: '#e6dec2aa' });
    plane.append(this.text); view.append(plane); this.root.append(view, hint); document.body.append(this.root);
    this.height = window.innerHeight;
    this.travel = this.height + this.text.offsetHeight + 500;
    this.update(0);
  }
  update(dt: number): boolean {
    this.elapsed += dt;
    const progress = Math.min(1, this.elapsed / this.duration);
    this.text.style.transform = `translateY(${this.height - progress * this.travel}px)`;
    this.root.style.opacity = String(Math.min(1, this.elapsed / .8, (this.duration - this.elapsed) / 1.5));
    return this.elapsed >= this.duration;
  }
  dispose(): void { this.root.remove(); }
}
