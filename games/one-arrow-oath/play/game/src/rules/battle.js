// Battle rules. Pure data in, data out: no drawing, no sound, no storage — so the same code is
// driven by the game screens and by the headless balance simulator (design/sim.mjs).
// Every function mutates the plain `battle` / `run` objects it is given and returns a list of
// events that the screens turn into animation and sound.
import { CARDS, BEATS, WARD_GUARD, RIPOSTE_MULT } from '../data/cards.js';
import { ENEMIES, STEP_SCALE, PAIR_HP_SCALE, ACT_HP_MULT, ACT_ATK_MULT, NATIVE_TUNE, RIVAL_SEQUENCE, RIVAL_TECHNIQUES, RIVAL_BREAKS_AT } from '../data/enemies.js';
import { DEBTS } from '../data/debts.js';

export const HAND_LIMIT = 7;
export const DRAW_PER_TURN = 5;
export const BASE_FOCUS = 3;
export const MAX_ENEMIES = 3;
export const FOUL_FRACTION = 0.4;
export const SPOTTER_GUARD = 8;
export const HIRED_SHIELD_GUARD = 6;
const WEAK_MULT = 0.75;
const EXPOSED_MULT = 1.5;

const living = (battle) => battle.enemies.filter((e) => !e.dead);

// An enemy met in a later act than its own is tougher; in the third act half its attacks are FOUL.
function makeEnemy(key, scale, hpScale, act = 1) {
  const def = ENEMIES[key];
  const later = Math.max(0, act - def.act);
  const tune = NATIVE_TUNE[def.act] ?? { hp: 1, atk: 1 };
  const own = def.tune ?? {};
  const hpMult = def.decoy ? 1 : ACT_HP_MULT ** later * tune.hp * (own.hp ?? 1);
  const hp = Math.max(1, Math.round(def.hp * (def.decoy ? 1 : scale * hpScale) * hpMult));
  return {
    key, name: def.name, element: def.element, shape: def.shape, act,
    hp, maxHp: hp, guard: 0, strength: 0, weak: 0, exposed: 0, rally: def.rally ?? 0, feeds: def.feeds ?? 0, lasts: def.lasts ?? 0,
    atkMult: def.decoy ? 1 : ACT_ATK_MULT ** later * tune.atk * (own.atk ?? 1), foulHalf: later > 0 && act >= 3,
    idx: 0, intent: null, answered: false, stunned: false, halve: false, dead: false, scale,
    decoy: !!def.decoy, boss: !!def.boss, elite: !!def.elite,
  };
}

// The Rival fires its face-up quiver in order, with a Technique between every two Arrows.
function setRivalIntent(enemy) {
  const step = RIVAL_SEQUENCE[enemy.idx % RIVAL_SEQUENCE.length];
  let next;
  if (step === 'A') {
    const arrow = enemy.quiver.find((a) => !a.fired);
    next = arrow
      ? { type: 'attack', value: arrow.value + enemy.aimBonus, hits: arrow.hits, element: arrow.element, foul: enemy.covenantBroken, arrowName: arrow.name }
      : { type: 'guard', value: 0 };
  } else {
    const techs = RIVAL_SEQUENCE.slice(0, enemy.idx % RIVAL_SEQUENCE.length).filter((x) => x === 'T').length;
    next = { ...RIVAL_TECHNIQUES[techs % RIVAL_TECHNIQUES.length] };
  }
  enemy.intent = next;
  enemy.answered = false;
  enemy.stunned = false;
  enemy.halve = false;
}

// Whatever happens to it, an Arrow that was due this turn is spent.
function strikeRivalArrow(enemy, intent) {
  if (!enemy.quiver || intent.type !== 'attack') return;
  const arrow = enemy.quiver.find((a) => !a.fired);
  if (arrow) arrow.fired = true;
  enemy.aimBonus = 0;
}

function setIntent(enemy) {
  if (enemy.quiver) {
    setRivalIntent(enemy);
    return;
  }
  const pattern = ENEMIES[enemy.key].pattern;
  const next = { ...pattern[enemy.idx % pattern.length] };
  if (next.type === 'attack') {
    next.value = Math.round(next.value * (enemy.decoy ? 1 : enemy.scale * enemy.atkMult));
    if (enemy.foulHalf && !next.foul && enemy.idx % 2 === 1) next.foul = true;
  }
  enemy.intent = next;
  enemy.answered = false;
  enemy.stunned = false;
  enemy.halve = false;
}

export function startBattle(run, encounter, rng, { final = false, label = 'a fight' } = {}) {
  const scale = 1 + STEP_SCALE * run.step;
  const hpScale = encounter.length > 1 ? PAIR_HP_SCALE : 1;
  const enemies = encounter.slice(0, MAX_ENEMIES).map((key) => makeEnemy(key, scale, hpScale, run.act));
  let openingGuard = run.guardNext;
  if (run.spotterFights > 0) {
    openingGuard += SPOTTER_GUARD;
    run.spotterFights -= 1;
  }
  // Supplies burned, a poisoned or shared well, a herald's respect: all bend the next fight.
  const elite = enemies.some((e) => e.elite);
  for (const enemy of enemies) {
    if (run.burnFights > 0) enemy.maxHp = enemy.hp = Math.max(1, Math.round(enemy.hp * 0.85));
    if (run.enemyHpNext) {
      enemy.hp += run.enemyHpNext;
      enemy.maxHp += run.enemyHpNext;
    }
    if (elite && run.eliteHpMult !== 1) enemy.maxHp = enemy.hp = Math.max(1, Math.round(enemy.hp * run.eliteHpMult));
    enemy.weak += run.enemyWeakNext;
  }
  // Vows sworn before the run began.
  for (const enemy of enemies) {
    if (run.oath >= 5) enemy.atkMult *= 1.1;
    if (run.oath >= 6) enemy.maxHp = enemy.hp = Math.max(1, Math.round(enemy.hp * 1.1));
    if (run.oath >= 10 && enemy.elite) enemy.maxHp = enemy.hp = Math.max(1, Math.round(enemy.hp * 1.25));
  }
  if (run.burnFights > 0) run.burnFights -= 1;
  run.enemyHpNext = 0;
  run.enemyWeakNext = 0;
  if (elite) run.eliteHpMult = 1;
  if (run.hiredShieldAct === run.act) openingGuard += HIRED_SHIELD_GUARD;
  const silent = run.silentFights > 0;
  if (silent) run.silentFights -= 1;
  const focusMinus = run.focusMinusNext;
  run.focusMinusNext = 0;
  const wager = run.wager;
  run.wager = false;
  for (const enemy of enemies) {
    enemy.guard = run.enemyGuardNext;
    if (ENEMIES[enemy.key].rival) {
      enemy.quiver = run.rivalQuiver.map((a) => ({ ...a, fired: false }));
      enemy.aimBonus = 0;
      enemy.covenantBroken = false;
    }
  }
  run.guardNext = 0;
  run.enemyGuardNext = 0;

  const battle = {
    label, final, turn: 0, phase: 'player',
    player: { resolve: run.resolve, maxResolve: run.maxResolve, guard: openingGuard, focus: 0, aim: 0, weak: 0, snared: 0, exposed: 0, focusNext: 0, measureNext: false },
    draw: rng.shuffle(run.deck.map((c) => ({ uid: c.uid, id: c.id }))),
    hand: [], discard: [], exhausted: [], usedOnce: [], nextTemp: 900000,
    enemies, unblemished: run.unblemished, fieldSees: false, silent, focusMinus, wager, foulUsed: false, arrowsThisTurn: 0, damageCardsThisTurn: 0, arrowsSpent: 0, wasted: 0, blewOut: false,
    debtsDue: final ? run.debts.map((id) => ({ id, turn: 2 + rng.int(2), done: false })) : [],
  };
  const events = [];
  beginPlayerTurn(battle, run, rng, events);
  return { battle, events };
}

function drawCards(battle, count, rng, events) {
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    if (battle.hand.length >= HAND_LIMIT) break;
    if (!battle.draw.length) {
      if (!battle.discard.length) break;
      battle.draw = rng.shuffle(battle.discard);
      battle.discard = [];
      events.push({ t: 'reshuffle' });
    }
    battle.hand.push(battle.draw.pop());
    drawn += 1;
  }
  if (drawn) events.push({ t: 'draw', n: drawn });
}

function beginPlayerTurn(battle, run, rng, events) {
  const p = battle.player;
  battle.turn += 1;
  battle.phase = 'player';
  battle.arrowsThisTurn = 0;
  battle.damageCardsThisTurn = 0;
  if (battle.turn > 1) p.guard = 0;
  p.focus = Math.max(0, BASE_FOCUS - (p.snared > 0 ? 1 : 0) + (battle.fieldSees ? 1 : 0) + p.focusNext);
  p.focusNext = 0;
  if (p.snared > 0) p.snared -= 1;
  for (const enemy of living(battle)) setIntent(enemy);
  const bonus = battle.turn === 1 && run.unblemished ? 1 : 0;
  if (battle.turn === 1) p.focus = Math.max(0, p.focus + (battle.silent ? 2 : 0) - battle.focusMinus);
  drawCards(battle, DRAW_PER_TURN + bonus, rng, events);
  for (const due of battle.debtsDue) {
    if (!due.done && due.turn === battle.turn) applyDebtDue(battle, run, due, rng, events);
  }
  events.push({ t: 'turn', n: battle.turn });
}

// "Better terms" Debts come due at half strength.
const halve = (effect) => Object.fromEntries(Object.entries(effect).map(([k, v]) => [k, typeof v === 'number' ? Math.trunc(v / 2) : v]));

function applyDueEffects(battle, run, effect, rng, events) {
  const p = battle.player;
  if (effect.loseGuard) p.guard = 0;
  if (effect.focus) p.focus = Math.max(0, p.focus + effect.focus);
  if (effect.focusZero) p.focus = 0;
  if (effect.exposed) p.exposed += effect.exposed;
  if (effect.weak) p.weak += effect.weak;
  if (effect.resolve) p.resolve = Math.max(1, p.resolve + effect.resolve);
  if (effect.maxResolve) {
    p.maxResolve = Math.max(10, p.maxResolve + effect.maxResolve);
    p.resolve = Math.min(p.resolve, p.maxResolve);
  }
  if (effect.payMarks) {
    if (run.marks >= effect.payMarks) run.marks -= effect.payMarks;
    else p.resolve = Math.max(1, p.resolve - (effect.elseResolve ?? 0));
  }
  if (effect.enemyGuard) for (const e of living(battle)) e.guard += effect.enemyGuard;
  if (effect.loseHand) {
    for (let i = 0; i < effect.loseHand && battle.hand.length; i++) battle.discard.push(...battle.hand.splice(rng.int(battle.hand.length), 1));
  }
  if (effect.forgetArrow) {
    let best = -1;
    battle.hand.forEach((c, i) => {
      if (CARDS[c.id].kind !== 'arrow') return;
      if (best < 0 || CARDS[c.id].cost > CARDS[battle.hand[best].id].cost) best = i;
    });
    if (best >= 0) {
      const [lost] = battle.hand.splice(best, 1);
      spendArrow(battle, run, lost, 'a debt come due');
      events.push({ t: 'forgot', id: lost.id });
    }
  }
  if (effect.promiseKept && run.promised) {
    // The Arrow you were promised is called in: Spent with no effect, wherever it is.
    const uid = run.promised.uid;
    const inQuiver = run.deck.some((c) => c.uid === uid);
    if (inQuiver) {
      battle.hand = battle.hand.filter((c) => c.uid !== uid);
      battle.draw = battle.draw.filter((c) => c.uid !== uid);
      battle.discard = battle.discard.filter((c) => c.uid !== uid);
      spendArrow(battle, run, { uid, id: run.promised.id }, 'a promise kept');
    } else p.resolve = Math.max(1, p.resolve - 10);
  }
  if (effect.twoMasters) for (const id of run.masters ?? []) applyDueEffects(battle, run, DEBTS[id].due, rng, events);
}

function applyDebtDue(battle, run, due, rng, events) {
  due.done = true;
  const effect = run.debtHalved[due.id] ? halve(DEBTS[due.id].due) : DEBTS[due.id].due;
  applyDueEffects(battle, run, effect, rng, events);
  events.push({ t: 'debtDue', id: due.id });
}

function spendArrow(battle, run, inst, where) {
  run.deck = run.deck.filter((c) => c.uid !== inst.uid);
  run.spent.push({ id: inst.id, where });
  battle.arrowsSpent += 1;
}

export function canPlay(battle, handIndex) {
  const inst = battle.hand[handIndex];
  if (!inst || battle.phase !== 'player') return false;
  const card = CARDS[inst.id];
  if (card.cost > battle.player.focus) return false;
  if (card.fx.once && battle.usedOnce.includes(card.id)) return false;
  return true;
}

const dealsDamage = (card) => !!card.fx.dmg || !!card.fx.guardToDmg;

export const needsTarget = (card) => {
  const fx = card.fx;
  if (dealsDamage(card) && !fx.all) return true;
  return !!(fx.weak || fx.exposed || fx.strengthDown || fx.stun) && !fx.all;
};

function answers(card, enemy) {
  if (enemy.dead || enemy.answered) return false;
  const intent = enemy.intent;
  if (!intent || intent.type !== 'attack' || intent.foul || !intent.element) return false;
  if (card.fx.answerAny) return true;
  return !!card.element && BEATS[card.element] === intent.element;
}

// Would playing this card at this target answer an attack? Used by the screens to highlight.
export function wouldAnswer(battle, handIndex, targetIndex) {
  const inst = battle.hand[handIndex];
  if (!inst) return false;
  const card = CARDS[inst.id];
  if (card.fx.ward || card.fx.all) return living(battle).some((e) => answers(card, e));
  if (!dealsDamage(card) && !card.fx.stun) return false;
  const target = resolveTarget(battle, card, targetIndex);
  if (card.fx.stun) return !!target && target.intent?.type === 'attack';
  return !!target && answers(card, target);
}

function resolveTarget(battle, card, targetIndex) {
  const alive = living(battle);
  if (!alive.length) return null;
  let target = battle.enemies[targetIndex];
  if (!target || target.dead) target = alive[0];
  // A standing lure draws every single-target shot.
  if (dealsDamage(card) && !card.fx.all && !target.decoy) {
    const lure = alive.find((e) => e.decoy);
    if (lure) target = lure;
  }
  return target;
}

function hitEnemy(battle, enemy, amount, pierce, events, extra) {
  let dealt = amount;
  if (!pierce && enemy.guard > 0) {
    const blocked = Math.min(enemy.guard, dealt);
    enemy.guard -= blocked;
    dealt -= blocked;
  }
  const overkill = Math.max(0, dealt - enemy.hp);
  enemy.hp = Math.max(0, enemy.hp - dealt);
  battle.wasted += overkill;
  const killed = enemy.hp === 0;
  if (killed) enemy.dead = true;
  if (enemy.rally && dealt > 0) {
    for (const other of living(battle)) if (other !== enemy && other.rally) other.strength += other.rally;
  }
  events.push({ t: 'hit', ei: battle.enemies.indexOf(enemy), amount: dealt, killed, overkill, ...extra });
  if (enemy.quiver && !enemy.covenantBroken && !killed && enemy.hp <= enemy.maxHp * RIVAL_BREAKS_AT) {
    // From here every Arrow it has left is FOUL. If you kept the Covenant, the field sees it.
    enemy.covenantBroken = true;
    if (enemy.intent?.type === 'attack') enemy.intent.foul = true;
    if (battle.unblemished) {
      battle.fieldSees = true;
      battle.player.focus += 1;
    }
    events.push({ t: 'rivalBreaks', fieldSees: battle.fieldSees });
  }
  return { killed, overkill, dealt };
}

function checkWon(battle, events) {
  const boss = battle.enemies.find((e) => e.boss);
  if (boss && boss.dead) for (const e of battle.enemies) e.dead = true;
  if (!living(battle).length) {
    battle.phase = 'won';
    events.push({ t: 'won' });
    return true;
  }
  return false;
}

export function playCard(battle, run, handIndex, targetIndex, rng) {
  const events = [];
  if (!canPlay(battle, handIndex)) return { ok: false, events };
  const p = battle.player;
  const [inst] = battle.hand.splice(handIndex, 1);
  const card = CARDS[inst.id];
  const fx = card.fx;
  p.focus -= card.cost;
  const target = needsTarget(card) || dealsDamage(card) ? resolveTarget(battle, card, targetIndex) : null;
  events.push({ t: 'play', id: card.id, uid: inst.uid, kind: card.kind, element: card.element, ei: target ? battle.enemies.indexOf(target) : -1 });

  let answeredAny = false;
  let killedAny = false;
  let overkillTotal = 0;
  let extraDraw = 0;

  if (fx.foul) {
    breakCovenant(run);
    battle.unblemished = false;
    events.push({ t: 'foul', ei: -1 });
  }

  if (fx.ward) {
    // A Ward that answers any element commits to the first attack it finds, and answers every
    // attack of that same element.
    let only = null;
    if (fx.answerAny) only = living(battle).find((e) => answers(card, e))?.intent.element ?? null;
    for (const enemy of living(battle)) {
      if (!answers(card, enemy)) continue;
      if (only && enemy.intent.element !== only) continue;
      enemy.answered = true;
      answeredAny = true;
      events.push({ t: 'answer', ei: battle.enemies.indexOf(enemy), element: card.element });
    }
    if (!answeredAny) {
      p.guard += WARD_GUARD;
      events.push({ t: 'guard', amount: WARD_GUARD });
    }
  }

  let dealtTotal = 0;
  if (dealsDamage(card)) {
    let aim = p.aim;
    p.aim = 0;
    let refund = false;
    const measured = !!fx.measured || (card.kind === 'arrow' && p.measureNext);
    if (card.kind === 'arrow') p.measureNext = false;
    // Damage that grows with the state of the quiver (read before this Arrow is spent).
    let bonus = 0;
    if (fx.perUnspent) {
      const others = run.deck.filter((c) => CARDS[c.id].kind === 'arrow').length - (card.kind === 'arrow' ? 1 : 0);
      bonus += fx.perUnspent * Math.max(0, others);
    }
    if (fx.perSpent) bonus += fx.perSpent * run.spent.length;
    if (fx.lastArrow && !battle.hand.some((c) => CARDS[c.id].kind === 'arrow')) bonus += fx.lastArrow;
    const base = (fx.guardToDmg ? p.guard : fx.dmg) + bonus;
    const strike = (enemy, riposte) => {
      let amount = base + aim;
      aim = 0;
      if (riposte && card.kind === 'arrow') amount *= RIPOSTE_MULT;
      if (p.weak > 0) amount *= WEAK_MULT;
      if (enemy.exposed > 0) amount *= EXPOSED_MULT;
      const result = hitEnemy(battle, enemy, Math.round(amount), !!fx.pierce, events, { riposte: riposte && card.kind === 'arrow', element: card.element });
      overkillTotal += result.overkill;
      dealtTotal += result.dealt;
      if (result.killed) killedAny = true;
      if (measured && result.killed && result.overkill <= 3) refund = true;
    };
    const answerIfMatches = (enemy) => {
      const riposte = answers(card, enemy);
      if (riposte) {
        enemy.answered = true;
        answeredAny = true;
        events.push({ t: 'answer', ei: battle.enemies.indexOf(enemy), element: card.element });
      }
      return riposte;
    };
    if (fx.spread) {
      // Every hit finds its own random living target.
      for (let h = 0; h < (fx.hits ?? 1); h++) {
        const pool = living(battle);
        if (!pool.length) break;
        const enemy = rng.pick(pool);
        strike(enemy, answerIfMatches(enemy));
      }
    } else {
      const victims = fx.all ? living(battle) : target ? [target] : [];
      for (const enemy of victims) {
        const riposte = answerIfMatches(enemy);
        for (let h = 0; h < (fx.hits ?? 1); h++) {
          if (enemy.dead) break;
          strike(enemy, riposte);
        }
      }
    }
    if (refund) p.focus += card.cost;
    if (fx.overkillToGuard && overkillTotal > 0) {
      p.guard += overkillTotal;
      events.push({ t: 'guard', amount: overkillTotal });
    }
    if (fx.guardFromDmg && dealtTotal > 0) {
      p.guard += dealtTotal;
      events.push({ t: 'guard', amount: dealtTotal });
    }
  }

  if (fx.guard) {
    p.guard += fx.guard;
    events.push({ t: 'guard', amount: fx.guard });
  }
  if (fx.patient && battle.arrowsThisTurn === 0) {
    p.guard += fx.patient;
    events.push({ t: 'guard', amount: fx.patient });
  }
  if (fx.aim) p.aim += fx.aim;
  if (fx.focus) p.focus += fx.focus;
  if (fx.heal) p.resolve = Math.min(p.maxResolve, p.resolve + fx.heal);
  if (fx.selfDmg) p.resolve = Math.max(1, p.resolve - fx.selfDmg);
  if (fx.lowHpGuard && p.resolve < p.maxResolve / 2) {
    p.guard += fx.lowHpGuard;
    events.push({ t: 'guard', amount: fx.lowHpGuard });
  }
  if (fx.calm) {
    // The reward for never having broken the Covenant.
    const gain = battle.unblemished ? fx.calm.guard : fx.calm.elseGuard;
    p.guard += gain;
    events.push({ t: 'guard', amount: gain });
    if (battle.unblemished) extraDraw += fx.calm.draw ?? 0;
  }
  if (fx.patientDraw && battle.arrowsThisTurn === 0) extraDraw += fx.patientDraw;
  if (fx.focusNext) p.focusNext += fx.focusNext;
  if (fx.measureNext) p.measureNext = true;

  // Statuses land on every living enemy when the card says `all`, otherwise on its target.
  const marked = fx.all ? living(battle) : target && !target.dead ? [target] : [];
  for (const enemy of marked) {
    if (fx.weak) enemy.weak += fx.weak;
    if (fx.exposed) enemy.exposed += fx.exposed;
    if (fx.strengthDown) enemy.strength = Math.max(0, enemy.strength - fx.strengthDown);
  }
  if (fx.stun && target && !target.dead) {
    // A boss cannot be silenced outright: it loses half of this turn's attack instead.
    if (target.boss) target.halve = true;
    else target.stunned = true;
    answeredAny = true;
    events.push({ t: 'answer', ei: battle.enemies.indexOf(target), element: card.element });
  }
  if (fx.addReeds) {
    for (let i = 0; i < fx.addReeds; i++) {
      if (battle.hand.length >= HAND_LIMIT) break;
      battle.hand.push({ uid: battle.nextTemp, id: 'reed', temp: true });
      battle.nextTemp += 1;
    }
  }

  // Rewards for what the card just did.
  const grant = (g) => {
    if (g.draw) extraDraw += g.draw;
    if (g.focus) p.focus += g.focus;
    if (g.aim) p.aim += g.aim;
    if (g.marks) run.marks += g.marks;
    if (g.guard) {
      p.guard += g.guard;
      events.push({ t: 'guard', amount: g.guard });
    }
  };
  if (fx.onKill && killedAny) grant(fx.onKill);
  if (fx.ifAnswers && answeredAny) grant(fx.ifAnswers);

  if (card.kind === 'arrow') {
    spendArrow(battle, run, inst, battle.label);
    battle.arrowsThisTurn += 1;
    events.push({ t: 'spent', id: card.id });
  } else if (fx.once || fx.exhaust) {
    if (fx.once) battle.usedOnce.push(card.id);
    battle.exhausted.push(inst);
  } else battle.discard.push(inst);

  if (dealsDamage(card)) feedStorms(battle);
  const drawN = (fx.draw ?? 0) + extraDraw;
  if (drawN) drawCards(battle, drawN, rng, events);
  if (fx.counsel) {
    // Draw, then let go of the costliest card you cannot afford this turn.
    let worst = -1;
    battle.hand.forEach((c, i) => {
      const cost = CARDS[c.id].cost;
      if (cost > p.focus && (worst < 0 || cost > CARDS[battle.hand[worst].id].cost)) worst = i;
    });
    if (worst >= 0) battle.discard.push(...battle.hand.splice(worst, 1));
  }
  checkWon(battle, events);
  return { ok: true, events };
}

function feedStorms(battle) {
  battle.damageCardsThisTurn += 1;
  for (const e of living(battle)) if (e.feeds) e.strength += e.feeds;
}

function breakCovenant(run) {
  run.standing = Math.max(0, run.standing - 1);
  run.unblemished = false;
  run.fouls += 1;
}

// Break the Covenant: once per fight, a blow that cannot be answered or guarded.
export function useFoul(battle, run, targetIndex) {
  const events = [];
  if (battle.phase !== 'player' || battle.foulUsed) return { ok: false, events };
  const alive = living(battle);
  let target = battle.enemies[targetIndex];
  if (!target || target.dead) target = alive.find((e) => !e.decoy) ?? alive[0];
  if (!target) return { ok: false, events };
  battle.foulUsed = true;
  breakCovenant(run);
  battle.unblemished = false;
  events.push({ t: 'foul', ei: battle.enemies.indexOf(target) });
  hitEnemy(battle, target, Math.ceil(target.maxHp * FOUL_FRACTION), true, events, { foul: true, element: null });
  feedStorms(battle);
  checkWon(battle, events);
  return { ok: true, events };
}

function enemyAct(battle, enemy, events) {
  const p = battle.player;
  const ei = battle.enemies.indexOf(enemy);
  const intent = enemy.intent;
  strikeRivalArrow(enemy, intent);
  if (enemy.stunned) {
    events.push({ t: 'fizzle', ei, element: null });
    enemy.idx += 1;
    if (enemy.weak > 0) enemy.weak -= 1;
    if (enemy.exposed > 0) enemy.exposed -= 1;
    return;
  }
  if (intent.type === 'attack') {
    if (enemy.answered) events.push({ t: 'fizzle', ei, element: intent.element });
    else {
      for (let h = 0; h < (intent.hits ?? 1); h++) {
        let amount = intent.value + enemy.strength;
        if (enemy.weak > 0) amount *= WEAK_MULT;
        if (enemy.halve) amount *= 0.5;
        if (p.exposed > 0) amount *= EXPOSED_MULT;
        amount = Math.max(0, Math.round(amount));
        const blocked = Math.min(p.guard, amount);
        p.guard -= blocked;
        p.resolve = Math.max(0, p.resolve - (amount - blocked));
        events.push({ t: 'enemyAttack', ei, amount: amount - blocked, blocked, element: intent.element });
        if (p.resolve === 0) return;
      }
    }
  } else if (intent.type === 'guard') {
    enemy.guard += intent.value;
    if (intent.strength) enemy.strength += intent.strength;
    events.push({ t: 'enemyGuard', ei, amount: intent.value });
  } else if (intent.type === 'guardAll') {
    for (const ally of living(battle)) if (!ally.decoy) ally.guard += intent.value;
    events.push({ t: 'enemyGuard', ei, amount: intent.value });
  } else if (intent.type === 'heal') {
    const hurt = living(battle).filter((e) => !e.decoy).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (hurt) {
      const gained = Math.min(intent.value, hurt.maxHp - hurt.hp);
      hurt.hp += gained;
      events.push({ t: 'enemyHeal', ei: battle.enemies.indexOf(hurt), amount: gained });
    }
  } else if (intent.type === 'curse') {
    for (let i = 0; i < intent.count; i++) {
      battle.discard.push({ uid: battle.nextTemp, id: 'frayed_string', temp: true });
      battle.nextTemp += 1;
    }
    events.push({ t: 'enemyDebuff', ei });
  } else if (intent.type === 'aim') {
    enemy.aimBonus += intent.value;
    events.push({ t: 'enemyBuff', ei });
  } else if (intent.type === 'buff') {
    enemy.strength += intent.strength;
    events.push({ t: 'enemyBuff', ei });
  } else if (intent.type === 'debuff') {
    if (intent.weak) p.weak += intent.weak;
    if (intent.snared) p.snared += intent.snared;
    if (intent.exposed) p.exposed += intent.exposed;
    events.push({ t: 'enemyDebuff', ei });
  } else if (intent.type === 'summon') {
    let added = 0;
    for (let i = 0; i < intent.count; i++) {
      battle.enemies = battle.enemies.filter((e) => !e.dead || !e.decoy);
      if (living(battle).length >= MAX_ENEMIES) break;
      const minion = makeEnemy(intent.key, enemy.scale, intent.hpFrac ?? 1, enemy.act);
      battle.enemies.push(minion);
      added += 1;
    }
    events.push({ t: 'summon', ei: battle.enemies.indexOf(enemy), n: added });
  }
  enemy.idx += 1;
  if (enemy.weak > 0) enemy.weak -= 1;
  if (enemy.exposed > 0) enemy.exposed -= 1;
}

export function endTurn(battle, run, rng) {
  const events = [];
  if (battle.phase !== 'player') return { ok: false, events };
  battle.phase = 'enemy';
  const p = battle.player;
  for (const c of battle.hand) {
    const held = CARDS[c.id].fx.held;
    if (held?.guard) {
      p.guard += held.guard;
      events.push({ t: 'guard', amount: held.guard });
    }
  }
  battle.discard.push(...battle.hand.filter((c) => !CARDS[c.id].fx.retain));
  battle.hand = battle.hand.filter((c) => CARDS[c.id].fx.retain);
  for (const e of battle.enemies) e.guard = 0;
  if (battle.damageCardsThisTurn === 0) for (const e of living(battle)) if (e.feeds && e.strength > 0) e.strength -= 1;
  events.push({ t: 'endTurn' });
  for (const enemy of battle.enemies.slice()) {
    if (enemy.dead) continue;
    enemyAct(battle, enemy, events);
    if (battle.player.resolve === 0) {
      battle.phase = 'lost';
      events.push({ t: 'lost' });
      return { ok: true, events };
    }
  }
  const spent = battle.enemies.find((e) => !e.dead && ((e.lasts && e.idx >= e.lasts) || (e.quiver && e.quiver.every((a) => a.fired))));
  if (spent) {
    // It blows itself out, or the Rival's quiver runs dry and it yields: the fight is won.
    battle.blewOut = true;
    for (const e of battle.enemies) e.dead = true;
    battle.phase = 'won';
    events.push({ t: 'won' });
    return { ok: true, events };
  }
  if (p.weak > 0) p.weak -= 1;
  if (p.exposed > 0) p.exposed -= 1;
  beginPlayerTurn(battle, run, rng, events);
  return { ok: true, events };
}

// Copy the fight's outcome back onto the run.
export function settleBattle(battle, run) {
  run.resolve = battle.player.resolve;
  run.maxResolve = battle.player.maxResolve;
}
