// 菜单题字按文字查询运行时 manifest，追加或更新字图后随页面加载生效。
interface LetteringEntry {
  text: string;
  style: string;
  palette: string;
  status: string;
  url: string;
  pixelSize: number[];
  contentBox: number[];
}
let entries: LetteringEntry[] = [];
const normalize = (text: string) => text.replace(/\s+/g, '');

export async function loadMenuLettering(): Promise<void> {
  const response = await fetch('/art/lettering/manifest.json');
  if (!response.ok) throw new Error(`菜单题字清单加载失败：${response.status}`);
  entries = (await response.json()).entries;
}

export function applyMenuLettering(root: HTMLElement): void {
  for (const el of root.querySelectorAll<HTMLElement>('.ttl,.ph1')) {
    const text = el.dataset.lettering ?? el.textContent ?? '';
    const logo = el.classList.contains('ttl');
    const entry = entries.findLast(e => normalize(e.text) === normalize(text) && e.palette === 'paper' && e.style === (logo ? 'swift' : 'weibei') && e.status === 'ready');
    if (!entry || el.dataset.letteringUrl === entry.url) continue;
    const minHeight = logo ? 1.05 : el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).fontSize);
    const fallback = [...el.childNodes].map(node => node.cloneNode(true));
    const img = new Image();
    img.className = 'menu-lettering';
    img.alt = '';
    img.src = entry.url;
    img.onerror = () => {
      el.classList.remove('lettered');
      el.style.removeProperty('min-height');
      el.replaceChildren(...fallback);
      delete el.dataset.letteringUrl;
    };
    // 用可见字高定字号，保留 PNG 的透明外留白与自然宽高比。
    img.style.width = `${entry.pixelSize[0] / entry.contentBox[3]}em`;
    img.style.height = `${entry.pixelSize[1] / entry.contentBox[3]}em`;
    el.style.minHeight = `${minHeight}em`;
    el.dataset.lettering = text;
    el.dataset.letteringUrl = entry.url;
    el.setAttribute('role', 'heading');
    el.setAttribute('aria-level', logo ? '1' : '2');
    el.setAttribute('aria-label', text.trim());
    el.classList.add('lettered');
    el.replaceChildren(img);
  }
}
