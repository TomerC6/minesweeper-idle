import LZString from 'lz-string';
import { CONFIG } from './config';
import { newGame, newRun, type GameState } from './game';

const KEY = 'minesweeper-idle.save';

export function serialize(g: GameState): string {
  return LZString.compressToBase64(JSON.stringify(g));
}

/** Parses an exported save string. Throws with a readable message when it is not one. */
export function deserialize(text: string, now: number): GameState {
  const json = LZString.decompressFromBase64(text.trim());
  if (!json) throw new Error('That is not a save string. Copy the whole text from Export and try again.');
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('That save string is damaged. Copy the whole text from Export and try again.');
  }
  return migrate(raw, now);
}

/** Fills in fields added after a save was made, so old saves keep loading. */
function migrate(raw: unknown, now: number): GameState {
  const base = newGame(now);
  if (!raw || typeof raw !== 'object' || (raw as GameState).version !== 1) {
    throw new Error('That save is from an unknown version of the game.');
  }
  const s = raw as GameState;
  const g: GameState = {
    ...base,
    ...s,
    meta: { ...base.meta, ...s.meta },
    stats: { ...base.stats, ...s.stats },
  };
  g.run = s.run ? { ...newRun(g, now), ...s.run, levels: { ...newRun(g, now).levels, ...s.run.levels } } : newRun(g, now);
  return g;
}

export function saveLocal(g: GameState) {
  try {
    localStorage.setItem(KEY, serialize(g));
  } catch {
    // storage blocked (private window, preview): the game still runs, it just won't persist
  }
}

export function loadLocal(now: number): GameState | null {
  try {
    const text = localStorage.getItem(KEY);
    return text ? deserialize(text, now) : null;
  } catch {
    return null;
  }
}

export function clearLocal() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export const AUTOSAVE_MS = CONFIG.autosaveSeconds * 1000;
