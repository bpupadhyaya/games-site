// Beach Flags: state and flow. Physics, rivals and rounds live in sim.js; drawing in view.js, art.js and menus.js.
// This is the only file that mutates `state` outside of the simulation step.
//
// Scenes: title, play (cup, sudden, daily, watch), result, cups, outfits, settings, howto/about/rules, demolimit.
import {
  TIERS, LOOKS, newField, newRound, stepRound, tapRunner, diveRunner, advise, bestFlag, clamp,
} from './sim.js';
import { stepFx, proj, makeCam, drawRound } from './art.js';
import { TEXT_SCALES, THINK_STEPS, meta, host, syncSize, refLayout, inRect } from './layout.js';
import { renderPlay, layoutOf, camFor } from './view.js';
import {
  renderTitle, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderOutfits, renderCups,
  hitScreen, flowMeta, REF, ensureLayout, resetMenus, lockupZone, collectionHit,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { OUTFITS } from './outfits.js';
import { setPress } from './ui.js';

export { meta };
const DEMO_RUNS = 3;      // cups the free web demo allows (Watch & Learn is free)
const SLOW = 0.35;        // time scale while a Think hint is showing
const THINK_SECS = 2.5;   // how long a Think hint lasts
const TAU = Math.PI * 2;
const DAILY_TIER = 1;

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fxRng = rng.fork(), runRng = rng.fork(), attRng = rng.fork();
  const freshRecord = () => ({
    sel: 0, tier: 0, cups: [0, 0, 0], bestScore: [0, 0, 0], bestRounds: [0, 0, 0], suddenBest: 0, dailyBest: 0, dailyDay: -1,
    rounds: 0, grabs: 0, dives: 0, bestReact: 0, owned: [true, false, false, false, false, false], outfit: 0, demoRuns: 0, falseStarts: 0,
  });
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, day: (config.day | 0), rev: 0, mode: 'cup',
    settings: { sound: true, guide: true, textIdx: 0, thinkIdx: 1 },
    record: freshRecord(),
    round: null, cup: null, att: null, attFx: [], attX: 0, attZ: -6, attWait: 0, camX: 0, camZ: -6, fx: [], pops: [], banner: null, shake: 0,
    toast: '', toastT: 0, think: null, dec: null, wd: { flag: -2, dived: false, start: false }, overT: 0, last: null, collSel: null, collBack: 'title',
    restoreMsg: '', strideFlash: null, ui: { scroll: 0, drag: null }, refScroll: 0, loaded: false, youLook: OUTFITS[0].look,
  };
  Object.defineProperty(state, 'owned', { get: () => !!monetization.owns?.('unlock_game'), enumerable: false });
  syncSize();

  // ---- persistence ----------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  const fixRecord = () => {
    const rec = state.record, d = freshRecord();
    for (const k of Object.keys(d)) if (rec[k] == null) rec[k] = d[k];
    for (const k of ['cups', 'bestScore', 'bestRounds']) if (!Array.isArray(rec[k]) || rec[k].length < 3) rec[k] = d[k].slice();
    if (!Array.isArray(rec.owned) || rec.owned.length < OUTFITS.length) rec.owned = d.owned.slice();
    rec.owned[0] = true;
    rec.tier = clamp(rec.tier | 0, 0, TIERS.length - 1); rec.sel = clamp(rec.sel | 0, 0, rec.tier);
    if (!rec.owned[rec.outfit]) rec.outfit = 0;
    state.youLook = OUTFITS[rec.outfit].look;
  };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    fixRecord();
    state.loaded = true; state.rev++;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound ----------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    whistle: () => { tone({ freq: 2300, to: 2500, dur: 0.34, type: 'square', vol: 0.05 }); tone({ freq: 2380, to: 2260, dur: 0.34, type: 'triangle', vol: 0.05 }); },
    step: (good) => tone({ freq: good ? 150 : 120, to: 80, dur: 0.07, type: 'sine', vol: 0.1 }),
    spin: () => tone({ freq: 300, to: 520, dur: 0.14, type: 'triangle', vol: 0.06 }),
    dive: () => { tone({ freq: 700, to: 140, dur: 0.32, type: 'sawtooth', vol: 0.035 }); tone({ freq: 100, to: 60, dur: 0.3, type: 'sine', vol: 0.1 }); },
    claim: () => { tone({ freq: 880, dur: 0.1, type: 'triangle', vol: 0.09 }); tone({ freq: 1320, dur: 0.18, type: 'triangle', vol: 0.07 }); },
    miss: () => { tone({ freq: 300, to: 110, dur: 0.4, type: 'sawtooth', vol: 0.06 }); },
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 230, to: 140, dur: 0.14, type: 'sawtooth', vol: 0.04 }),
    bump: () => tone({ freq: 110, to: 70, dur: 0.07, type: 'sine', vol: 0.07 }),
    win: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.22 + i * 0.05, type: 'triangle', vol: 0.1 })),
    fin: () => [0, 3, 7].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.2 + i * 0.04, type: 'triangle', vol: 0.07 })),
  };
  const toast = (text, secs = 2.8) => { state.toast = text; state.toastT = secs; };

  // ---- effects --------------------------------------------------------------------------------------------------
  const MAX_FX = 110;
  const add = (list, q) => { if (list.length < MAX_FX) list.push(q); };
  const sand = (list, x, z, n = 5, big = 1) => {
    for (let i = 0; i < n; i++) { const a = fxRng.next() * TAU, v = (0.4 + fxRng.next() * 1.2) * big; add(list, { kind: 0, x: x + (fxRng.next() - 0.5) * 0.4, y: 0.05, z, vx: Math.cos(a) * v, vy: 0.8 + fxRng.next() * 1.8 * big, vz: Math.sin(a) * v * 0.8, t: 0, max: 0.35 + fxRng.next() * 0.35, size: 0.07 + fxRng.next() * 0.06, col: fxRng.next() < 0.5 ? '#f3dca4' : '#d7b878' }); }
  };
  const confetti = (list, x, z, n) => {
    const cols = ['#ff3d7f', '#ffc83d', '#25d0c0', '#7a5cff', '#fff1e2', '#ff7a2f'];
    for (let i = 0; i < n; i++) { const a = fxRng.next() * TAU, v = 0.8 + fxRng.next() * 2.2; add(list, { kind: 2, x, y: 1.2 + fxRng.next() * 0.6, z, vx: Math.cos(a) * v, vy: 2 + fxRng.next() * 3, vz: Math.sin(a) * v, t: 0, max: 1.1 + fxRng.next() * 0.8, size: 0.06 + fxRng.next() * 0.04, col: cols[i % cols.length], rot: fxRng.next() * 6, spin: (fxRng.next() - 0.5) * 14 }); }
  };
  const pop = (text, x, y, z, col = '#fff3b0', size = 26, max = 0.95) => { if (state.pops.length < 8) state.pops.push({ text, x, y, z, col, size, t: 0, max }); };
  const banner = (text, sub, col) => { state.banner = { text, sub, col, t: 0, max: 1.6 }; };

  // ---- cups and rounds --------------------------------------------------------------------------------------------------
  const dailySeed = () => 5000011 + (state.day | 0) * 7919;
  const startMode = (mode) => {
    const rec = state.record;
    if (state.demo && mode !== 'watch' && rec.demoRuns >= DEMO_RUNS) { state.scene = 'demolimit'; state.ui.scroll = 0; state.rev++; return; }
    state.mode = mode; state.last = null; state.think = null; state.dec = null; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    const base = mode === 'daily' ? dailySeed() : 1 + runRng.int(1e9);
    const tier = mode === 'daily' ? DAILY_TIER : mode === 'watch' ? 1 : rec.sel;
    let field;
    if (mode === 'sudden') field = [{ name: 'You', look: 0, skill: 0.85, you: true }, { name: 'Rival', look: 1, skill: 0.34, you: false }];
    else if (mode === 'watch') { const f = newField(1, base); field = [f.find((p) => p.you), ...f.filter((p) => !p.you).slice(-3)]; }
    else field = newField(tier, base);
    state.cup = { mode, tier, field, roundNo: 0, total: Math.max(1, field.length - 1), score: 0, streak: 0, rounds: 0, dives: 0, bestReact: null, hints: 0, base, grabs: 0 };
    if (state.demo && mode !== 'watch') { rec.demoRuns++; save(); }
    beginRound();
    toast(mode === 'watch' ? 'Watch & Learn: the game stops to think at key moments' : 'Lie flat. When the whistle blows, tap once to spin up, then tap in rhythm.', 3.6);
  };
  const beginRound = () => {
    const cup = state.cup;
    if (cup.mode === 'sudden') { cup.field[1].skill = clamp(0.32 + cup.streak * 0.07, 0.3, 0.97); cup.field[1].look = 1 + (cup.streak % 7); }
    const round = newRound({ profiles: cup.field, seed: cup.base * 31 + cup.roundNo * 977 + 11, roundNo: cup.roundNo, level: cup.tier, hasPlayer: true });
    if (cup.mode === 'watch') round.auto = round.you;
    state.round = round; state.scene = 'play'; state.mode = cup.mode; state.overT = 0; state.fx.length = 0; state.pops.length = 0; state.banner = null;
    state.think = null; state.dec = null; state.wd = { flag: -2, dived: false, start: false }; state.strideFlash = null;
    const me = round.runners[round.you];
    state.camX = me.x * 0.6; state.camZ = -6;
  };
  const endCup = (champion) => {
    const cup = state.cup, rec = state.record, mode = cup.mode;
    const r = { mode, champion, score: cup.score, rounds: cup.rounds, roundOut: cup.roundNo, bestReact: cup.bestReact, dives: cup.dives, streak: cup.streak, hints: cup.hints, unlocks: [], newBest: false, msg: '', nextTier: false };
    if (mode !== 'watch') {
      rec.rounds += cup.rounds; rec.dives += cup.dives; rec.grabs += cup.grabs;
      const practice = cup.hints > 0;
      if (cup.bestReact != null && !practice && (!rec.bestReact || cup.bestReact < rec.bestReact)) rec.bestReact = cup.bestReact;
      const gain = (i) => { if (!rec.owned[i]) { rec.owned[i] = true; r.unlocks.push(OUTFITS[i].name); } };
      if (mode === 'cup' && !practice) {
        const t = cup.tier;
        if (cup.score > rec.bestScore[t]) { rec.bestScore[t] = cup.score; r.newBest = true; }
        rec.bestRounds[t] = Math.max(rec.bestRounds[t], cup.rounds);
        if (champion) {
          rec.cups[t]++;
          gain(1 + t);
          if (t === rec.tier && rec.tier < TIERS.length - 1) { rec.tier++; rec.sel = rec.tier; r.nextTier = true; r.msg = `Next cup open: ${TIERS[rec.tier].name}`; }
          else if (t >= TIERS.length - 1) r.msg = 'Champion! Defend the title.';
        } else r.msg = 'Stay in for every round to win the cup.';
      } else if (mode === 'sudden') {
        if (cup.streak > rec.suddenBest && !practice) { rec.suddenBest = cup.streak; r.newBest = true; }
        if (cup.streak >= 5 && !practice) gain(5);
      } else if (mode === 'daily') {
        if (rec.dailyDay !== state.day) { rec.dailyDay = state.day; rec.dailyBest = 0; }
        if (cup.score > rec.dailyBest && !practice) { rec.dailyBest = cup.score; r.newBest = true; }
      }
      if (rec.dives >= 10) gain(4);
      save();
    }
    if (r.unlocks.length) sfx.win();
    state.last = r; state.scene = 'result'; state.ui.scroll = 0; state.paused = false; state.rev++;
    if (champion || r.newBest) sfx.win(); else sfx.fin();
  };
  // after a round has shown its outcome: score it, drop the racer who is out, then go on
  const afterRound = () => {
    const round = state.round, cup = state.cup, o = round.over, me = round.runners[round.you];
    const safe = me.flag >= 0;
    cup.hints += round.hintsUsed;
    if (safe) {
      cup.rounds++;
      if (cup.mode === 'sudden') cup.streak++;
      const rb = o.react != null ? clamp(Math.round((0.5 - o.react) * 200), 0, 60) : 0;
      cup.score += 100 + rb + (o.dive ? 20 : 0);
      if (o.dive) cup.dives++;
      cup.grabs++;
      if (o.react != null && !o.falseStart && (cup.bestReact == null || o.react < cup.bestReact)) cup.bestReact = o.react;
    }
    cup.field = cup.field.filter((_, i) => !o.outPi.includes(i));
    cup.roundNo++;
    if (!safe) { endCup(false); return; }
    if (cup.mode === 'sudden') { cup.field = [cup.field.find((p) => p.you), { name: 'Rival', look: 1, skill: 0.4, you: false }]; beginRound(); return; }
    if (cup.field.length <= 1) { if (cup.mode !== 'watch') cup.score += 300; endCup(true); return; }
    beginRound();
  };

  // ---- player input --------------------------------------------------------------------------------------------------------
  const steerFor = (px) => {
    const round = state.round, me = round.runners[round.you];
    if (!me) return 0;
    const L = layoutOf(state), cam = camFor(state, round), p = proj(cam, me.x, 0, me.z);
    const s = (px - p.x) / (L.world.w * 0.16);
    return Math.abs(s) < 0.14 ? 0 : clamp(s, -1, 1);
  };
  const doStride = (steer) => {
    const round = state.round;
    if (!round || round.over || state.paused) return;
    const res = tapRunner(round, round.you, steer);
    if (state.think && res !== 'ignored') state.think = null;
  };
  const doDive = () => {
    const round = state.round;
    if (!round || round.over || state.paused) return;
    if (diveRunner(round, round.you) && state.think) state.think = null;
  };
  const requestThink = () => {
    const round = state.round;
    if (!round || round.over || state.paused || state.mode === 'watch') return;
    round.hintsUsed++;
    state.think = { t: 0, adv: advise(round) };
    sfx.tick();
  };

  // events from the simulation become sound, particles and words
  const handleEvents = (round, list, live) => {
    for (const e of round.events) {
      if (e.seq < round.evDone) continue;
      round.evDone = e.seq + 1;
      const q = e.id != null ? round.runners[e.id] : null, mine = !!q && q.you;
      if (e.type === 'whistle') { if (live) sfx.whistle(); }
      else if (e.type === 'false') {
        if (q) sand(list, q.x, q.z, 3);
        if (live && mine) { sfx.no(); pop('Caution!', q.x, 0.8, q.z, '#ffd89a', 26, 1); state.record.falseStarts++; }
      } else if (e.type === 'spin') {
        if (q) sand(list, q.x, q.z, 6);
        if (live && mine) { sfx.spin(); pop(`${Math.round(e.react * 1000)} ms`, q.x, 1.5, q.z, e.react < 0.3 ? '#9dffb0' : e.react < 0.4 ? '#fff3b0' : '#ffd0b0', 26, 1.0); }
      } else if (e.type === 'stride') {
        if (q) sand(list, q.x, q.z, e.good ? 1 : 2);
        if (live && mine) { sfx.step(e.good); state.strideFlash = { good: e.good, t: 0 }; }
      } else if (e.type === 'dive') {
        if (q) sand(list, q.x, q.z, 8, 1.4);
        if (live && mine) sfx.dive();
      } else if (e.type === 'bump') {
        sand(list, e.x, e.z, 4); if (live) sfx.bump();
      } else if (e.type === 'claim') {
        if (q) { confetti(list, q.x, q.z, mine ? 26 : 8); sand(list, q.x, q.z, 6, 1.2); }
        if (live && mine) { sfx.claim(); pop(e.dive ? 'Dive grab!' : 'Got it!', q.x, 2.3, q.z, '#ffe074', 30, 1.1); state.shake = Math.max(state.shake, 0.18); }
      } else if (e.type === 'over') {
        if (live) {
          const me = round.runners[round.you];
          if (me && me.flag >= 0) sfx.win();
          else if (me) { sfx.miss(); state.shake = 0.4; }
        }
      }
    }
  };

  // ---- the Watch & Learn decision loop: THINK -> REVEAL -> ACT ---------------------------------------------------------
  const watchThink = () => THINK_STEPS[state.settings.thinkIdx];
  // Returns true while the world is frozen on a decision.
  const updateWatch = (dt) => {
    const round = state.round, me = round.runners[round.you];
    if (state.paused || round.over) return true;
    const dec = state.dec;
    if (dec) {
      dec.t += dt;
      if (dec.phase === 'think' && dec.t >= dec.dur) { dec.phase = 'reveal'; dec.t = 0; dec.dur = 2; }
      else if (dec.phase === 'reveal' && dec.t >= dec.dur) { state.dec = null; state.think = null; }
      return true;
    }
    const wd = state.wd, open = (why) => { state.dec = { active: true, phase: 'think', t: 0, dur: watchThink(), adv: why }; state.think = { adv: why, t: 0 }; };
    if (!round.go && !wd.start && round.count < 1.0) { wd.start = true; open(advise(round)); return true; }
    if (round.go && me.phase === 'run') {
      const b = bestFlag(round, me, true);
      if (b && b.flag.id !== wd.flag && me.z > 1.2) {
        wd.flag = b.flag.id; wd.dived = false;
        const adv = advise(round); adv.flag = b.flag.id;
        open({ ...adv, why: `${b.contested ? 'A rival is closer to the nearest flag, so I will take another. ' : ''}${adv.why}` });
        return true;
      }
      const f = me.ai.target >= 0 ? round.flags[me.ai.target] : null;
      if (f && f.owner < 0 && !wd.dived) {
        const dz = f.z - me.z;
        if (dz <= me.ai.diveD + 0.5 && dz > me.ai.diveD && Math.abs(f.x - me.x) <= 0.6) {
          wd.dived = true;
          open({ act: 'dive', flag: f.id, steer: 0, why: `The flag is about ${dz.toFixed(1)} m ahead and in line: this is the moment to dive and stretch for it.` });
          return true;
        }
      }
    }
    return false;
  };

  // ---- the title-screen demo: AI racers fight for flags on their own ------------------------------------------------------------
  const newAttract = () => {
    const n = 5 + attRng.int(4), profiles = [];
    for (let i = 0; i < n; i++) profiles.push({ name: `R${i}`, look: i % LOOKS.length, skill: 0.5 + attRng.next() * 0.45, you: false });
    const round = newRound({ profiles, seed: 1 + attRng.int(1e9), roundNo: 0, level: 1, hasPlayer: false });
    round.count = 4.2 + attRng.next() * 0.8;           // the title shows them lying on the sand for a while before the whistle
    state.att = round; state.attFx.length = 0; state.attZ = -6; state.attX = 0; state.attWait = 0;
  };
  const updateAttract = (dt) => {
    if (!state.att) newAttract();
    const round = state.att;
    if (round.over) {
      state.attWait += dt; stepRound(round, dt); stepFx(state.attFx, dt);
      if (state.attWait > 2.2) newAttract();
      return;
    }
    stepRound(round, dt);
    handleEvents(round, state.attFx, false);
    stepFx(state.attFx, dt);
    const lead = round.runners.reduce((a, q) => a + q.z, 0) / round.runners.length;
    const target = clamp(lead - 6, -6, 13);
    state.attZ += (target - state.attZ) * Math.min(1, dt * 3);
  };

  // ---- pause ------------------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; state.rev++; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.rev++; };
  const leaveRound = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.think = null; state.dec = null; state.rev++; };

  // ---- the play scene ----------------------------------------------------------------------------------------------------
  const scrollFlow = (ptr) => {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) { const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)); state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
  };
  const updatePlay = (dt, input) => {
    const round = state.round, ptr = input.pointer, keys = input.keys, watch = state.mode === 'watch';
    const L = layoutOf(state);
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (state.pauseMenu) closePause(); else if (!watch) openPause(); else { state.paused = !state.paused; } }
    if (state.pauseMenu) {
      if (flowMeta().key !== 'pause') return;
      if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
      if (state.ui.drag && ptr.down) scrollFlow(ptr);
      if (ptr.released && state.ui.drag) { const d = state.ui.drag; state.ui.drag = null; if (d.moved < 10) handlePauseTap(hitScreen(ptr.x, ptr.y, state.ui.scroll)); }
      return;
    }
    if (ptr.pressed && !round.over) {
      if (watch) {
        const D = L.demo;
        if (inRect(D.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(D.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); toast(`Thinking time: ${watchThink()} s`, 1.6); }
        else if (inRect(D.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); toast(`Thinking time: ${watchThink()} s`, 1.6); }
        else if (inRect(D.exit, ptr.x, ptr.y)) { leaveRound(); return; }
      } else if (inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
      else if (inRect(L.think, ptr.x, ptr.y)) requestThink();
      else if (inRect(L.dive, ptr.x, ptr.y)) doDive();
      else if (!inRect(L.score, ptr.x, ptr.y) && ptr.x <= L.world.x + L.world.w) doStride(steerFor(ptr.x));
    }
    if (!watch && !round.over) {
      if (keys.pressed.has('ArrowLeft') || keys.pressed.has('KeyA')) doStride(-1);
      if (keys.pressed.has('ArrowRight') || keys.pressed.has('KeyD')) doStride(1);
      if (keys.pressed.has('Space') || keys.pressed.has('ArrowUp') || keys.pressed.has('KeyW')) doStride(0);
      if (keys.pressed.has('ArrowDown') || keys.pressed.has('KeyS') || keys.pressed.has('KeyX')) doDive();
      if (keys.pressed.has('KeyH')) requestThink();
    }
    if (state.paused) return;
    let frozen = false;
    if (watch) frozen = updateWatch(dt);
    if (state.think && !watch) {
      state.think.t += dt; state.think.adv = advise(round);
      if (state.think.t > THINK_SECS) state.think = null;
    }
    const ts = state.think && !watch ? SLOW : 1;
    if (round.over) stepRound(round, dt);
    else if (!frozen) stepRound(round, dt * ts);
    handleEvents(round, state.fx, true);
    // camera: behind your runner
    const me = round.runners[round.you];
    if (!frozen) {
      const tz = Math.max(-6, me.z - 6), tx = clamp(me.x * 0.6, -3, 3);
      state.camZ += (tz - state.camZ) * Math.min(1, dt * 12);
      state.camX += (tx - state.camX) * Math.min(1, dt * 4);
    }
    if (round.over) {
      state.overT += dt;
      if (state.overT > 2.3 || (ptr.pressed && state.overT > 0.9)) afterRound();
    }
    stepFx(state.fx, dt);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.banner) { state.banner.t += dt; if (state.banner.t >= state.banner.max) state.banner = null; }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.6);
    if (state.strideFlash) { state.strideFlash.t += dt; if (state.strideFlash.t > 0.3) state.strideFlash = null; }
  };
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); state.rev++; }
    else if (id === 'p-guide') { state.settings.guide = !state.settings.guide; save(); state.rev++; }
    else if (id === 'quit') leaveRound();
  }

  // ---- menus ----------------------------------------------------------------------------------------------------------------
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'cup') startMode('cup');
    else if (id === 'sudden' || id === 'daily' || id === 'watch') startMode(id);
    else if (id === 'cups') { state.scene = 'cups'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'outfits') { state.collSel = null; state.scene = 'outfits'; state.ui.scroll = 0; state.collBack = 'title'; state.rev++; }
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.refScroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); state.rev++; }
  };
  const handleCups = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; return; }
    const m = /^tier-(\d)$/.exec(id);
    if (m) { const i = +m[1]; if (i <= state.record.tier) { state.record.sel = i; save(); state.scene = 'title'; state.ui.scroll = 0; state.rev++; } }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-guide') st.guide = !st.guide;
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; state.rev++; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; state.rev++; });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    state.rev++; save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const r = state.last;
    if (id === 'again') startMode(r ? r.mode : 'cup');
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'outfits') { state.collBack = 'result'; state.collSel = null; state.scene = 'outfits'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'share' && r) { Promise.resolve(env.share?.(`I scored ${r.score} points in Beach Flags from Arcforge!`)).catch(() => {}); }
  };
  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    ensureLayout(state, key);
    { const m0 = flowMeta(); state.ui.scroll = clamp(state.ui.scroll, 0, m0.lay ? Math.max(0, m0.lay.contentH - (m0.bottom - m0.top)) : 0); }
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      const lay = flowMeta(), scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const mt = flowMeta(), max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); state.rev++; save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); state.rev++; save(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
    void dt;
  };
  const updateOutfits = (dt, input) => {
    const ptr = input.pointer, rec = state.record;
    ensureLayout(state, 'outfits');
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      if (d.moved < 10) {
        const h = collectionHit(ptr.x, ptr.y);
        if (h) {
          if (state.collSel === h.i && rec.owned[h.i]) { rec.outfit = h.i; state.youLook = OUTFITS[h.i].look; save(); sfx.win(); } else sfx.tick();
          state.collSel = h.i; state.rev++;
        } else if (hitScreen(ptr.x, ptr.y, state.ui.scroll) === 'back') { state.scene = state.collBack || 'title'; state.ui.scroll = 0; state.rev++; sfx.tick(); }
      }
    }
    const mt = flowMeta(), max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    state.ui.scroll = clamp(state.ui.scroll, 0, max);
    if (input.keys.pressed.has('Escape')) { state.scene = state.collBack || 'title'; state.ui.scroll = 0; state.rev++; }
    void dt;
  };
  let refDrag = null, wheelHooked = false;
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys, RL = refLayout(), set = (v) => { state.refScroll = clamp(v, 0, REF.max); };
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.refScroll = 0; };
    if (ptr.pressed) {
      if (inRect(RL.next, ptr.x, ptr.y) || inRect(RL.back, ptr.x, ptr.y)) { close(); return; }
      else if (inRect(RL.dec, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); state.refScroll = 0; state.rev++; save(); }
      else if (inRect(RL.inc, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); state.refScroll = 0; state.rev++; save(); }
      else if (inRect(RL.panel, ptr.x, ptr.y)) refDrag = { y0: ptr.y, s0: state.refScroll };
    }
    if (refDrag) { if (ptr.down) set(refDrag.s0 - (ptr.y - refDrag.y0)); else refDrag = null; }
    if (keys.pressed.has('ArrowDown')) set(state.refScroll + 70);
    if (keys.pressed.has('ArrowUp')) set(state.refScroll - 70);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) set(state.refScroll + REF.view * 0.9);
    if (keys.pressed.has('PageUp')) set(state.refScroll - REF.view * 0.9);
    if (keys.pressed.has('Home')) set(0);
    if (keys.pressed.has('End')) set(1e9);
    if (keys.pressed.has('Escape')) close();
  };

  resetMenus();
  newAttract();
  for (let i = 0; i < 60 * 3; i++) updateAttract(1 / 60);

  // Store screenshots (main.js calls this only for ?shot=1&scene=...): put the game in a named moment and run it forward.
  const IDLE = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
  const advance = (n) => { for (let i = 0; i < n; i++) api.update(1 / 60, IDLE); };
  // a good player's hands: spin at 0.26 s, a stride every 0.27 s, steer to the flag, dive when it is close
  const botTap = (opts = {}) => {
    const round = state.round; if (!round || round.over || !round.go) return;
    const me = round.runners[round.you];
    if (me.phase === 'prone' && round.tgo >= (opts.react || 0.26)) tapRunner(round, round.you, 0);
    else if (me.phase === 'run') {
      const a = advise(round);
      if (a.act === 'dive' && !opts.noDive) diveRunner(round, round.you);
      else if (round.tgo - me.lastStride >= (opts.cad || 0.27)) tapRunner(round, round.you, a.steer || 0);
    } else if (me.phase === 'down') tapRunner(round, round.you, 0);
  };
  const runUntil = (pred, maxFrames = 60 * 40, opts) => { for (let i = 0; i < maxFrames && !pred(state.round) && state.scene === 'play' && !state.round.over; i++) { botTap(opts); advance(1); } };
  const shotScene = (name) => {
    const rec = state.record;
    rec.owned = [true, true, true, false, true, false]; rec.tier = 2; rec.sel = 1; rec.cups = [3, 1, 0]; rec.bestScore = [820, 560, 0]; rec.suddenBest = 6; rec.dailyDay = state.day; rec.dailyBest = 640; rec.rounds = 60; rec.dives = 14;
    state.loaded = true; state.rev++;
    advance(10);
    if (name === 'title') { state.att = null; advance(3); if (state.att) state.att.count = 99; return; }
    if (name === 'start') { startMode('cup'); state.toastT = 0; advance(20); state.paused = true; return; }
    if (name.startsWith('spin')) { const at = name.includes('@') ? parseFloat(name.split('@')[1]) : 0.16; startMode('cup'); state.toastT = 0; runUntil((r) => r.runners[r.you].phase === 'spin' && r.runners[r.you].pt > at, 60 * 8); state.toastT = 0; state.paused = true; return; }
    if (name === 'run') { startMode('cup'); state.toastT = 0; runUntil((r) => r.go && r.runners[r.you].z > 7, 60 * 20); state.toastT = 0; state.paused = true; return; }
    if (name === 'dive') {
      startMode('cup'); state.toastT = 0;
      runUntil((r) => r.runners[r.you].phase === 'dive' && r.runners[r.you].pt > 0.15, 60 * 25); state.toastT = 0; state.paused = true; return;
    }
    if (name === 'grab') {
      startMode('cup'); state.toastT = 0;
      for (let i = 0; i < 60 * 25 && !(state.round.over && state.overT > 0.6); i++) { botTap(); advance(1); }
      state.toastT = 0; state.paused = true; return;
    }
    if (name === 'watch') {
      state.settings.thinkIdx = 1;
      startMode('watch'); state.toastT = 0;
      for (let i = 0; i < 60 * 70 && !(state.dec && state.dec.phase === 'think' && state.dec.t > 0.8 && state.round.go && state.round.runners[state.round.you].z > 3); i++) advance(1);
      state.paused = true; return;
    }
    if (name === 'icon') {
      // the app icon: the player flying at a row of flags on the sand, seen from low, behind and to the side (rendered with the game's own art)
      startMode('cup'); state.toastT = 0;
      const r = state.round, me = r.runners[r.you];
      r.go = true; r.count = 0;
      const fl = r.flags.slice().sort((a, b) => a.x - b.x);
      fl.forEach((f, i) => { f.z = 9 + 0.12 * Math.abs(i - 3); f.x = (i - (fl.length - 1) / 2) * 1.2; });
      const tgt = fl[Math.min(fl.length - 1, 3)];
      me.phase = 'dive'; me.pt = 0.22; me.v = 6; me.x = tgt.x - 0.45; me.z = tgt.z - 1.35; me.flag = -1;
      state.iconArt = { tx: tgt.x, tz: tgt.z };
      state.paused = true; return;
    }
    if (name === 'outfits') { state.scene = 'outfits'; state.collBack = 'title'; state.collSel = 3; state.rev++; advance(2); return; }
    if (name === 'cups') { state.scene = 'cups'; state.rev++; advance(2); return; }
    if (name === 'rules' || name === 'howto' || name === 'about') { state.back = 'title'; state.scene = name; state.refScroll = 0; advance(2); return; }
    if (name === 'settings') { state.scene = 'settings'; state.rev++; advance(2); return; }
    if (name === 'result') {
      startMode('cup'); state.toastT = 0;
      for (let i = 0; i < 60 * 600 && state.scene === 'play'; i++) { botTap(); advance(1); }
      advance(3); return;
    }
    if (name === 'pause') { startMode('cup'); state.toastT = 0; runUntil((r) => r.go && r.runners[r.you].z > 5, 60 * 20); openPause(); advance(2); }
  };

  const api = {
    // Watch & Learn, the outfits and every menu are free; only real racing counts against the free preview (a paused round and the wait for the whistle do not).
    isPreviewExempt: () => !(state.scene === 'play' && state.round && state.mode !== 'watch' && !state.round.over && state.round.go) || state.paused,
    update(dt, input) {
      if (!wheelHooked && input.onWheel) {
        wheelHooked = true;
        input.onWheel(({ dy }) => {
          const mt = flowMeta();
          if (state.scene === 'rules' || state.scene === 'howto' || state.scene === 'about') state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max);
          else if (['title', 'settings', 'result', 'demolimit', 'outfits', 'cups'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0);
        });
      }
      syncSize();
      if (state.scene === 'play') { // keep the kit's preview pill clear of the HUD: portrait under the rhythm strip, landscape over the beach
        const L = layoutOf(state);
        meta.previewBadge = L.land ? { x: L.world.w / 2, y: host.t + 10, align: 'center' } : { x: meta.width / 2, y: L.gauge.y + L.gauge.h + 6, align: 'center' };
      } else meta.previewBadge = null;
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'cups': updateFlowScene(dt, input, handleCups, 'cups'); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'outfits': updateOutfits(dt, input); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx) {
      syncSize();
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'cups': renderCups(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'outfits': renderOutfits(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          if (state.round && state.iconArt) {
            const cam = makeCam({ x: 0, y: 0, w: meta.width, h: meta.height }, state.iconArt.tx - 0.28, state.iconArt.tz - 4.6);
            cam.F *= 2.55; cam.camH = 1.5; cam.yh = meta.height * 0.2; cam.hq = true;
            drawRound(ctx, cam, state.round, { t: 1.3, icon: true, marker: false, yawOff: -1.1 });
          } else if (state.round) renderPlay(ctx, state);
          if (state.pauseMenu) renderPause(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
    lockupZone: () => lockupZone(),
    shotScene,
  };
  return api;
}
