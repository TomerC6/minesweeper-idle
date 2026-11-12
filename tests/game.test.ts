import { describe, expect, it } from 'vitest';
import { fmt } from '../src/format';
import * as G from '../src/game';
import { deserialize, serialize } from '../src/save';

describe('fmt', () => {
  it('formats small and large numbers', () => {
    expect(fmt(5)).toBe('5');
    expect(fmt(2.5)).toBe('2.5');
    expect(fmt(950)).toBe('950');
    expect(fmt(1234)).toBe('1.23K');
    expect(fmt(3.4e6)).toBe('3.40M');
    expect(fmt(999_999)).toBe('1.00M');
    expect(fmt(5.6e12)).toBe('5.60e12');
  });
});

describe('juice', () => {
  it('combo builds on quick taps and resets after a pause', () => {
    const g = G.newGame(0);
    const noLuck = () => 0.99;
    G.reveal(g, 5, noLuck);
    G.harvest(g, 5, noLuck, true, 0);
    G.harvest(g, 5, noLuck, true, 500);
    expect(g.run.combo).toBe(2);
    G.harvest(g, 5, noLuck, true, 5000);
    expect(g.run.combo).toBe(1);
  });

  it('crits multiply a tap', () => {
    const g = G.newGame(0);
    G.reveal(g, 5, () => 0.99);
    const [ev] = G.harvest(g, 5, () => 0.01);
    expect(ev).toMatchObject({ type: 'harvest', crit: true });
    expect((ev as { amount: number }).amount).toBe(5);
  });
});

describe('runs', () => {
  it('opens the first click on a blank and harvesting pays and builds Heat', () => {
    const g = G.newGame(0);
    const noLuck = () => 0.99; // no crit, no rich vein
    G.reveal(g, 5, noLuck);
    const t = g.run.board.tiles[5];
    expect(t.mine).toBe(false);
    expect(t.adj).toBe(0);
    expect(t.charges).toBe(5);
    expect(g.run.coins).toBe(3); // discovery pays 3 taps
    G.harvest(g, 5, noLuck);
    expect(g.run.coins).toBe(4);
    expect(g.run.heat).toBe(1);
    expect(t.charges).toBe(4);
  });

  it('ends the run on a mine and converts kept Coins to Shards', () => {
    const g = G.newGame(0);
    G.reveal(g, 0);
    g.run.earned = 100;
    const mine = g.run.board.tiles.findIndex(t => t.mine);
    G.reveal(g, mine);
    expect(g.run.result?.kind).toBe('death');
    expect(g.run.result?.shards).toBe(G.shardsFor(30));
  });

  it('a Shield absorbs one mine', () => {
    const g = G.newGame(0);
    G.reveal(g, 0);
    g.run.shields = 1;
    const mine = g.run.board.tiles.findIndex(t => t.mine);
    G.reveal(g, mine);
    expect(g.run.result).toBeNull();
    expect(g.run.board.tiles[mine].defused).toBe(true);
  });

  it('Expand adds a row and a column', () => {
    const g = G.newGame(0);
    G.reveal(g, 0);
    g.run.coins = 1000;
    G.buyRun(g, 'expand');
    expect(g.run.board.w).toBe(5);
    expect(g.run.board.tiles.length).toBe(25);
  });

  it('save strings round-trip', () => {
    const g = G.newGame(0);
    g.shards = 42;
    G.reveal(g, 0);
    const back = deserialize(serialize(g), 0);
    expect(back.shards).toBe(42);
    expect(back.run.board.tiles.length).toBe(16);
    expect(() => deserialize('nonsense', 0)).toThrow();
  });
});
