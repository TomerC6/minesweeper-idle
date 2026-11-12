// Pure game logic. No DOM access, so the sim script and tests can drive it headlessly.
import { CONFIG, type MetaUpgradeId, type RunUpgradeId, type UpgradeDef } from './config';

export interface Tile {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adj: number;          // adjacent mines
  charges: number;      // harvests left (blanks only)
  cracked: boolean;     // was a blank, a planted mine turned it into a number
  defused: boolean;     // a mine revealed by a Shield or the Detector
  rich?: boolean;       // a rich vein pays several times more per tap
}

export interface Board {
  w: number;
  h: number;
  tiles: Tile[];
  minesPlaced: boolean;
  pendingMines: number; // mines to place on the first click
}

export type RunEnd = 'cashout' | 'clear' | 'death';

export interface RunResult {
  kind: RunEnd;
  earned: number;
  keep: number;
  shards: number;
}

export interface RunState {
  board: Board;
  coins: number;
  earned: number;
  heat: number;
  nextMineAt: number;
  levels: Record<RunUpgradeId, number>;
  shields: number;
  autoAcc: number;
  combo: number;
  lastHarvestAt: number;
  bestCombo: number;
  startedAt: number;
  result: RunResult | null;
}

export interface Stats {
  runs: number;
  clears: number;
  deaths: number;
  cashouts: number;
  bestEarned: number;
  totalEarned: number;
}

export interface GameState {
  version: 1;
  shards: number;
  lifetimeShards: number;
  meta: Record<MetaUpgradeId, number>;
  run: RunState;
  stats: Stats;
  lastTick: number;
  createdAt: number;
}

export type Rng = () => number;

// ---------- upgrade costs ----------

export function cost(def: UpgradeDef, level: number): number {
  return Math.ceil(def.base * def.growth ** level);
}

export function isMaxed(def: UpgradeDef, level: number): boolean {
  return def.max !== undefined && level >= def.max;
}

const RUN_UNLOCK: Partial<Record<RunUpgradeId, MetaUpgradeId>> = {
  detector: 'unlockDetector',
  autoHarvest: 'unlockAuto',
  shield: 'unlockShield',
  surveyor: 'unlockSurveyor',
};

export function runUpgradeUnlocked(g: GameState, id: RunUpgradeId): boolean {
  const req = RUN_UNLOCK[id];
  return !req || g.meta[req] > 0;
}

// ---------- derived values ----------

export function startSide(g: GameState): number {
  return CONFIG.board.startSide + g.meta.biggerClaim;
}

export function maxSide(g: GameState): number {
  return startSide(g) + CONFIG.board.expandCapOverStart;
}

export function density(g: GameState): number {
  const d = CONFIG.board.baseDensity - g.meta.steadyGround * CONFIG.meta_effects.steadyGroundPerLevel;
  return Math.max(CONFIG.board.minDensity, d);
}

export function chargesPerBlank(r: RunState): number {
  return CONFIG.blank.baseCharges + 2 * r.levels.deepVeins;
}

export function incomeMult(g: GameState): number {
  return CONFIG.meta_effects.goldenTouchMult ** g.meta.goldenTouch;
}

export function heatMult(r: RunState): number {
  return 1 + r.heat * CONFIG.heat.payoutPerHeat;
}

export function richSoilMult(level: number): number {
  return 2 ** Math.floor(level / CONFIG.juice.richSoilMilestone);
}

export function comboMult(combo: number): number {
  return 1 + Math.min(Math.max(0, combo - 1), CONFIG.juice.comboMaxSteps) * CONFIG.juice.comboPerStep;
}

/** Coins per tap on a plain blank, before combo, crit and rich veins. */
export function blankValue(g: GameState): number {
  const r = g.run;
  const soil = (CONFIG.blank.baseValue + r.levels.richSoil) * richSoilMult(r.levels.richSoil);
  return soil * incomeMult(g) * heatMult(r);
}

export function heatInterval(g: GameState): number {
  return CONFIG.heat.mineEvery + g.meta.coolHead * CONFIG.meta_effects.coolHeadPerLevel;
}

export function keepOnDeath(g: GameState): number {
  return Math.min(1, CONFIG.run.keepOnDeath + g.meta.safetyNet * CONFIG.meta_effects.safetyNetPerLevel);
}

export function shardsFor(coinsKept: number): number {
  return Math.floor(Math.max(0, coinsKept) ** CONFIG.shardExponent);
}

export function headStartCoins(level: number): number {
  return CONFIG.meta_effects.headStartCoins * (2 ** level - 1);
}

// ---------- creation ----------

function emptyTile(): Tile {
  return { mine: false, revealed: false, flagged: false, adj: 0, charges: 0, cracked: false, defused: false };
}

function zeroLevels<T extends string>(defs: Record<T, UpgradeDef>): Record<T, number> {
  const out = {} as Record<T, number>;
  for (const k of Object.keys(defs) as T[]) out[k] = 0;
  return out;
}

export function newBoard(side: number, dens: number): Board {
  return {
    w: side,
    h: side,
    tiles: Array.from({ length: side * side }, emptyTile),
    minesPlaced: false,
    pendingMines: Math.max(1, Math.round(side * side * dens)),
  };
}

export function newRun(g: GameState, now: number): RunState {
  const side = startSide(g);
  return {
    board: newBoard(side, density(g)),
    coins: headStartCoins(g.meta.headStart),
    earned: 0,
    heat: 0,
    nextMineAt: heatInterval(g),
    levels: zeroLevels(CONFIG.run_upgrades),
    shields: 0,
    autoAcc: 0,
    combo: 0,
    lastHarvestAt: -Infinity,
    bestCombo: 0,
    startedAt: now,
    result: null,
  };
}

export function newGame(now: number): GameState {
  const g: GameState = {
    version: 1,
    shards: 0,
    lifetimeShards: 0,
    meta: zeroLevels(CONFIG.meta_upgrades),
    run: null as unknown as RunState,
    stats: { runs: 0, clears: 0, deaths: 0, cashouts: 0, bestEarned: 0, totalEarned: 0 },
    lastTick: now,
    createdAt: now,
  };
  g.run = newRun(g, now);
  return g;
}

// ---------- board helpers ----------

export function neighbors(b: Board, i: number): number[] {
  const x = i % b.w, y = Math.floor(i / b.w);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < b.w && ny < b.h) out.push(ny * b.w + nx);
    }
  }
  return out;
}

function recountAdj(b: Board) {
  b.tiles.forEach((t, i) => {
    t.adj = neighbors(b, i).filter(n => b.tiles[n].mine).length;
  });
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function placeMines(g: GameState, safe: number, rng: Rng) {
  const b = g.run.board;
  const all = b.tiles.map((_, i) => i).filter(i => i !== safe);
  // Keep the first click's neighbours clear too, so the first click always opens on a blank
  let pool = all;
  const near = new Set(neighbors(b, safe));
  const far = all.filter(i => !near.has(i));
  if (far.length >= b.pendingMines) pool = far;
  const count = Math.min(b.pendingMines, pool.length);
  for (const i of shuffle([...pool], rng).slice(0, count)) b.tiles[i].mine = true;
  b.minesPlaced = true;
  b.pendingMines = 0;
  recountAdj(b);
}

/** After mines change: revealed blanks next to a mine stop paying. */
function crackBlanks(b: Board) {
  for (const t of b.tiles) {
    if (t.revealed && !t.mine && t.adj > 0 && t.charges > 0) {
      t.charges = 0;
      t.cracked = true;
    }
  }
}

export function safeTilesLeft(b: Board): number {
  if (!b.minesPlaced) return b.tiles.length - b.pendingMines;
  return b.tiles.filter(t => !t.mine && !t.revealed).length;
}

export function minesLeft(b: Board): number {
  if (!b.minesPlaced) return b.pendingMines;
  return b.tiles.filter(t => t.mine && !t.defused).length - b.tiles.filter(t => t.flagged && !t.defused).length;
}

export function totalCharges(b: Board): number {
  return b.tiles.reduce((s, t) => s + (t.revealed && !t.mine ? t.charges : 0), 0);
}

// ---------- events (for the UI to animate) ----------

export type GameEvent =
  | { type: 'reveal'; i: number }
  | { type: 'discover'; i: number; amount: number; rich: boolean }
  | { type: 'harvest'; i: number; amount: number; crit: boolean; combo: number; rich: boolean }
  | { type: 'survey'; i: number; amount: number }
  | { type: 'shield'; i: number }
  | { type: 'planted'; i: number; cracked: number }
  | { type: 'runEnd'; result: RunResult; i?: number };

// ---------- actions ----------

export function reveal(g: GameState, i: number, rng: Rng = Math.random): GameEvent[] {
  const r = g.run;
  const b = r.board;
  const t = b.tiles[i];
  if (r.result || !t || t.revealed || t.flagged) return [];
  const firstClick = !b.minesPlaced;
  if (firstClick) placeMines(g, i, rng);

  if (t.mine) {
    if (r.shields > 0) {
      r.shields -= 1;
      t.revealed = true;
      t.defused = true;
      t.flagged = false;
      return [{ type: 'shield', i }];
    }
    t.revealed = true;
    return [endRun(g, 'death', i)];
  }

  t.revealed = true;
  const events: GameEvent[] = [{ type: 'reveal', i }];
  if (t.adj === 0) {
    t.charges = chargesPerBlank(r);
    t.rich = rng() < CONFIG.juice.richChance;
    const amount = blankValue(g) * CONFIG.juice.discoveryTaps * (t.rich ? CONFIG.juice.richMult : 1);
    r.coins += amount;
    r.earned += amount;
    events.push({ type: 'discover', i, amount, rich: t.rich });
  } else if (r.levels.surveyor > 0) {
    const amount = blankValue(g) * CONFIG.surveyorShare * r.levels.surveyor;
    r.coins += amount;
    r.earned += amount;
    events.push({ type: 'survey', i, amount });
  }
  if (firstClick && g.meta.prospector > 0) {
    for (const n of neighbors(b, i)) if (!r.result) events.push(...reveal(g, n, rng));
  }
  if (!r.result && safeTilesLeft(b) === 0) events.push(endRun(g, 'clear'));
  return events;
}

/** Classic chord: on a number whose flags are all placed, reveal the other hidden neighbours. */
export function chord(g: GameState, i: number, rng: Rng = Math.random): GameEvent[] {
  const b = g.run.board;
  const t = b.tiles[i];
  if (g.run.result || !t.revealed || t.mine || t.adj === 0) return [];
  const ns = neighbors(b, i);
  const marked = ns.filter(n => b.tiles[n].flagged || b.tiles[n].defused).length;
  if (marked !== t.adj) return [];
  const events: GameEvent[] = [];
  for (const n of ns) {
    if (g.run.result) break;
    events.push(...reveal(g, n, rng));
  }
  return events;
}

export function toggleFlag(g: GameState, i: number) {
  const t = g.run.board.tiles[i];
  if (g.run.result || t.revealed) return;
  t.flagged = !t.flagged;
}

/** `now` (ms) is passed for taps by the player; it drives the combo. Auto and offline taps leave it out. */
export function harvest(g: GameState, i: number, rng: Rng = Math.random, withHeat = true, now?: number): GameEvent[] {
  const r = g.run;
  const t = r.board.tiles[i];
  if (r.result || !t.revealed || t.mine || t.charges <= 0) return [];
  let combo = 0;
  if (now !== undefined) {
    r.combo = now - r.lastHarvestAt <= CONFIG.juice.comboWindowMs ? r.combo + 1 : 1;
    r.lastHarvestAt = now;
    r.bestCombo = Math.max(r.bestCombo, r.combo);
    combo = r.combo;
  }
  const crit = rng() < CONFIG.juice.critChance;
  const rich = !!t.rich;
  const amount = blankValue(g) * comboMult(combo) * (crit ? CONFIG.juice.critMult : 1) * (rich ? CONFIG.juice.richMult : 1);
  t.charges -= 1;
  r.coins += amount;
  r.earned += amount;
  const events: GameEvent[] = [{ type: 'harvest', i, amount, crit, combo, rich }];
  if (withHeat) {
    r.heat += CONFIG.heat.perHarvest;
    while (r.heat >= r.nextMineAt) {
      r.nextMineAt += heatInterval(g);
      const ev = plantMine(g, rng);
      if (ev) events.push(ev);
    }
  }
  return events;
}

/**
 * Heat plants a mine under a hidden tile, preferring tiles next to charged blanks, so staying
 * long collapses your best nodes. With no hidden tile to spare, a charged blank collapses instead.
 */
function plantMine(g: GameState, rng: Rng): GameEvent | null {
  const b = g.run.board;
  const spots = b.tiles.map((_, i) => i).filter(i => !b.tiles[i].revealed && !b.tiles[i].mine);
  const before = b.tiles.filter(t => t.cracked).length;
  // Leave at least one safe hidden tile so the board can still be cleared
  if (spots.length <= 1) {
    const charged = b.tiles.map((_, i) => i).filter(i => b.tiles[i].revealed && !b.tiles[i].mine && b.tiles[i].charges > 0);
    if (!charged.length) return null;
    const i = charged[Math.floor(rng() * charged.length)];
    b.tiles[i].charges = 0;
    b.tiles[i].cracked = true;
    return { type: 'planted', i, cracked: 1 };
  }
  const nearCharged = spots.filter(i => neighbors(b, i).some(n => b.tiles[n].revealed && b.tiles[n].charges > 0));
  const pool = nearCharged.length ? nearCharged : spots;
  const i = pool[Math.floor(rng() * pool.length)];
  b.tiles[i].mine = true;
  recountAdj(b);
  crackBlanks(b);
  const cracked = b.tiles.filter(t => t.cracked).length - before;
  return { type: 'planted', i, cracked };
}

export function cashOut(g: GameState): GameEvent[] {
  if (g.run.result) return [];
  return [endRun(g, 'cashout')];
}

function endRun(g: GameState, kind: RunEnd, i?: number): GameEvent {
  const r = g.run;
  const keep = kind === 'cashout' ? CONFIG.run.keepOnCashOut : kind === 'clear' ? CONFIG.run.keepOnClear : keepOnDeath(g);
  const shards = shardsFor(r.earned * keep);
  r.result = { kind, earned: r.earned, keep, shards };
  g.shards += shards;
  g.lifetimeShards += shards;
  g.stats.runs += 1;
  if (kind === 'clear') g.stats.clears += 1;
  if (kind === 'death') g.stats.deaths += 1;
  if (kind === 'cashout') g.stats.cashouts += 1;
  g.stats.bestEarned = Math.max(g.stats.bestEarned, r.earned);
  g.stats.totalEarned += r.earned;
  return { type: 'runEnd', result: r.result, i };
}

export function startNewRun(g: GameState, now: number) {
  g.run = newRun(g, now);
}

// ---------- buying ----------

export function canBuyRun(g: GameState, id: RunUpgradeId): boolean {
  const r = g.run;
  const def = CONFIG.run_upgrades[id];
  const lvl = r.levels[id];
  if (r.result || !runUpgradeUnlocked(g, id) || isMaxed(def, lvl) || r.coins < cost(def, lvl)) return false;
  if (id === 'expand') return r.board.w < maxSide(g);
  if (id === 'shield') return r.shields < 1;
  if (id === 'detector') return r.board.minesPlaced && r.board.tiles.some(t => t.mine && !t.revealed && !t.flagged);
  return true;
}

export function buyRun(g: GameState, id: RunUpgradeId, rng: Rng = Math.random): number | null {
  if (!canBuyRun(g, id)) return null;
  const r = g.run;
  r.coins -= cost(CONFIG.run_upgrades[id], r.levels[id]);
  r.levels[id] += 1;
  if (id === 'expand') expandBoard(g, rng);
  if (id === 'deepVeins') {
    for (const t of r.board.tiles) if (t.revealed && !t.mine && t.adj === 0 && !t.cracked) t.charges += 2;
  }
  if (id === 'shield') r.shields += 1;
  if (id === 'detector') {
    const targets = r.board.tiles.map((t, i) => i).filter(i => {
      const t = r.board.tiles[i];
      return t.mine && !t.revealed && !t.flagged;
    });
    const i = targets[Math.floor(rng() * targets.length)];
    r.board.tiles[i].flagged = true;
    return i;
  }
  return null;
}

function expandBoard(g: GameState, rng: Rng) {
  const old = g.run.board;
  const w = old.w + 1, h = old.h + 1;
  const tiles: Tile[] = [];
  const fresh: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < old.w && y < old.h) tiles.push(old.tiles[y * old.w + x]);
      else {
        fresh.push(tiles.length);
        tiles.push(emptyTile());
      }
    }
  }
  const b: Board = { w, h, tiles, minesPlaced: old.minesPlaced, pendingMines: old.pendingMines };
  const newMines = Math.round(fresh.length * density(g));
  if (b.minesPlaced) {
    for (const i of shuffle(fresh, rng).slice(0, newMines)) tiles[i].mine = true;
    recountAdj(b);
    crackBlanks(b);
  } else {
    b.pendingMines += newMines;
  }
  g.run.board = b;
}

export function canBuyMeta(g: GameState, id: MetaUpgradeId): boolean {
  const def = CONFIG.meta_upgrades[id];
  const lvl = g.meta[id];
  return !isMaxed(def, lvl) && g.shards >= cost(def, lvl);
}

export function buyMeta(g: GameState, id: MetaUpgradeId): boolean {
  if (!canBuyMeta(g, id)) return false;
  g.shards -= cost(CONFIG.meta_upgrades[id], g.meta[id]);
  g.meta[id] += 1;
  return true;
}

// ---------- time ----------

/** Advance the auto-harvester by dt seconds. */
export function tick(g: GameState, dt: number, rng: Rng = Math.random): GameEvent[] {
  const r = g.run;
  const events: GameEvent[] = [];
  if (r.result || r.levels.autoHarvest === 0) return events;
  r.autoAcc += dt * r.levels.autoHarvest * CONFIG.autoHarvest.tapsPerSecPerLevel;
  while (r.autoAcc >= 1 && !r.result) {
    r.autoAcc -= 1;
    const i = pickChargedBlank(r.board, rng);
    if (i < 0) {
      r.autoAcc = 0;
      break;
    }
    events.push(...harvest(g, i, rng));
  }
  return events;
}

function pickChargedBlank(b: Board, rng: Rng): number {
  const ready = b.tiles.map((t, i) => i).filter(i => b.tiles[i].revealed && !b.tiles[i].mine && b.tiles[i].charges > 0);
  return ready.length ? ready[Math.floor(rng() * ready.length)] : -1;
}

/** Time away: the auto-harvester runs at a reduced rate and builds no Heat. */
export function applyOffline(g: GameState, now: number, rng: Rng = Math.random): { seconds: number; coins: number } {
  const elapsed = Math.max(0, (now - g.lastTick) / 1000);
  const seconds = Math.min(elapsed, CONFIG.autoHarvest.offlineCapHours * 3600);
  const r = g.run;
  if (r.result || r.levels.autoHarvest === 0 || seconds < 10) return { seconds: 0, coins: 0 };
  let taps = Math.floor(seconds * r.levels.autoHarvest * CONFIG.autoHarvest.tapsPerSecPerLevel * CONFIG.autoHarvest.offlineRate);
  const before = r.coins;
  while (taps-- > 0) {
    const i = pickChargedBlank(r.board, rng);
    if (i < 0) break;
    harvest(g, i, rng, false);
  }
  return { seconds, coins: r.coins - before };
}
