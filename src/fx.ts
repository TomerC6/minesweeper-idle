// Particle effects on one full-window canvas: bursts, confetti, and coins flying to the counter.

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string;
  gravity: number; spin: number; angle: number; shape: 'dot' | 'diamond' | 'rect' | 'ring' | 'star';
  grow?: number;
}

interface Flyer {
  x0: number; y0: number; cx: number; cy: number; target: HTMLElement;
  t: number; dur: number; color: string; size: number; onArrive?: () => void;
}

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.createElement('canvas');
canvas.className = 'fx';
document.body.append(canvas);
const ctx = canvas.getContext('2d')!;
let particles: Particle[] = [];
let flyers: Flyer[] = [];
let running = false;
let last = 0;

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
addEventListener('resize', resize);

export function cssColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#c90';
}

function start() {
  if (running) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(step);
}

function step(now: number) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); // rAF time can trail performance.now()
  last = now;
  ctx.clearRect(0, 0, innerWidth, innerHeight);

  particles = particles.filter(p => (p.life += dt) < p.max);
  for (const p of particles) {
    p.vy += p.gravity * dt;
    p.vx *= 0.985;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.angle += p.spin * dt;
    const k = p.life / p.max;
    ctx.globalAlpha = Math.max(0, 1 - k);
    if (p.shape === 'ring') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(0.5, 6 * (1 - k));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size + (p.grow ?? 100) * (1 - (1 - k) ** 3), 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = p.color;
    drawShape(p.x, p.y, p.size, p.shape, p.angle);
  }

  flyers = flyers.filter(f => {
    f.t += dt / f.dur;
    const r = f.target.getBoundingClientRect();
    const x1 = r.left + r.width / 2, y1 = r.top + r.height / 2;
    if (f.t >= 1) {
      f.onArrive?.();
      return false;
    }
    // ease-in quadratic Bezier toward the counter
    const t = f.t * f.t;
    const x = (1 - t) ** 2 * f.x0 + 2 * (1 - t) * t * f.cx + t * t * x1;
    const y = (1 - t) ** 2 * f.y0 + 2 * (1 - t) * t * f.cy + t * t * y1;
    ctx.globalAlpha = 1;
    ctx.fillStyle = f.color;
    drawShape(x, y, f.size, 'diamond', 0);
    return true;
  });

  ctx.globalAlpha = 1;
  if (particles.length || flyers.length) requestAnimationFrame(step);
  else {
    running = false;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
  }
}

function drawShape(x: number, y: number, s: number, shape: Particle['shape'], angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (shape === 'dot') {
    ctx.beginPath();
    ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === 'diamond') {
    ctx.beginPath();
    ctx.moveTo(0, -s / 2);
    ctx.lineTo(s / 2.6, 0);
    ctx.lineTo(0, s / 2);
    ctx.lineTo(-s / 2.6, 0);
    ctx.closePath();
    ctx.fill();
  } else if (shape === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? s / 6 : s / 2;
      const a = (i * Math.PI) / 4;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(-s / 2, -s / 4, s, s / 2);
  }
  ctx.restore();
}

export function centerOf(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function burst(x: number, y: number, color: string, count = 12, speed = 220, shape: Particle['shape'] = 'dot') {
  if (reduced) return;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.8);
    particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3,
      life: 0, max: 0.45 + Math.random() * 0.4, size: 3 + Math.random() * 4,
      color, gravity: 600, spin: (Math.random() - 0.5) * 12, angle: 0, shape,
    });
  }
  start();
}

export function confetti(x: number, y: number) {
  if (reduced) return;
  const colors = ['--gold', '--shield', '--good', '--heat', '--n4'].map(cssColor);
  for (let i = 0; i < 90; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
    const v = 350 + Math.random() * 450;
    particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: 0, max: 1.4 + Math.random() * 0.8, size: 6 + Math.random() * 6,
      color: colors[i % colors.length], gravity: 700, spin: (Math.random() - 0.5) * 18, angle: Math.random() * 6, shape: 'rect',
    });
  }
  start();
}

/** Coins fly from a point to a counter element; onArrive runs as each lands. */
export function fly(x0: number, y0: number, target: HTMLElement, count: number, color: string, onArrive?: () => void) {
  if (reduced) {
    for (let i = 0; i < count; i++) onArrive?.();
    return;
  }
  for (let i = 0; i < count; i++) {
    flyers.push({
      x0: x0 + (Math.random() - 0.5) * 16, y0: y0 + (Math.random() - 0.5) * 16,
      cx: x0 + (Math.random() - 0.5) * 220, cy: y0 - 80 - Math.random() * 120,
      target, t: -i * 0.06, dur: 0.55 + Math.random() * 0.2, color, size: 10, onArrive,
    });
  }
  start();
}

export function shake(el: HTMLElement, strength = 6, ms = 320) {
  if (reduced) return;
  const frames = Array.from({ length: 8 }, (_, k) => {
    const s = strength * (1 - k / 8);
    return { transform: `translate(${(Math.random() - 0.5) * 2 * s}px, ${(Math.random() - 0.5) * 2 * s}px)` };
  });
  el.animate([...frames, { transform: 'none' }], { duration: ms, easing: 'ease-out' });
}

export function pop(el: Element, scale = 1.15, ms = 180) {
  if (reduced) return;
  el.animate([{ transform: 'scale(1)' }, { transform: `scale(${scale})` }, { transform: 'scale(1)' }], { duration: ms, easing: 'ease-out' });
}

export function flash(el: HTMLElement, color: string) {
  if (reduced) return;
  el.animate([{ boxShadow: `0 0 0 0 ${color}` }, { boxShadow: `0 0 0 12px transparent` }], { duration: 500, easing: 'ease-out' });
}

export function shockwave(x: number, y: number, color: string, radius = 120, ms = 600) {
  if (reduced) return;
  particles.push({ x, y, vx: 0, vy: 0, life: 0, max: ms / 1000, size: 6, color, gravity: 0, spin: 0, angle: 0, shape: 'ring', grow: radius });
  start();
}

export function sparkle(x: number, y: number, color: string, count = 6, spread = 26) {
  if (reduced) return;
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread,
      vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 60,
      life: 0, max: 0.5 + Math.random() * 0.5, size: 8 + Math.random() * 8,
      color, gravity: -20, spin: (Math.random() - 0.5) * 4, angle: Math.random(), shape: 'star',
    });
  }
  start();
}

/** Stone chunks thrown out by an explosion. */
export function debris(x: number, y: number, count = 18) {
  if (reduced) return;
  const tones = ['#4d4339', '#362f28', '#75675a', '#1d1915'];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 200 + Math.random() * 380;
    particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 200,
      life: 0, max: 0.9 + Math.random() * 0.6, size: 6 + Math.random() * 9,
      color: tones[i % tones.length], gravity: 1100, spin: (Math.random() - 0.5) * 20, angle: Math.random() * 6, shape: 'rect',
    });
  }
  start();
}

/** A full-screen colour flash, for explosions and big wins. */
export function flashScreen(color: string, ms = 380, strength = 0.55) {
  if (reduced) return;
  const el = document.createElement('div');
  el.className = 'flash';
  el.style.background = `radial-gradient(circle at 50% 45%, ${color}, transparent 75%)`;
  document.body.append(el);
  el.animate([{ opacity: strength }, { opacity: 0 }], { duration: ms, easing: 'ease-out' }).onfinish = () => el.remove();
}

// ---------- ambient dust: slow lamp-lit motes behind everything ----------
const dust = document.createElement('canvas');
dust.className = 'dust';
document.body.prepend(dust);
const dctx = dust.getContext('2d')!;
const motes = Array.from({ length: reduced ? 0 : 46 }, () => ({
  x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.8,
  vx: (Math.random() - 0.5) * 0.006, vy: -0.003 - Math.random() * 0.008, tw: Math.random() * 6,
}));
function sizeDust() {
  dust.width = innerWidth;
  dust.height = innerHeight;
}
sizeDust();
addEventListener('resize', sizeDust);
let dustLast = performance.now();
function dustStep(now: number) {
  const dt = Math.max(0, Math.min(0.1, (now - dustLast) / 1000));
  dustLast = now;
  dctx.clearRect(0, 0, dust.width, dust.height);
  for (const m of motes) {
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.tw += dt;
    if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
    if (m.x < -0.02) m.x = 1.02;
    if (m.x > 1.02) m.x = -0.02;
    dctx.globalAlpha = 0.25 + 0.25 * Math.sin(m.tw * 1.3);
    dctx.fillStyle = '#ffcf8a';
    dctx.beginPath();
    dctx.arc(m.x * dust.width, m.y * dust.height, m.r, 0, Math.PI * 2);
    dctx.fill();
  }
  if (motes.length) requestAnimationFrame(dustStep);
}
requestAnimationFrame(dustStep);
