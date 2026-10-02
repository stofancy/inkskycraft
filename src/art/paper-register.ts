// 纸龙第三段专用画面；判定与生命仍由关卡中的条目部件负责。
const asset = (name: string) => `${import.meta.env.BASE_URL}art/bosses/ch1/register/${name}.png`;
export interface RegisterTag {
 x: number; y: number; name: string; hp: number; hpFrac: number; burnedAt: number;
}

export function paperRegisterSvg(rows: RegisterTag[], time: number, o: { cx: number; top: number; lit: number }): string {
 const K = .7, W = 266, H = 250;
 let svg = `<defs>
 <filter id="register-char"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope=".22"/><feFuncG type="linear" slope=".18"/><feFuncB type="linear" slope=".16"/></feComponentTransfer></filter>
 <linearGradient id="register-curl"><stop stop-color="#211a14"/><stop offset=".45" stop-color="#8b6945"/><stop offset=".7" stop-color="#cab084"/><stop offset="1" stop-color="#33251a"/></linearGradient>
 </defs><image data-register-scroll href="${asset('scroll')}" x="${o.cx - W / 2}" y="${o.top}" width="${W}" height="${H}" preserveAspectRatio="none"/>
 <text x="${o.cx}" y="${o.top + 52}" text-anchor="middle" font-size="22" fill="#9d3423">查封令</text>`;
 rows.forEach((row, i) => {
  const lit = o.lit === i && row.hp > 0, dead = row.hp <= 0, age = dead ? Math.max(0, time - row.burnedAt) : 0;
  if (dead && age >= .8) return;
  const curl = dead ? Math.min(1, age / .8) : 0;
  const left = row.x - 93 * K, top = row.y - 28 * K, width = 186 * K * (1 - curl);
  const edge = left + width, damage = dead ? 1 : Math.max(0, 1 - row.hpFrac);
  const opacity = dead ? 1 - curl : 1;
  // 标签的可见宽度对应原有五个半径23的命中圆，中心与64像素行距保持原值。
  const clip = `register-tag-${i}`, charClip = `register-char-${i}`;
  svg += `<defs><clipPath id="${clip}"><rect x="${left}" y="${top}" width="${width}" height="${56 * K}"/></clipPath>
   <clipPath id="${charClip}"><rect x="${edge - Math.max(12, damage * width)}" y="${top}" width="${Math.max(12, damage * width)}" height="${56 * K}"/></clipPath></defs>
   <g data-register-tag="${i}" data-burned="${dead}" opacity="${opacity}">
   ${lit ? `<rect x="${left - 6}" y="${top - 6}" width="${186 * K + 12}" height="${56 * K + 12}" rx="6" fill="#ff3a1a" fill-opacity="${.25 + .25 * Math.sin(time * 10)}" stroke="#ff6a30" stroke-width="${3 + 2 * Math.sin(time * 12)}"/>` : ''}
   <g clip-path="url(#${clip})"><image href="${asset('ship-tag')}" x="${left}" y="${top}" width="${186 * K}" height="${56 * K}" preserveAspectRatio="none"/>
   ${damage > 0 ? `<image href="${asset('ship-tag')}" x="${left}" y="${top}" width="${186 * K}" height="${56 * K}" preserveAspectRatio="none" clip-path="url(#${charClip})" filter="url(#register-char)"/>` : ''}
   <text x="${row.x}" y="${row.y + 12 * K}" text-anchor="middle" font-size="${33 * K}" fill="${dead ? '#b99b72' : '#38251b'}">${row.name}</text></g>`;
  if (dead) {
   // 焦边从右往左卷成筒；余烬沿卷边跳动，整张签在原有0.8秒内消失。
   const height = 38 * K * (1 - curl * .3), y = row.y + 5 * K;
   svg += `<ellipse cx="${edge}" cy="${y}" rx="${4 + 7 * curl}" ry="${height / 2}" fill="url(#register-curl)" stroke="#241b15" stroke-width="2"/>`;
   for (let j = 0; j < 5; j++) {
    const fy = y - height / 2 + j * height / 4, flicker = 3 + 4 * (1 + Math.sin(time * 27 + j * 2 + i));
    svg += `<path d="M${edge - 3} ${fy + 5}q${flicker} -3 ${flicker + 4} -11q-1 10 -${flicker} 16Z" fill="#e66e25"/><path d="M${edge - 2} ${fy + 4}q5 -1 6 -6l-2 9Z" fill="#ffce72"/>`;
   }
  }
  svg += '</g>';
 });
 return svg;
}
