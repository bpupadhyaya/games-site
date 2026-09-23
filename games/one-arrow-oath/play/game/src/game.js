// One Arrow Oath — contract entry (docs/GAME-CONTRACT.md).
// This file owns the state, the scenes, input and the animation events. Rules live in
// rules/*.js (pure, also driven by the balance simulator); drawing lives in ui/render.js.
import { CARDS } from './data/cards.js';
import { DEBTS } from './data/debts.js';
import { EVENTS } from './data/events.js';
import { ARCHERS, ARCHER_IDS, OATHS, applyRunToMeta, defaultMeta, loadMeta } from './data/meta.js';
import { COACH, HOW_TO_PLAY, ABOUT } from './data/help.js';
import { RULES_REFERENCE } from './data/rules_reference.js';
import { ENEMIES } from './data/enemies.js';
import * as B from './rules/battle.js';
import * as R from './rules/run.js';
import { makeSky } from './ui/draw.js';
import { render as renderAll, renderAuto } from './ui/render.js';
import { C, elementColor } from './ui/theme.js';
import { ARCHER, BTN, CARD_H, CARD_W, CLOSE, CONFIRM, COVENANT_BTN, COVENANT_BTN_TOP, DETAIL, ENVOY, ENVOY_TOP, FIELD_BOTTOM, GRID, OPTIONS, OPTIONS_TOP, PULL_TO_LOOSE, SECONDARY, HELP_TABS, HELP_TEXT, PAGE_NAV, HOWTO_PER_PAGE, ABOUT_PER_PAGE, TEXT_SCALES, NEWRUN, TUNER_REMOVE, TUNER_TRIO_Y, choiceRects, enemySlots, handSlots, inRect, titleRects, trioRects, AUTO_THINK_STEPS, AUTO_REVEAL_SECONDS, AUTO_ACT_SECONDS, AUTO_STEP_DEC, AUTO_STEP_INC, AUTO_SKIP, AUTO_PAUSE, AUTO_EXIT, AUTO_AGAIN } from './ui/layout.js';
import { chooseCard as autoChooseCard, chooseDoor as autoChooseDoor, chooseReward as autoChooseReward, chooseCampOption as autoChooseCampOption, chooseEnvoyOption as autoChooseEnvoyOption, chooseTunerAction as autoChooseTunerAction, draftValue as autoDraftValue } from './autoplay.js';

// +1: the element-ring diagram gets its own last page rather than riding on the last tip page,
// where it would have to compete for room and could silently vanish at the top text-size step.
const HOWTO_PAGES = Math.ceil(HOW_TO_PLAY.length / HOWTO_PER_PAGE) + 1;
// +1: Version/credits get their own last page rather than riding on the last paragraph page,
// where a long final paragraph plus that footer could together overflow at the top text step.
const ABOUT_PAGES = Math.ceil(ABOUT.length / ABOUT_PER_PAGE) + 1;

// 9:19.5 — fills a modern phone edge to edge (the kit letterboxes anything else).
export const meta = { width: 720, height: 1560 };

const DEMO_BATTLES = 3;
const HOLD_TO_INSPECT = 0.45;
const MOVE_SLOP = 14;

export function createGame(env) {
  const { rng, storage, audio, monetization } = env;
  const sky = makeSky(rng.fork());

  const s = {
    scene: 'title', t: 0, run: null, battle: null, door: null, reward: null, envoy: null, overlay: null,
    ui: { sel: -1, target: 0, drag: null, press: null, choice: -1, cardPos: {}, shownHp: [], shownResolve: 50, flash: [], pull: 0, lastPlay: { x: 360, y: 1280 } },
    fx: [], lock: 0, shake: 0, pending: null, best: 0, muted: false, demoBattles: 0, saved: null, runs: 0, legend: 0,
    fade: 1, lastScene: 'title', meta: defaultMeta(), coach: { key: null, t: 0 }, unlocked: [],
    textScaleIdx: 0, // index into TEXT_SCALES; the help overlay's How to Play/About/Rules text size
    autoThinkIdx: 1, // index into AUTO_THINK_STEPS (Auto Play's think-time stepper); default 5s
    auto: null, // Auto Play's own private run, only while scene === 'auto' — never s.run/s.battle
  };

  storage.get('best', 0).then((v) => {
    s.best = Math.max(s.best, v);
  });
  // Clamped so a stale saved index from a build with a shorter/longer TEXT_SCALES array can
  // never produce an out-of-range (NaN-font) lookup.
  storage.get('textScaleIdx', 0).then((v) => {
    s.textScaleIdx = Math.min(Math.max(v ?? 0, 0), TEXT_SCALES.length - 1);
  });
  storage.get('muted', false).then((v) => {
    s.muted = !!v;
    audio.setMuted(s.muted);
  });
  storage.get('demoBattles', 0).then((v) => {
    s.demoBattles = Math.max(s.demoBattles, v);
  });
  storage.get('meta', null).then((v) => {
    s.meta = loadMeta(v);
  });
  storage.get('save', null).then((v) => {
    if (v && v.run && !s.run) s.saved = v;
  });
  storage.get('autoThinkIdx', 1).then((v) => {
    s.autoThinkIdx = Math.min(Math.max(v ?? 1, 0), AUTO_THINK_STEPS.length - 1);
  });

  // ------------------------------------------------------------------ sound
  // Auto Play watches itself, with nobody there to hear it: silent by design, the same way the
  // menu's own moon and stars animate without a sound. One gate here covers every sfx.* call.
  const tone = (freq, to, dur, type = 'sine', vol = 0.16) => {
    if (s.scene === 'auto') return;
    audio.tone({ freq, to, dur, type, vol });
  };
  const MOTIF = { ember: [330, 349], tide: [392, 262], flare: [523, 659], storm: [196, 185], gale: [440, 587], stone: [147, 165] };
  const sfx = {
    tap: () => tone(620, 520, 0.05, 'sine', 0.08),
    loose: () => {
      tone(900, 300, 0.12, 'square', 0.07);
      tone(240, 120, 0.2, 'sine', 0.14);
    },
    impact: (element) => {
      const m = MOTIF[element] ?? [294, 294];
      tone(m[0], m[1], 0.16, 'triangle', 0.16);
    },
    answer: () => {
      tone(523, null, 0.09);
      tone(659, null, 0.13);
      tone(784, null, 0.2);
    },
    guard: () => tone(300, 380, 0.1, 'triangle', 0.1),
    hurt: () => tone(160, 70, 0.22, 'sawtooth', 0.14),
    spent: () => tone(130, 98, 0.35, 'sine', 0.1),
    debt: () => {
      tone(110, null, 0.5, 'sine', 0.16);
      tone(116, null, 0.5, 'sine', 0.12);
    },
    win: () => {
      tone(392, null, 0.15);
      tone(523, null, 0.2);
      tone(784, null, 0.35);
    },
    lose: () => tone(220, 60, 0.7, 'sawtooth', 0.12),
    foul: () => tone(90, 50, 0.5, 'square', 0.16),
  };

  // ------------------------------------------------------------------ persistence
  const save = () => {
    if (!s.run || s.run.result) return;
    storage.set('save', { v: 1, run: s.run, scene: s.scene, battle: s.battle, door: s.door, reward: s.reward, envoy: s.envoy });
  };
  const clearSave = () => {
    s.saved = null;
    storage.remove('save');
  };

  // ------------------------------------------------------------------ flow
  const resetUi = () => {
    Object.assign(s.ui, { sel: -1, target: 0, drag: null, choice: -1, cardPos: {}, shownHp: [], flash: [], pull: 0 });
    s.fx = [];
    s.lock = 0;
    s.pending = null;
  };

  const saveMeta = () => storage.set('meta', s.meta);
  const markCoach = (key) => {
    if (!key || s.meta.coach[key]) return;
    s.meta.coach[key] = true;
    s.coach = { key: null, t: 0 };
    saveMeta();
  };

  const startRun = (opts = {}) => {
    clearSave();
    s.unlocked = [];
    s.run = R.newRun(rng, opts);
    s.battle = null;
    s.door = null;
    s.reward = null;
    s.envoy = null;
    s.overlay = null;
    s.runs += 1;
    s.ui.shownResolve = s.run.resolve;
    resetUi();
    s.scene = 'map';
    monetization.track('run_start', { n: s.runs });
    save();
  };

  const resume = () => {
    const v = s.saved;
    if (!v) return;
    s.run = v.run;
    s.battle = v.battle ?? null;
    s.door = v.door ?? null;
    s.reward = v.reward ?? null;
    s.envoy = v.envoy ?? null;
    s.saved = null;
    resetUi();
    s.ui.shownResolve = s.battle ? s.battle.player.resolve : s.run.resolve;
    const known = ['map', 'battle', 'reward', 'camp', 'envoy', 'tuner'];
    s.scene = known.includes(v.scene) ? v.scene : 'map';
    if (s.scene === 'battle' && !s.battle) s.scene = 'map';
    if (s.scene === 'reward' && !s.reward) s.scene = 'map';
    if ((s.scene === 'camp' || s.scene === 'envoy' || s.scene === 'tuner') && !s.door) s.scene = 'map';
    if (s.scene === 'envoy' && !s.envoy) s.scene = 'map';
  };

  const finishRun = (result) => {
    s.run.result = result;
    s.legend = R.legend(s.run);
    if (s.legend > s.best) {
      s.best = s.legend;
      storage.set('best', s.best);
    }
    monetization.track('run_end', { result, legend: s.legend, spent: s.run.spent.length });
    // What this run adds to the Tuner's Book, and what it unlocks.
    const before = s.meta;
    s.meta = applyRunToMeta(before, s.run, s.legend);
    s.unlocked = [
      ...s.meta.archers.filter((a) => !before.archers.includes(a)).map((a) => `${ARCHERS[a].name} joins you`),
      ...(s.meta.oaths > before.oaths ? [`Oath ${s.meta.oaths - 1} is open: ${OATHS[s.meta.oaths - 1].name}`] : []),
    ];
    saveMeta();
    clearSave();
    s.overlay = null;
    resetUi();
    s.scene = 'runover';
    if (result === 'won') sfx.win();
    else sfx.lose();
  };

  const ACT_NAMES = ['THE FIRST DAY', 'THE SECOND DAY', 'THE THIRD DAY'];
  const ACT_SUBS = ['', 'They no longer keep every rule.', 'Nobody keeps the Covenant now.'];

  const nextStep = () => {
    const moved = R.advance(s.run, rng);
    s.door = null;
    s.reward = null;
    s.envoy = null;
    s.battle = null;
    resetUi();
    if (s.run.result) {
      finishRun('won');
      return;
    }
    if (env.config.demo && s.demoBattles >= DEMO_BATTLES) {
      clearSave();
      s.scene = 'demo-limit';
      return;
    }
    s.scene = 'map';
    if (s.run.arrivals.length) banner('A PROMISE ARRIVES', s.run.arrivals.map((id) => CARDS[id].name).join(', ') + ' joins your quiver.', C.good);
    if (moved === 'act') banner(ACT_NAMES[s.run.act - 1], ACT_SUBS[s.run.act - 1], C.goldLight);
    save();
  };

  const tierOf = (door) => (door.kind === 'fight' ? 'normal' : door.kind);

  const beginBattle = (door) => {
    const boss = door.kind === 'boss' ? ENEMIES[door.encounter[0]] : null;
    const labels = { fight: 'a skirmish', elite: 'a hard fight', boss: boss ? boss.name.toLowerCase() : '' };
    const { battle, events } = B.startBattle(s.run, door.encounter, rng, { final: door.kind === 'boss' && s.run.act === R.ACTS, label: `${labels[door.kind]}, day ${s.run.act}` });
    s.battle = battle;
    resetUi();
    s.ui.shownResolve = battle.player.resolve;
    s.scene = 'battle';
    if (env.config.demo) {
      s.demoBattles += 1;
      storage.set('demoBattles', s.demoBattles);
    }
    processEvents(events);
    if (boss?.intro) banner(boss.intro.title, boss.intro.sub, C.gold);
    save();
  };

  const enterDoor = (index) => {
    const door = s.run.doors[index];
    if (!door) return;
    s.door = door;
    s.ui.choice = -1;
    sfx.tap();
    if (door.kind === 'fight' || door.kind === 'elite' || door.kind === 'boss') beginBattle(door);
    else {
      s.scene = door.kind;
      s.envoy = door.kind === 'envoy' ? { event: door.event, outcome: null } : null;
      save();
    }
  };

  const battleWon = () => {
    B.settleBattle(s.battle, s.run);
    s.run.battlesWon += 1;
    const tier = tierOf(s.door ?? { kind: 'fight' });
    const marks = R.battleMarks(rng, tier);
    s.run.marks += marks;
    s.reward = { cards: R.genRewards(s.run, rng, tier, !!s.door?.guaranteeRare), marks, spent: s.battle.arrowsSpent, wasted: s.battle.wasted, bonus: null, notes: [] };
    if (s.battle.wager) {
      // The other archer's bet: win without loosing a single Arrow.
      if (s.battle.arrowsSpent === 0) s.reward.notes.push(`You won the wager: ${CARDS[R.giveArrow(s.run, rng, 'rare')].name} joins your quiver.`);
      else {
        s.run.marks = Math.max(0, s.run.marks - 20);
        s.reward.notes.push('You lost the wager: 20 Marks.');
      }
    }
    // Ending the Answering Storm before it blows itself out shatters it into a rare Arrow.
    if (s.battle.enemies.some((e) => e.lasts) && !s.battle.blewOut) {
      R.addCard(s.run, 'stormglass');
      s.reward.bonus = 'stormglass';
    }
    s.battle = null;
    resetUi();
    s.scene = 'reward';
    sfx.win();
    save();
  };

  const battleLost = () => {
    B.settleBattle(s.battle, s.run);
    finishRun('lost');
  };

  // ------------------------------------------------------------------ animation events
  function banner(title, sub, color) {
    s.fx.push({ k: 'banner', title, sub, color, t: 0, dur: 2.2, delay: 0 });
  }

  const enemyPos = (ei) => {
    const slots = enemySlots(s.battle ? s.battle.enemies : []);
    return slots[ei] ?? { x: 360, y: 330, r: 80 };
  };

  function processEvents(events) {
    let d = 0;
    for (const ev of events) {
      if (ev.t === 'play') {
        const from = { x: ARCHER.x + 34, y: ARCHER.y - 250 };
        if (ev.ei >= 0) {
          const to = enemyPos(ev.ei);
          s.fx.push({ k: 'streak', x0: from.x, y0: from.y, x1: to.x, y1: to.y, color: ev.kind === 'arrow' ? elementColor(ev.element) : C.ink, thick: ev.kind === 'arrow' ? 5 : 2.5, t: 0, dur: 0.22, delay: d });
        }
        sfx.loose();
        d += 0.12;
      } else if (ev.t === 'hit') {
        const to = enemyPos(ev.ei);
        s.fx.push({ k: 'num', x: to.x, y: to.y - 20, text: ev.foul ? `FOUL ${ev.amount}` : ev.riposte ? `${ev.amount}!` : String(ev.amount), color: ev.riposte ? C.good : C.ink, size: ev.riposte ? 54 : 44, t: 0, dur: 0.9, delay: d });
        s.fx.push({ k: 'ring', x: to.x, y: to.y, color: elementColor(ev.element), t: 0, dur: 0.4, delay: d });
        s.ui.flash[ev.ei] = 1;
        if (ev.killed) s.fx.push({ k: 'burst', x: to.x, y: to.y, color: elementColor(ev.element), t: 0, dur: 0.75, delay: d });
        if (ev.overkill >= 8) s.fx.push({ k: 'num', x: to.x, y: to.y + 60, text: `${ev.overkill} wasted`, color: C.muted, size: 24, t: 0, dur: 1.2, delay: d + 0.1 });
        sfx.impact(ev.element);
        d += 0.08;
      } else if (ev.t === 'answer') {
        const to = enemyPos(ev.ei);
        s.fx.push({ k: 'shards', x: to.x, y: to.y - to.r - 60, color: C.good, t: 0, dur: 0.6, delay: d });
        s.fx.push({ k: 'num', x: to.x, y: to.y - to.r - 96, text: 'ANSWERED', color: C.good, size: 26, t: 0, dur: 1, delay: d });
        sfx.answer();
      } else if (ev.t === 'guard') {
        s.fx.push({ k: 'num', x: ARCHER.x - 150, y: ARCHER.y - 120, text: `+${ev.amount}`, color: C.guard, size: 34, t: 0, dur: 0.8, delay: d });
        sfx.guard();
      } else if (ev.t === 'spent') {
        s.fx.push({ k: 'ember', x0: s.ui.lastPlay.x, y0: s.ui.lastPlay.y, x1: BTN.spent.x + BTN.spent.w / 2, y1: BTN.spent.y + 20, t: 0, dur: 0.7, delay: d + 0.15 });
        sfx.spent();
      } else if (ev.t === 'endTurn') d += 0.15;
      else if (ev.t === 'enemyAttack') {
        const from = enemyPos(ev.ei);
        s.fx.push({ k: 'streak', x0: from.x, y0: from.y, x1: ARCHER.x, y1: ARCHER.y - 110, color: elementColor(ev.element), thick: 4, t: 0, dur: 0.2, delay: d });
        s.fx.push({ k: 'num', x: ARCHER.x + 150, y: ARCHER.y - 110, text: ev.amount > 0 ? `-${ev.amount}` : 'blocked', color: ev.amount > 0 ? C.damage : C.guard, size: ev.amount > 0 ? 46 : 28, t: 0, dur: 0.9, delay: d + 0.18 });
        if (ev.amount > 0) {
          s.fx.push({ k: 'shake', amount: Math.min(6, 2 + ev.amount / 4), t: 0, dur: 0.25, delay: d + 0.18 });
          sfx.hurt();
        } else sfx.guard();
        d += 0.34;
      } else if (ev.t === 'fizzle') {
        const to = enemyPos(ev.ei);
        s.fx.push({ k: 'shards', x: to.x, y: to.y, color: C.good, t: 0, dur: 0.5, delay: d });
        d += 0.2;
      } else if (ev.t === 'enemyHeal') {
        const to = enemyPos(ev.ei);
        s.fx.push({ k: 'num', x: to.x, y: to.y - 30, text: `+${ev.amount}`, color: C.good, size: 36, t: 0, dur: 0.9, delay: d });
        d += 0.24;
      } else if (ev.t === 'enemyGuard' || ev.t === 'enemyBuff' || ev.t === 'enemyDebuff' || ev.t === 'summon') {
        const to = enemyPos(ev.ei);
        const label = ev.t === 'enemyGuard' ? `Guard +${ev.amount}` : ev.t === 'enemyBuff' ? 'Stronger' : ev.t === 'enemyDebuff' ? 'Hindered!' : 'Lures rise';
        s.fx.push({ k: 'num', x: to.x, y: to.y - 30, text: label, color: C.gold, size: 28, t: 0, dur: 0.9, delay: d });
        d += 0.24;
      } else if (ev.t === 'debtDue') {
        const debt = DEBTS[ev.id];
        s.fx.push({ k: 'banner', title: debt.dueName.toUpperCase(), sub: debt.dueText, color: C.damage, t: 0, dur: 2.4, delay: d });
        sfx.debt();
        d += 0.5;
      } else if (ev.t === 'rivalBreaks') {
        s.fx.push({ k: 'banner', title: 'THE RIVAL BREAKS THE COVENANT', sub: ev.fieldSees ? 'Every arrow left is FOUL. The field saw you keep it: +1 Focus.' : 'Every arrow they have left is FOUL.', color: C.damage, t: 0, dur: 2.8, delay: d });
        sfx.foul();
        d += 0.5;
      } else if (ev.t === 'foul') {
        s.fx.push({ k: 'banner', title: 'THE COVENANT IS BROKEN', sub: 'Your Standing falls. It does not return.', color: C.damage, t: 0, dur: 2.2, delay: d });
        sfx.foul();
      } else if (ev.t === 'won') s.pending = { what: 'won', at: d + 0.7 };
      else if (ev.t === 'lost') s.pending = { what: 'lost', at: d + 0.9 };
    }
    s.lock = Math.max(s.lock, d);
  }

  // ------------------------------------------------------------------ battle actions
  const retarget = () => {
    const b = s.battle;
    if (!b) return;
    const current = b.enemies[s.ui.target];
    if (!current || current.dead) s.ui.target = Math.max(0, b.enemies.findIndex((e) => !e.dead));
  };

  const playFromHand = (index) => {
    const b = s.battle;
    if (!b || s.lock > 0 || b.phase !== 'player' || !b.hand[index]) return;
    if (!B.canPlay(b, index)) {
      const short = CARDS[b.hand[index].id].cost > b.player.focus;
      s.fx.push({ k: 'num', x: 360, y: DETAIL.y + 40, text: short ? 'Not enough Focus' : 'Cannot play', color: C.damage, size: 28, t: 0, dur: 0.9, delay: 0 });
      return;
    }
    const pos = s.ui.cardPos[b.hand[index].uid];
    s.ui.lastPlay = pos ? { x: pos.x, y: pos.y } : { x: 360, y: 1280 };
    if (s.coach.key) markCoach(s.coach.key);
    const { events } = B.playCard(b, s.run, index, s.ui.target, rng);
    s.ui.sel = -1;
    processEvents(events);
    retarget();
  };

  const doEndTurn = () => {
    const b = s.battle;
    if (!b || s.lock > 0 || b.phase !== 'player') return;
    s.ui.sel = -1;
    sfx.tap();
    const { events } = B.endTurn(b, s.run, rng);
    processEvents(events);
    retarget();
    save();
  };

  const doFoul = () => {
    const b = s.battle;
    if (!b) return;
    const { ok, events } = B.useFoul(b, s.run, s.ui.target);
    if (ok) processEvents(events);
    retarget();
  };

  const cycleTarget = (dir) => {
    const b = s.battle;
    if (!b) return;
    const n = b.enemies.length;
    for (let step = 1; step <= n; step++) {
      const i = (s.ui.target + dir * step + n * 2) % n;
      if (!b.enemies[i].dead) {
        s.ui.target = i;
        return;
      }
    }
  };

  // ------------------------------------------------------------------ overlays
  const openCards = (title, items, pick = null, note = '') => {
    s.overlay = { type: 'cards', title, items, pick, note, scroll: 0, inspect: null };
  };
  const openQuiver = () => openCards('Your Quiver', s.run.deck.map((c) => ({ id: c.id, uid: c.uid })), null, 'Arrows here are still unspent.');
  const openSpent = () => openCards('The Spent', s.run.spent.map((c, i) => ({ id: c.id, uid: -1 - i, note: c.where })), null, 'Loosed once. Never again.');
  const openLedger = () => {
    s.overlay = {
      type: 'options', title: 'The Ledger',
      text: s.run.debts.length ? 'Every Debt comes due in the final fight, on turn 2 or 3.' : 'You owe nothing.',
      options: s.run.debts.map((id) => ({ label: DEBTS[id].name, sub: `Due: ${id === 'two_masters' && s.run.masters ? s.run.masters.map((m) => DEBTS[m].dueText).join(' + ') : DEBTS[id].dueText}`, act: null })),
    };
  };

  // Debts and events sometimes leave the player a choice: cards to remove, or one to take.
  const beginPending = (then) => {
    const p = s.run.pending;
    const items = p ? R.pendingCards(s.run) : [];
    if (!p || !items.length) {
      s.run.pending = null;
      then();
      return;
    }
    const title = p.type === 'gain' ? 'Choose an Arrow' : p.filter === 'tech' ? 'Remove a Technique' : p.filter === 'arrow' ? 'Give an Arrow' : 'Remove a card';
    const note = p.type === 'gain' ? 'The one you choose joins your quiver.' : p.left > 1 ? `Choose ${p.left} to remove, one at a time.` : 'Choose one.';
    s.overlay = { type: 'cards', title, items, pick: 'pending', required: true, selected: null, note, scroll: 0, inspect: null, then };
  };

  const gridCell = (i, scroll) => {
    const col = i % GRID.cols;
    const row = Math.floor(i / GRID.cols);
    return { x: GRID.x + col * GRID.cellW, y: GRID.y + row * GRID.cellH - scroll, w: GRID.cellW, h: GRID.cellH };
  };

  const runAct = (act, arg) => {
    if (act === 'settle') {
      R.settleDebt(s.run, arg);
      s.overlay = null;
      nextStep();
    }
  };

  function updateOverlay(tap, p) {
    const o = s.overlay;
    if (o.type === 'inspect') {
      if (tap) s.overlay = null;
      return;
    }
    if (o.type === 'newrun') {
      if (!tap) return;
      const unlockedArcher = s.meta.archers.includes(ARCHER_IDS[o.archer]);
      if (inRect(NEWRUN.archerPrev, tap.x, tap.y)) o.archer = (o.archer + ARCHER_IDS.length - 1) % ARCHER_IDS.length;
      else if (inRect(NEWRUN.archerNext, tap.x, tap.y)) o.archer = (o.archer + 1) % ARCHER_IDS.length;
      else if (inRect(NEWRUN.oathPrev, tap.x, tap.y)) o.oath = Math.max(0, o.oath - 1);
      else if (inRect(NEWRUN.oathNext, tap.x, tap.y)) o.oath = Math.min(s.meta.oaths - 1, o.oath + 1);
      else if (inRect(NEWRUN.begin, tap.x, tap.y) && unlockedArcher) {
        s.meta.lastArcher = ARCHER_IDS[o.archer];
        s.meta.lastOath = o.oath;
        saveMeta();
        startRun({ archer: ARCHER_IDS[o.archer], oath: o.oath });
        return;
      } else if (inRect(NEWRUN.cancel, tap.x, tap.y)) s.overlay = null;
      sfx.tap();
      return;
    }
    if (o.type === 'help') {
      if (!tap) return;
      const tab = HELP_TABS.findIndex((r) => inRect(r, tap.x, tap.y));
      if (inRect(HELP_TEXT.dec, tap.x, tap.y) && s.textScaleIdx > 0) {
        s.textScaleIdx--;
        storage.set('textScaleIdx', s.textScaleIdx);
        sfx.tap();
      } else if (inRect(HELP_TEXT.inc, tap.x, tap.y) && s.textScaleIdx < TEXT_SCALES.length - 1) {
        s.textScaleIdx++;
        storage.set('textScaleIdx', s.textScaleIdx);
        sfx.tap();
      } else if (tab >= 0) {
        o.page = tab;
        sfx.tap();
      } else if (o.page === 0 && inRect(PAGE_NAV.back, tap.x, tap.y)) {
        o.howtoPage = (o.howtoPage - 1 + HOWTO_PAGES) % HOWTO_PAGES;
        sfx.tap();
      } else if (o.page === 0 && inRect(PAGE_NAV.next, tap.x, tap.y)) {
        o.howtoPage = (o.howtoPage + 1) % HOWTO_PAGES;
        sfx.tap();
      } else if (o.page === 1 && inRect(PAGE_NAV.back, tap.x, tap.y)) {
        o.aboutPage = (o.aboutPage - 1 + ABOUT_PAGES) % ABOUT_PAGES;
        sfx.tap();
      } else if (o.page === 1 && inRect(PAGE_NAV.next, tap.x, tap.y)) {
        o.aboutPage = (o.aboutPage + 1) % ABOUT_PAGES;
        sfx.tap();
      } else if (o.page === 2 && inRect(PAGE_NAV.back, tap.x, tap.y)) {
        o.rulesPage = (o.rulesPage - 1 + RULES_REFERENCE.length) % RULES_REFERENCE.length;
        sfx.tap();
      } else if (o.page === 2 && inRect(PAGE_NAV.next, tap.x, tap.y)) {
        o.rulesPage = (o.rulesPage + 1) % RULES_REFERENCE.length;
        sfx.tap();
      } else if (inRect(CLOSE, tap.x, tap.y)) s.overlay = null;
      return;
    }
    if (o.type === 'confirmFoul') {
      if (!tap) return;
      if (inRect(CONFIRM, tap.x, tap.y)) {
        s.overlay = null;
        doFoul();
      } else if (inRect(SECONDARY, tap.x, tap.y)) s.overlay = null;
      return;
    }
    if (o.type === 'covenant') {
      if (!tap) return;
      const rects = choiceRects(4, COVENANT_BTN_TOP, COVENANT_BTN.h, COVENANT_BTN.gap);
      if (inRect(rects[0], tap.x, tap.y)) {
        s.muted = !s.muted;
        audio.setMuted(s.muted);
        storage.set('muted', s.muted);
      } else if (inRect(rects[1], tap.x, tap.y)) {
        s.meta.reduceMotion = !s.meta.reduceMotion;
        saveMeta();
      } else if (inRect(rects[2], tap.x, tap.y) && s.run && !s.run.result && s.scene !== 'title') {
        s.overlay = null;
        if (s.battle) B.settleBattle(s.battle, s.run);
        finishRun('lost');
      } else if (inRect(rects[3], tap.x, tap.y)) s.overlay = null;
      return;
    }
    if (o.type === 'options') {
      if (!tap) return;
      const rects = choiceRects(o.options.length, OPTIONS_TOP, OPTIONS.h, OPTIONS.gap);
      const hit = rects.findIndex((r) => inRect(r, tap.x, tap.y));
      if (hit >= 0 && o.options[hit].act) runAct(o.options[hit].act, o.options[hit].arg);
      else if (inRect(CLOSE, tap.x, tap.y)) s.overlay = null;
      return;
    }
    if (o.type === 'cards') {
      if (o.inspect !== null) {
        if (tap) o.inspect = null;
        return;
      }
      if (o.pick === 'pending') {
        const rowsP = Math.ceil(o.items.length / GRID.cols);
        const maxP = Math.max(0, rowsP * GRID.cellH - GRID.h);
        if (p.down && s.ui.press && s.ui.press.moved) o.scroll = Math.max(0, Math.min(maxP, o.scroll - (p.y - s.ui.press.lastY)));
        if (!tap) return;
        if (inRect(CLOSE, tap.x, tap.y)) {
          if (o.selected === null) return;
          const done = R.resolvePending(s.run, o.selected);
          sfx.tap();
          if (done || !s.run.pending) {
            const then = o.then;
            s.overlay = null;
            then();
          } else beginPending(o.then);
          return;
        }
        if (tap.y < GRID.y || tap.y > GRID.y + GRID.h) return;
        const pickIdx = o.items.findIndex((_, i) => inRect(gridCell(i, o.scroll), tap.x, tap.y));
        if (pickIdx >= 0) {
          o.selected = o.items[pickIdx].uid;
          sfx.tap();
        }
        return;
      }
      const rows = Math.ceil(o.items.length / GRID.cols);
      const maxScroll = Math.max(0, rows * GRID.cellH - GRID.h);
      if (p.down && s.ui.press && s.ui.press.moved) o.scroll = Math.max(0, Math.min(maxScroll, o.scroll - (p.y - s.ui.press.lastY)));
      if (!tap) return;
      if (inRect(CLOSE, tap.x, tap.y)) {
        s.overlay = null;
        return;
      }
      if (tap.y < GRID.y || tap.y > GRID.y + GRID.h) return;
      const hit = o.items.findIndex((_, i) => inRect(gridCell(i, o.scroll), tap.x, tap.y));
      if (hit < 0) return;
      if (o.pick === 'remove' || o.pick === 'tunerRemove') {
        const item = o.items[hit];
        if (o.pick === 'tunerRemove') s.run.marks -= R.REMOVE_PRICE;
        R.removeCard(s.run, item.uid);
        s.overlay = null;
        sfx.tap();
        if (o.pick === 'remove') nextStep();
        else {
          s.door.removed = true;
          save();
        }
      } else o.inspect = o.items[hit].id;
    }
  }

  // ------------------------------------------------------------------ scenes
  // With nothing unlocked there is nothing to choose: go straight in. Otherwise pick who and how heavy.
  const startNew = () => {
    if (s.meta.oaths > 1 || s.meta.archers.length > 1) s.overlay = { type: 'newrun', archer: Math.max(0, ARCHER_IDS.indexOf(s.meta.lastArcher ?? 'keeper')), oath: Math.min(s.meta.lastOath ?? 0, s.meta.oaths - 1) };
    else startRun();
  };

  const openBook = () => {
    const arrows = Object.values(CARDS).filter((c) => c.kind === 'arrow');
    const items = arrows.map((c) => ({ id: c.id, uid: c.id, count: s.meta.book[c.id] ?? 0, dim: !s.meta.book[c.id] }));
    const known = items.filter((i) => i.count > 0).length;
    s.overlay = { type: 'cards', title: "The Tuner's Book", items, pick: null, note: `${known} of ${items.length} Arrows loosed. Each one, once per run.`, scroll: 0, inspect: null };
  };

  // Title actions: 'covenant' and 'auto' share their row as two half-width buttons (see
  // titleActionRects below) rather than adding a whole new row, so nothing else on the title
  // screen shifts.
  const titleActions = () => (s.saved ? ['resume', 'new', 'book', 'help', 'covenant', 'auto'] : ['new', 'book', 'help', 'covenant', 'auto']);
  function titleActionRects(actions) {
    const rows = titleRects(actions.length - 1);
    const last = rows[rows.length - 1];
    const gap = 16;
    const half = (last.w - gap) / 2;
    return [...rows.slice(0, -1), { x: last.x, y: last.y, w: half, h: last.h }, { x: last.x + half + gap, y: last.y, w: half, h: last.h }];
  }

  function updateTitle(tap, keys) {
    const actions = titleActions();
    const rects = titleActionRects(actions);
    if (keys.pressed.has('Enter') || keys.pressed.has('Space')) {
      if (s.saved) resume();
      else startNew();
      return;
    }
    if (!tap) return;
    const hit = rects.findIndex((r) => inRect(r, tap.x, tap.y));
    if (hit < 0) return;
    sfx.tap();
    if (actions[hit] === 'resume') resume();
    else if (actions[hit] === 'new') startNew();
    else if (actions[hit] === 'book') openBook();
    else if (actions[hit] === 'help') s.overlay = { type: 'help', page: 0, howtoPage: 0, aboutPage: 0, rulesPage: 0 };
    else if (actions[hit] === 'auto') enterAuto();
    else s.overlay = { type: 'covenant' };
  }

  // Shared "tap to choose, tap again (or Confirm) to commit" behaviour for every choice screen.
  const choose = (count, tap, keys, rects, onConfirm) => {
    if (count <= 0) return false;
    if (keys.pressed.has('ArrowRight') || keys.pressed.has('ArrowDown')) s.ui.choice = (s.ui.choice + 1 + count) % count;
    if (keys.pressed.has('ArrowLeft') || keys.pressed.has('ArrowUp')) s.ui.choice = (s.ui.choice - 1 + count * 2) % count;
    const valid = s.ui.choice >= 0 && s.ui.choice < count;
    if ((keys.pressed.has('Space') || keys.pressed.has('Enter')) && valid) {
      onConfirm(s.ui.choice);
      return true;
    }
    if (!tap) return false;
    const hit = rects.findIndex((r) => inRect(r, tap.x, tap.y));
    if (hit >= 0) {
      if (s.ui.choice === hit) onConfirm(hit);
      else {
        s.ui.choice = hit;
        sfx.tap();
      }
      return true;
    }
    if (inRect(CONFIRM, tap.x, tap.y) && valid) {
      onConfirm(s.ui.choice);
      return true;
    }
    return false;
  };

  function updateMap(tap, keys) {
    const doors = s.run.doors;
    if (choose(doors.length, tap, keys, choiceRects(doors.length), enterDoor)) return;
    if (!tap) return;
    if (inRect(BTN.menu, tap.x, tap.y)) s.overlay = { type: 'covenant' };
    else if (inRect(BTN.quiver, tap.x, tap.y)) openQuiver();
    else if (inRect(BTN.spent, tap.x, tap.y)) openSpent();
    else if (inRect(BTN.ledger, tap.x, tap.y)) openLedger();
  }

  function updateReward(tap, keys) {
    const cards = s.reward.cards;
    const take = (i) => {
      R.addCard(s.run, cards[i]);
      sfx.tap();
      nextStep();
    };
    if (choose(cards.length, tap, keys, trioRects(cards.length), take)) return;
    if (tap && inRect(SECONDARY, tap.x, tap.y)) {
      s.run.marks += R.SKIP_REWARD_MARKS;
      nextStep();
    }
  }

  const campOptions = () => {
    const list = [{ id: 'rest', label: 'Rest', sub: `Heal ${R.campHeal(s.run)} Resolve` }];
    if (R.removableTechs(s.run).length > 1) list.push({ id: 'drop', label: 'Lighten the quiver', sub: 'Remove one Technique for good' });
    if (s.run.debts.length) list.push({ id: 'settle', label: 'Settle a Debt', sub: 'Costs 5 maximum Resolve' });
    return list;
  };

  function updateCamp(tap, keys) {
    const options = campOptions();
    choose(options.length, tap, keys, choiceRects(options.length), (i) => {
      const id = options[i].id;
      sfx.tap();
      if (id === 'rest') {
        R.campRest(s.run);
        nextStep();
      } else if (id === 'drop') openCards('Remove a Technique', R.removableTechs(s.run).map((c) => ({ id: c.id, uid: c.uid })), 'remove', 'Tap the one to leave behind.');
      else {
        s.overlay = {
          type: 'options', title: 'Settle a Debt', text: 'Paid now, it will not come due. It costs 5 maximum Resolve.',
          options: s.run.debts.map((d) => ({ label: DEBTS[d].name, sub: `Would come due as: ${DEBTS[d].dueText}`, act: 'settle', arg: d })),
        };
      }
    });
  }

  function updateEnvoy(tap, keys) {
    const ev = EVENTS[s.envoy.event];
    if (!ev) {
      nextStep();
      return;
    }
    if (s.envoy.outcome) {
      if ((tap && inRect(CONFIRM, tap.x, tap.y)) || keys.pressed.has('Space') || keys.pressed.has('Enter')) beginPending(nextStep);
      return;
    }
    choose(ev.options.length, tap, keys, choiceRects(ev.options.length, ENVOY_TOP, ENVOY.h, ENVOY.gap), (i) => {
      const standingBefore = s.run.standing;
      const outcome = R.applyEventOption(s.run, s.envoy.event, i, rng);
      s.envoy.outcome = { ...outcome, option: i, broke: s.run.standing < standingBefore };
      s.ui.choice = -1;
      if (s.envoy.outcome.broke) sfx.foul();
      else sfx.tap();
      save();
    });
  }

  function updateTuner(tap, keys) {
    const stock = s.door.stock ?? [];
    const bought = choose(stock.length, tap, keys, trioRects(stock.length, TUNER_TRIO_Y), (i) => {
      if (R.buy(s.run, s.door, i)) {
        sfx.win();
        save();
      } else sfx.hurt();
      s.ui.choice = -1;
    });
    if (bought || !tap) return;
    if (inRect(TUNER_REMOVE, tap.x, tap.y) && !s.door.removed && s.run.marks >= R.REMOVE_PRICE && R.removableTechs(s.run).length > 1) {
      openCards('Remove a Technique', R.removableTechs(s.run).map((c) => ({ id: c.id, uid: c.uid })), 'tunerRemove', `Costs ${R.REMOVE_PRICE} Marks.`);
    } else if (inRect(SECONDARY, tap.x, tap.y)) nextStep();
  }

  function updateRunover(tap, keys) {
    if (keys.pressed.has('Enter')) {
      startRun();
      return;
    }
    if (!tap) return;
    if (inRect(CONFIRM, tap.x, tap.y)) startRun();
    else if (inRect(SECONDARY, tap.x, tap.y)) {
      const names = s.run.spent.map((c) => CARDS[c.id].name).join(', ');
      env.share(`One Arrow Oath — Legend ${s.legend}. I spent ${s.run.spent.length} arrows: ${names || 'none'}. Nothing fires twice.`);
    }
  }

  // ------------------------------------------------------------------ Auto Play (assisted learning)
  // A private run driven only by rules/battle.js and rules/run.js — never startRun/nextStep/
  // beginBattle/finishRun above, whose save()/saveMeta()/clearSave()/monetization.track() must
  // never fire for a demonstration nobody asked to have saved. The move-picker is autoplay.js,
  // ported from design/sim.mjs (the private balance simulator — this game's only existing
  // move-choosing logic, since there is no opponent AI in a single-player card battler).
  // THINK (board still, nothing shown) -> REVEAL (~2s, highlight the one move about to be taken)
  // -> ACT (the real rule functions run) -> loop, until the run ends on its own.
  const autoRng = () => (rng.fork ? rng.fork() : rng);

  const autoCampOptionsList = (run) => {
    const list = [{ id: 'rest', label: 'Rest', sub: `Heal ${R.campHeal(run)} Resolve` }];
    if (R.removableTechs(run).length > 1) list.push({ id: 'drop', label: 'Lighten the quiver', sub: 'Remove one Technique for good' });
    if (run.debts.length) list.push({ id: 'settle', label: 'Settle a Debt', sub: 'Costs 5 maximum Resolve' });
    return list;
  };

  function enterAuto() {
    const run = R.newRun(autoRng(), { archer: 'keeper', oath: 0 });
    s.auto = {
      rng: autoRng(), run, battle: null, door: null, reward: null, envoy: null, leaving: false,
      scene: 'map', phase: 'think', timer: AUTO_THINK_STEPS[s.autoThinkIdx], pending: null,
      caption: '', result: null, legend: 0, ui: { choice: -1, sel: -1, target: 0 }, paused: false,
    };
    s.scene = 'auto';
    s.fade = s.meta.reduceMotion ? 0 : 1;
  }

  function exitAuto() {
    s.auto = null;
    s.scene = 'title';
    s.fade = s.meta.reduceMotion ? 0 : 1;
  }

  function autoFinish(A, result) {
    A.run.result = result;
    A.legend = R.legend(A.run);
    A.result = result;
    A.scene = 'runover';
  }

  function autoAdvanceStep(A) {
    R.advance(A.run, A.rng);
    A.door = null;
    A.reward = null;
    A.envoy = null;
    A.battle = null;
    A.leaving = false;
    if (A.run.result) {
      autoFinish(A, A.run.result);
      return;
    }
    A.scene = 'map';
    A.ui.choice = -1;
  }

  function autoBattleWon(A) {
    B.settleBattle(A.battle, A.run);
    A.run.battlesWon += 1;
    const tier = tierOf(A.door ?? { kind: 'fight' });
    A.run.marks += R.battleMarks(A.rng, tier);
    A.reward = { cards: R.genRewards(A.run, A.rng, tier, !!A.door?.guaranteeRare) };
    A.battle = null;
    A.scene = 'reward';
    A.ui.choice = -1;
  }

  function autoBattleLost(A) {
    B.settleBattle(A.battle, A.run);
    autoFinish(A, 'lost');
  }

  // A Debt or an Envoy event can leave run.pending (a card still to remove, or an Arrow still to
  // choose) — the real game shows an overlay for it; Auto Play resolves it immediately with the
  // same draftValue heuristic (best for a gain, worst for a forced removal) so a run never sits
  // with an unresolved promise the player never sees.
  function autoResolvePending(A) {
    let guard = 0;
    while (A.run.pending && guard < 20) {
      guard += 1;
      const items = R.pendingCards(A.run);
      if (!items.length) {
        A.run.pending = null;
        break;
      }
      const pick = A.run.pending.type === 'gain'
        ? items.reduce((best, it) => (autoDraftValue(it.id) > autoDraftValue(best.id) ? it : best))
        : items.reduce((worst, it) => (autoDraftValue(it.id) < autoDraftValue(worst.id) ? it : worst));
      R.resolvePending(A.run, pick.uid);
    }
  }

  // THINK ends here: decide the single move to make, and how REVEAL should show it.
  function computeAutoMove(A) {
    A.leaving = false;
    if (A.scene === 'map') {
      const index = autoChooseDoor(A.run);
      const door = A.run.doors[index];
      A.pending = { type: 'door', index };
      A.ui.choice = index;
      const verbs = { fight: 'Entering a skirmish', elite: 'Entering a hard fight', boss: 'Entering the last door', camp: 'Making camp', tuner: 'Visiting the Tuner', envoy: 'Meeting an Envoy' };
      A.caption = verbs[door.kind] ?? 'Choosing a door';
    } else if (A.scene === 'battle') {
      const pick = autoChooseCard(A.battle);
      if (pick) {
        const card = CARDS[A.battle.hand[pick.i].id];
        const targetEnemy = A.battle.enemies[pick.target];
        A.pending = { type: 'play', index: pick.i, target: pick.target };
        A.ui.sel = pick.i;
        A.ui.target = pick.target;
        A.caption = targetEnemy && B.needsTarget(card) ? `Playing ${card.name} on ${targetEnemy.name}` : `Playing ${card.name}`;
      } else {
        A.pending = { type: 'end' };
        A.ui.sel = -1;
        A.caption = 'Ending the turn';
      }
    } else if (A.scene === 'reward') {
      const index = autoChooseReward(A.reward.cards);
      A.pending = { type: 'take', index };
      A.ui.choice = index;
      A.caption = `Taking ${CARDS[A.reward.cards[index]].name}`;
    } else if (A.scene === 'camp') {
      const options = autoCampOptionsList(A.run);
      const index = autoChooseCampOption(options);
      A.pending = { type: 'camp', index };
      A.ui.choice = index;
      A.caption = options[index].label;
    } else if (A.scene === 'envoy') {
      const ev = EVENTS[A.envoy.event];
      const index = autoChooseEnvoyOption(ev);
      A.pending = { type: 'envoy', index };
      A.ui.choice = index;
      A.caption = `Choosing: ${ev.options[index].label}`;
    } else if (A.scene === 'tuner') {
      const decision = autoChooseTunerAction(A.run, A.door);
      if (decision.buy >= 0) {
        A.pending = { type: 'buy', index: decision.buy };
        A.ui.choice = decision.buy;
        A.caption = `Buying ${CARDS[A.door.stock[decision.buy].id].name}`;
      } else {
        A.pending = { type: 'leave' };
        A.ui.choice = -1;
        A.leaving = true;
        A.caption = 'Leaving the Tuner';
      }
    }
  }

  // ACT: the pending decision actually happens now, through the real rule functions — never a
  // fake path that only looks like it played a card or entered a door.
  function applyAutoMove(A) {
    const p = A.pending;
    A.pending = null;
    if (!p) return;
    if (p.type === 'door') {
      const door = A.run.doors[p.index];
      A.door = door;
      if (door.kind === 'fight' || door.kind === 'elite' || door.kind === 'boss') {
        const { battle } = B.startBattle(A.run, door.encounter, A.rng, { final: door.kind === 'boss' && A.run.act === R.ACTS, label: 'a fight' });
        A.battle = battle;
        A.scene = 'battle';
        A.ui.sel = -1;
        A.ui.target = 0;
      } else {
        A.scene = door.kind;
        A.envoy = door.kind === 'envoy' ? { event: door.event } : null;
      }
    } else if (p.type === 'play') {
      B.playCard(A.battle, A.run, p.index, p.target, A.rng);
      // The played card just left the hand, splicing every later index down by one — clear the
      // highlight rather than let it now point at whatever card slid into that slot (matches
      // playFromHand's own s.ui.sel = -1 after a real play, for the same reason).
      A.ui.sel = -1;
      if (A.battle.phase === 'won') autoBattleWon(A);
      else if (A.battle.phase === 'lost') autoBattleLost(A);
    } else if (p.type === 'end') {
      B.endTurn(A.battle, A.run, A.rng);
      if (A.battle.phase === 'won') autoBattleWon(A);
      else if (A.battle.phase === 'lost') autoBattleLost(A);
    } else if (p.type === 'take') {
      R.addCard(A.run, A.reward.cards[p.index]);
      autoAdvanceStep(A);
    } else if (p.type === 'camp') {
      const options = autoCampOptionsList(A.run);
      const id = options[p.index].id;
      if (id === 'rest') R.campRest(A.run);
      else if (id === 'settle') R.settleDebt(A.run, A.run.debts[0]);
      else if (id === 'drop') {
        const c = R.removableTechs(A.run)[0];
        if (c) R.removeCard(A.run, c.uid);
      }
      autoAdvanceStep(A);
    } else if (p.type === 'envoy') {
      R.applyEventOption(A.run, A.envoy.event, p.index, A.rng);
      autoResolvePending(A);
      autoAdvanceStep(A);
    } else if (p.type === 'buy') {
      R.buy(A.run, A.door, p.index);
    } else if (p.type === 'leave') {
      autoAdvanceStep(A);
    }
  }

  function updateAuto(dt, tap) {
    const A = s.auto;
    if (!A) return;
    if (tap) {
      if (inRect(AUTO_STEP_DEC, tap.x, tap.y) && s.autoThinkIdx > 0) {
        s.autoThinkIdx -= 1;
        storage.set('autoThinkIdx', s.autoThinkIdx);
        return;
      }
      if (inRect(AUTO_STEP_INC, tap.x, tap.y) && s.autoThinkIdx < AUTO_THINK_STEPS.length - 1) {
        s.autoThinkIdx += 1;
        storage.set('autoThinkIdx', s.autoThinkIdx);
        return;
      }
      if (inRect(AUTO_EXIT, tap.x, tap.y)) {
        exitAuto();
        return;
      }
      if (A.phase === 'over' && inRect(AUTO_AGAIN, tap.x, tap.y)) {
        enterAuto();
        return;
      }
      // Pause freezes the whole loop exactly where it is - mid-THINK, mid-REVEAL or mid-ACT's
      // settle pause - by short-circuiting below before A.timer (or anything else) ever moves;
      // Resume just lets the same timer keep counting down from wherever it was left.
      if (A.phase !== 'over' && inRect(AUTO_PAUSE, tap.x, tap.y)) {
        A.paused = !A.paused;
        return;
      }
      if (!A.paused && (A.phase === 'think' || A.phase === 'reveal') && inRect(AUTO_SKIP, tap.x, tap.y)) A.timer = 0;
    }
    if (A.phase === 'over' || A.paused) return;
    A.timer -= dt;
    if (A.timer > 0) return;
    if (A.phase === 'think') {
      computeAutoMove(A);
      A.phase = 'reveal';
      A.timer = AUTO_REVEAL_SECONDS;
    } else if (A.phase === 'reveal') {
      applyAutoMove(A);
      A.phase = 'act';
      A.timer = AUTO_ACT_SECONDS;
    } else if (A.phase === 'act') {
      if (A.run.result) A.phase = 'over';
      else {
        A.phase = 'think';
        A.timer = AUTO_THINK_STEPS[s.autoThinkIdx];
      }
    }
  }

  function updateBattle(dt, tap, p, keys) {
    const b = s.battle;
    const ui = s.ui;
    // the three first-fight hints, one at a time, each shown until acted on or read for a while
    const seen = s.meta.coach;
    let hint = null;
    if (!seen.read && b.turn === 1) hint = 'read';
    else if (!seen.answer && b.phase === 'player' && b.hand.some((_, i) => B.wouldAnswer(b, i, ui.target))) hint = 'answer';
    else if (!seen.spent && s.run.spent.length > 0) hint = 'spent';
    if (hint !== s.coach.key) s.coach = { key: hint, t: 0 };
    else if (hint) {
      s.coach.t += dt;
      if (s.coach.t > 8) markCoach(hint);
    }
    // displayed numbers ease toward the real ones
    const k = 1 - Math.exp(-dt * 9);
    ui.shownResolve += (b.player.resolve - ui.shownResolve) * k;
    ui.shownHp.length = b.enemies.length;
    ui.flash.length = b.enemies.length;
    b.enemies.forEach((e, i) => {
      if (typeof ui.shownHp[i] !== 'number') ui.shownHp[i] = e.hp;
      ui.shownHp[i] += (e.hp - ui.shownHp[i]) * k;
      ui.flash[i] = Math.max(0, (ui.flash[i] ?? 0) - dt * 5);
    });

    // cards ease toward their slots in the fan
    const slots = handSlots(b.hand.length);
    const kc = 1 - Math.exp(-dt * 16);
    // a card under the finger follows almost 1:1; others settle softly
    const kd = 1 - Math.exp(-dt * 48);
    const alive = {};
    b.hand.forEach((c, i) => {
      alive[c.uid] = true;
      let pos = ui.cardPos[c.uid];
      if (!pos) {
        pos = { x: BTN.quiver.x + 50, y: BTN.quiver.y, rot: 0, scale: 0.4 };
        ui.cardPos[c.uid] = pos;
      }
      let tx = slots[i].x;
      let ty = slots[i].y;
      let tr = slots[i].rot;
      let ts = slots[i].scale;
      if (ui.drag && ui.drag.uid === c.uid) {
        tx = p.x;
        ty = p.y - 30;
        tr = 0;
        ts = 1.12;
      } else if (ui.sel === i) {
        ty -= 40;
        tr = 0;
        ts = Math.max(1.06, slots[i].scale * 1.16);
      }
      const held = ui.drag && ui.drag.uid === c.uid;
      pos.x += (tx - pos.x) * (held ? kd : kc);
      pos.y += (ty - pos.y) * (held ? kd : kc);
      pos.rot += (tr - pos.rot) * kc;
      pos.scale += (ts - pos.scale) * kc;
    });
    for (const uid of Object.keys(ui.cardPos)) if (!alive[uid]) delete ui.cardPos[uid];
    if (ui.sel >= b.hand.length) ui.sel = -1;

    if (s.pending) {
      s.pending.at -= dt;
      if (s.pending.at <= 0 || tap) {
        const what = s.pending.what;
        s.pending = null;
        if (what === 'won') battleWon();
        else battleLost();
      }
      return;
    }
    if (s.lock > 0) {
      s.lock -= dt;
      if (tap) {
        // a tap skips the animation, never the outcome
        s.lock = 0;
        for (const f of s.fx) f.delay = 0;
      }
      ui.drag = null;
      return;
    }
    if (b.phase !== 'player') return;

    // keyboard
    for (let n = 1; n <= 7; n++) if (keys.pressed.has(`Digit${n}`) && n <= b.hand.length) ui.sel = ui.sel === n - 1 ? -1 : n - 1;
    if (keys.pressed.has('ArrowLeft')) cycleTarget(-1);
    if (keys.pressed.has('ArrowRight')) cycleTarget(1);
    if ((keys.pressed.has('Enter') || keys.pressed.has('ArrowUp')) && ui.sel >= 0) {
      playFromHand(ui.sel);
      return;
    }
    if (keys.pressed.has('Space')) {
      doEndTurn();
      return;
    }
    if (keys.pressed.has('KeyF') && !b.foulUsed) s.overlay = { type: 'confirmFoul' };
    if (keys.pressed.has('KeyQ')) openQuiver();

    const cardAt = (x, y) => {
      const order = b.hand.map((_, i) => i);
      if (ui.sel >= 0) order.push(order.splice(ui.sel, 1)[0]);
      for (let j = order.length - 1; j >= 0; j--) {
        const i = order[j];
        const pos = ui.cardPos[b.hand[i].uid];
        if (!pos) continue;
        const w = CARD_W * pos.scale;
        const h = CARD_H * pos.scale;
        if (x >= pos.x - w / 2 && x <= pos.x + w / 2 && y >= pos.y - h / 2 && y <= pos.y + h / 2) return i;
      }
      return -1;
    };

    // pressing a card starts a draw
    if (p.pressed) {
      const i = cardAt(p.x, p.y);
      if (i >= 0) ui.drag = { uid: b.hand[i].uid };
    }
    // the string: how far the held card has been pulled down
    ui.pull = ui.drag && ui.press ? Math.max(0, Math.min(1, (p.y - ui.press.y) / PULL_TO_LOOSE)) : 0;

    // holding still on a card opens its full text
    if (ui.drag && ui.press && !ui.press.moved && ui.press.held >= HOLD_TO_INSPECT) {
      const inst = b.hand.find((c) => c.uid === ui.drag.uid);
      ui.drag = null;
      ui.press = null;
      if (inst) s.overlay = { type: 'inspect', id: inst.id };
      return;
    }

    if (p.released && ui.drag) {
      const index = b.hand.findIndex((c) => c.uid === ui.drag.uid);
      const start = ui.press;
      const dy = start ? p.y - start.y : 0;
      const moved = start ? start.moved : false;
      ui.drag = null;
      ui.pull = 0;
      if (index < 0) return;
      if (dy >= PULL_TO_LOOSE) playFromHand(index);
      else if (moved && p.y < FIELD_BOTTOM) {
        const slotsE = enemySlots(b.enemies);
        const hit = b.enemies.findIndex((e, i) => !e.dead && Math.hypot(p.x - slotsE[i].x, p.y - slotsE[i].y) < slotsE[i].r * 1.7);
        if (hit >= 0) ui.target = hit;
        playFromHand(index);
      } else if (!moved) {
        if (ui.sel === index) playFromHand(index);
        else {
          ui.sel = index;
          sfx.tap();
        }
      }
      return;
    }

    if (!tap) return;
    const slotsE = enemySlots(b.enemies);
    const enemyHit = b.enemies.findIndex((e, i) => !e.dead && Math.hypot(tap.x - slotsE[i].x, tap.y - slotsE[i].y) < slotsE[i].r * 1.5);
    if (enemyHit >= 0) {
      if (ui.sel >= 0 && ui.target === enemyHit) playFromHand(ui.sel);
      else {
        ui.target = enemyHit;
        sfx.tap();
      }
    } else if (inRect(BTN.endTurn, tap.x, tap.y)) doEndTurn();
    else if (inRect(BTN.foul, tap.x, tap.y)) {
      if (!b.foulUsed) s.overlay = { type: 'confirmFoul' };
    } else if (inRect(BTN.quiver, tap.x, tap.y)) openQuiver();
    else if (inRect(BTN.spent, tap.x, tap.y)) openSpent();
    else if (inRect(BTN.ledger, tap.x, tap.y)) openLedger();
    else if (inRect(BTN.menu, tap.x, tap.y)) s.overlay = { type: 'covenant' };
    else ui.sel = -1;
  }

  // ------------------------------------------------------------------ contract
  return {
    update(dt, input) {
      s.t += dt;
      const p = input.pointer;
      const keys = input.keys;
      const ui = s.ui;

      // raw pointer state -> taps
      let tap = null;
      if (p.pressed) ui.press = { x: p.x, y: p.y, lastY: p.y, moved: false, held: 0 };
      if (ui.press && p.down) {
        if (Math.hypot(p.x - ui.press.x, p.y - ui.press.y) > MOVE_SLOP) ui.press.moved = true;
        ui.press.held += dt;
      }
      if (p.released && ui.press && !ui.press.moved) tap = { x: p.x, y: p.y };

      // effects
      let shake = 0;
      for (const f of s.fx) {
        if (f.delay > 0) f.delay -= dt;
        else {
          f.t += dt;
          if (f.k === 'shake') shake = Math.max(shake, f.amount * Math.max(0, 1 - f.t / f.dur));
        }
      }
      s.fx = s.fx.filter((f) => f.t < f.dur);
      s.shake = shake;
      if (s.scene !== s.lastScene) {
        s.lastScene = s.scene;
        s.fade = s.meta.reduceMotion ? 0 : 1;
      }
      if (s.fade > 0) s.fade = Math.max(0, s.fade - dt * 3.2);
      if (s.meta.reduceMotion) s.shake = 0;

      if (keys.pressed.has('Escape')) {
        if (s.overlay) {
          if (!s.overlay.required) s.overlay = null;
        }
        else if (s.scene === 'auto') exitAuto();
        else if (s.run && !s.run.result && s.scene !== 'title') s.overlay = { type: 'covenant' };
      } else if (s.overlay) updateOverlay(tap, p);
      else if (s.scene === 'title') updateTitle(tap, keys);
      else if (s.scene === 'map') updateMap(tap, keys);
      else if (s.scene === 'battle') updateBattle(dt, tap, p, keys);
      else if (s.scene === 'reward') updateReward(tap, keys);
      else if (s.scene === 'camp') updateCamp(tap, keys);
      else if (s.scene === 'envoy') updateEnvoy(tap, keys);
      else if (s.scene === 'tuner') updateTuner(tap, keys);
      else if (s.scene === 'runover') updateRunover(tap, keys);
      else if (s.scene === 'auto') updateAuto(dt, tap);
      // 'demo-limit': nothing is playable and taps do nothing.

      if (ui.press && p.down) ui.press.lastY = p.y;
      if (p.released) ui.press = null;
    },

    render(ctx, view) {
      if (s.scene === 'auto' && s.auto) renderAuto(ctx, s, s.auto, { sky });
      else renderAll(ctx, view, s, { sky, campOptions, demo: !!env.config.demo, demoLeft: Math.max(0, DEMO_BATTLES - s.demoBattles), manifest: env.manifest });
    },

    // Auto Play is free and silent by design (see the tone() gate above); it must never accrue
    // against, or be blocked by, the platform's own preview-time gate.
    isPreviewExempt: () => s.scene === 'auto',

    getState: () => s,
  };
}
