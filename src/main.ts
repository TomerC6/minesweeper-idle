import './style.css';
import { CONFIG, type MetaUpgradeId, type RunUpgradeId, type UpgradeDef } from './config';
import { fmt, fmtDuration, fmtPct } from './format';
import * as G from './game';
import { BOMB, COIN, CRYSTAL, FLAG, GEM, GEM_OUTLINE, UPGRADE_ICONS } from './art';
import * as fx from './fx';
import { AUTOSAVE_MS, clearLocal, deserialize, loadLocal, saveLocal, serialize } from './save';
import { isMuted, setMuted, sfx } from './sfx';

// ---------- state ----------

let g: G.GameState = loadLocal(Date.now()) ?? G.newGame(Date.now());
let tab: 'run' | 'workshop' | 'save' = 'run';
let flagMode = false;
let debug = location.hash === '#debug';
let showMines = false;
let resetArmed = false;
let saveMsg: { text: string; ok: boolean } | null = null;
let dirty = true;
let lastPlanted = -1;
let overlayAt = 0;              // the run summary waits so the last moment can land
let shownCoins = g.run.coins;   // the counter rolls toward the real value
let shownEarned = g.run.earned;

const offline = G.applyOffline(g, Date.now());
g.lastTick = Date.now();

// ---------- skeleton ----------

const app = document.getElementById('app')!;
app.innerHTML = `
<div class="app">
  <header class="top">
    <h1 class="brand"><small>Incremental</small>Minesweeper Idle</h1>
    <div class="wallet">
      <div class="stat coins"><span class="label">${COIN} Coins</span><span class="value" id="coins">0</span></div>
      <div class="stat"><span class="label">Earned this run</span><span class="value num" id="earned">0</span></div>
      <div class="stat shards"><span class="label">${CRYSTAL} Shards</span><span class="value" id="shards">0</span></div>
      <button class="btn icon" id="mute" aria-pressed="false" aria-label="Sound"></button>
    </div>
  </header>
  <div class="main">
    <section class="card mine-card" id="mineCard" aria-label="Board">
      <div class="heat">
        <div class="heat-row"><span>Heat <strong id="heat">0</strong> · payout <strong id="heatMult">×1.00</strong></span><span id="nextMine"></span></div>
        <div class="heat-bar" role="progressbar" aria-label="Heat until the next mine" id="heatBar"><div class="heat-fill" id="heatFill"></div></div>
      </div>
      <div class="combo" id="combo" aria-live="off">
        <span class="combo-x num" id="comboX">×1.00</span>
        <span class="combo-label" id="comboLabel">Tap blanks quickly to build a combo</span>
        <div class="combo-bar"><div class="combo-fill" id="comboFill"></div></div>
      </div>
      <div class="board-wrap" id="boardWrap">
        <div class="board" id="board" role="grid" aria-label="Minefield"></div>
      </div>
      <div class="board-info"><span id="boardInfo"></span><span id="shieldInfo"></span></div>
      <div class="actions">
        <button class="btn primary" id="cashOut">Cash out</button>
        <button class="btn toggle" id="flagMode" aria-pressed="false">Flag mode</button>
        <span class="hint" id="hint"></span>
      </div>
    </section>
    <section class="card" aria-label="Upgrades">
      <div class="tabs" role="tablist">
        <button class="tab" role="tab" data-tab="run" id="tab-run">Run upgrades</button>
        <button class="tab" role="tab" data-tab="workshop" id="tab-workshop">Workshop</button>
        <button class="tab" role="tab" data-tab="save" id="tab-save">Stats &amp; save</button>
      </div>
      <div id="panel"></div>
    </section>
  </div>
  <section class="card debug" id="debug" hidden>
    <strong>Debug</strong> <span class="hint">(open with the # key or #debug in the URL)</span>
    <div class="actions">
      <button class="btn" data-debug="coins">+1K Coins</button>
      <button class="btn" data-debug="shards">+100 Shards</button>
      <button class="btn" data-debug="heat">+25 Heat</button>
      <button class="btn" data-debug="mines">Show mines</button>
      <button class="btn" data-debug="away">Simulate 1h away</button>
    </div>
  </section>
</div>
<div class="toasts" id="toasts" aria-live="polite"></div>`;

const $ = (id: string) => document.getElementById(id)!;
const boardEl = $('board');
const boardWrap = $('boardWrap');
const panel = $('panel');

// ---------- toasts and floating numbers ----------

function toast(text: string) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  $('toasts').append(el);
  setTimeout(() => el.remove(), 3300);
}

type FloatKind = 'normal' | 'big' | 'crit' | 'rich' | 'small' | 'bad';

function floatText(i: number, text: string, kind: FloatKind = 'normal') {
  const tile = boardEl.children[i] as HTMLElement | undefined;
  if (!tile) return;
  const wrap = boardWrap.getBoundingClientRect();
  const r = tile.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = `float ${kind}`;
  el.textContent = text;
  el.style.left = `${r.left - wrap.left + r.width / 2 + (Math.random() - 0.5) * 14}px`;
  el.style.top = `${r.top - wrap.top + r.height / 2}px`;
  boardWrap.append(el);
  setTimeout(() => el.remove(), kind === 'crit' || kind === 'rich' ? 1150 : 850);
}

const coinsEl = () => $('coins');

/** Coins fly from a tile to the counter. The counter itself rolls up on its own. */
function coinsFrom(i: number, count: number) {
  const tile = boardEl.children[i];
  if (!tile) return;
  const c = fx.centerOf(tile);
  fx.fly(c.x, c.y, coinsEl(), count, fx.cssColor('--gold'), () => fx.pop(coinsEl(), 1.12, 140));
}

function tileFx(i: number, f: (x: number, y: number) => void) {
  const tile = boardEl.children[i];
  if (!tile) return;
  const c = fx.centerOf(tile);
  f(c.x, c.y);
}

function tileBurst(i: number, color: string, count = 12, speed = 220) {
  const tile = boardEl.children[i];
  if (!tile) return;
  const c = fx.centerOf(tile);
  fx.burst(c.x, c.y, color, count, speed);
}

function handleEvents(events: G.GameEvent[], fromAuto = false) {
  for (const e of events) {
    if (e.type === 'reveal') {
      sfx.reveal();
    }
    if (e.type === 'discover') {
      sfx.discover(e.rich);
      floatText(e.i, e.rich ? `Rich vein! +${fmt(e.amount)}` : `+${fmt(e.amount)}`, e.rich ? 'rich' : 'big');
      tileBurst(e.i, fx.cssColor('--gold'), e.rich ? 28 : 14, e.rich ? 300 : 200);
      coinsFrom(e.i, e.rich ? 6 : 3);
      tileFx(e.i, (x, y) => {
        fx.shockwave(x, y, fx.cssColor('--gold'), e.rich ? 140 : 70, e.rich ? 700 : 450);
        fx.sparkle(x, y, '#fff1b8', e.rich ? 10 : 4);
      });
      if (e.rich) fx.flashScreen(fx.cssColor('--gold'), 300, 0.18);
    }
    if (e.type === 'harvest') {
      if (fromAuto) {
        sfx.autoHarvest();
        const tile = boardEl.children[e.i];
        if (tile) fx.pop(tile, 1.08, 160);
        if (Math.random() < 0.35) coinsFrom(e.i, 1);
      } else {
        sfx.harvest(e.combo);
        if (e.crit) sfx.crit();
        const kind: FloatKind = e.crit ? 'crit' : e.rich ? 'rich' : 'normal';
        floatText(e.i, e.crit ? `Crit! +${fmt(e.amount)}` : `+${fmt(e.amount)}`, kind);
        tileBurst(e.i, fx.cssColor('--gold'), e.crit ? 22 : 6, e.crit ? 320 : 150);
        tileFx(e.i, (x, y) => {
          fx.sparkle(x, y, '#fff1b8', e.crit ? 8 : 2, 22);
          if (e.crit) {
            fx.shockwave(x, y, fx.cssColor('--heat'), 110, 500);
            fx.flashScreen(fx.cssColor('--gold'), 220, 0.14);
          }
        });
        coinsFrom(e.i, e.crit ? 5 : e.rich ? 2 : 1);
        const tile = boardEl.children[e.i];
        if (tile) fx.pop(tile, e.crit ? 1.25 : 1.1, 160);
        if (e.crit) fx.shake($('board'), 4, 220);
        if (e.combo > 0 && e.combo % 10 === 0) {
          floatText(e.i, `${e.combo} combo!`, 'big');
          fx.pop($('combo'), 1.12, 220);
        }
      }
    }
    if (e.type === 'survey') floatText(e.i, `+${fmt(e.amount)}`, 'small');
    if (e.type === 'shield') {
      sfx.shield();
      tileBurst(e.i, fx.cssColor('--shield'), 26, 280);
      tileFx(e.i, (x, y) => fx.shockwave(x, y, fx.cssColor('--shield'), 160, 700));
      fx.flashScreen(fx.cssColor('--shield'), 350, 0.25);
      floatText(e.i, 'Shield!', 'big');
      toast('Your Shield absorbed a mine. The run goes on.');
    }
    if (e.type === 'planted') {
      lastPlanted = e.i;
      sfx.planted();
      tileBurst(e.i, fx.cssColor('--heat'), 14, 180);
      tileFx(e.i, (x, y) => fx.shockwave(x, y, fx.cssColor('--heat'), 90, 500));
      fx.shake($('board'), 5, 300);
      toast(e.cracked > 0
        ? `Heat planted a new mine. ${e.cracked} blank${e.cracked > 1 ? 's' : ''} cracked and stopped paying.`
        : 'Heat planted a new mine. Check the numbers again.');
      setTimeout(() => { lastPlanted = -1; dirty = true; }, 800);
    }
    if (e.type === 'runEnd') onRunEnd(e.result, e.i);
  }
  if (events.length) dirty = true;
}

function onRunEnd(res: G.RunResult, mineAt?: number) {
  overlayAt = performance.now() + (res.kind === 'death' ? 1100 : res.kind === 'clear' ? 900 : 250);
  setTimeout(() => { dirty = true; }, overlayAt - performance.now() + 20);
  const card = document.querySelector('.main .card') as HTMLElement;
  if (res.kind === 'death') {
    sfx.boom();
    if (mineAt !== undefined) {
      tileBurst(mineAt, fx.cssColor('--heat'), 60, 420);
      tileBurst(mineAt, fx.cssColor('--gold'), 20, 260);
      tileFx(mineAt, (x, y) => {
        fx.shockwave(x, y, fx.cssColor('--heat'), 260, 800);
        fx.shockwave(x, y, '#ffd0a0', 140, 500);
        fx.debris(x, y, 22);
      });
    }
    fx.flashScreen(fx.cssColor('--heat'), 600, 0.6);
    fx.shake(card, 14, 520);
  } else if (res.kind === 'clear') {
    sfx.clear();
    const c = fx.centerOf($('board'));
    fx.confetti(c.x, c.y);
    fx.shockwave(c.x, c.y, fx.cssColor('--gold'), 320, 900);
    fx.flashScreen(fx.cssColor('--gold'), 500, 0.35);
  } else {
    sfx.cashout();
  }
}

// ---------- board input ----------

let pressTimer = 0;
let longPressed = false;

function onTileActivate(i: number) {
  const t = g.run.board.tiles[i];
  if (g.run.result) return;
  if (flagMode && !t.revealed) {
    G.toggleFlag(g, i);
    sfx.flag();
    dirty = true;
    return;
  }
  if (!t.revealed) handleEvents(G.reveal(g, i));
  else if (t.adj === 0 && !t.mine) handleEvents(G.harvest(g, i, Math.random, true, performance.now()));
  else handleEvents(G.chord(g, i));
}

boardEl.addEventListener('click', e => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('.tile');
  if (!btn) return;
  if (longPressed) { longPressed = false; return; }
  onTileActivate(Number(btn.dataset.i));
});
boardEl.addEventListener('contextmenu', e => {
  e.preventDefault();
  const btn = (e.target as HTMLElement).closest<HTMLElement>('.tile');
  if (!btn || longPressed) return;
  G.toggleFlag(g, Number(btn.dataset.i));
  sfx.flag();
  dirty = true;
});
boardEl.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse') return;
  const btn = (e.target as HTMLElement).closest<HTMLElement>('.tile');
  if (!btn) return;
  longPressed = false;
  clearTimeout(pressTimer);
  pressTimer = window.setTimeout(() => {
    longPressed = true;
    G.toggleFlag(g, Number(btn.dataset.i));
    navigator.vibrate?.(15);
    dirty = true;
  }, 350);
});
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
  boardEl.addEventListener(ev, () => clearTimeout(pressTimer));
}

$('cashOut').addEventListener('click', () => handleEvents(G.cashOut(g)));
$('mute').addEventListener('click', () => {
  setMuted(!isMuted());
  if (!isMuted()) sfx.buy();
  dirty = true;
});
$('flagMode').addEventListener('click', () => {
  flagMode = !flagMode;
  dirty = true;
});

// ---------- tabs and panel ----------

document.querySelectorAll<HTMLElement>('.tab').forEach(b =>
  b.addEventListener('click', () => {
    tab = b.dataset.tab as typeof tab;
    resetArmed = false;
    saveMsg = null;
    renderPanel(true);
  }),
);

panel.addEventListener('click', e => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el) return;
  const act = el.dataset.act!;
  const id = el.dataset.id!;
  if (act === 'run') {
    if (!G.canBuyRun(g, id as RunUpgradeId)) return;
    const flagged = G.buyRun(g, id as RunUpgradeId);
    celebrateBuy(el, fx.cssColor('--gold'));
    if (id === 'detector' && flagged !== null) {
      toast('Detector flagged a mine.');
      floatText(flagged, 'Mine found', 'small');
    }
    if (id === 'richSoil' && g.run.levels.richSoil % CONFIG.juice.richSoilMilestone === 0) {
      sfx.milestone();
      toast(`Rich Soil level ${g.run.levels.richSoil}: blank value doubled!`);
      fx.confetti(fx.centerOf(el).x, fx.centerOf(el).y);
      fx.flashScreen(fx.cssColor('--gold'), 450, 0.3);
    }
    if (id === 'expand') fx.pop($('board'), 1.04, 260);
  } else if (act === 'meta') {
    if (!G.buyMeta(g, id as MetaUpgradeId)) return;
    celebrateBuy(el, fx.cssColor('--shield'));
    if (id.startsWith('unlock')) {
      sfx.milestone();
      toast(`${CONFIG.meta_upgrades[id as MetaUpgradeId].name.replace('Workshop: ', '')} is now in Run upgrades.`);
    }
  } else if (act === 'export') {
    const box = $('exportBox') as HTMLTextAreaElement;
    box.value = serialize(g);
    box.select();
    navigator.clipboard?.writeText(box.value).then(
      () => { saveMsg = { text: 'Save copied to your clipboard.', ok: true }; renderPanel(true); },
      () => { saveMsg = { text: 'Select the text above and copy it.', ok: true }; renderPanel(true); },
    );
    return;
  } else if (act === 'import') {
    const text = ($('importBox') as HTMLTextAreaElement).value;
    try {
      g = deserialize(text, Date.now());
      saveLocal(g);
      saveMsg = { text: 'Save loaded.', ok: true };
    } catch (err) {
      saveMsg = { text: (err as Error).message, ok: false };
    }
  } else if (act === 'reset') {
    if (!resetArmed) {
      resetArmed = true;
    } else {
      clearLocal();
      g = G.newGame(Date.now());
      resetArmed = false;
      saveMsg = { text: 'Progress erased. Fresh start.', ok: true };
    }
  }
  dirty = true;
  renderPanel(true);
});

function celebrateBuy(el: HTMLElement, color: string) {
  sfx.buy();
  const c = fx.centerOf(el);
  fx.burst(c.x, c.y, color, 16, 200, 'diamond');
}

boardWrap.addEventListener('click', e => {
  if ((e.target as HTMLElement).closest('[data-act="newRun"]')) {
    G.startNewRun(g, Date.now());
    shownCoins = g.run.coins;
    shownEarned = 0;
    sfx.reveal();
    dirty = true;
  }
  if ((e.target as HTMLElement).closest('[data-act="toWorkshop"]')) {
    tab = 'workshop';
    renderPanel(true);
  }
});

// ---------- debug ----------

window.addEventListener('keydown', e => {
  if (e.key === '#') {
    debug = !debug;
    dirty = true;
  }
});
$('debug').addEventListener('click', e => {
  const k = (e.target as HTMLElement).dataset.debug;
  if (k === 'coins') { g.run.coins += 1000; g.run.earned += 1000; }
  if (k === 'shards') g.shards += 100;
  if (k === 'heat') g.run.heat += 25; // mines catch up on the next harvest
  if (k === 'mines') showMines = !showMines;
  if (k === 'away') {
    g.lastTick -= 3600 * 1000;
    const r = G.applyOffline(g, Date.now());
    g.lastTick = Date.now();
    toast(`Simulated 1h away: +${fmt(r.coins)} Coins.`);
  }
  dirty = true;
});

// ---------- rendering ----------

function renderBoard() {
  const r = g.run;
  const b = r.board;
  boardEl.style.setProperty('--side', String(b.w));
  while (boardEl.children.length < b.tiles.length) {
    const el = document.createElement('button');
    el.className = 'tile';
    el.setAttribute('role', 'gridcell');
    boardEl.append(el);
  }
  while (boardEl.children.length > b.tiles.length) boardEl.lastElementChild!.remove();

  const over = r.result !== null;
  b.tiles.forEach((t, i) => {
    const el = boardEl.children[i] as HTMLButtonElement;
    el.dataset.i = String(i);
    let cls = 'tile';
    let html = '';
    let label = 'Hidden tile';
    if (t.revealed && t.mine && t.defused) {
      cls += ' defused'; html = BOMB; label = 'Defused mine';
    } else if (t.revealed && t.mine) {
      cls += ' mine'; html = BOMB; label = 'Mine';
    } else if (t.revealed && t.adj === 0) {
      if (t.charges > 0) {
        cls += t.rich ? ' blank rich' : ' blank';
        html = `${GEM}<span class="charges">${t.charges}</span>`;
        label = `Blank, ${t.charges} harvests left`;
      } else {
        cls += ' dry'; html = GEM_OUTLINE; label = 'Empty blank';
      }
    } else if (t.revealed) {
      cls += ` open n${t.adj}${t.cracked ? ' cracked' : ''}`;
      html = String(t.adj);
      label = `${t.adj} mine${t.adj > 1 ? 's' : ''} nearby`;
      const marked = G.neighbors(b, i).filter(n => b.tiles[n].flagged || b.tiles[n].defused).length;
      const hidden = G.neighbors(b, i).some(n => !b.tiles[n].revealed && !b.tiles[n].flagged);
      if (marked === t.adj && hidden && !over) cls += ' chordable';
    } else if (over && t.mine) {
      cls += ' mine other'; html = t.flagged ? FLAG : BOMB; label = 'Mine';
    } else if (t.flagged) {
      cls += ' flag'; html = FLAG; label = 'Flagged tile';
    } else if (showMines && t.mine) {
      html = `<span class="ghost">${BOMB}</span>`;
    }
    if (i === lastPlanted) cls += ' planted';
    const wasHidden = el.dataset.rev !== '1';
    el.dataset.rev = t.revealed || (over && t.mine) ? '1' : '0';
    if (wasHidden && el.dataset.rev === '1') {
      const delay = over ? Math.random() * 400 : 0;
      el.animate(
        [{ transform: 'perspective(300px) rotateX(80deg) scale(0.7)', opacity: 0.4 }, { transform: 'none', opacity: 1 }],
        { duration: 240, delay, easing: 'cubic-bezier(.2,1.4,.4,1)', fill: 'backwards' },
      );
    }
    if (el.className !== cls) el.className = cls;
    if (el.innerHTML !== html) el.innerHTML = html;
    el.setAttribute('aria-label', label);
    el.disabled = over;
  });

  // result overlay
  let overlay = boardWrap.querySelector('.result');
  if (r.result && !overlay && performance.now() >= overlayAt) {
    const res = r.result;
    const title = res.kind === 'clear' ? 'Board cleared' : res.kind === 'cashout' ? 'Cashed out' : 'You hit a mine';
    const keepLine = res.kind === 'clear' ? '100% + 50% bonus' : fmtPct(res.keep);
    overlay = document.createElement('div');
    overlay.className = 'result';
    overlay.innerHTML = `
      <div class="result-card ${res.kind}" role="dialog" aria-label="${title}">
        <h2>${title}</h2>
        <div class="big" id="shardGain">+0 Shards</div>
        <dl>
          <dt>Coins earned</dt><dd>${fmt(res.earned)}</dd>
          <dt>Kept</dt><dd>${keepLine}</dd>
          <dt>Shards now</dt><dd>${fmt(g.shards)}</dd>
        </dl>
        <button class="btn primary" data-act="newRun">Start next run</button>
        <button class="btn" data-act="toWorkshop">Open the Workshop</button>
      </div>`;
    boardWrap.append(overlay);
    countUp($('shardGain'), res.shards, n => `+${fmt(n)} Shards`);
  } else if (!r.result && overlay) {
    overlay.remove();
  }
}

function countUp(el: HTMLElement, to: number, label: (n: number) => string) {
  const t0 = performance.now();
  const dur = Math.min(1200, 400 + to * 20);
  const stepFn = (now: number) => {
    const k = Math.min(1, (now - t0) / dur);
    const eased = 1 - (1 - k) ** 3;
    el.textContent = label(Math.round(to * eased));
    if (k < 1) requestAnimationFrame(stepFn);
    else fx.pop(el, 1.2, 240);
  };
  requestAnimationFrame(stepFn);
}

/** Runs every frame: counters roll toward their real values, the combo bar drains. */
function renderLive(now: number) {
  const r = g.run;
  const roll = (shown: number, real: number) => (Math.abs(real - shown) < 0.05 || real < shown ? real : shown + (real - shown) * 0.2);
  shownCoins = roll(shownCoins, r.coins);
  shownEarned = roll(shownEarned, r.earned);
  const c = fmt(shownCoins);
  if ($('coins').textContent !== c) $('coins').textContent = c;
  const e = fmt(shownEarned);
  if ($('earned').textContent !== e) $('earned').textContent = e;

  const left = 1 - (now - r.lastHarvestAt) / CONFIG.juice.comboWindowMs;
  const live = r.combo > 1 && left > 0 && !r.result;
  const interval = G.heatInterval(g);
  const heatLevel = r.result ? 0 : Math.min(1, (interval - (r.nextMineAt - r.heat)) / interval);
  const card = $('mineCard');
  card.style.setProperty('--hl', heatLevel.toFixed(2));
  card.style.setProperty('--cl', live ? Math.min(1, (r.combo / CONFIG.juice.comboMaxSteps) * left).toFixed(2) : '0');
  const comboEl = $('combo');
  comboEl.classList.toggle('live', live);
  comboEl.classList.toggle('max', live && r.combo > CONFIG.juice.comboMaxSteps);
  ($('comboFill') as HTMLElement).style.width = `${live ? left * 100 : 0}%`;
  const x = `×${G.comboMult(live ? r.combo : 0).toFixed(2)}`;
  if ($('comboX').textContent !== x) $('comboX').textContent = x;
  const label = live
    ? `${r.combo} combo${r.combo > CONFIG.juice.comboMaxSteps ? ' · max' : ''}`
    : r.bestCombo > 1 ? `Best combo this run: ${r.bestCombo}` : 'Tap blanks quickly to build a combo';
  if ($('comboLabel').textContent !== label) $('comboLabel').textContent = label;
}

function renderTop() {
  const r = g.run;
  $('shards').textContent = fmt(g.shards);
  $('mute').textContent = isMuted() ? 'Sound off' : 'Sound on';
  $('mute').setAttribute('aria-pressed', String(!isMuted()));
  $('heat').textContent = String(Math.floor(r.heat));
  $('heatMult').textContent = `×${G.heatMult(r).toFixed(2)}`;
  const interval = G.heatInterval(g);
  const into = interval - (r.nextMineAt - r.heat);
  $('nextMine').textContent = `next mine in ${Math.ceil(r.nextMineAt - r.heat)} Heat`;
  ($('heatFill') as HTMLElement).style.width = `${Math.min(100, (into / interval) * 100)}%`;
  $('heatBar').setAttribute('aria-valuenow', String(Math.round((into / interval) * 100)));

  const b = r.board;
  $('boardInfo').textContent = `${b.w}×${b.h} · ${G.minesLeft(b)} mines left · ${G.safeTilesLeft(b)} safe tiles hidden · ${fmt(G.blankValue(g))} Coins per tap`;
  $('shieldInfo').textContent = r.shields > 0 ? 'Shield ready' : '';
  ($('cashOut') as HTMLButtonElement).disabled = r.result !== null || r.earned <= 0;
  $('flagMode').setAttribute('aria-pressed', String(flagMode));
  const noMinesYet = !b.minesPlaced;
  $('hint').textContent = r.result ? '' : noMinesYet
    ? 'Click any tile to start. The first click is never a mine.'
    : flagMode ? 'Tap hidden tiles to flag them.' : 'Tap gold blanks fast for a combo. Right-click or long-press to flag.';
  $('debug').hidden = !debug;
}

let panelKey = '';
function renderPanel(force = false) {
  document.querySelectorAll<HTMLElement>('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  const affordableMeta = (Object.keys(CONFIG.meta_upgrades) as MetaUpgradeId[]).filter(id => G.canBuyMeta(g, id)).length;
  $('tab-workshop').innerHTML = `Workshop${affordableMeta ? `<span class="badge">${affordableMeta}</span>` : ''}`;

  let html = '';
  if (tab === 'run') {
    const ids = Object.keys(CONFIG.run_upgrades) as RunUpgradeId[];
    const shown = ids.filter(id => G.runUpgradeUnlocked(g, id));
    html = `<div class="ups">${shown.map(id => runUpgradeHtml(id)).join('')}</div>`;
    if (shown.length < ids.length) html += `<p class="locked-note">${ids.length - shown.length} more upgrades unlock in the Workshop.</p>`;
  } else if (tab === 'workshop') {
    const ids = Object.keys(CONFIG.meta_upgrades) as MetaUpgradeId[];
    html = `<p class="locked-note">Shards come from ending runs. Workshop upgrades last until prestige.</p><div class="ups">${ids.map(id => metaUpgradeHtml(id)).join('')}</div>`;
  } else {
    html = saveHtml();
  }
  const key = tab + html;
  if (!force && key === panelKey) return;
  // keep text typed into the import box across re-renders
  const typed = (document.getElementById('importBox') as HTMLTextAreaElement | null)?.value;
  const exported = (document.getElementById('exportBox') as HTMLTextAreaElement | null)?.value;
  panelKey = key;
  panel.innerHTML = html;
  if (typed) ($('importBox') as HTMLTextAreaElement).value = typed;
  if (exported && tab === 'save') ($('exportBox') as HTMLTextAreaElement).value = exported;
}

function runUpgradeHtml(id: RunUpgradeId): string {
  const def: UpgradeDef = CONFIG.run_upgrades[id];
  const r = g.run;
  const lvl = r.levels[id];
  let costText = fmt(G.cost(def, lvl));
  let extra = '';
  if (G.isMaxed(def, lvl)) costText = 'Max';
  if (id === 'expand') {
    extra = ` (${r.board.w}×${r.board.h})`;
    if (r.board.w >= G.maxSide(g)) costText = 'Max';
  }
  if (id === 'shield' && r.shields > 0) costText = 'Held';
  if (id === 'autoHarvest' && lvl > 0) extra = ` (${lvl}/s)`;
  const showLvl = !['detector', 'shield'].includes(id) && lvl > 0 ? `<span class="up-lvl">Lv ${lvl}</span>` : '';
  const can = G.canBuyRun(g, id);
  return `<button class="up${costText === 'Max' ? ' maxed' : ''}${can ? ' ready' : ''}" data-act="run" data-id="${id}" ${can ? '' : 'disabled'}>
    <span class="up-icon">${UPGRADE_ICONS[id] ?? ''}</span>
    <span class="up-name">${def.name}${showLvl}</span>
    <span class="up-cost">${costText}</span>
    <span class="up-desc">${def.desc}${extra}</span>
  </button>`;
}

function metaUpgradeHtml(id: MetaUpgradeId): string {
  const def: UpgradeDef = CONFIG.meta_upgrades[id];
  const lvl = g.meta[id];
  const maxed = G.isMaxed(def, lvl);
  const costText = maxed ? (def.max === 1 ? 'Owned' : 'Max') : fmt(G.cost(def, lvl));
  let now = '';
  if (id === 'headStart' && lvl) now = ` Now ${fmt(G.headStartCoins(lvl))}.`;
  if (id === 'safetyNet') now = ` Now ${fmtPct(G.keepOnDeath(g))}.`;
  if (id === 'steadyGround') now = ` Now ${fmtPct(G.density(g))}.`;
  if (id === 'biggerClaim') now = ` Now ${G.startSide(g)}×${G.startSide(g)}.`;
  if (id === 'goldenTouch' && lvl) now = ` Now ×${fmt(G.incomeMult(g))}.`;
  if (id === 'coolHead') now = ` Now every ${G.heatInterval(g)} Heat.`;
  const showLvl = def.max !== 1 && lvl > 0 ? `<span class="up-lvl">Lv ${lvl}</span>` : '';
  const can = G.canBuyMeta(g, id);
  return `<button class="up meta${maxed ? ' maxed' : ''}${can ? ' ready' : ''}" data-act="meta" data-id="${id}" ${can ? '' : 'disabled'}>
    <span class="up-icon">${UPGRADE_ICONS[id] ?? ''}</span>
    <span class="up-name">${def.name}${showLvl}</span>
    <span class="up-cost">${costText}</span>
    <span class="up-desc">${def.desc}.${now}</span>
  </button>`;
}

function saveHtml(): string {
  const s = g.stats;
  const msg = saveMsg ? `<p class="msg ${saveMsg.ok ? 'ok' : 'err'}">${saveMsg.text}</p>` : '';
  return `<div class="save">
    <div class="stats-grid">
      <span>Runs</span><span>${s.runs}</span>
      <span>Boards cleared</span><span>${s.clears}</span>
      <span>Cash outs</span><span>${s.cashouts}</span>
      <span>Mines hit</span><span>${s.deaths}</span>
      <span>Best run</span><span>${fmt(s.bestEarned)} Coins</span>
      <span>Lifetime Shards</span><span>${fmt(g.lifetimeShards)}</span>
    </div>
    <p class="hint">The game saves to this browser every ${CONFIG.autosaveSeconds} seconds.</p>
    <h3>Export</h3>
    <textarea id="exportBox" readonly aria-label="Exported save"></textarea>
    <div class="actions"><button class="btn" data-act="export">Copy save string</button></div>
    <h3>Import</h3>
    <textarea id="importBox" placeholder="Paste a save string here" aria-label="Save string to import"></textarea>
    <div class="actions">
      <button class="btn" data-act="import">Load save</button>
      <button class="btn danger" data-act="reset">${resetArmed ? 'Click again to erase everything' : 'Erase progress'}</button>
    </div>
    ${msg}
  </div>`;
}

function render() {
  renderTop();
  renderBoard();
  renderPanel();
  dirty = false;
}

// ---------- loop ----------

let last = performance.now();
let lastSave = Date.now();
function frame(nowPerf: number) {
  const dt = Math.min(1, (nowPerf - last) / 1000);
  last = nowPerf;
  if (!g.run.result && g.run.levels.autoHarvest > 0) handleEvents(G.tick(g, dt), true);
  g.lastTick = Date.now();
  if (Date.now() - lastSave > AUTOSAVE_MS) {
    saveLocal(g);
    lastSave = Date.now();
  }
  if (dirty) render();
  renderLive(nowPerf);
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveLocal(g);
  else {
    const away = G.applyOffline(g, Date.now());
    if (away.coins > 0) toast(`While you were away (${fmtDuration(away.seconds * 1000)}), the Auto-Harvester collected ${fmt(away.coins)} Coins.`);
    g.lastTick = Date.now();
    last = performance.now();
    dirty = true;
  }
});
window.addEventListener('pagehide', () => saveLocal(g));

render();
if (offline.coins > 0) toast(`While you were away (${fmtDuration(offline.seconds * 1000)}), the Auto-Harvester collected ${fmt(offline.coins)} Coins.`);
requestAnimationFrame(frame);
