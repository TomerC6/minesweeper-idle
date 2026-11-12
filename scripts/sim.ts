// Balance simulation: a simple bot plays the game and prints progress at checkpoints.
// Run with `npm run sim` (optionally `npm run sim -- 7` for a different seed).
import { CONFIG, type MetaUpgradeId, type RunUpgradeId } from '../src/config';
import { fmt } from '../src/format';
import * as G from '../src/game';

const SECONDS_PER_CLICK = 0.6;
const SECONDS_BETWEEN_RUNS = 4;
const GUESS_IF_MINE_CHANCE_BELOW = 0.3;
const CHECKPOINTS_MIN = [1, 2, 5, 10, 30, 60, 120];

function mulberry32(seed: number): G.Rng {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(Number(process.argv[2] ?? 1));
const g = G.newGame(0);
let clock = 0; // simulated seconds

function spend(seconds: number) {
  clock += seconds;
  G.tick(g, seconds, rng);
}

function buyRunUpgrades() {
  const order: RunUpgradeId[] = ['richSoil', 'deepVeins', 'expand', 'autoHarvest', 'surveyor', 'shield'];
  for (;;) {
    const options = order.filter(id => G.canBuyRun(g, id));
    if (!options.length) return;
    options.sort((a, b) => G.cost(CONFIG.run_upgrades[a], g.run.levels[a]) - G.cost(CONFIG.run_upgrades[b], g.run.levels[b]));
    G.buyRun(g, options[0], rng);
    spend(SECONDS_PER_CLICK);
  }
}

function buyMetaUpgrades() {
  const ids = Object.keys(CONFIG.meta_upgrades) as MetaUpgradeId[];
  for (;;) {
    const options = ids.filter(id => G.canBuyMeta(g, id));
    if (!options.length) return;
    options.sort((a, b) => G.cost(CONFIG.meta_upgrades[a], g.meta[a]) - G.cost(CONFIG.meta_upgrades[b], g.meta[b]));
    G.buyMeta(g, options[0]);
  }
}

/** One deduction step: returns true if it revealed or flagged something. */
function deduce(): boolean {
  const b = g.run.board;
  for (let i = 0; i < b.tiles.length; i++) {
    const t = b.tiles[i];
    if (!t.revealed || t.mine || t.adj === 0) continue;
    const ns = G.neighbors(b, i);
    const hidden = ns.filter(n => !b.tiles[n].revealed && !b.tiles[n].flagged);
    const marked = ns.filter(n => b.tiles[n].flagged || b.tiles[n].defused).length;
    if (!hidden.length) continue;
    if (marked === t.adj) {
      G.reveal(g, hidden[0], rng);
      return true;
    }
    if (marked + hidden.length === t.adj) {
      G.toggleFlag(g, hidden[0]);
      return true;
    }
  }
  return false;
}

function playRun() {
  const b0 = g.run.board;
  G.reveal(g, Math.floor(b0.tiles.length / 2), rng);
  spend(SECONDS_PER_CLICK);
  while (!g.run.result) {
    buyRunUpgrades();
    const b = g.run.board;
    const blank = b.tiles.findIndex(t => t.revealed && !t.mine && t.charges > 0);
    if (blank >= 0) {
      G.harvest(g, blank, rng, true, clock * 1000);
    } else if (!deduce()) {
      // stuck: guess or cash out
      const hidden = b.tiles.map((_, i) => i).filter(i => !b.tiles[i].revealed && !b.tiles[i].flagged);
      const p = Math.max(0, G.minesLeft(b)) / Math.max(1, hidden.length);
      if (g.run.shields > 0 || p < GUESS_IF_MINE_CHANCE_BELOW) {
        G.reveal(g, hidden[Math.floor(rng() * hidden.length)], rng);
      } else {
        G.cashOut(g);
      }
    }
    spend(SECONDS_PER_CLICK);
  }
}

const runLog: { earned: number; kind: string; side: number }[] = [];
let nextCheckpoint = 0;

function report() {
  const recent = runLog.slice(-5);
  const avg = recent.reduce((s, r) => s + r.earned, 0) / Math.max(1, recent.length);
  const kinds = recent.map(r => r.kind[0]).join('');
  const m = g.meta;
  console.log(
    `${String(CHECKPOINTS_MIN[nextCheckpoint]).padStart(4)} min | runs ${String(g.stats.runs).padStart(4)} | ` +
    `avg coins/run ${fmt(avg).padStart(6)} | shards ${fmt(g.shards).padStart(6)} (life ${fmt(g.lifetimeShards).padStart(6)}) | ` +
    `side ${recent.at(-1)?.side ?? '-'} | last5 ${kinds.padEnd(5)} | ` +
    `HS${m.headStart} SN${m.safetyNet} SG${m.steadyGround} BC${m.biggerClaim} GT${m.goldenTouch} CH${m.coolHead} ` +
    `unlocks ${['unlockDetector', 'unlockAuto', 'unlockShield', 'unlockSurveyor'].filter(k => m[k as MetaUpgradeId]).length}/4`,
  );
}

console.log(`seed ${process.argv[2] ?? 1}; kinds: c=cash out, l=clear, d=death`);
while (nextCheckpoint < CHECKPOINTS_MIN.length) {
  G.startNewRun(g, clock * 1000);
  playRun();
  const side = g.run.board.w;
  runLog.push({ earned: g.run.result!.earned, kind: g.run.result!.kind === 'clear' ? 'l' : g.run.result!.kind, side });
  buyMetaUpgrades();
  spend(SECONDS_BETWEEN_RUNS);
  while (nextCheckpoint < CHECKPOINTS_MIN.length && clock >= CHECKPOINTS_MIN[nextCheckpoint] * 60) {
    report();
    nextCheckpoint++;
  }
}
