import { CONFIG } from './config';

/** 950 -> "950", 1234 -> "1.23K", 3.4e6 -> "3.40M", 5.6e12 -> "5.60e12". */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 10) return trimZeros(n.toFixed(1));
  if (n < 1000) return String(Math.floor(n));
  if (n >= CONFIG.format.scientificFrom) {
    const exp = Math.floor(Math.log10(n));
    let mant = n / 10 ** exp;
    if (mant >= 9.995) return `1.00e${exp + 1}`;
    return `${mant.toFixed(2)}e${exp}`;
  }
  const suffixes = CONFIG.format.suffixes;
  let tier = Math.floor(Math.log10(n) / 3);
  if (tier >= suffixes.length) tier = suffixes.length - 1;
  let scaled = n / 1000 ** tier;
  // 999.96K would round to "1000K"; promote to the next tier instead
  if (scaled >= 999.995 && tier + 1 < suffixes.length) {
    tier += 1;
    scaled = n / 1000 ** tier;
  }
  const digits = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
  return scaled.toFixed(digits) + suffixes[tier];
}

function trimZeros(s: string): string {
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

export function fmtPct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
