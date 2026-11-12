// Every balance number in the game lives here. Edit, save, and the dev server reloads.

export interface UpgradeDef {
  name: string;
  desc: string;
  base: number;      // cost of the first level
  growth: number;    // cost multiplier per level owned
  max?: number;      // level cap (omit for no cap)
}

export const CONFIG = {
  board: {
    startSide: 4,           // starting board is startSide x startSide
    baseDensity: 0.20,      // share of tiles that are mines
    minDensity: 0.10,
    expandCapOverStart: 4,  // Expand can grow the board this many sides past the start
    firstClickSafe: true,
  },

  blank: {
    baseValue: 1,           // Coins per harvest tap before upgrades
    baseCharges: 5,         // taps per blank before it runs dry
  },

  heat: {
    perHarvest: 1,          // Heat added per harvest tap
    payoutPerHeat: 0.02,    // +2% payout per point of Heat
    mineEvery: 25,          // a mine is planted every N Heat
  },

  run: {
    keepOnCashOut: 1.0,
    keepOnClear: 1.5,       // 100% + 50% clear bonus
    keepOnDeath: 0.30,
  },

  // Shards = floor((keep * coinsEarned) ^ shardExponent)
  shardExponent: 0.45,

  autoHarvest: {
    tapsPerSecPerLevel: 1,
    offlineRate: 0.5,       // share of the online rate while away
    offlineCapHours: 8,
  },

  surveyorShare: 0.25,

  // Game feel: the rewards that make tapping fun
  juice: {
    comboWindowMs: 1200,    // tap again within this to keep the combo going
    comboPerStep: 0.05,     // +5% payout per combo step
    comboMaxSteps: 10,      // so the combo tops out at ×2
    critChance: 0.08,       // chance a harvest tap is a crit
    critMult: 5,
    richChance: 0.12,       // chance a new blank is a rich vein
    richMult: 4,            // rich veins pay this much more per tap
    discoveryTaps: 3,       // revealing a blank pays this many taps at once
    richSoilMilestone: 10,   // every N levels of Rich Soil doubles its value
  },      // number tiles pay this share of blank value per Surveyor level

  // In-run upgrades, bought with Coins, reset every run
  run_upgrades: {
    richSoil:   { name: 'Rich Soil',      desc: '+1 base Coins per tap. Doubles every 10 levels',  base: 5, growth: 1.75 },
    expand:     { name: 'Expand',         desc: '+1 row and +1 column of hidden tiles',           base: 12, growth: 2.3 },
    deepVeins:  { name: 'Deep Veins',     desc: '+2 charges on every blank',                      base: 12, growth: 2.0 },
    detector:   { name: 'Detector',       desc: 'Flags one random hidden mine',                   base: 30, growth: 1.7 },
    autoHarvest:{ name: 'Auto-Harvester', desc: 'Taps 1 charged blank per second. Builds Heat',   base: 40, growth: 2.0 },
    shield:     { name: 'Shield',         desc: 'Absorbs one mine hit. Hold one at a time',       base: 50, growth: 2.5 },
    surveyor:   { name: 'Surveyor',       desc: 'Number tiles pay 25% of blank value on reveal',  base: 25, growth: 2.2, max: 4 },
  } satisfies Record<string, UpgradeDef>,

  // Meta-upgrades, bought with Shards, kept until prestige
  meta_upgrades: {
    headStart:    { name: 'Head Start',    desc: 'Start each run with 10 × (2^L − 1) Coins',     base: 3,  growth: 2.2 },
    safetyNet:    { name: 'Safety Net',    desc: '+7% of Coins kept when you hit a mine',        base: 5,  growth: 2.0, max: 10 },
    steadyGround: { name: 'Steady Ground', desc: '−1 point of mine density',                     base: 6,  growth: 2.6, max: 10 },
    biggerClaim:  { name: 'Bigger Claim',  desc: '+1 starting board side',                       base: 8,  growth: 4, max: 6 },
    goldenTouch:  { name: 'Golden Touch',  desc: '×1.5 all Coin income',                         base: 10, growth: 3.2 },
    coolHead:     { name: 'Cool Head',     desc: '+5 Heat between planted mines',                base: 12, growth: 2.8, max: 10 },
    prospector:   { name: 'Prospector',    desc: 'Your first click also reveals the tiles around it',     base: 15, growth: 1,   max: 1 },
    unlockDetector:   { name: 'Workshop: Detector',       desc: 'Unlocks Detector in runs',       base: 10, growth: 1, max: 1 },
    unlockAuto:       { name: 'Workshop: Auto-Harvester', desc: 'Unlocks Auto-Harvester in runs', base: 25, growth: 1, max: 1 },
    unlockShield:     { name: 'Workshop: Shield',         desc: 'Unlocks Shield in runs',         base: 40, growth: 1, max: 1 },
    unlockSurveyor:   { name: 'Workshop: Surveyor',       desc: 'Unlocks Surveyor in runs',       base: 60, growth: 1, max: 1 },
  } satisfies Record<string, UpgradeDef>,

  meta_effects: {
    headStartCoins: 10,       // 10 × (2^L − 1)
    safetyNetPerLevel: 0.07,
    steadyGroundPerLevel: 0.01,
    goldenTouchMult: 1.5,
    coolHeadPerLevel: 5,
  },

  format: {
    scientificFrom: 1e12,     // numbers at or above this use 5.6e12 style
    suffixes: ['', 'K', 'M', 'B'],
  },

  autosaveSeconds: 10,
};

export type RunUpgradeId = keyof typeof CONFIG.run_upgrades;
export type MetaUpgradeId = keyof typeof CONFIG.meta_upgrades;
