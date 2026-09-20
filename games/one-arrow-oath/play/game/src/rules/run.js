// Run rules: the path of doors, rewards, camps, the Tuner's shop, Envoy events, Debts, Standing
// and the final Legend score. Pure data like rules/battle.js — no drawing, sound or storage.
import { CARDS, CARD_IDS, STARTING_QUIVER, ELEMENT_NAMES, cardValue } from '../data/cards.js';
import { ENCOUNTERS, ENEMIES, NATIVE_TUNE, STEP_SCALE, buildRivalQuiver } from '../data/enemies.js';
import { DEBTS, DEBT_IDS, LINKABLE_DEBTS, SETTLE_COST_MAX_RESOLVE } from '../data/debts.js';
import { EVENTS, EVENT_IDS } from '../data/events.js';
import { ARCHERS } from '../data/meta.js';

export const ACTS = 3;
export const STEPS_PER_ACT = 6;
export const ACT_HEAL_FRACTION = 0.25;
export const START_RESOLVE = 50;
export const START_MARKS = 20;
export const CAMP_HEAL_FRACTION = 0.3;
export const SKIP_REWARD_MARKS = 8;
export const PRICES = { common: 25, uncommon: 45, rare: 80 };
export const REMOVE_PRICE = 30;

// Door kinds offered at each step of the first act (order is shuffled per run).
const STEP_DOORS = [
  ['easy', 'easy'],
  ['normal', 'envoy'],
  ['normal', 'elite', 'tuner'],
  ['normal', 'camp', 'envoy'],
  ['normal', 'elite', 'tuner'],
  ['camp', 'tuner'],
];

const RARITY_WEIGHTS = {
  normal: [['common', 60], ['uncommon', 32], ['rare', 8]],
  elite: [['common', 30], ['uncommon', 48], ['rare', 22]],
  boss: [['common', 0], ['uncommon', 40], ['rare', 60]],
};

const POOL = CARD_IDS.filter((id) => CARDS[id].rarity !== 'starter' && !CARDS[id].bonus);
const poolOf = (kind, rarity) => POOL.filter((id) => CARDS[id].kind === kind && CARDS[id].rarity === rarity);

function weighted(rng, table) {
  const total = table.reduce((n, [, w]) => n + w, 0);
  let roll = rng.next() * total;
  for (const [value, w] of table) {
    roll -= w;
    if (roll < 0) return value;
  }
  return table[table.length - 1][0];
}

export function addCard(run, id) {
  run.deck.push({ uid: run.nextUid, id });
  run.nextUid += 1;
}

export function newRun(rng, { archer = 'keeper', oath = 0 } = {}) {
  const run = {
    archer, oath,
    act: 1, step: 0, deck: [], nextUid: 1, spent: [], marks: oath >= 1 ? 0 : START_MARKS,
    resolve: oath >= 9 ? 40 : START_RESOLVE, maxResolve: oath >= 9 ? 40 : START_RESOLVE, standing: 3, unblemished: true, fouls: 0,
    debts: [], battlesWon: 0, guardNext: 0, enemyGuardNext: 0, spotterFights: 0,
    seenEvents: [], doors: [], result: null,
    // Things promised or owed by Debts and events, consumed by later steps and fights.
    pending: null, owed: [], arrivals: [], masters: null, promised: null, debtHalved: {},
    silentFights: 0, hiredShieldAct: 0, tunerHalf: false, skipNext: false, wager: false, burnFights: 0,
    enemyHpNext: 0, enemyWeakNext: 0, focusMinusNext: 0, eliteHpMult: 1, legendBonus: 0, captains: false,
  };
  // The quiver you begin with depends on who you are, and on the vows you have added.
  const quiver = [...ARCHERS[archer].quiver];
  if (oath >= 2) {
    const last = quiver.map((id, i) => [id, i]).filter(([id]) => CARDS[id].kind === 'arrow').pop();
    if (last) quiver.splice(last[1], 1);
  }
  if (oath >= 8) for (let i = 0; i < 2; i++) quiver.splice(quiver.indexOf('reed'), 1);
  for (const id of quiver) addCard(run, id);
  // The Rival's quiver is fixed for the whole run, so the player can plan a draft against it.
  const rival = ENEMIES.the_rival;
  run.rivalQuiver = buildRivalQuiver(rng, (1 + STEP_SCALE * STEPS_PER_ACT) * NATIVE_TUNE[rival.act].atk * (rival.tune?.atk ?? 1));
  genDoors(run, rng);
  if (oath >= 4) takeDebt(run, rng.pick(LINKABLE_DEBTS), rng);
  return run;
}

function pickEvent(run, rng) {
  const fresh = EVENT_IDS.filter((id) => !run.seenEvents.includes(id));
  return rng.pick(fresh.length ? fresh : EVENT_IDS);
}

export function genDoors(run, rng) {
  if (run.step >= STEPS_PER_ACT) {
    run.doors = [{ kind: 'boss', encounter: rng.pick(ENCOUNTERS[run.act].boss) }];
    return;
  }
  const kinds = rng.shuffle(STEP_DOORS[run.step]);
  const used = [];
  run.doors = kinds.map((kind) => {
    if (kind === 'easy' || kind === 'normal' || kind === 'elite') {
      const all = ENCOUNTERS[run.act][kind];
      const table = all.filter((enc) => !used.includes(enc));
      const encounter = rng.pick(table.length ? table : all);
      used.push(encounter);
      return { kind: kind === 'elite' ? 'elite' : 'fight', encounter };
    }
    if (kind === 'envoy') return { kind, event: pickEvent(run, rng) };
    if (kind === 'tuner') return { kind, stock: genStock(run, rng) };
    return { kind };
  });
  if (run.captains) {
    run.captains = false;
    let at = run.doors.findIndex((d) => d.kind === 'fight');
    if (at < 0) at = run.doors.length - 1;
    run.doors[at] = { kind: 'elite', encounter: rng.pick(ENCOUNTERS[run.act].elite), guaranteeRare: true };
  }
}

// FOUL cards are temptations: half as likely to appear, and never on an ordinary reward while you
// are still Unblemished. Elites and the Tuner offer them freely.
function rollCard(run, rng, tier, forceArrow, exclude, allowFoul, forceRare = false) {
  for (let tries = 0; tries < 30; tries++) {
    const rarity = forceRare ? 'rare' : weighted(rng, RARITY_WEIGHTS[tier]);
    const kind = forceArrow || rng.chance(0.7) ? 'arrow' : 'tech';
    const options = poolOf(kind, rarity).filter((id) => !exclude.includes(id) && (allowFoul || !CARDS[id].fx.foul));
    if (!options.length) continue;
    const id = rng.pick(options);
    if (CARDS[id].fx.foul && !rng.chance(0.5)) continue;
    return id;
  }
  return rng.pick(POOL.filter((id) => !exclude.includes(id) && !CARDS[id].fx.foul));
}

export function genRewards(run, rng, tier = 'normal', guaranteeRare = false) {
  const allowFoul = tier !== 'normal' || !run.unblemished;
  const picks = [];
  for (let i = 0; i < (run.oath >= 7 ? 2 : 3); i++) picks.push(rollCard(run, rng, tier, i === 0, picks, allowFoul, guaranteeRare && i === 0));
  return picks;
}

function genStock(run, rng) {
  const picks = [];
  for (let i = 0; i < 3; i++) picks.push(rollCard(run, rng, i === 2 ? 'elite' : 'normal', i === 0, picks, true));
  const half = run.tunerHalf ? 0.5 : 1;
  return picks.map((id) => ({ id, price: Math.ceil((PRICES[CARDS[id].rarity] ?? PRICES.common) * half), sold: false }));
}

export function battleMarks(rng, tier) {
  return 10 + rng.int(6) + (tier === 'elite' ? 15 : tier === 'boss' ? 40 : 0);
}

// Called after a door's business is finished: move along the path. Returns 'act' when a new act
// begins (so the screen can announce it) and sets run.result when the last boss has fallen.
export function advance(run, rng) {
  run.step += 1;
  // Gifts that were promised "a few steps on" arrive now.
  run.arrivals = [];
  for (const owe of run.owed) owe.left -= 1;
  for (const owe of run.owed.filter((o) => o.left <= 0)) {
    const id = rng.pick(poolOf('arrow', owe.rarity));
    addCard(run, id);
    run.arrivals.push(id);
  }
  run.owed = run.owed.filter((o) => o.left > 0);
  // Slipping through the lines, or a night march, skips the next step of the road.
  if (run.skipNext) {
    run.skipNext = false;
    if (run.step < STEPS_PER_ACT) run.step += 1;
  }
  if (run.step > STEPS_PER_ACT) {
    if (run.act >= ACTS) {
      run.result = 'won';
      run.doors = [];
      return 'won';
    }
    run.act += 1;
    run.step = 0;
    run.resolve = Math.min(run.maxResolve, run.resolve + Math.round(run.maxResolve * ACT_HEAL_FRACTION));
    genDoors(run, rng);
    return 'act';
  }
  genDoors(run, rng);
  return 'step';
}

// ---- Debts
export function offerDebt(run, rng) {
  const bound = run.masters ?? [];
  const open = DEBT_IDS.filter((id) => !run.debts.includes(id) && !bound.includes(id));
  const linkable = LINKABLE_DEBTS.filter((id) => !run.debts.includes(id) && !bound.includes(id));
  const offers = open.filter((id) => id !== 'two_masters' || linkable.length >= 2);
  return offers.length ? rng.pick(offers) : null;
}

// Applies what a Debt gives you now. Returns the id of an Arrow handed over immediately, if any.
function applyGain(run, id, rng) {
  const gain = DEBTS[id].gain;
  let gained = null;
  if (gain.heal) run.resolve = Math.min(run.maxResolve, run.resolve + gain.heal);
  if (gain.maxResolve) {
    run.maxResolve += gain.maxResolve;
    run.resolve = Math.min(run.maxResolve, run.resolve + gain.maxResolve);
  }
  if (gain.marks) run.marks += gain.marks;
  if (gain.spotterFights) run.spotterFights += gain.spotterFights;
  if (gain.silentFights) run.silentFights += gain.silentFights;
  if (gain.tunerHalf) run.tunerHalf = true;
  if (gain.breaksCovenant) breakCovenant(run);
  if (gain.skipStep) run.skipNext = true;
  if (gain.hiredShieldAct) run.hiredShieldAct = run.act;
  if (gain.rareArrow) {
    gained = rng.pick(poolOf('arrow', 'rare'));
    addCard(run, gained);
  }
  if (gain.removeCards) run.pending = { type: 'remove', left: gain.removeCards, filter: 'any' };
  if (gain.chooseRare) run.pending = { type: 'gain', options: rng.shuffle(poolOf('arrow', 'rare')).slice(0, gain.chooseRare), promise: true };
  if (gain.twoMasters) {
    run.masters = rng.shuffle(LINKABLE_DEBTS.filter((d) => !run.debts.includes(d))).slice(0, 2);
    for (const d of run.masters) applyGain(run, d, rng);
  }
  return gained;
}

export function takeDebt(run, id, rng, { halved = false } = {}) {
  run.debts.push(id);
  if (halved) run.debtHalved[id] = true;
  return applyGain(run, id, rng);
}

export function settleDebt(run, id) {
  if (!run.debts.includes(id)) return false;
  run.debts = run.debts.filter((d) => d !== id);
  if (id === 'two_masters') run.masters = null;
  run.maxResolve = Math.max(10, run.maxResolve - SETTLE_COST_MAX_RESOLVE);
  run.resolve = Math.min(run.resolve, run.maxResolve);
  return true;
}

// ---- Picks the player still owes the game after a Debt or event
export function pendingCards(run) {
  const p = run.pending;
  if (!p) return [];
  if (p.type === 'gain') return p.options.map((id) => ({ id, uid: id }));
  return run.deck.filter((c) => p.filter === 'any' || CARDS[c.id].kind === p.filter).map((c) => ({ id: c.id, uid: c.uid }));
}

// The player chose `uid` (a quiver card for removals, a card id for gains). Returns true when done.
export function resolvePending(run, uid) {
  const p = run.pending;
  if (!p) return true;
  if (p.type === 'gain') {
    if (!p.options.includes(uid)) return false;
    addCard(run, uid);
    if (p.promise) run.promised = { uid: run.deck[run.deck.length - 1].uid, id: uid };
    run.pending = null;
    return true;
  }
  if (!run.deck.some((c) => c.uid === uid)) return false;
  removeCard(run, uid);
  p.left -= 1;
  if (p.left > 0) return false;
  if (p.thenGain) addCard(run, p.thenGain);
  run.pending = null;
  return true;
}

// ---- Camp
export const campHeal = (run) => Math.round(run.maxResolve * (run.oath >= 3 ? 0.2 : CAMP_HEAL_FRACTION));

export function campRest(run) {
  const amount = campHeal(run);
  run.resolve = Math.min(run.maxResolve, run.resolve + amount);
  return amount;
}

export const removableTechs = (run) => run.deck.filter((c) => CARDS[c.id].kind === 'tech');

export function removeCard(run, uid) {
  const before = run.deck.length;
  run.deck = run.deck.filter((c) => c.uid !== uid);
  return run.deck.length < before;
}

// ---- Tuner
export function buy(run, door, index) {
  const item = door.stock?.[index];
  if (!item || item.sold || run.marks < item.price) return false;
  run.marks -= item.price;
  item.sold = true;
  addCard(run, item.id);
  return true;
}

// ---- Envoy
export function breakCovenant(run) {
  run.standing = Math.max(0, run.standing - 1);
  run.unblemished = false;
}

// How the last enemy of a day opens, in plain words, for the Old Oathkeeper's story.
function describeOpening(run) {
  const key = ENCOUNTERS[run.act].boss[0][0];
  if (ENEMIES[key].rival) return `The Rival's first arrows: ${run.rivalQuiver.slice(0, 3).map((a) => a.name).join(', ')}.`;
  const words = ENEMIES[key].pattern.slice(0, 3).map((i) => {
    if (i.type === 'attack') return `${i.element ? `${ELEMENT_NAMES[i.element]} ` : ''}${i.value}${i.hits > 1 ? `×${i.hits}` : ''}`;
    if (i.type === 'guard') return `guard ${i.value}`;
    if (i.type === 'summon') return 'raises lures';
    return i.type;
  });
  return `${ENEMIES[key].name} opens: ${words.join(', then ')}.`;
}

const randomOfRarity = (rng, rarity) => rng.pick(poolOf('arrow', rarity));

export function giveArrow(run, rng, rarity) {
  const id = randomOfRarity(rng, rarity);
  addCard(run, id);
  return id;
}

export function applyEventOption(run, eventId, optionIndex, rng) {
  const option = EVENTS[eventId]?.options[optionIndex];
  const outcome = { gained: [], lost: [], debt: null, notes: [] };
  if (!option) return outcome;
  if (!run.seenEvents.includes(eventId)) run.seenEvents.push(eventId);
  const e = option.effect;
  if (e.resolve) run.resolve = Math.max(1, Math.min(run.maxResolve, run.resolve + e.resolve));
  if (e.marks) run.marks += e.marks;
  if (e.standing && e.standing < 0) breakCovenant(run);
  if (e.enemyGuardNext) run.enemyGuardNext = e.enemyGuardNext;
  if (e.guardNext) run.guardNext = e.guardNext;
  if (e.arrow) {
    const id = randomOfRarity(rng, e.arrow);
    addCard(run, id);
    outcome.gained.push(id);
  }
  if (e.arrowsNow) {
    for (let i = 0; i < e.arrowsNow.count; i++) {
      const id = randomOfRarity(rng, e.arrowsNow.rarity);
      addCard(run, id);
      outcome.gained.push(id);
    }
  }
  if (e.tradeUp) {
    const arrows = run.deck.filter((c) => CARDS[c.id].kind === 'arrow');
    if (arrows.length) {
      arrows.sort((a, b) => cardValue(CARDS[a.id]) - cardValue(CARDS[b.id]) || a.uid - b.uid);
      const worst = arrows[0];
      const rarity = CARDS[worst.id].rarity === 'uncommon' || CARDS[worst.id].rarity === 'rare' ? 'rare' : 'uncommon';
      removeCard(run, worst.uid);
      const id = randomOfRarity(rng, rarity);
      addCard(run, id);
      outcome.lost.push(worst.id);
      outcome.gained.push(id);
    }
  }
  if (e.debt) {
    const debt = offerDebt(run, rng);
    if (debt) {
      const arrowId = takeDebt(run, debt, rng, { halved: !!e.debtHalved });
      outcome.debt = debt;
      if (arrowId) outcome.gained.push(arrowId);
    }
  }
  if (e.debtId && !run.debts.includes(e.debtId)) {
    takeDebt(run, e.debtId, rng);
    outcome.debt = e.debtId;
  }
  // Promises and consequences that play out later
  if (e.arrowLater) {
    run.owed.push({ left: e.arrowLater.steps, rarity: e.arrowLater.rarity });
    outcome.notes.push(`A ${e.arrowLater.rarity} Arrow will reach you in ${e.arrowLater.steps} steps.`);
  }
  if (e.wager) run.wager = true;
  if (e.burnFights) run.burnFights = e.burnFights;
  if (e.enemyHpNext) run.enemyHpNext = e.enemyHpNext;
  if (e.enemyWeakNext) run.enemyWeakNext = e.enemyWeakNext;
  if (e.skipStep) run.skipNext = true;
  if (e.captains) run.captains = true;
  if (e.tendHorse) {
    run.focusMinusNext = 1;
    run.legendBonus += 10;
  }
  if (e.story) outcome.notes.push(describeOpening(run));
  if (e.heraldTruth) {
    if (run.spent.length < 6) {
      run.eliteHpMult = 0.8;
      outcome.notes.push('They respect a light hand. The next Hard Fight will be weaker.');
    } else outcome.notes.push('You have loosed a great many. They only nod.');
  }
  if (e.giveLeast) {
    const arrows = run.deck.filter((c) => CARDS[c.id].kind === 'arrow').sort((a, b) => cardValue(CARDS[a.id]) - cardValue(CARDS[b.id]) || a.uid - b.uid);
    if (arrows.length) {
      removeCard(run, arrows[0].uid);
      outcome.lost.push(arrows[0].id);
      if (run.standing < 3) {
        run.standing += 1;
        outcome.notes.push('Your Standing rises.');
      } else {
        run.legendBonus += 15;
        outcome.notes.push('+15 Legend.');
      }
    }
  }
  if (e.letter) {
    addCard(run, 'letter');
    outcome.gained.push('letter');
  }
  // Choices the player still has to make
  if (e.giveArrowFor) run.pending = { type: 'remove', left: 1, filter: 'arrow', thenGain: e.giveArrowFor };
  if (e.removeTechs) run.pending = { type: 'remove', left: e.removeTechs, filter: 'tech' };
  return outcome;
}

// ---- Score
export function legend(run) {
  const unspent = run.deck.reduce((n, c) => n + cardValue(CARDS[c.id]), 0);
  const letter = run.deck.some((c) => c.id === 'letter') ? 40 : 0;
  const base = unspent + run.standing * 25 + run.resolve + Math.floor(run.marks / 5) - run.debts.length * 30 + run.legendBonus + letter;
  return Math.max(0, base + (run.result === 'won' ? 100 : 0) + run.battlesWon * 5);
}
