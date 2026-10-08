// Dhow Sailing: flow and input. Drawing lives in view.js / hud.js / scene2d.js, the voyage in sim.js, the career in economy.js, the computer navigator
// in ai.js. This file is the only one that mutates `state`.
//
// Play: drag the compass to steer, drag the sheet slider to trim the sail, tap Reef / Sight / Sweeps. Keyboard: see the Rules.
import { createRng } from '../kit/rng.js';
import { W, H, DT, clamp, wrap360, bearingOf, DEG } from './core.js';
import { LEGS, legById, LEVELS, PORTS, PORT_IDX, GOODS, LORE, SEASONS, seasonOfMonth, legFavour, portById, TRIVIA } from './data.js';
import * as E from './economy.js';
import { makeVoyage, stepVoyage, setHeading, setTrim, setReef, setSweeps, startSight, takeSight, canSight, decide, todOf, idealTrim, upcomingSquall } from './sim.js';
import { autoControl, explain, planFor } from './ai.js';
import { TEXT_SCALES, inRect, setPress } from './ui.js';
import { renderScene } from './view.js';
import { decisionSpec, decisionRects, sightButtonRect } from './hud.js';
import { LY, syncLayout, host } from './layout.js';

export const meta = { width: W, height: H, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };

const THINK_STEPS = [2, 5, 8, 10];
const DEMO_PASSAGES = 2;
const hid = (o, k, v) => Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true });
const nm = (id) => portById(id).name;

export function createGame(env) {
  const { rng, storage, audio, config, monetization } = env;
  const freshV = () => ({ parts: [], flash: 0, seed: 7, t: 0, trail: [], trailT: 0 });
  const state = {
    scene: 'title', t: 0, tick: 0,
    prefs: { sound: true, level: 1, textIdx: 0, thinkIdx: 1, cam: 0, coach: 0 },
    ui: { scroll: 0, drag: null, lot: 5, confirmNew: false },
    voy: null, mode: 'passage', camp: null, setup: null, results: null, talk: { q: TRIVIA[0], picked: null }, notice: '',
    v: freshV(), paused: false, hints: 3, endT: 0, toasts: [], coach: false, legKey: '',
    think: { open: false, lines: [] },
    auto: { phase: 'idle', timer: 0, total: 0, lines: [], fullLines: [], decision: '', speed: 1, revealing: false, last: -99, seen: 0, hold: false },
    touch: { mode: null },
    records: {}, demoPlayed: 0, cargoView: { frac: 0.7, good: 'timber' },
  };
  hid(state, 'env', env);
  hid(state, '_ui', { hits: [], footer: [], view: { x: 0, y: 0, w: W, h: H }, maxS: 0, bar: null, thumb: null });
  syncLayout(meta.width, meta.height);
  let seenEv = 0, ambT = 0, flapT = 0, lastReefToast = -99;
  const sfxq = [];

  // ---- persistence ------------------------------------------------------------------------------------------------------------------------------------
  const savePrefs = () => storage.set('prefs', state.prefs);
  const saveCamp = () => { if (state.camp) storage.set('camp', state.camp); };
  const saveRecords = () => storage.set('records', state.records);
  storage.get('prefs', null).then((p) => {
    if (!p) return;
    const pf = state.prefs;
    pf.sound = p.sound ?? true; pf.level = clamp(p.level ?? 1, 0, 2); pf.textIdx = clamp(p.textIdx ?? 0, 0, TEXT_SCALES.length - 1); pf.thinkIdx = clamp(p.thinkIdx ?? 1, 0, 3);
    pf.cam = clamp(p.cam ?? 0, 0, 3); pf.coach = clamp(Number(p.coach) || 0, 0, 99);
    audio.setMuted(!pf.sound);
  });
  storage.get('camp', null).then((c) => { if (c && c.v === 1 && !state.camp) state.camp = c; });
  storage.get('records', {}).then((r) => { if (r && typeof r === 'object') state.records = r; });
  storage.get('demoPlayed', 0).then((n) => { state.demoPlayed = Math.max(state.demoPlayed, Number(n) || 0); });

  // ---- sound ---------------------------------------------------------------------------------------------------------------------------------------------
  const tone = (o, delay = 0) => { if (!state.prefs.sound) return; if (delay > 0) sfxq.push({ at: state.t + delay, o }); else audio.tone(o); };
  const sfx = (name, q = 1) => {
    switch (name) {
      case 'ui': tone({ freq: 520, to: 700, dur: 0.07, type: 'triangle', vol: 0.12 }); break;
      case 'bell': tone({ freq: 880, to: 870, dur: 0.6, type: 'sine', vol: 0.12 * q }); tone({ freq: 1320, to: 1300, dur: 0.5, type: 'sine', vol: 0.07 * q }, 0.02); break;
      case 'thud': tone({ freq: 190, to: 70, dur: 0.18, type: 'triangle', vol: 0.3 }); break;
      case 'crack': tone({ freq: 140, to: 60, dur: 0.25, type: 'triangle', vol: 0.4 }); tone({ freq: 900, to: 200, dur: 0.07, type: 'square', vol: 0.1 }); break;
      case 'drum': for (let k = 0; k < 3; k++) tone({ freq: 90, to: 55, dur: 0.22, type: 'triangle', vol: 0.3 }, k * 0.3); break;
      case 'flap': tone({ freq: 180 + 90 * q, to: 90, dur: 0.07, type: 'square', vol: 0.05 }); break;
      case 'dip': tone({ freq: 220, to: 150, dur: 0.5, type: 'triangle', vol: 0.1 }); break;
      case 'creak': tone({ freq: 110 + 30 * q, to: 70, dur: 0.4, type: 'sawtooth', vol: 0.03 }); break;
      case 'win': [523, 659, 784, 1046].forEach((f, k) => tone({ freq: f, dur: 0.3, type: 'sine', vol: 0.16 }, k * 0.14)); break;
      case 'lose': [392, 330, 262].forEach((f, k) => tone({ freq: f, dur: 0.34, type: 'triangle', vol: 0.16 }, k * 0.18)); break;
      case 'coin': tone({ freq: 1200, to: 1500, dur: 0.1, type: 'square', vol: 0.06 }); break;
      default: break;
    }
  };
  const playSfxQueue = () => { for (let i = sfxq.length - 1; i >= 0; i--) if (sfxq[i].at <= state.t) { audio.tone(sfxq[i].o); sfxq.splice(i, 1); } };
  const ambient = (V, dt) => {
    if (!state.prefs.sound) return;
    ambT -= dt; flapT -= dt;
    if (ambT <= 0) { ambT = 0.55; const w = V.wind.speed; audio.tone({ freq: 60 + w * 9, to: 70 + w * 8, dur: 0.7, type: 'sine', vol: 0.012 + 0.004 * w }); audio.tone({ freq: 200 + 40 * Math.sin(V.t), to: 120, dur: 0.5, type: 'triangle', vol: 0.006 + 0.002 * w }); if (V.ship.v > 3 && (Math.floor(V.t) % 5) === 0) sfx('creak', V.ship.v / 6); }
    if (flapT <= 0 && V.ship.flap > 0.4) { flapT = 0.22; sfx('flap', V.ship.flap); }
  };

  // ---- view helpers -------------------------------------------------------------------------------------------------------------------------------------
  const vr = () => { const v = state.v; v.seed = (Math.imul(v.seed, 1664525) + 1013904223) >>> 0; return v.seed / 4294967296; };
  const confetti = (cx, cy, n, colors) => { for (let i = 0; i < n; i++) state.v.parts.push({ kind: 'confetti', x: cx + (vr() - 0.5) * 120, y: cy, vx: (vr() - 0.5) * 560, vy: -240 - vr() * 520, r: 4 + vr() * 5, life: 1.8, max: 1.8, color: colors[Math.floor(vr() * colors.length)], rot: vr() * 6, g: 900 }); };
  const toast = (text, col) => { state.toasts.push({ text, col, t0: state.t }); if (state.toasts.length > 4) state.toasts.shift(); };
  const updateView = (dt) => {
    const v = state.v; v.t += dt; v.flash *= 0.9; if (v.flash < 0.01) v.flash = 0;
    for (const q of v.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.g ?? 0) * dt; q.life -= dt; if (q.rot != null) q.rot += dt * 8; }
    v.parts = v.parts.filter((q) => q.life > 0);
    state.toasts = state.toasts.filter((x) => state.t - x.t0 < 4.4);
  };

  // ---- starting a voyage ----------------------------------------------------------------------------------------------------------------------------------
  function launch(kind, o = {}) {
    if (kind === 'passage' && config.demo && state.demoPlayed >= DEMO_PASSAGES) { go('demolimit'); return; }
    if (kind === 'passage' && config.demo) { state.demoPlayed += 1; storage.set('demoPlayed', state.demoPlayed); }
    const pf = state.prefs, camp = state.camp;
    let leg = o.leg, season = o.season, level = o.level ?? pf.level, seed = o.seed ?? rng.int(1 << 30), crew = { sailors: 3, navigator: 1, sailmaker: 0 }, hull = 100, sail = 100, water = 1.0, morale = 80, tod0 = 0.27 + (seed % 7) * 0.012;
    if (kind === 'career') { season = E.seasonNow(camp); crew = { ...camp.crew }; hull = camp.hull; sail = camp.sail; water = Math.min(1.2, camp.barrels * E.BARREL); morale = camp.morale; seed = o.seed ?? E.passage(camp, leg.id, season).seed; state.cargoView = { frac: E.cargoUnits(camp) / E.holdMax(camp), good: E.dominantGood(camp) || 'timber' }; }
    else state.cargoView = { frac: 0.7, good: ['timber', 'cloth', 'dates', 'pepper', 'porcelain'][seed % 5] };
    if (kind === 'auto') { crew = { sailors: 3, navigator: 1, sailmaker: 0 }; level = 1; }
    state.mode = kind;
    state.voy = makeVoyage({ leg, season, level, seed, crew, hull, sail, water, morale, tod0 });
    state.v = freshV(); state.toasts = []; state.paused = false; state.hints = 3; state.endT = 0; state.think = { open: false, lines: [] }; state.touch = { mode: null };
    state.coach = kind === 'passage' || kind === 'career' ? pf.coach < 4 : false;
    state.auto = { phase: 'idle', timer: 0, total: 0, lines: [], fullLines: [], decision: '', speed: 1, revealing: false, last: -99, seen: 0, hold: false };
    seenEv = 0; state.legKey = `${leg.id}|${season}|${level}`;
    const V = state.voy; V.ctl.target = V.bearing; V.ctl.trim = idealTrim(Math.abs(((V.wind.from - V.bearing + 540) % 360) - 180));
    state.scene = kind === 'auto' ? 'auto' : 'play'; state.ui.scroll = 0;
    if (kind !== 'auto') monetization.track('voyage_start', { kind, leg: leg.id });
  }
  const go = (scene) => { state.scene = scene; state.ui.scroll = 0; state.paused = false; state.think.open = false; state.notice = ''; sfx('ui'); };

  function startPassageFromSetup() {
    const su = state.setup, pf = state.prefs;
    pf.level = su.level; savePrefs();
    launch('passage', { leg: legById(su.legId), season: su.season, level: su.level });
  }
  function startDaily() {
    const day = config.day ?? 0, g = createRng(day * 7 + 3);
    const legs = LEGS.slice();
    let leg = legs[g.int(legs.length)], si = day % 3, season = ['kusi', 'kaskazi', 'between'][si];
    for (let k = 0; k < 3 && legFavour(leg, season).rating === 'foul'; k++) season = ['kusi', 'kaskazi', 'between'][(si + k + 1) % 3];
    state.mode = 'daily';
    launch('daily', { leg, season, level: 1, seed: day * 7919 + 3 });
    state.mode = 'daily';
  }

  // ---- end of a voyage -----------------------------------------------------------------------------------------------------------------------------------
  function finishVoyage() {
    const V = state.voy, r = V.result, leg = legById(V.legId), rec = state.records, mode = state.mode;
    const arrived = r.how === 'arrived';
    const failText = { wrecked: 'Wrecked', thirst: 'Out of water', lost: 'Lost at sea' }[r.how];
    const rows = [];
    let res;
    if (mode === 'career') {
      const camp = state.camp, sum = E.applyVoyage(camp, V, leg);
      const lore = arrived && r.stars >= 2 ? E.unlockLore(camp, ['lateen', 'kamal', 'isba', 'stitched', 'types', 'crux'][(camp.stats.voyages) % 6]) : false;
      if (lore) sum.notes.push('A new lore card is in your logbook.');
      rows.push({ label: 'Route', value: `${nm(V.from)} to ${nm(V.to)}` }, ...sum.rows, { label: 'Coins now', value: String(Math.round(camp.coins)), color: '#ffd05c' }, { label: 'Reputation', value: String(Math.round(camp.rep)) });
      res = { headline: arrived ? (r.stars === 3 ? 'A splendid passage!' : r.stars === 2 ? 'Well sailed!' : 'Landfall') : failText, sub: arrived ? `Welcome to ${nm(V.to)}.` : 'The voyage did not end well.', stars: arrived ? r.stars : null, rows, notes: sum.notes, career: true };
      saveCamp();
    } else {
      rows.push({ label: 'Time', value: `${Math.round(r.t)} s  (par ${Math.round(V.par)})`, color: '#ffd05c' }, { label: 'Hull left', value: `${Math.round(r.hull)}` }, { label: 'Yard dips', value: String(V.stats.dips) }, { label: 'Star sights', value: String(r.sights) }, { label: 'Top speed', value: `${V.stats.maxKn.toFixed(1)} kn` });
      if (V.landfall) rows.push({ label: 'Landfall off the harbour', value: `${Math.round(Math.abs(V.landfall.l))} m` });
      if (mode === 'passage' || mode === 'daily') {
        if (arrived) { const key = `best:${state.legKey}`; if (!rec[key] || r.t < rec[key]) rec[key] = r.t; rec.bestStars = Math.max(rec.bestStars ?? 0, r.stars); rec.passages = (rec.passages ?? 0) + 1; if (mode === 'daily') { rec.dailyDay = config.day; rec.dailyStars = Math.max(rec.dailyDay === config.day ? rec.dailyStars ?? 0 : 0, r.stars); } saveRecords(); rows.push({ label: 'Best time here', value: `${Math.round(rec[key])} s` }); }
      }
      res = { headline: mode === 'auto' ? 'Auto Play finished' : arrived ? (r.stars === 3 ? 'A splendid passage!' : r.stars === 2 ? 'Well sailed!' : 'Landfall') : failText, sub: mode === 'auto' ? 'The computer sailed the whole passage.' : arrived ? `${nm(V.from)} to ${nm(V.to)}` : 'The passage did not end well.', stars: arrived && mode !== 'auto' ? r.stars : null, rows, notes: [], career: false };
    }
    state.results = res;
    if (arrived) { sfx('win'); confetti(LY.cx, LY.h * 0.3, r.stars === 3 ? 80 : 36, ['#ffd34d', '#5ee0cc', '#fff4dc', '#ee6a4c']); } else sfx('lose');
    if (state.prefs.coach < 99 && (mode === 'passage' || mode === 'career')) { state.prefs.coach = Math.min(99, state.prefs.coach + 1); savePrefs(); }
    monetization.track('voyage_end', { mode, how: r.how, stars: r.stars });
    go('arrive');
  }

  // ---- events -> sound, toasts, fx --------------------------------------------------------------------------------------------------------------------------
  function processEvents() {
    const V = state.voy;
    for (const e of V.events) {
      if (e.id <= seenEv) continue;
      seenEv = e.id;
      switch (e.type) {
        case 'depart': toast(`Leaving ${nm(V.from)}`, '#9fe8e8'); break;
        case 'dip': toast(e.tack ? 'Tacking: dipping the yard' : 'Gybing: dipping the yard', '#ffd05c'); sfx('dip'); break;
        case 'split': toast('The sail split in the gust!', '#ff9a8a'); sfx('crack'); state.v.flash = 0.5; break;
        case 'broach': toast('Broached! Some cargo is lost', '#ff9a8a'); sfx('crack'); state.v.flash = 0.9; break;
        case 'reef-seen': if (state.t - lastReefToast > 6) { lastReefToast = state.t; toast('Reef ahead! Pale water and breakers', '#ffb15a'); sfx('creak', 0.8); } break;
        case 'reef-hit': toast('We struck the reef!', '#ff9a8a'); sfx('crack'); state.v.flash = 1; break;
        case 'ground': toast('Aground on the shore!', '#ff9a8a'); sfx('thud'); state.v.flash = 0.7; break;
        case 'squall-warn': toast('A squall is coming!', '#ffb15a'); sfx('drum'); break;
        case 'squall-end': toast('The squall passes', '#9fe8e8'); break;
        case 'calm-start': toast('Becalmed', '#9fe8e8'); break;
        case 'calm-end': toast('A breeze returns', '#9fe8e8'); break;
        case 'help-near': toast('A dhow signals ahead', '#ffd05c'); break;
        case 'land': toast('Land sighted!', '#7fe3a0'); sfx('bell'); break;
        case 'sight-start': toast('The guiding star is up. Tap NOW when it meets the card.', '#bcd2ff'); break;
        case 'sight': toast(e.q > 0.75 ? 'Excellent sight! Latitude fixed' : e.q > 0.35 ? 'A fair sight' : 'A poor sight', e.q > 0.5 ? '#7fe3a0' : '#ffb15a'); sfx('bell', 0.4 + e.q); break;
        case 'sight-lost': toast('The star slipped behind a cloud', '#ffb15a'); break;
        case 'life': toast(e.kind === 'dolphins' ? 'Dolphins run alongside the bow!' : 'Flying fish skim the waves', '#9fe8e8'); break;
        case 'reef-in': toast('Reefing the sail', '#9fe8e8'); break;
        case 'reef-out': toast('Shaking out the reef', '#9fe8e8'); break;
        default: break;
      }
    }
  }

  function stepVoy(dt) {
    const V = state.voy;
    stepVoyage(V, DT);
    processEvents();
    ambient(V, dt);
    V.trailT = (V.trailT ?? 0) + dt;
    state.v.trailT += dt;
    if (state.v.trailT > 2.2) { state.v.trailT = 0; state.v.trail.push([V.est.x, V.est.y]); if (state.v.trail.length > 160) state.v.trail.shift(); }
  }

  // ---- hints ----------------------------------------------------------------------------------------------------------------------------------------------------------
  function openThink() {
    const V = state.voy;
    if (state.hints <= 0 || state.think.open || V.phase !== 'sail') return;
    state.hints -= 1; const ex = explain(V); state.think = { open: true, lines: ex.lines.slice(0, 5) }; sfx('ui');
  }

  // ---- play input -----------------------------------------------------------------------------------------------------------------------------------------------
  const dialHeading = (x, y) => { const D = LY.dial, dx = x - D.cx, dy = y - D.cy; if (Math.hypot(dx, dy) < D.r * 0.12) return null; return wrap360(Math.atan2(dx, -dy) / DEG); };
  const sheetTrim = (y) => { const S = LY.sheet, y0 = S.y + 44, y1 = S.y + S.h - 36; return clamp((y1 - y) / (y1 - y0), 0, 1); };
  function playInput(input, dt) {
    const V = state.voy, p = input.pointer, tc = state.touch, k = input.keys;
    const kd = k.down;
    const dirx = (kd.has('ArrowRight') ? 1 : 0) - (kd.has('ArrowLeft') ? 1 : 0), diry = (kd.has('ArrowUp') ? 1 : 0) - (kd.has('ArrowDown') ? 1 : 0);
    if (dirx) setHeading(V, V.ctl.target + dirx * 42 * dt);
    if (diry) { setTrim(V, V.ctl.trim + diry * 0.5 * dt); V.plan.autoTrim = false; }
    if (k.pressed.has('KeyR')) setReef(V, !V.ctl.reef);
    if (k.pressed.has('KeyW')) setSweeps(V, !V.ctl.sweeps);
    if (k.pressed.has('KeyC')) { state.prefs.cam = (state.prefs.cam + 1) % 4; savePrefs(); }
    if (k.pressed.has('KeyK')) startSight(V);
    if ((k.pressed.has('Space') || k.pressed.has('Enter') || k.pressed.has('KeyN')) && V.sight && !V.sight.done) takeSight(V);
    const spec = decisionSpec(V);
    if (spec) { const keys = ['Digit1', 'Digit2', 'Digit3']; spec.opts.forEach((o, i) => { if (k.pressed.has(keys[i])) decide(V, o[0]); }); }
    if (p.pressed) {
      if (V.sight && !V.sight.done && inRect(LY.sightPanel, p.x, p.y)) { takeSight(V); tc.mode = null; return; }
      if (spec) { const { opts } = decisionRects(spec); for (const o of opts) if (inRect(o.rect, p.x, p.y)) { decide(V, o.id); sfx('ui'); tc.mode = null; return; } }
      if (inRect(LY.camBtn, p.x, p.y)) { state.prefs.cam = (state.prefs.cam + 1) % 4; savePrefs(); sfx('ui'); return; }
      if (inRect(LY.reef, p.x, p.y)) { setReef(V, !V.ctl.reef); sfx('ui'); return; }
      if (inRect(LY.sight, p.x, p.y)) { if (!startSight(V)) toast(canSight(V) ? '' : 'Star sights are for clear nights', '#ffb15a'); return; }
      if (inRect(LY.sweeps, p.x, p.y)) { if (V.wind.speed > 6.5 && !V.ctl.sweeps) toast('Too much wind for the sweeps', '#ffb15a'); else setSweeps(V, !V.ctl.sweeps); sfx('ui'); return; }
      const S = LY.sheet, ext = { x: S.x - 24, y: S.y - 10, w: S.w + 24, h: S.h + 20 };
      if (inRect(ext, p.x, p.y)) { tc.mode = 'sheet'; setTrim(V, sheetTrim(p.y)); V.plan.autoTrim = false; }
      else { const D = LY.dial; if (Math.hypot(p.x - D.cx, p.y - D.cy) <= D.r * 1.12) { tc.mode = 'dial'; const h = dialHeading(p.x, p.y); if (h != null) setHeading(V, h); } }
    }
    if (p.down && tc.mode === 'sheet') { setTrim(V, sheetTrim(p.y)); V.plan.autoTrim = false; }
    if (p.down && tc.mode === 'dial') { const h = dialHeading(p.x, p.y); if (h != null) setHeading(V, h); }
    if (p.released) tc.mode = null;
  }

  function updatePlay(dt, input) {
    const V = state.voy, p = input.pointer;
    if (state.paused) {
      if (p.pressed) {
        const PM = LY.pauseMenu;
        if (inRect(PM.resume, p.x, p.y) || inRect(LY.pause, p.x, p.y)) { state.paused = false; sfx('ui'); }
        else if (inRect(PM.sound, p.x, p.y)) { state.prefs.sound = !state.prefs.sound; audio.setMuted(!state.prefs.sound); savePrefs(); }
        else if (inRect(PM.quit, p.x, p.y)) { state.paused = false; abandon(); }
      }
      if (input.keys.pressed.has('KeyP')) state.paused = false;
      return;
    }
    if (state.think.open) {
      if (p.pressed && inRect(LY.thinkCard.btn, p.x, p.y)) { state.think.open = false; sfx('ui'); }
      if (input.keys.pressed.has('KeyT') || input.keys.pressed.has('Escape')) state.think.open = false;
      return;
    }
    if (V.phase !== 'sail') {
      state.endT += dt; updateView(dt);
      if (state.endT > 3.2 || (p.pressed && state.endT > 0.9)) finishVoyage();
      return;
    }
    if (p.pressed && inRect(LY.pause, p.x, p.y)) { state.paused = true; sfx('ui'); return; }
    if (p.pressed && inRect(LY.think, p.x, p.y)) { openThink(); return; }
    if (input.keys.pressed.has('KeyP')) { state.paused = true; return; }
    if (input.keys.pressed.has('KeyT')) openThink();
    playInput(input, dt);
    const n = V.skip > 0 ? 6 : 1;
    for (let i = 0; i < n && V.phase === 'sail'; i++) { stepVoy(dt); if (V.skip > 0) V.skip = Math.max(0, V.skip - DT); }
    updateView(dt);
  }
  function abandon() {
    const V = state.voy;
    if (state.mode === 'career') { state.camp.day += 2; E.addLog(state.camp, `Turned back to ${nm(V.from)} after leaving.`); state.camp.hull = Math.round(V.hull); state.camp.sail = Math.round(V.sail); saveCamp(); go('port'); }
    else go('title');
  }

  // ---- auto play (Watch and Learn) ------------------------------------------------------------------------------------------------------------------
  const EVENT_LINE = {
    'squall-warn': 'A squall is coming. I reef the sail now so the gust cannot split it, and keep my course.',
    'help-near': 'A small dhow signals that it needs water. We have enough to share, and it is the right thing to do, so I help.',
    'calm-start': 'The wind has died. With three sailors I take the sweeps to keep moving until the breeze returns.',
    land: 'Land! The coast is in sight, so the doubt on the chart is gone. I steer straight for the harbour.',
    'sight-start': 'The star is up. I raise the kamal and wait for it to meet the edge of the card.',
  };
  function autoThink(trigger) {
    const V = state.voy, a = state.auto;
    const ex = explain(V), lines = ex.lines.slice();
    if (trigger && EVENT_LINE[trigger]) lines.unshift(EVENT_LINE[trigger]);
    const p = ex.plan;
    a.fullLines = lines.slice(0, 4); a.lines = a.fullLines.slice(0, 1); a.phase = 'think'; a.total = THINK_STEPS[state.prefs.thinkIdx]; a.timer = a.total; a.revealing = false; a.hold = true; a.trigger = trigger;
    a.decision = trigger === 'squall-warn' ? 'Decision: reef the sail, hold the course.' : trigger === 'help-near' ? 'Decision: share water.' : trigger === 'calm-start' ? 'Decision: pull the sweeps.' : `Decision: steer ${String(Math.round(p.h)).padStart(3, '0')} degrees, sheet at ${Math.round(p.trim * 100)} percent${p.over > 0.95 ? ', reef the sail' : ''}.`;
    a.last = V.t;
  }
  function autoStep(dt) {
    const V = state.voy, a = state.auto;
    if (a.phase === 'think' || a.phase === 'reveal') {
      a.timer -= dt;
      if (a.phase === 'think') { const all = a.fullLines, frac = clamp(1 - a.timer / a.total, 0, 1); a.lines = all.slice(0, Math.max(1, Math.min(all.length, Math.ceil(frac * all.length * 1.05)))); }
      if (a.timer <= 0) {
        if (a.phase === 'think') { a.phase = 'reveal'; a.revealing = true; a.total = 2; a.timer = 2; a.lines = a.fullLines.concat([a.decision]); }
        else { a.phase = 'act'; a.revealing = false; a.hold = false; a.lines = a.fullLines.concat([a.decision]); if (V.decision) autoControl(V, 0.92, true); }
      }
      return;
    }
    if (V.phase !== 'sail') return;
    autoControl(V, 0.92, !V.decision || a.phase === 'act');
    stepVoy(dt);
    // decision points
    for (const e of V.events) {
      if (e.id <= a.seen) continue; a.seen = e.id;
      if (['squall-warn', 'help-near', 'calm-start', 'land', 'sight-start'].includes(e.type) && (V.t - a.last > 7 || e.type === 'squall-warn')) { autoThink(e.type); return; }
    }
    if (V.t < 0.1 && a.last < 0) { autoThink('start'); return; }
    if (V.t - a.last > 28) autoThink('now');
  }
  function updateAuto(dt, input) {
    const V = state.voy, a = state.auto, p = input.pointer;
    if (state.paused) {
      if (p.pressed && (inRect(LY.auto.pause, p.x, p.y) || inRect(LY.pause, p.x, p.y))) { state.paused = false; sfx('ui'); }
      if (input.keys.pressed.has('KeyP') || input.keys.pressed.has('Space')) state.paused = false;
      return;
    }
    if (p.pressed) {
      const A = LY.auto;
      if (inRect(A.pause, p.x, p.y) || inRect(LY.pause, p.x, p.y)) { state.paused = true; sfx('ui'); return; }
      if (inRect(A.speed, p.x, p.y)) { a.speed = a.speed >= 4 ? 1 : a.speed * 2; sfx('ui'); }
      else if (inRect(A.dec, p.x, p.y)) { state.prefs.thinkIdx = clamp(state.prefs.thinkIdx - 1, 0, 3); savePrefs(); sfx('ui'); }
      else if (inRect(A.inc, p.x, p.y)) { state.prefs.thinkIdx = clamp(state.prefs.thinkIdx + 1, 0, 3); savePrefs(); sfx('ui'); }
      else if (inRect(A.exit, p.x, p.y)) { go('title'); return; }
      else if (inRect(LY.camBtn, p.x, p.y)) { state.prefs.cam = (state.prefs.cam + 1) % 4; savePrefs(); sfx('ui'); }
    }
    if (input.keys.pressed.has('KeyP')) { state.paused = true; return; }
    if (input.keys.pressed.has('KeyC')) { state.prefs.cam = (state.prefs.cam + 1) % 4; }
    if (V.phase !== 'sail') { state.endT += dt; updateView(dt); if (state.endT > 3.0) finishVoyage(); return; }
    for (let s = 0; s < a.speed; s++) { autoStep(DT); if (state.scene !== 'auto' || V.phase !== 'sail') break; }
    updateView(dt);
  }

  // ---- UI scenes --------------------------------------------------------------------------------------------------------------------------------------------------
  function uiInput(input) {
    const p = input.pointer, ui = state.ui, U = state._ui;
    if (wheelInput.dy) { ui.scroll = clamp(ui.scroll + wheelInput.dy, 0, U.maxS); wheelInput.dy = 0; }
    if (p.pressed) {
      const bar = U.bar;
      const onBar = !!(bar && U.thumb && U.maxS > 0 && p.x >= bar.x - 16 && p.x <= bar.x + bar.w + 16 && p.y >= bar.y && p.y <= bar.y + bar.h);
      ui.drag = { y0: p.y, s0: ui.scroll, moved: onBar, x0: p.x, sb: onBar };
    }
    if (ui.drag && p.down) {
      if (ui.drag.sb) { const t = U.thumb, bar = U.bar; ui.scroll = clamp((p.y - bar.y - t.h / 2) / Math.max(1, bar.h - t.h), 0, 1) * U.maxS; }
      else { const dy = p.y - ui.drag.y0; if (Math.abs(dy) > 12) ui.drag.moved = true; if (ui.drag.moved) ui.scroll = clamp(ui.drag.s0 - dy, 0, U.maxS); }
    }
    for (const k of input.keys.pressed) {
      if (k === 'ArrowDown') ui.scroll = clamp(ui.scroll + 80, 0, U.maxS);
      if (k === 'ArrowUp') ui.scroll = clamp(ui.scroll - 80, 0, U.maxS);
      if (k === 'PageDown') ui.scroll = clamp(ui.scroll + U.view.h * 0.9, 0, U.maxS);
      if (k === 'PageUp') ui.scroll = clamp(ui.scroll - U.view.h * 0.9, 0, U.maxS);
      if (k === 'Home') ui.scroll = 0;
      if (k === 'End') ui.scroll = U.maxS;
      if (k === 'Escape') uiTap('back');
      if (k === 'Enter' || k === 'Space') {
        if (state.scene === 'title') { uiTap('play'); return; }
        const prim = U.footer.find((f) => ['start', 'next', 'again', 'cont'].includes(f.id)); if (prim) uiTap(prim.id);
      }
    }
    if (p.released && ui.drag) {
      const d = ui.drag; ui.drag = null;
      if (d.moved) return;
      const x = p.x, y = p.y;
      if (inRect(LY.zoom.dec, x, y)) { state.prefs.textIdx = clamp(state.prefs.textIdx - 1, 0, TEXT_SCALES.length - 1); savePrefs(); return; }
      if (inRect(LY.zoom.inc, x, y)) { state.prefs.textIdx = clamp(state.prefs.textIdx + 1, 0, TEXT_SCALES.length - 1); savePrefs(); return; }
      if (U.lockTap && state.scene === 'title' && inRect(U.lockTap, x, y)) { state.lockDown = state.t + 0.25; env.openArcforgeHome?.(); return; }
      for (const f of U.footer) if (inRect(f.rect, x, y)) { uiTap(f.id); return; }
      if (y >= U.view.y && y <= U.view.y + U.view.h) for (const h of U.hits) if (inRect(h.rect, x, y)) { uiTap(h.id); return; }
    }
  }

  const newCareer = () => { state.camp = E.newCamp(rng.int(1 << 30)); saveCamp(); };
  function uiTap(id) {
    if (!id) return;
    const sc = state.scene, pf = state.prefs, camp = state.camp;
    sfx('ui');
    if (id === 'back') {
      if (sc === 'setup') go('modes');
      else if (['modes', 'settings', 'howto', 'about', 'rules'].includes(sc)) go('title');
      else if (sc === 'port') go('modes');
      else if (['market', 'yard', 'crew', 'logbook', 'voyage', 'talk'].includes(sc)) go('port');
      return;
    }
    switch (sc) {
      case 'title':
        if (id === 'play') go('modes');
        else if (id === 'auto') launch('auto', { leg: legById('mombasa>aden'), season: 'kusi', seed: 12345 });
        else if (['howto', 'rules', 'about', 'settings'].includes(id)) go(id);
        break;
      case 'modes':
        if (id === 'mode:career') { if (config.demo) { sfx('lose'); break; } if (!camp) newCareer(); go('port'); }
        else if (id === 'mode:passage') { state.setup = { base: 'mombasa>aden', legId: 'mombasa>aden', rev: false, season: 'kusi', level: pf.level }; go('setup'); }
        else if (id === 'mode:daily') { if (config.demo) { sfx('lose'); break; } startDaily(); }
        else if (id === 'newcareer') { if (state.ui.confirmNew) { newCareer(); state.ui.confirmNew = false; go('port'); } else { state.ui.confirmNew = true; state.notice = 'Tap again to erase your career.'; } }
        break;
      case 'setup': {
        const su = state.setup;
        if (id.startsWith('leg:')) { su.base = id.slice(4); su.legId = su.rev ? reverseOf(su.base) : su.base; }
        else if (id.startsWith('dir:')) { su.rev = id.slice(4) === '1'; su.legId = su.rev ? reverseOf(su.base) : su.base; }
        else if (id.startsWith('season:')) su.season = id.slice(7);
        else if (id.startsWith('level:')) su.level = Number(id.slice(6));
        else if (id === 'start') startPassageFromSetup();
        break;
      }
      case 'port':
        if (id === 'p:market') go('market'); else if (id === 'p:yard') go('yard'); else if (id === 'p:crew') go('crew'); else if (id === 'p:log') go('logbook'); else if (id === 'p:sail') go('voyage');
        else if (id === 'p:talk') { if (camp.talkKey === `${camp.port}:${camp.day}`) break; state.talk = { q: E.nextTrivia(camp), picked: null }; go('talk'); }
        break;
      case 'market':
        if (id.startsWith('lot:')) state.ui.lot = Number(id.slice(4));
        else if (id.startsWith('buy:')) { const r = E.buy(camp, id.slice(4), state.ui.lot); if (r.bought) sfx('coin'); else sfx('lose'); saveCamp(); }
        else if (id.startsWith('sell:')) { const r = E.sell(camp, id.slice(5), state.ui.lot); if (r.sold) sfx('coin'); if (r.goal) { sfx('win'); state.notice = 'You are now a Master Nakhoda! Keep sailing as long as you like.'; } saveCamp(); }
        break;
      case 'yard':
        if (id === 'y:hull') E.repairHull(camp); else if (id === 'y:sail') E.repairSail(camp); else if (id === 'y:water') E.buyWater(camp, 1); else if (id === 'y:waterall') E.buyWater(camp, 6); else if (id === 'y:hold') E.upgradeHold(camp);
        saveCamp(); break;
      case 'crew':
        if (id.startsWith('hire:')) E.hire(camp, id.slice(5)); else if (id.startsWith('fire:')) E.dismiss(camp, id.slice(5));
        saveCamp(); break;
      case 'talk':
        if (id.startsWith('ans:') && state.talk.picked == null) {
          const i = Number(id.slice(4)); state.talk.picked = i; camp.talkKey = `${camp.port}:${camp.day}`;
          if (i === state.talk.q.c) { camp.coins += 4; camp.stats.trivia += 1; E.unlockLore(camp, state.talk.q.lore); sfx('win'); } else sfx('lose');
          saveCamp();
        }
        break;
      case 'voyage':
        if (id.startsWith('go:')) {
          const leg = legById(id.slice(3));
          if (camp.barrels < 1) { state.notice = 'Buy water first: the barrels are almost empty.'; sfx('lose'); break; }
          const w = E.dailyWage(camp) * 0; void w;
          launch('career', { leg });
        } else if (id === 'wait') { camp.day += 7; camp.coins = Math.max(0, camp.coins - Math.round(E.dailyWage(camp) * 7)); camp.morale = Math.min(100, camp.morale + 4); E.rescue(camp); E.addLog(camp, 'Waited a week in port for the wind.'); saveCamp(); }
        break;
      case 'settings':
        if (id === 'set:sound') { pf.sound = !pf.sound; audio.setMuted(!pf.sound); }
        else if (id === 'set:level') pf.level = (pf.level + 1) % 3;
        else if (id === 'set:think') pf.thinkIdx = (pf.thinkIdx + 1) % 4;
        else if (id === 'set:cam') pf.cam = (pf.cam + 1) % 4;
        else if (id === 'set:restore') monetization.restore();
        else if (id === 'set:dev') { state.dev = true; }
        savePrefs(); break;
      case 'about':
        if (id === 'a:unlock') monetization.purchase('unlock_game'); else if (id === 'a:restore') monetization.restore();
        break;
      case 'arrive':
        if (id === 'cont') { saveCamp(); go(state.camp ? 'port' : 'title'); }
        else if (id === 'again') { const V = state.voy; if (state.mode === 'auto') launch('auto', { leg: legById('mombasa>aden'), season: 'kusi', seed: 12345 }); else if (state.mode === 'daily') startDaily(); else launch('passage', { leg: legById(V.legId), season: V.season, level: V.level }); }
        else if (id === 'menu') go('title');
        break;
      case 'demolimit':
        if (id === 'auto') launch('auto', { leg: legById('mombasa>aden'), season: 'kusi', seed: 12345 }); else if (id === 'menu') go('title'); break;
      default: break;
    }
  }
  const reverseOf = (id) => { const [a, b] = id.split('>'); return `${b}>${a}`; };

  const noInput = () => ({ pointer: { pressed: false, released: false, down: false, x: 0, y: 0 }, keys: { pressed: new Set(), down: new Set() } });
  return {
    update(dt, input) {
      host.zoom = Math.min(2, TEXT_SCALES[clamp(state.prefs.textIdx, 0, TEXT_SCALES.length - 1)]);
      syncLayout(meta.width, meta.height);
      if (state.freeze) return;
      state.tick += 1;
      setPress(input.pointer.down ? input.pointer.x : null, input.pointer.y);
      const sc = state.scene;
      if (!state.paused) state.t += dt;
      playSfxQueue();
      if (sc === 'play') updatePlay(dt, input);
      else if (sc === 'auto') updateAuto(dt, input);
      else uiInput(input);
    },
    render(ctx, view) { host.zoom = Math.min(2, TEXT_SCALES[clamp(state.prefs.textIdx, 0, TEXT_SCALES.length - 1)]); syncLayout(view?.width ?? meta.width, view?.height ?? meta.height); renderScene(ctx, state); },
    getState: () => state,
    // Auto Play, the menus, the career screens, the paused hint and the end of a voyage are free; only real sailing uses up the free preview.
    isPreviewExempt: () => state.scene !== 'play' || state.paused || state.think.open || !!(state.voy && state.voy.phase !== 'sail'),
    debug: {
      state,
      freeze: (b) => { state.freeze = b; },
      go: (s) => { state.scene = s; state.ui.scroll = 0; },
      launch,
      newCareer,
      step: (n = 1) => { for (let i = 0; i < n; i++) { if (state.scene === 'auto') updateAuto(DT, noInput()); else if (state.scene === 'play' && !state.paused) { stepVoy(DT); updateView(DT); } } },
      setPrefs: (o) => Object.assign(state.prefs, o),
      finish: finishVoyage, autoThink, uiTap,
      // Store-shot scenes (used by the capture script): title, sail, night, squall, market, watch.
      shotScene: (name) => {
        const leg = legById('mombasa>aden'), sail = (n, tod0, seed = 21, season = 'kusi') => { launch('passage', { leg, season, level: 1, seed }); state.coach = false; state.voy.tod0 = tod0; for (let i = 0; i < n; i++) { autoControl(state.voy, 0.92); stepVoy(DT); updateView(DT); } };
        state.paused = false; state.think.open = false; state.freeze = false;
        if (name === 'title') go('title');
        else if (name === 'sail') sail(1500, 0.34);
        else if (name === 'night') { sail(700, 0.9); }
        else if (name === 'sight') { sail(300, 0.9); startSight(state.voy); for (let i = 0; i < 40; i++) { stepVoy(DT); updateView(DT); } }
        else if (name === 'squall') { let sq = null; for (let sd = 5; sd < 60 && !sq; sd++) { sail(1, 0.4, sd, 'between'); sq = state.voy.hazards.find((h) => h.k === 'squall'); } const V = state.voy; if (sq) while (V.t < sq.t0 + 9 && V.phase === 'sail') { autoControl(V, 0.92); stepVoy(DT); updateView(DT); } }
        else if (name === 'market') { if (!state.camp) newCareer(); const c = state.camp; c.port = 'mombasa'; c.coins = 640; c.cargo.timber = 8; c.cargo.cloth = 5; c.lore = ['monsoon']; c.day = 40; go('market'); }
        else if (name === 'watch') { launch('auto', { leg, season: 'kusi', seed: 12345 }); for (let i = 0; i < 700; i++) updateAuto(DT, noInput()); }
        return state.scene;
      },
      steer: (h) => setHeading(state.voy, h), trim: (u) => setTrim(state.voy, u),
      plan: () => planFor(state.voy),
    },
  };
}
void LORE; void PORTS; void PORT_IDX; void GOODS; void SEASONS; void seasonOfMonth; void todOf; void bearingOf; void upcomingSquall; void sightButtonRect; void LEVELS;
