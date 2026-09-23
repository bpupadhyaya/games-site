// Auto Play's move-picker. One Arrow Oath has no in-game AI file (it is a single-player card
// battler — nobody to control but you) but it does already have reusable move-choosing logic:
// design/sim.mjs, the private balance simulator, drives whole runs by scoring the same choices a
// player faces, calling only the pure functions in rules/battle.js and rules/run.js. This module
// ports that scoring (chooseCard/pickTarget/draftValue/chooseDoor) for Auto Play to reuse, rather
// than inventing a second, different move-picker. sim.mjs itself is never imported here — it is a
// dev-only Node script — but its heuristics are copied over near verbatim (style fixed to
// 'careful', the steadiest of its three).
import { CARDS } from './data/cards.js';
import * as B from './rules/battle.js';

const BACK_OFF = 6;

const living = (battle) => battle.enemies.filter((e) => !e.dead);
const incoming = (battle) => battle.enemies.reduce((n, e) => n + (!e.dead && e.intent?.type === 'attack' && !e.answered ? e.intent.value + e.strength : 0), 0);

export function pickTarget(battle) {
  const alive = living(battle);
  if (!alive.length) return 0;
  const lure = alive.find((e) => e.decoy);
  if (lure) return battle.enemies.indexOf(lure);
  const attackers = alive.filter((e) => e.intent?.type === 'attack' && !e.answered);
  const pool = attackers.length ? attackers : alive;
  pool.sort((a, b) => a.hp - b.hp);
  return battle.enemies.indexOf(pool[0]);
}

// Scores every playable card in hand against the current battle and returns the best one, or null
// when nothing is worth playing (the signal to end the turn instead).
export function chooseCard(battle) {
  const p = battle.player;
  const danger = incoming(battle) - p.guard;
  const target = pickTarget(battle);
  const targetEnemy = battle.enemies[target];
  const lureUp = living(battle).some((e) => e.decoy);
  const starving = living(battle).some((e) => e.feeds && e.strength >= BACK_OFF);
  let best = null;
  battle.hand.forEach((inst, i) => {
    if (!B.canPlay(battle, i)) return;
    const card = CARDS[inst.id];
    const fx = card.fx;
    let score = 0;
    const answers = B.wouldAnswer(battle, i, target);
    if (fx.draw) score += 30;
    if (fx.focus) score += 40;
    if (fx.ward) score += answers ? 90 : danger > 0 ? 8 : 1;
    if (fx.guard) score += danger > 0 ? 20 + Math.min(fx.guard, danger) * 2 : 2;
    if (fx.aim) score += battle.hand.some((c) => CARDS[c.id].fx.dmg) ? 14 : 0;
    if (fx.exposed && !fx.dmg) score += targetEnemy && targetEnemy.hp > 25 ? 16 : 0;
    if (starving && (fx.dmg || fx.guardToDmg)) return;
    if (fx.guardToDmg) score += p.guard >= 8 ? 20 + p.guard : 0;
    if (fx.heal) score += p.resolve < p.maxResolve - fx.heal ? 12 : 0;
    if (fx.stun) score += danger > 0 ? 45 : 0;
    if (fx.dmg) {
      const total = fx.dmg * (fx.hits ?? 1);
      if (card.kind === 'tech') score += 25 + total;
      else {
        const hp = targetEnemy ? targetEnemy.hp + targetEnemy.guard : 0;
        const fits = total <= hp + 4;
        if (lureUp && !fx.all) score -= 100;
        else if (answers) score += 70 + total;
        else if (danger >= p.resolve) score += 60 + total;
        else if (fits && hp >= 18) score += 22 + total * 0.5;
        else score -= 20;
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { i, score, target };
  });
  return best;
}

// How much a card is worth drafting (reward pick, Tuner purchase). Higher is better.
export function draftValue(id) {
  const c = CARDS[id];
  const fx = c.fx;
  if (fx.foul) return -50;
  let v = 0;
  const dmg = (fx.dmg ?? 0) * (fx.hits ?? 1) * (fx.all ? 1.6 : 1) + (fx.perSpent ?? 0) * 4 + (fx.perUnspent ?? 0) * 3 + (fx.lastArrow ?? 0) * 0.5;
  v += c.kind === 'arrow' ? dmg * 0.8 : dmg * 1.1;
  v += (fx.guard ?? 0) * 1.2 + (fx.held?.guard ?? 0) * 1.0 + (fx.draw ?? 0) * 7 + (fx.focus ?? 0) * 9 + (fx.heal ?? 0) * 1.2;
  v += (fx.aim ?? 0) * 0.8 + (fx.exposed ?? 0) * 3 + (fx.weak ?? 0) * 3 + (fx.strengthDown ?? 0) * 4 + (fx.stun ? 14 : 0);
  if (fx.guardToDmg) v += 12;
  if (c.element) v += 5;
  if (fx.ward) v += 12;
  v -= c.cost * 3;
  const rank = { common: 0, uncommon: 4, rare: 8 }[c.rarity] ?? 0;
  return v + rank;
}

// Which door to walk through: rest when hurt and a camp is offered, seek an elite when healthy and
// one is offered (more Marks and rewards), otherwise take the ordinary fight, then an Envoy.
export function chooseDoor(run) {
  const doors = run.doors;
  const hurt = run.resolve / run.maxResolve;
  const want = (kind) => doors.findIndex((d) => d.kind === kind);
  if (hurt < 0.55 && want('camp') >= 0) return want('camp');
  if (hurt > 0.75 && want('elite') >= 0) return want('elite');
  if (want('fight') >= 0) return want('fight');
  if (want('envoy') >= 0) return want('envoy');
  if (want('boss') >= 0) return want('boss');
  return 0;
}

export function chooseReward(cards) {
  let best = 0;
  for (let i = 1; i < cards.length; i++) if (draftValue(cards[i]) > draftValue(cards[best])) best = i;
  return best;
}

// Camp always has "Rest" as its first option (see game.js's campOptions) and it is always the
// simplest reasonable choice for a run with nobody at the keyboard to plan around a later Debt.
export function chooseCampOption(options) {
  const i = options.findIndex((o) => o.id === 'rest');
  return i >= 0 ? i : 0;
}

// Prefers an option that does not break the Covenant (lose Standing) when one exists.
export function chooseEnvoyOption(event) {
  const options = event.options;
  const safe = options.findIndex((o) => !((o.effect.standing ?? 0) < 0));
  return safe >= 0 ? safe : 0;
}

// The Tuner: buy the single best-value affordable item worth having, or leave.
export function chooseTunerAction(run, door) {
  const stock = door.stock ?? [];
  let best = -1;
  let bestV = -Infinity;
  stock.forEach((item, i) => {
    if (item.sold || run.marks < item.price) return;
    const v = draftValue(item.id);
    if (v > bestV) {
      bestV = v;
      best = i;
    }
  });
  if (best >= 0 && bestV > 12) return { buy: best };
  return { leave: true };
}
