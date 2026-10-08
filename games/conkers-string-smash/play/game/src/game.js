// Conkers String Smash: state and flow. Rules live in engine.js, the physics in sim.js, the computer players and the Think hint in ai.js, the scene
// and the conker pictures in scene.js, the play screen in view.js, every other screen in menus.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, pick (the tin), settings, play (also Watch & Learn), result, howto / about / rules, demolimit.
// Play phases: intro, aim (a person plans the swing), think (a computer plans it), swing, result, turn, over.
import { W, H, FR, setFrame, flowOrigin, TEXT_SCALES, THINK_STEPS, REVEAL_SECS, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, SETUP_PINS, inRect } from './layout.js';
import { newSim, stepSim, settleSim, setHand, setPull, advanceD, PULL_MIN, PULL_MAX, HAND_RANGE, FLICK_KICK, bobPos, WOBBLE_PERIOD } from './sim.js';
import { KINDS, RIVALS, CUP_ROUNDS, GOES, newConker, rivalConker, newDuel, applySwing, awardWin, newCup, tinLeft, countLabel, kindOf, statsOf, stageOf, STAGE_NAMES } from './engine.js';
import { touchDamage } from './engine.js';
import { STEADY, SKILLS, choosePlan, performPlan, swingTable, robust, explain, evaluate, mulberry, valueOf, DELAYS } from './ai.js';
import { renderPlay, computeLayout, nameOf, statusText, whyTitle } from './view.js';
import { renderTitle, renderSetup, renderSettings, renderPick, renderResult, renderPause, renderWhy, renderPages, renderDemoLimit, hitScreen, flowMeta, pageCount, ensureLayout, READER } from './menus.js';
import { ABOUT, HOWTO, RULES, LORE } from './content.js';
import { setPress } from './ui.js';
import { pressLockup } from './brand.js';
import { makeCam } from './scene.js';

// Fluid layout (kit 1.7.1): the kit keeps meta.width / meta.height equal to the live screen (short side 720); layout.js turns that into the design frame.
export const meta = { width: W, height: H, fluid: { short: 720 } };
const DEMO_GAME_CAP = 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const STEPS_PER_TICK = 4;            // physics steps (1/240 s) per tick (1/60 s)
const DRAW_SECS = 0.8;               // a computer player draws its conker back
const WOBBLE_A = 0.03;               // the defender's hand wobble (metres)
const MAX_PARTS = 90;
const CANCEL_PULL = 0.3;             // a pull shorter than this is not a swing
const HAND_STEP = 0.25;

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork(), tw = rng.fork(), aiR = rng.fork();
  const rn = () => aiR.next();
  let shotMode = false;
  try { shotMode = /[?&]shot=/.test(globalThis.location.search); } catch { shotMode = false; }
  const shotSeed = config.seed | 0;
  // A second finger would make the kit's single pointer jump and its lift would end the swing: every touch that is not the primary one is dropped.
  try {
    if (typeof globalThis.addEventListener === 'function' && !shotMode) {
      const dropStray = (e) => { if (e.pointerType === 'touch' && e.isPrimary === false) e.stopImmediatePropagation(); };
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) globalThis.addEventListener(type, dropStray, true);
    }
  } catch { /* no DOM (headless): nothing to guard */ }
  try {
    if (typeof globalThis.addEventListener === 'function') globalThis.addEventListener('wheel', (e) => { state.wheel = clamp((state.wheel || 0) + (e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY), -600, 600); }, { passive: true });
  } catch { /* no DOM */ }

  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, guide: true, steady: 1, textIdx: 0, thinkIdx: 1 },
    record: { played: 0, wins: [0, 0, 0, 0], cups: 0, bestCount: 0, demoGames: 0, swings: 0, touches: 0, shatters: 0 },
    setup: { mode: 'duel', opp: 0, kind: [1, 1] }, setupMsg: '', restoreMsg: '',
    ui: { scroll: 0, drag: null, rs: 0, rsPage: -1, rsKey: '' }, wheel: 0, page: 0, loaded: false,
    cup: null, m: null, sim: null, ph: 'intro', pt: 0, humanTurn: false, mirror: false, plan: { pull: 0.9, hand: 0, flick: 0 }, lastPlan: [null, null],
    parts: [], banner: null, shake: 0, flash: 0, curtain: 0, turnDone: false, guide: null, strip: null, hint: null, think: null, why: null, drag: null,
    thinkSecs: 5, tip: '', res: null, att: { sim: null, c: null, parts: [], n: 0, wait: 0, flash: 0, seen: 0 }, shot: false, showcase: false, hitsSeen: 0, firstSwing: true, gt: 0, swc: 0,
  };
  const record = state.record;

  // ---- persistence ---------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  const saveCup = () => { if (state.cup) storage.set('cup', state.cup); else storage.remove('cup'); };
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  const validCup = (c) => !!c && Array.isArray(c.tin) && c.tin.length === 3 && c.tin.every((k) => k && KINDS.some((q) => q.id === k.kind) && int(k.count, 0, 999) && Number.isFinite(k.dmg) && Number.isFinite(k.psi))
    && int(c.round, 0, CUP_ROUNDS - 1) && int(c.wins, 0, 99) && int(c.lost, 0, 99) && !c.done;
  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('cup', null)]).then(([s, r, cup]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    const st = state.settings;
    st.textIdx = clamp(st.textIdx | 0, 0, TEXT_SCALES.length - 1);
    st.thinkIdx = clamp(st.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    st.steady = clamp(st.steady | 0, 0, STEADY.length - 1);
    st.guide = st.guide !== false;
    if (!Array.isArray(state.record.wins) || state.record.wins.length < 4) state.record.wins = [0, 0, 0, 0];
    if (validCup(cup) && !shotMode) { cup.picked = -1; state.cup = cup; }
    state.loaded = true;
    audio.setMuted?.(!st.sound);
  }).catch(() => { state.loaded = true; });

  // ---- sound ---------------------------------------------------------------------------------------
  let toneBudget = 0;
  const tone = (o) => { if (state.settings.sound && toneBudget < 8) { toneBudget++; audio.tone(o); } };
  const sfx = {
    whoosh: (s = 1) => tone({ freq: 240 + 120 * s, to: 130, dur: 0.3, type: 'sawtooth', vol: 0.025 }),
    knock: (e = 1) => { tone({ freq: 180 + 60 * Math.min(2, e), to: 70, dur: 0.12, type: 'square', vol: 0.12 }); tone({ freq: 520 + 120 * Math.min(2, e), to: 260, dur: 0.07, type: 'triangle', vol: 0.09 }); },
    crack: () => { tone({ freq: 1400, to: 420, dur: 0.09, type: 'sawtooth', vol: 0.07 }); tone({ freq: 900, to: 300, dur: 0.14, type: 'square', vol: 0.05 }); },
    smash: () => { [0, 1, 2, 3].forEach((i) => tone({ freq: 700 - i * 130, to: 120, dur: 0.18 + i * 0.05, type: 'sawtooth', vol: 0.08 })); tone({ freq: 90, to: 40, dur: 0.35, type: 'sine', vol: 0.2 }); },
    tick: () => tone({ freq: 880, dur: 0.04, type: 'triangle', vol: 0.05 }),
    miss: () => tone({ freq: 190, to: 110, dur: 0.22, type: 'sawtooth', vol: 0.035 }),
    win: () => [0, 2, 4, 7, 9, 12].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.3 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const showBanner = (text, sub = '', kind = '', dur = 1.5, size = 84) => { state.banner = { text, sub, kind, t: 0, dur, size }; };

  // ---- particles ------------------------------------------------------------------------------------
  const addPart = (list, p) => { if (list.length < MAX_PARTS) list.push({ t: 0, vx: 0, vy: 0, rot: 0, vr: 0, ...p }); };
  const sparks = (list, x, y, n, power = 1) => {
    for (let i = 0; i < n; i++) { const a = fx.next() * Math.PI * 2, v = (0.3 + fx.next() * 0.9) * power; addPart(list, { k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.2, size: 0.006 + fx.next() * 0.006, max: 0.35 + fx.next() * 0.3, col: fx.next() < 0.5 ? '#fff0b8' : '#ffb85a' }); }
    addPart(list, { k: 'ring', x, y, max: 0.35, size: 0.02, col: 'rgba(255,240,200,0.8)' });
  };
  const chips = (list, x, y, n) => {
    for (let i = 0; i < n; i++) { const a = fx.next() * Math.PI * 2, v = 0.4 + fx.next() * 1.3, q = fx.next(); addPart(list, { k: 'chip', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.9, size: 0.014 + fx.next() * 0.022, max: 1.4 + fx.next() * 0.6, rot: fx.next() * 6, vr: (fx.next() - 0.5) * 14, col: q < 0.28 ? '#d6b883' : q < 0.5 ? '#b3541f' : '#7a2f0e' }); }
  };
  const stepParts = (list, dt) => {
    for (const p of list) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.k === 'chip' || p.k === 'spark') p.vy += 3.2 * dt; if (p.k === 'chip' && p.y > 0.78) { p.y = 0.78; p.vy *= -0.3; p.vx *= 0.7; } p.vx *= 0.99; }
    return list.filter((p) => p.t < p.max);
  };

  // ---- who is who -------------------------------------------------------------------------------------
  const mode = () => state.m.cfg.mode;
  const isAI = (side) => mode() === 'watch' || ((mode() === 'cup' || mode() === 'duel') && side === 1);
  const skillOf = (side) => state.m.skills[side];
  const duelOf = () => state.m.duel;
  const strikerSide = () => duelOf().striker;
  const stats = () => { const d = duelOf(), si = d.striker; return { cs: d.c[si], cd: d.c[1 - si] }; };

  // ---- the match ---------------------------------------------------------------------------------------
  const demoLocked = () => state.demo && record.demoGames >= DEMO_GAME_CAP;
  const startMatch = (cfg) => {
    if (state.demo && cfg.mode !== 'watch') {
      if (demoLocked()) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
      record.demoGames++; save();
    }
    let c0, c1, names, skills, first;
    if (cfg.mode === 'cup') {
      const cup = state.cup, rv = RIVALS[cup.round];
      c0 = cup.tin[cup.picked]; c1 = rivalConker(cup.round); names = ['You', rv.name]; skills = [0, rv.skill]; first = (cup.round + cup.lost) % 2;
    } else if (cfg.mode === 'duel') {
      const rv = RIVALS[cfg.opp];
      c0 = newConker(KINDS[cfg.kind[0]].id, 0); c1 = rivalConker(cfg.opp); names = ['You', rv.name]; skills = [0, rv.skill]; first = cfg.first ?? aiR.int(2);
    } else if (cfg.mode === 'two') {
      c0 = newConker(KINDS[cfg.kind[0]].id, 0); c1 = newConker(KINDS[cfg.kind[1]].id, 0); names = ['Player 1', 'Player 2']; skills = [0, 0]; first = cfg.first ?? aiR.int(2);
    } else {
      const ids = [0, 1, 2, 3], a = ids.splice(aiR.int(ids.length), 1)[0], b = ids[aiR.int(ids.length)];
      c0 = newConker(KINDS[aiR.int(3)].id, aiR.int(3)); c1 = newConker(KINDS[aiR.int(3)].id, aiR.int(3));
      names = [RIVALS[a].name, RIVALS[b].name]; skills = [Math.max(2, RIVALS[a].skill), Math.max(2, RIVALS[b].skill)]; first = aiR.int(2);
    }
    c0.gone = false; c1.gone = false; c0.dmg = Math.min(c0.dmg, 0.97);
    state.m = { cfg: { ...cfg }, duel: newDuel(c0, c1, first), names, skills, stat: { swings: 0, touches: 0, weak: 0 } };
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.why = null;
    state.parts = []; state.banner = null; state.flash = 0; state.shake = 0; state.curtain = 0; state.sim = null; state.lastPlan = [null, null];
    state.swc = tw.next() * 20; state.turnDone = false;
    state.thinkSecs = THINK_STEPS[state.settings.thinkIdx];
    const head = cfg.mode === 'cup' ? `Round ${state.cup.round + 1}` : cfg.mode === 'watch' ? 'Watch & Learn' : 'Duel';
    showBanner(head, `${names[first] === 'You' ? 'You swing' : `${names[first]} swings`} first`, '', 1.5, 78);
    beginGo(true, false);
  };
  const startWatch = () => startMatch({ mode: 'watch' });

  // A fresh pair of conkers on strings for the next go. The defender's state carries over so nothing jumps.
  function beginGo(intro, turnChanged) {
    const m = state.m, d = m.duel, si = d.striker;
    const prev = state.sim;
    let dd, c = state.swc;
    if (prev) { dd = turnChanged ? { phi: prev.S.phi, om: prev.S.om } : { phi: prev.D.phi, om: prev.D.om }; c = prev.sw.c + prev.t; }
    else { const adv = advanceD({ phi: 0, om: 0 }, 6, { A: WOBBLE_A, c }); dd = { phi: adv.phi, om: adv.om }; c = adv.sw.c; }
    if (d.goes === 0) { d.c[0].psi = (tw.next() * 2 - 1) * Math.PI; d.c[1].psi = (tw.next() * 2 - 1) * Math.PI; }
    state.mirror = si === 1;
    state.humanTurn = !isAI(si);
    const lp = state.lastPlan[si] ?? { pull: 0.9, hand: 0 };
    state.plan = { pull: lp.pull, hand: lp.hand, flick: 0 };
    state.sim = newSim({ pull: state.plan.pull, hand: state.plan.hand, delay: 1e9, flick: 0 }, dd, statsOf(d.c[si]).mass, statsOf(d.c[1 - si]).mass, { A: WOBBLE_A, c });
    state.hitsSeen = 0; state.hint = null; state.think = null; state.drag = null; state.why = null; state.flash = 0; state.guide = null; state.strip = null;
    state.pt = 0;
    state.ph = intro ? 'intro' : state.humanTurn ? 'aim' : 'think';
    if (state.ph === 'think') startThink();
    state.tip = state.firstSwing && state.humanTurn ? 'Press anywhere on the scene, pull back, and let go. Turn on the aim guide in Settings for the best moments.' : '';
  }

  // ---- the swing ------------------------------------------------------------------------------------------------
  const releaseSwing = (flick) => {
    const sim = state.sim;
    if (state.ph !== 'aim') return;
    const si = strikerSide();
    sim.releaseT = sim.t; sim.kick = clamp(flick, 0, 1) * FLICK_KICK;
    state.lastPlan[si] = { pull: sim.pull, hand: sim.hand };
    state.ph = 'swing'; state.pt = 0; state.hint = null; state.drag = null; state.why = null;
    state.firstSwing = false; state.tip = '';
    if (mode() !== 'watch') record.swings = (record.swings | 0) + 1;
    sfx.whoosh(0.5 + clamp(sim.pull / PULL_MAX, 0, 1) + sim.kick / FLICK_KICK);
  };
  // effects for each new touch while the physics runs
  const onTouches = () => {
    const sim = state.sim;
    while (state.hitsSeen < sim.hits.length) {
      const h = sim.hits[state.hitsSeen++];
      sparks(state.parts, h.x, h.y, 6 + Math.round(Math.min(2, h.E) * 5), 0.6 + Math.min(1.6, h.E));
      state.shake = Math.min(1, 0.25 + h.E * 0.4); state.flash = 0.8;
      sfx.knock(h.E);
    }
  };
  const finishSwing = () => {
    const m = state.m, d = m.duel, sim = state.sim, si = d.striker, di = 1 - si;
    const rolls = sim.hits.map(() => 0.92 + 0.16 * fx.next());
    const cdBefore = stageOf(d.c[di]);
    const sum = applySwing(d, sim.hits, rolls);
    m.stat.swings++;
    if (sum.hit) { m.stat.touches++; if (sum.weak) m.stat.weak++; record.touches = (record.touches | 0) + 1; }
    const pct = (v) => `${Math.round(v * 100)}%`;
    if (sum.hit) {
      const lab = sum.solid === 2 ? 'Crushing!' : sum.solid === 1 ? 'Solid touch' : 'Glancing touch';
      const nmOf = (i) => (nameOf(state, i) === 'You' ? 'Your' : `${nameOf(state, i)}'s`);
      const sub = `${nmOf(di)} conker +${pct(sum.dD)} damage, ${nameOf(state, si) === 'You' ? 'yours' : `${nameOf(state, si)}'s`} +${pct(sum.dS)}`;
      if (sum.shattered >= 0) {
        d.c[sum.shattered].gone = true;
        const lose = sum.shattered, b = lose === si ? bobPos(sim.ps, sim.S.phi) : bobPos(sim.pd, sim.D.phi);
        chips(state.parts, b.x, b.y, 26);
        sparks(state.parts, b.x, b.y, 10, 1.4);
        state.shake = 1; sfx.smash();
        showBanner('SHATTERED!', `${nmOf(lose)} conker is in pieces`, 'gold', 2.4, 96);
        state.ph = 'over'; state.pt = 0;
        return;
      }
      showBanner(sum.weak ? 'Pale patch!' : lab, sum.weak ? `${lab}. ${sub}` : sub, sum.weak ? 'gold' : '', 1.5, sum.weak ? 80 : 74);
      if (sum.weak || sum.solid === 2 || stageOf(d.c[di]) > cdBefore) sfx.crack();
    } else {
      showBanner('Missed', d.goes === 0 ? 'The turn passes' : `${GOES - d.goes} ${GOES - d.goes === 1 ? 'go' : 'goes'} left`, 'bad', 1.2, 80);
      sfx.miss();
    }
    state.ph = 'result'; state.pt = 0;
  };
  const nextAfterResult = () => {
    const d = state.m.duel;
    if (d.over) { finishDuel(); return; }
    if (d.last && d.last.turnOver) { state.ph = 'turn'; state.pt = 0; state.turnDone = false; return; }
    beginGo(false, false);
  };

  // ---- the end of a duel ----------------------------------------------------------------------------------------------
  const finishDuel = () => {
    const m = state.m, d = m.duel, cfg = m.cfg, won0 = d.over.winner === 0;
    const gain = awardWin(d);
    const wc = d.c[d.over.winner];
    const res = { win: won0 || cfg.mode === 'two' || cfg.mode === 'watch', title: '', big: '', lines: [], buttons: [], conker: null };
    const nm = (i) => nameOf(state, i);
    const lore = LORE[(record.played + d.turns) % LORE.length];
    state.scene = 'result'; state.ui.scroll = 0; state.banner = null; state.paused = false; state.pauseMenu = false;
    if (cfg.mode !== 'watch') record.played = (record.played | 0) + 1;
    record.shatters = (record.shatters | 0) + 1;
    if (cfg.mode === 'cup') {
      const cup = state.cup;
      if (won0) {
        cup.wins++; cup.round++; cup.picked = -1;
        record.wins[cup.round - 1] = (record.wins[cup.round - 1] | 0) + 1;
        record.bestCount = Math.max(record.bestCount | 0, wc.count);
        res.title = cup.round >= CUP_ROUNDS ? 'Conker Cup champion!' : 'You win the duel!';
        res.big = `Your ${kindOf(wc.kind).name.toLowerCase()} conker is now ${countLabel(wc.count)}`;
        res.lines = [`${nm(1)}'s conker shattered. ${gain > 1 ? `It carried ${gain - 1} ${gain === 2 ? 'win' : 'wins'}, so you take ${gain}.` : 'You take 1 win.'}`, `Your conker is now ${STAGE_NAMES[stageOf(wc)].toLowerCase()}.`, `Lore: ${lore}`];
        res.conker = wc;
        if (cup.round >= CUP_ROUNDS) { cup.done = true; cup.champion = true; record.cups = (record.cups | 0) + 1; res.lines.unshift('You beat all four rivals.'); res.buttons = [{ id: 'cupnew', label: 'Play the Cup again' }, { id: 'menu', label: 'Main menu' }]; state.cup = null; storage.remove('cup'); }
        else { res.lines.unshift(`Round ${cup.round} of ${CUP_ROUNDS} won against ${nm(1)}.`); res.buttons = [{ id: 'cupnext', label: `Next rival: ${RIVALS[cup.round].name}` }, { id: 'menu', label: 'Main menu', sub: 'The Cup is kept' }]; saveCup(); }
        sfx.win();
      } else {
        const cup = state.cup; cup.lost++; cup.picked = -1;
        const left = tinLeft(cup);
        res.title = 'Your conker shattered';
        res.lines = [`${nm(1)} wins this duel and carries ${countLabel(d.c[1].count)}.`, left > 0 ? `${left} ${left === 1 ? 'conker is' : 'conkers are'} left in your tin.` : 'Your tin is empty.', `Lore: ${lore}`];
        if (left > 0) { res.buttons = [{ id: 'cupretry', label: 'Choose another conker', sub: `Try ${nm(1)} again` }, { id: 'menu', label: 'Main menu', sub: 'The Cup is kept' }]; saveCup(); }
        else { res.title = 'The Cup is over'; res.buttons = [{ id: 'cupnew', label: 'Start a new Cup' }, { id: 'menu', label: 'Main menu' }]; state.cup = null; storage.remove('cup'); }
      }
    } else {
      if (cfg.mode === 'duel' && won0) record.wins[cfg.opp] = (record.wins[cfg.opp] | 0) + 1;
      if (cfg.mode !== 'watch') record.bestCount = Math.max(record.bestCount | 0, won0 || cfg.mode === 'two' ? wc.count : 0);
      res.title = cfg.mode === 'two' || cfg.mode === 'watch' ? `${nm(d.over.winner)} wins` : won0 ? 'You win!' : 'You lose';
      res.big = `${nm(d.over.winner) === 'You' ? 'Your' : `${nm(d.over.winner)}'s`} conker is now ${countLabel(wc.count)}`;
      res.lines = [`Touches that landed: ${m.stat.touches} of ${m.stat.swings} swings.${m.stat.weak ? ` On the pale patch: ${m.stat.weak}.` : ''}`, `Lore: ${lore}`];
      res.conker = wc;
      res.buttons = cfg.mode === 'watch' ? [{ id: 'again', label: 'Watch another' }, { id: 'menu', label: 'Main menu' }] : [{ id: 'again', label: 'Rematch' }, { id: 'new', label: 'New duel' }, { id: 'menu', label: 'Main menu' }];
      if (won0 || cfg.mode === 'two') sfx.win();
    }
    state.res = res;
    save();
  };

  // ---- the Think hint and the aim guide ----------------------------------------------------------------------------
  const defNow = () => { const s = state.sim; return { phi: s.D.phi, om: s.D.om, sw: { A: s.sw.A, c: s.sw.c + s.t } }; };
  // What a release right now would do.
  const guideNow = () => {
    const sim = state.sim, { cs, cd } = stats();
    const e = evaluate({ pull: sim.pull, hand: sim.hand, flick: 0, delay: 0 }, defNow(), cs, cd);
    if (!e.hit) return { kind: 'miss', text: 'Release now: a miss. Wait for a better moment.', E: 0, at: null };
    const kind = e.E > 1.4 ? 'crush' : e.E > 0.55 ? 'solid' : 'glance';
    const name = kind === 'crush' ? 'CRUSHING touch' : kind === 'solid' ? 'SOLID touch' : 'Glancing touch';
    const td = touchDamage(e.first, cs, cd, 1);
    return { kind, E: e.E, weak: e.weak, first: e.first, wD: td.wD, wS: td.wS, dD: td.dD, dS: td.dS, at: e.first ? { x: e.first.x, y: e.first.y } : null, text: `Release now: ${name}${e.weak ? ' on the pale patch' : ''}` };
  };
  const stripNow = () => {
    const sim = state.sim, { cs, cd } = stats(), n = 28, out = [], d0 = defNow();
    for (let i = 0; i < n; i++) {
      const e = evaluate({ pull: sim.pull, hand: sim.hand, flick: 0, delay: (i / n) * WOBBLE_PERIOD }, d0, cs, cd);
      out.push({ hit: e.hit, E: e.E, weak: e.weak });
    }
    return out;
  };
  const requestHint = () => {
    if (!state.humanTurn || state.ph !== 'aim') return;
    if (state.hint && !state.hint.busy) { state.hint = null; return; }
    if (state.hint) return;
    state.hint = { busy: true, t: 0, plan: null, text: '' };
    sfx.tick();
  };
  const computeHint = () => {
    const sim = state.sim, { cs, cd } = stats();
    const dn = defNow();
    const sk = STEADY[state.settings.steady];
    const table = swingTable(cs, cd, dn, 1);
    const top = table.slice(0, 6);
    const seed = mulberry(Math.round(sim.t * 1000) + 5);
    top.forEach((c) => { c.rob = robust(c, dn, cs, cd, sk.err, 5, seed, 1); });
    top.sort((a, b) => b.rob.mean - a.rob.mean);
    const best = top[0];
    state.hint = { busy: false, plan: { pull: best.pull, hand: best.hand, flick: best.flick }, text: explain(best, best.rob, cs, cd) };
    state.why = { text: `${state.hint.text} Then watch the guide and the timing strip, and let go at a good moment.`, title: 'Think', wasPaused: false, useHint: true };
    state.ui.scroll = 0; state.drag = null;
  };
  const useHint = () => {
    if (!state.hint || state.hint.busy) return;
    setPull(state.sim, state.hint.plan.pull); setHand(state.sim, state.hint.plan.hand); state.plan.flick = state.hint.plan.flick;
    state.plan.pull = state.sim.pull; state.plan.hand = state.sim.hand;
    state.hint = null; state.why = null; sfx.tick();
  };

  // ---- computer players --------------------------------------------------------------------------------------------
  function startThink() {
    const si = strikerSide(), sk = SKILLS[skillOf(si)], watch = mode() === 'watch';
    const { cs, cd } = stats();
    const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : sk.think[0] + rn() * (sk.think[1] - sk.think[0]);
    const reveal = watch ? REVEAL_SECS * TEXT_SCALES[state.settings.textIdx] : 0;
    const horizon = dur + reveal + DRAW_SECS;
    const dN = defNow(), adv = advanceD(dN, horizon, dN.sw), d0 = { phi: adv.phi, om: adv.om, sw: adv.sw };
    const pick = choosePlan(cs, cd, d0, skillOf(si), rn);
    let text = '';
    if (watch) { const rob = robust(pick.pick, d0, cs, cd, sk.err, 6, mulberry(Math.round(adv.phi * 1e4) + 3), 1); text = explain(pick.pick, rob, cs, cd); }
    state.think = { t: 0, dur, reveal, phase: 'think', plan: pick.plan, text, from: { pull: state.sim.pull, hand: state.sim.hand }, perf: null };
    state.thinkSecs = THINK_STEPS[state.settings.thinkIdx];
  }
  // At the end of thinking: the exact release moment is re-chosen for the real defender, then the hand's error is applied.
  function beginDraw(th) {
    const si = strikerSide(), { cs, cd } = stats();
    const dN = defNow(), adv = advanceD(dN, DRAW_SECS, dN.sw), d0 = { phi: adv.phi, om: adv.om, sw: adv.sw };
    let best = null;
    for (let i = 0; i < DELAYS; i++) {
      const p = { ...th.plan, delay: (i * WOBBLE_PERIOD) / DELAYS };
      const v = valueOf(evaluate(p, d0, cs, cd), cs, cd, SKILLS[skillOf(si)].aggr);
      if (!best || v > best.v) best = { v, p };
    }
    th.perf = performPlan(best.p, skillOf(si), rn);
    th.phase = 'act'; th.t = 0;
  }
  const updateThink = (dt) => {
    const th = state.think, sim = state.sim;
    if (!th) { startThink(); return; }
    th.t += dt;
    if (th.phase === 'think') {
      if (th.t >= th.dur) {
        th.t = 0;
        if (mode() === 'watch') { th.phase = 'reveal'; th.dur = th.reveal; sfx.tick(); } else beginDraw(th);
      }
    } else if (th.phase === 'reveal') { if (th.t >= th.dur) beginDraw(th); }
    else if (th.phase === 'act') {
      const k = clamp(th.t / DRAW_SECS, 0, 1), e = 1 - Math.pow(1 - k, 3);
      setPull(sim, th.from.pull + (th.perf.pull - th.from.pull) * e); setHand(sim, th.from.hand + (th.perf.hand - th.from.hand) * e);
      if (th.t >= DRAW_SECS) {
        setPull(sim, th.perf.pull); setHand(sim, th.perf.hand);
        sim.releaseT = sim.t + th.perf.delay; sim.kick = th.perf.flick * FLICK_KICK;
        state.lastPlan[strikerSide()] = { pull: th.perf.pull, hand: th.perf.hand };
        state.ph = 'swing'; state.pt = 0; state.think = null; state.firstSwing = false;
        sfx.whoosh(1);
      }
    }
  };

  // ---- human aim -----------------------------------------------------------------------------------------------------------------
  const sceneCam = () => { const lay = computeLayout(state); return makeCam(0, lay.scene.y, FR.sw, lay.scene.h, state.mirror); };
  const nudgeHand = (v) => { setHand(state.sim, state.sim.hand + v); state.plan.hand = state.sim.hand; sfx.tick(); };
  const handleTray = (id) => {
    if (!id) return false;
    switch (id) {
      case 'menu': openPause(); return true;
      case 'think': if (state.hint && !state.hint.busy) useHint(); else requestHint(); return true;
      case 'handup': if (state.ph === 'aim') nudgeHand(HAND_STEP); return true;
      case 'handdn': if (state.ph === 'aim') nudgeHand(-HAND_STEP); return true;
      case 'swing': if (state.ph === 'aim') { if (state.sim.pull < CANCEL_PULL) setPull(state.sim, 0.9); releaseSwing(0.5); } return true;
      default: return false;
    }
  };
  const pressRect = (R_, ptr) => { for (const id of Object.keys(R_)) if (inRect(R_[id], ptr.x, ptr.y)) return id; return null; };
  function dragPull(cam, ptr) {
    const sim = state.sim, ps = sim.ps;
    const phi = Math.atan2(cam.wx(ptr.x) - ps.x, cam.wy(ptr.y) - ps.y);     // from straight down, positive toward the defender
    setPull(sim, -phi);
    state.plan.pull = sim.pull;
  }
  const updateAimInput = (dt, input, lay, cam) => {
    const ptr = input.pointer, keys = input.keys, sim = state.sim, ps = sim.ps;
    if (ptr.pressed) {
      const id = pressRect(lay.rects, ptr);
      if (id && handleTray(id)) return;
      if (inRect(lay.scene, ptr.x, ptr.y)) {
        const wx = cam.wx(ptr.x), wy = cam.wy(ptr.y);
        const nearHand = Math.hypot(wx - ps.x, wy - ps.y) < 0.085;
        state.drag = nearHand ? { kind: 'hand', h0: sim.hand, y0: wy, active: true, samples: [] } : { kind: 'pull', active: true, samples: [[ptr.x, ptr.y, state.gt]] };
        if (!nearHand) dragPull(cam, ptr);
      }
    }
    const d = state.drag;
    if (d && ptr.down) {
      if (d.kind === 'pull') { dragPull(cam, ptr); d.samples.push([ptr.x, ptr.y, state.gt]); if (d.samples.length > 8) d.samples.shift(); }
      else { setHand(sim, d.h0 + (d.y0 - cam.wy(ptr.y)) / (HAND_RANGE * 1.4)); state.plan.hand = sim.hand; }
    }
    if (d && ptr.released) {
      state.drag = null;
      if (d.kind === 'pull' && d.active && sim.pull >= CANCEL_PULL) {
        // the flick: how fast the finger was moving along the swing at the moment of release (world metres per second)
        const s = d.samples, a = s[Math.max(0, s.length - 4)], b = s[s.length - 1];
        let flick = 0;
        if (a && b && b[2] > a[2] + 1e-6) {
          const dtp = b[2] - a[2], vx = (cam.wx(b[0]) - cam.wx(a[0])) / dtp, vy = (cam.wy(b[1]) - cam.wy(a[1])) / dtp;
          flick = clamp((vx * Math.cos(sim.pull) + vy * Math.sin(sim.pull)) / 3.0, 0, 1);
        }
        releaseSwing(flick);
        return;
      }
    }
    if (!ptr.down && state.drag) state.drag = null;
    // the keyboard
    const sp = 0.9 * dt;
    if (keys.down.has('ArrowLeft')) { setPull(sim, sim.pull + sp); state.plan.pull = sim.pull; }
    if (keys.down.has('ArrowRight')) { setPull(sim, sim.pull - sp); state.plan.pull = sim.pull; }
    if (keys.pressed.has('ArrowUp')) nudgeHand(HAND_STEP);
    if (keys.pressed.has('ArrowDown')) nudgeHand(-HAND_STEP);
    if (keys.pressed.has('KeyH')) requestHint();
    if (keys.pressed.has('Space') || keys.pressed.has('Enter')) { if (sim.pull < CANCEL_PULL) setPull(sim, 0.9); releaseSwing(0.5); }
  };

  // ---- play ---------------------------------------------------------------------------------------------------------------------------
  function openPause() { if (state.scene !== 'play' || mode() === 'watch') return; state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; state.drag = null; }
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const openWhy = () => {
    const text = statusText(state) || 'Nothing to explain right now: the reason for the next swing appears here while a computer player is thinking.';
    state.why = { text, title: whyTitle(state), wasPaused: state.paused, useHint: false };
    if (mode() === 'watch') state.paused = true;
    state.ui.scroll = 0; state.drag = null; sfx.tick();
  };
  const closeWhy = () => { if (!state.why) return; if (mode() === 'watch') state.paused = !!state.why.wasPaused; state.why = null; state.ui.scroll = 0; };
  const leaveMatch = () => {
    if (mode() === 'cup') saveCup();
    state.scene = 'title';
    state.paused = false; state.pauseMenu = false; state.why = null; state.ui.scroll = 0; state.think = null; state.banner = null; state.drag = null;
  };
  const stepVisuals = (dt) => {
    state.parts = stepParts(state.parts, dt);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.2);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 4);
    if (state.curtain > 0 && state.ph !== 'turn') state.curtain = Math.max(0, state.curtain - dt * 3);
    if (state.banner) { state.banner.t += dt; if (state.banner.t >= state.banner.dur) state.banner = null; }
  };
  const stepSimTick = () => { const sim = state.sim; for (let i = 0; i < STEPS_PER_TICK; i++) stepSim(sim); };
  const scrollFlow = (ptr) => {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) { const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)); state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
  };

  const updatePlay = (dt, input) => {
    const m = state.m, ptr = input.pointer, keys = input.keys, watch = m.cfg.mode === 'watch';
    const lay = computeLayout(state);
    if (state.why) {
      if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) closeWhy();
      else updateFlowScene(dt, input, (id) => {
        if (id === 'wclose') closeWhy();
        else if (id === 'wuse') useHint();
        else if (id === 'wdec' || id === 'winc') { state.settings.thinkIdx = clamp(state.settings.thinkIdx + (id === 'winc' ? 1 : -1), 0, THINK_STEPS.length - 1); state.thinkSecs = THINK_STEPS[state.settings.thinkIdx]; sfx.tick(); save(); ensureLayout(state, 'why'); }
      }, 'why');
      return;
    }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (state.pauseMenu) closePause(); else if (!watch) openPause(); else state.paused = !state.paused; }
    if (state.pauseMenu) {
      if (flowMeta().key !== 'pause') return;
      if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
      if (state.ui.drag && ptr.down) scrollFlow(ptr);
      { const mt = flowMeta(), mx = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0; if (state.wheel) { state.ui.scroll = clamp(state.ui.scroll + state.wheel, 0, mx); state.wheel = 0; } if (keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, mx); if (keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, mx); }
      if (ptr.released && state.ui.drag) { const d = state.ui.drag; state.ui.drag = null; if (d.moved < 10) handlePauseTap(hitScreen(ptr.x, ptr.y, state.ui.scroll)); }
      return;
    }
    if (watch && ptr.pressed) {
      const id = pressRect(lay.rects, ptr);
      if (id === 'wpause') { state.paused = !state.paused; sfx.tick(); }
      else if (id === 'wdec') { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); state.thinkSecs = THINK_STEPS[state.settings.thinkIdx]; sfx.tick(); save(); }
      else if (id === 'winc') { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); state.thinkSecs = THINK_STEPS[state.settings.thinkIdx]; sfx.tick(); save(); }
      else if (id === 'more') openWhy();
      else if (id === 'wexit') { leaveMatch(); return; }
    }
    // Everything below is frozen while paused: timers, the computer's thinking, the conkers in the air, the particles, the banners.
    if (state.paused) return;
    toneBudget = 0;
    stepVisuals(dt);
    state.pt += dt; state.gt += dt;
    const ph = state.ph, sim = state.sim;
    if (!watch && ptr.pressed && ph !== 'aim' && pressRect(lay.rects, ptr) === 'menu') { openPause(); return; }
    if (ph === 'intro') {
      stepSimTick();
      if (state.pt >= 1.5 || (ptr.pressed && state.pt > 0.4 && !watch)) { state.banner = null; state.ph = state.humanTurn ? 'aim' : 'think'; state.pt = 0; if (state.ph === 'think') startThink(); }
    } else if (ph === 'aim') {
      stepSimTick();
      if (state.hint && state.hint.busy) { state.hint.t += dt; if (state.hint.t > 0.3) computeHint(); }
      if (state.humanTurn) updateAimInput(dt, input, lay, sceneCam());
      if (state.ph === 'aim' && state.settings.guide) {
        const f = Math.floor(state.gt * 60);
        if (f % 3 === 0 || !state.guide) state.guide = guideNow();
        if (f % 6 === 0 || !state.strip) state.strip = stripNow();
      }
    } else if (ph === 'think') {
      stepSimTick();
      updateThink(dt);
    } else if (ph === 'swing') {
      stepSimTick(); onTouches();
      if (sim.done) finishSwing();
    } else if (ph === 'result') {
      settleSim(sim, dt, 1.2);
      if (state.pt >= 1.4 || (!watch && ptr.pressed && state.pt > 0.6 && pressRect(lay.rects, ptr) !== 'menu')) nextAfterResult();
    } else if (ph === 'turn') {
      state.curtain = clamp(state.pt / 0.3, 0, 1);
      if (state.pt >= 0.3 && !state.turnDone) {
        state.turnDone = true; beginGo(false, true); state.curtain = 1;
        showBanner(nameOf(state, strikerSide()) === 'You' ? 'Your swing' : `${nameOf(state, strikerSide())} swings`, '', '', 1.0, 70);
      }
    } else if (ph === 'over') {
      settleSim(sim, dt, 1.2);
      if (state.pt >= 2.2 || (!watch && ptr.pressed && state.pt > 1.0)) finishDuel();
    }
  };

  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.page = 0; state.ui.rsPage = -1; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.page = 0; state.ui.rsPage = -1; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'quit') leaveMatch();
  }

  // ---- menus --------------------------------------------------------------------------------------------------------------
  const startCupFresh = () => { state.cup = newCup(); saveCup(); state.scene = 'pick'; state.ui.scroll = 0; };
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { pressLockup(); env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'cup') startCupFresh();
    else if (id === 'continue') { state.scene = 'pick'; state.ui.scroll = 0; }
    else if (id === 'duel') { state.setup.mode = 'duel'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'two') { state.setup.mode = 'two'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'watch') startWatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.page = 0; state.ui.rsPage = -1; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('opp')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = 'That rival is in the full game.'; return; } s.opp = i; state.setupMsg = ''; }
    else if (id.startsWith('k0')) s.kind[0] = Number(id.slice(2));
    else if (id.startsWith('k1')) s.kind[1] = Number(id.slice(2));
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, kind: s.kind.slice() });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-guide') st.guide = !st.guide;
    else if (id.startsWith('st')) st.steady = Number(id.slice(2));
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      state.restoreMsg = 'Checking with the store...';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    save();
  };
  const handlePick = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'cupquit') { saveCup(); state.scene = 'title'; state.ui.scroll = 0; return; }
    if (id.startsWith('tin')) {
      const i = Number(id.slice(3)), cup = state.cup;
      if (!cup || cup.tin[i].dmg >= 1) return;
      cup.picked = i;
      startMatch({ mode: 'cup', pick: i });
    }
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const cfg = state.m.cfg;
    if (id === 'cupnext' || id === 'cupretry') { state.scene = 'pick'; state.ui.scroll = 0; }
    else if (id === 'cupnew') startCupFresh();
    else if (id === 'again') { if (cfg.mode === 'watch') startWatch(); else startMatch({ ...cfg, first: undefined }); }
    else if (id === 'new') { state.setup.mode = cfg.mode === 'two' ? 'two' : 'duel'; state.scene = 'setup'; state.ui.scroll = 0; }
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    if (key) ensureLayout(state, key);
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      const lay = flowMeta();
      const scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const mt = flowMeta();
    const max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    if (state.wheel) { state.ui.scroll = clamp(state.ui.scroll + state.wheel, 0, max); state.wheel = 0; }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };
  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    if (ptr.pressed && (inRect(SETUP_PINS.start, ptr.x, ptr.y) || inRect(SETUP_PINS.back, ptr.x, ptr.y))) {
      handleSetup(inRect(SETUP_PINS.start, ptr.x, ptr.y) ? 'start' : 'back');
      return;
    }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys, n = pageCount(), ui = state.ui;
    const R_ = READER, close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.page = 0; ui.rsPage = -1; ui.rdrag = null; };
    const setRs = (v) => { ui.rs = clamp(v, 0, R_.max); state.page = clamp(Math.round(ui.rs / R_.slot), 0, n - 1); ui.rsPage = state.page; };
    const jump = (t) => { setRs(t); };
    const next = () => { if (ui.rs >= R_.max - 4) close(); else jump(Math.min(R_.max, (Math.floor(ui.rs / R_.slot + 0.02) + 1) * R_.slot)); };
    const prev = () => { if (ui.rs <= 4) close(); else jump(Math.max(0, (Math.ceil(ui.rs / R_.slot - 0.02) - 1) * R_.slot)); };
    if (ptr.pressed) {
      if (inRect(REF_NEXT, ptr.x, ptr.y)) next();
      else if (inRect(REF_BACK, ptr.x, ptr.y)) prev();
      else if (inRect(TEXT_DEC, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
      else if (inRect(TEXT_INC, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
      else ui.rdrag = { y0: ptr.y, rs0: ui.rs };
    }
    if (ui.rdrag && ptr.down) setRs(ui.rdrag.rs0 - (ptr.y - ui.rdrag.y0));
    if (ptr.released) ui.rdrag = null;
    if (state.wheel) { setRs(ui.rs + state.wheel); state.wheel = 0; }
    if (keys.down.has('ArrowDown')) setRs(ui.rs + 16);
    if (keys.down.has('ArrowUp')) setRs(ui.rs - 16);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) jump(Math.min(R_.max, ui.rs + R_.view * 0.85));
    if (keys.pressed.has('PageUp')) jump(Math.max(0, ui.rs - R_.view * 0.85));
    if (keys.pressed.has('Home')) jump(0);
    if (keys.pressed.has('End')) jump(R_.max);
    if (keys.pressed.has('ArrowRight')) next();
    if (keys.pressed.has('ArrowLeft')) prev();
    if (keys.pressed.has('Escape')) close();
  };

  // ---- the living scene behind the title: friendly swings between two spare conkers -------------------------------------------------------------
  const startAttract = () => {
    const a = state.att;
    if (!a.c || a.n % 4 === 0) a.c = [{ ...newConker('seasoned', 3), psi: -0.4, gone: false }, { ...newConker('heavy', 1), psi: 0.9, gone: false }];
    a.n++;
    const prev = a.sim;
    const d = prev ? { phi: prev.D.phi, om: prev.D.om } : advanceD({ phi: 0, om: 0 }, 5, { A: WOBBLE_A, c: 1 });
    const c = prev ? prev.sw.c + prev.t : (d.sw ? d.sw.c : 1);
    const dN = { phi: d.phi, om: d.om, sw: { A: WOBBLE_A, c } };
    let best = null;
    for (let i = 0; i < 12; i++) { const p = { pull: 1.15, hand: 0, flick: 1, delay: 1.2 + (i * WOBBLE_PERIOD) / 12 }; const e = evaluate(p, dN, a.c[0], a.c[1]); if (e.hit && (!best || e.E > best.E)) best = { E: e.E, p }; }
    const plan = best ? best.p : { pull: 1.15, hand: 0, flick: 1, delay: 1.5 };
    a.sim = newSim(plan, { phi: d.phi, om: d.om }, 1, 1, { A: WOBBLE_A, c });
    a.seen = 0; a.wait = 0;
  };
  const updateAttract = (dt) => {
    const a = state.att;
    if (!a.sim) startAttract();
    a.parts = stepParts(a.parts, dt);
    if (a.flash > 0) a.flash = Math.max(0, a.flash - dt * 4);
    const s = a.sim;
    if (!s.done) {
      for (let i = 0; i < STEPS_PER_TICK; i++) stepSim(s);
      while (a.seen < s.hits.length) { const h = s.hits[a.seen++]; sparks(a.parts, h.x, h.y, 8, 1); a.flash = 0.6; a.c[1].dmg = Math.min(0.6, a.c[1].dmg + 0.09); a.c[0].dmg = Math.min(0.5, a.c[0].dmg + 0.05); }
    } else { settleSim(s, dt, 1.0); a.wait += dt; if (a.wait > 1.3) startAttract(); }
  };

  // ---- shot presets (store screenshots and my own checks): ?shot=1&seed=N picks a fixed, deterministic screen ----------------------------------
  const demoPlay = (cfg, opts = {}) => {
    startMatch({ mode: 'duel', opp: 1, kind: [1, 1], first: 0, ...cfg });
    const d = duelOf();
    if (opts.dmg) { d.c[0].dmg = opts.dmg[0]; d.c[1].dmg = opts.dmg[1]; }
    if (opts.counts) { d.c[0].count = opts.counts[0]; d.c[1].count = opts.counts[1]; }
    state.banner = null; state.ph = 'aim'; state.pt = 0.5;
    if (state.humanTurn) { setPull(state.sim, opts.pull ?? 1.15); setHand(state.sim, opts.hand ?? 0.25); state.plan.pull = state.sim.pull; state.plan.hand = state.sim.hand; }
    for (let i = 0; i < (opts.warm ?? 60); i++) stepSimTick();
    state.guide = guideNow(); state.strip = stripNow(); state.tip = '';
  };
  const NOINPUT = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
  const shotSwing = (steps, opts = {}) => {
    demoPlay({}, { dmg: opts.dmg ?? [0.15, 0.4], counts: [2, 1], pull: 1.2, hand: 0.1, warm: opts.warm ?? 30 });
    const { cs, cd } = stats();
    let best = null;
    for (let i = 0; i < DELAYS; i++) { const p = { pull: 1.2, hand: 0.1, flick: 1, delay: (i * WOBBLE_PERIOD) / DELAYS }; const e = evaluate(p, defNow(), cs, cd); if (e.hit && (!best || e.E > best.E)) best = { E: e.E, p }; }
    const p = best ? best.p : { pull: 1.2, hand: 0.1, flick: 1, delay: 0.3 };
    state.sim.releaseT = state.sim.t + p.delay; state.sim.kick = p.flick * FLICK_KICK;
    state.ph = 'swing'; state.hitsSeen = 0;
    let guard = 0;
    guard = 0;
    while (!state.sim.hits.length && guard++ < 4000) stepSim(state.sim);       // up to the moment of the touch
    for (let i = 0; i < steps * STEPS_PER_TICK && !state.sim.done; i++) stepSim(state.sim);
    onTouches(); state.parts = stepParts(state.parts, 0.05); state.guide = null; state.strip = null; state.shake = opts.shake ?? 0; state.flash = opts.flash ?? 0;
  };
  const applyPreset = () => {
    const n = ((shotSeed % 100) + 100) % 100;
    if (n === 60) { state.showcase = true; state.settings.thinkIdx = 0; state.thinkSecs = 2; startWatch(); return; }
    state.shot = true;
    updateAttract(0);
    if (n === 1) { for (let i = 0; i < 160; i++) updateAttract(1 / 60); state.scene = 'title'; return; }
    if (n === 2) { demoPlay({}, { dmg: [0.2, 0.45], counts: [2, 1], pull: 1.1, hand: 0.3, warm: 100 }); return; }
    if (n === 3) { shotSwing(0, { shake: 0.6, flash: 0.8 }); return; }
    if (n === 4) { shotSwing(14, { shake: 0.3, flash: 0.1 }); return; }
    if (n === 5) { demoPlay({}, { dmg: [0.3, 0.55], counts: [1, 3], pull: 1.0, hand: 0, warm: 80 }); computeHint(); state.why = null; return; }
    if (n === 6) { demoPlay({ opp: 2 }, { dmg: [0.35, 1], counts: [3, 2] }); const d = duelOf(); d.c[1].gone = true; d.over = { loser: 1, winner: 0 }; finishDuel(); return; }
    if (n === 7) { state.back = 'title'; state.scene = 'rules'; state.page = 0; return; }
    if (n === 8) { state.back = 'title'; state.scene = 'howto'; state.page = 1; return; }
    if (n === 9) { state.scene = 'setup'; return; }
    if (n === 10) { state.scene = 'settings'; return; }
    if (n === 11) { state.back = 'title'; state.scene = 'about'; return; }
    if (n === 12) { // a conker has just shattered
      demoPlay({ opp: 2 }, { dmg: [0.4, 0.93], counts: [2, 4], pull: 1.2, hand: 0.1, warm: 30 });
      const d = duelOf(); d.c[1].gone = true; d.c[1].dmg = 1; const b = bobPos(state.sim.pd, state.sim.D.phi); chips(state.parts, b.x, b.y, 26); sparks(state.parts, b.x, b.y, 12, 1.4); state.parts = stepParts(state.parts, 0.2);
      state.ph = 'over'; d.over = { loser: 1, winner: 0 }; showBanner('SHATTERED!', "Rowan's conker is in pieces", 'gold', 99, 96); state.banner.t = 0.5; return;
    }
    if (n === 13) {
      startWatch(); state.think = { t: 0.8, dur: 2, reveal: 2, phase: 'reveal', plan: { pull: 1.15, hand: 0.25, flick: 1, delay: 0.4 }, text: 'Pull back to about 66 degrees, hand a little high, and flick as you let go. Tested with 6 slightly shaky swings: 5 touched, 3 on the pale patch. A touch costs their conker about 31% and yours about 14%.', from: { pull: 0.9, hand: 0 }, perf: null };
      state.ph = 'think'; state.banner = null; setPull(state.sim, 1.15); return;
    }
    if (n === 14) { startCupFresh(); state.cup.tin[1].dmg = 0.45; state.cup.tin[1].count = 2; state.cup.tin[2].dmg = 1; state.cup.round = 1; return; }
    if (n === 15) { demoPlay({}, { dmg: [0.78, 0.2], counts: [5, 0], pull: 0.8, hand: -0.4 }); return; }
    if (n === 16) { shotSwing(30, { dmg: [0.2, 0.8] }); showBanner('Pale patch!', "Crushing! Hazel's conker +38% damage, yours +14%", 'gold', 99, 80); state.banner.t = 0.5; state.ph = 'result'; return; }
    if (n === 17) { startMatch({ mode: 'two', kind: [0, 2], opp: 0, first: 0 }); state.banner = null; state.ph = 'aim'; return; }
    if (n >= 30 && n <= 39) {
      state.settings.textIdx = 4;
      if (n === 30) startCupFresh();
      else if (n === 31) demoPlay({}, { dmg: [0.2, 0.4] });
      else if (n === 32) { demoPlay({}, { dmg: [0.2, 0.4] }); state.paused = true; state.pauseMenu = true; }
      else if (n === 33) { demoPlay({}, { dmg: [0.2, 0.4] }); computeHint(); }
      else if (n === 34) state.scene = 'demolimit';
      else if (n === 35) { startWatch(); state.banner = null; state.why = { text: 'Pull back to about 66 degrees, hand a little high, and flick as you let go. Tested with 6 swings: 5 touched.', title: 'Why this swing?', wasPaused: false, useHint: false }; }
      else if (n === 36) { state.back = 'title'; state.scene = 'about'; }
      else if (n === 37) state.scene = 'setup';
      else if (n === 38) { demoPlay({}, { dmg: [0.2, 0.9], counts: [3, 5] }); const d = duelOf(); d.c[1].gone = true; d.over = { loser: 1, winner: 0 }; finishDuel(); }
      return;
    }
    if (n >= 20 && n <= 29) {
      state.settings.textIdx = 4;
      if (n === 20) { state.back = 'title'; state.scene = 'rules'; state.page = 2; }
      else if (n === 21) state.scene = 'title';
      else if (n === 22) demoPlay({}, { dmg: [0.2, 0.4] });
      else if (n === 23) state.scene = 'settings';
      else if (n === 24) state.scene = 'setup';
      else if (n === 25) { state.back = 'title'; state.scene = 'howto'; state.page = 1; }
      return;
    }
    if (n === 61 || n === 62) { if (n === 62) state.settings.textIdx = 4; demoPlay({}, { dmg: [0.2, 0.4] }); return; }
    if (n >= 40 && n <= 59) { state.back = 'title'; state.scene = 'rules'; state.page = n - 40; }
  };

  // ---- the object the kit and the shell see ----------------------------------------------------------------------------------------
  const game = {
    // Only live action uses up the free preview: a swing in motion, a computer player's draw-back and swing, or a pull on the screen. Every menu, the rules,
    // settings, Watch & Learn, the Think hint, pause, banners, results and a player waiting to aim are free. A tester build (config.dev) never uses it up.
    isPreviewExempt: () => {
      if (config.dev) return true;
      if (state.scene !== 'play' || !state.m || state.m.cfg.mode === 'watch') return true;
      if (state.paused || state.pauseMenu || state.why) return true;
      return !(state.ph === 'swing' || (state.ph === 'think' && state.think && state.think.phase === 'act') || (state.ph === 'aim' && state.drag && state.drag.active));
    },
    update(dt, input) {
      if (state.showcase) input = NOINPUT;
      setFrame(meta.width, meta.height);
      if (state.layKey !== FR.key) {
        if (state.layKey) { state.drag = null; state.ui.drag = null; state.ui.rdrag = null; }
        state.layKey = FR.key;
      }
      const p0 = input.pointer, sc = 1 / FR.s;
      const conv = (ox) => ({ pointer: { ...p0, x: p0.x * sc - ox, y: p0.y * sc }, keys: input.keys });
      const modal = state.scene === 'play' && (state.pauseMenu || state.why);
      setPress(state.scene === 'play' && !modal ? conv(0).pointer : conv(flowOrigin(state.scene === 'play' ? 'pause' : state.scene)).pointer);
      if (state.shot) { state.t += dt; return; }
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      toneBudget = 0;
      if (state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, conv(flowOrigin('title')), handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, conv(FR.fox)); break;
        case 'settings': updateFlowScene(dt, conv(FR.fox), handleSettings, 'settings'); break;
        case 'pick': updateFlowScene(dt, conv(FR.fox), handlePick, 'pick'); break;
        case 'result': updateFlowScene(dt, conv(FR.fox), handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, conv(FR.fox), (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(conv(FR.fox)); break;
        case 'play': updatePlay(dt, modal ? conv(FR.fox) : conv(0)); break;
        default: break;
      }
    },
    render(ctx) {
      if (state.scene !== 'play') globalThis.__previewBadge = undefined;
      setFrame(meta.width, meta.height);
      ctx.save();
      if (FR.s !== 1) ctx.scale(FR.s, FR.s);
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'setup': renderSetup(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'pick': renderPick(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          if (state.m && state.sim) {
            renderPlay(ctx, state);
            if (state.why) renderWhy(ctx, state);
            if (state.pauseMenu) renderPause(ctx, state);
          }
          break;
        default: break;
      }
      ctx.restore();
    },
    getState: () => state,
    // Every tappable rectangle of the current screen in FRAME coordinates, plus the frame itself: used by the layout checks. No gameplay use.
    getRects() {
      const out = [], scene = state.scene, modal = scene === 'play' && (state.pauseMenu || state.why);
      const push = (id, r, o = 0) => out.push({ id, x: r.x + o, y: r.y, w: r.w, h: r.h });
      const flow = (o) => { const mt = flowMeta(); if (!mt.lay) return; const sc = Math.min(state.ui.scroll, Math.max(0, mt.lay.contentH - (mt.bottom - mt.top))); for (const it of mt.lay.items) if (it.w.t === 'btn') { const y = mt.top + it.y - sc; if (y >= mt.top - 1 && y + it.h <= mt.bottom + 1) push(it.w.id, { x: it.x, y, w: it.wd, h: it.h }, o); } };
      if (modal) flow(FR.fox);
      else if (scene === 'play') { if (state.m) { const lay = computeLayout(state); for (const id of Object.keys(lay.rects)) push(id, lay.rects[id], 0); } }
      else if (scene === 'howto' || scene === 'about' || scene === 'rules') { push('dec', TEXT_DEC, FR.fox); push('inc', TEXT_INC, FR.fox); push('back', REF_BACK, FR.fox); push('next', REF_NEXT, FR.fox); }
      else { flow(flowOrigin(scene)); if (scene === 'setup') { push('start', SETUP_PINS.start, FR.fox); push('back', SETUP_PINS.back, FR.fox); } }
      return { frame: { sw: FR.sw, H: FR.H, s: FR.s, land: FR.land, ins: FR.ins }, rects: out, scene, ph: state.ph, mode: state.m ? state.m.cfg.mode : null };
    },
  };
  updateAttract(0);
  if (shotMode) applyPreset();
  return game;
}
export { PULL_MIN };
