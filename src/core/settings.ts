import { DEFAULT_SETTINGS, type Settings } from '../types';

const KEY = 'inksky.settings.v1';
const HI_KEY = 'inksky.hiscore.v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* 隐私模式等 */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 忽略 */ }
}

export function loadHiScore(): number {
  try { return Number(localStorage.getItem(HI_KEY)) || 0; } catch { return 0; }
}

export function saveHiScore(v: number): void {
  try { localStorage.setItem(HI_KEY, String(Math.floor(v))); } catch { /* 忽略 */ }
}
