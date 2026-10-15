// GAME CONTRACT (docs/GAME-CONTRACT.md): exports meta and createGame(env) -> { update, render, getState }.
// This file owns state and flow (scenes, input, strikes, flights, saving). Rules and physics live in rules.js, everything
// drawn in view.js / art.js. `state` is plain JSON: closures hold nothing that matters.
import { W, H, inRect, layoutFor, cameraFor, scaleAt, unproj, creditHit, live } from './layout.js';
import {
  RIES, FIELDERS, BOARD, MAX_THROWS, venueOf, newMatch, makeFlight, crossing, boardStops, resolveFlight, planFielding, planStrike, hintStrike, hintFielder,
  strikeFrom, distanceFor, tensionAt, isPerfect, applyStrike, strikerName, strikeNumber, pointsFor, WHIP_T,
} from './rules.js';
import { screenButtons, screenLayout, readerMax, TEXT_SCALES, AP_THINK_STEPS, setCredits3d } from './ui.js';
import { render as draw } from './view.js';

export const wheelInput = { dy: 0 };
let credits3d = '';
export const meta = { width: W, height: H, fluid: { short: 720 } };

const DEMO_MATCHES = 1;
const AP_REVEAL = 2;
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

export function createGame(env) {
  const { rng, storage, audio, config, monetization } = env;
  const fx = rng.fork(); // visual randomness never shifts the strike stream
  const lay = () => { live.w = meta.width; live.h = meta.height; return layoutFor(meta.width, meta.height); };

  const state = {
    scene: 'title', t: 0, demo: !!config.demo, demoMatches: 0,
    prefs: { sound: true, calm: false, guide: true, textScaleIdx: 0, apThinkIdx: 1 },
    coach: { bat: 0, field: 0 }, rel: null, pend: null,
    setup: { first: 'bat', level: 'normal', len: 8, venue: 'emmental' },
    stats: { played: 0, won: 0 },
    menuOpen: false, howPage: 0, aboutPage: 0, rulesPage: 0, refFrom: 'title', scroll: 0, press: null, jump: null,
    m: null, vb: null, ph: 'ready', wait: 0, msg: '', turn: null, windTotal: 0.7, holdSnd: 0, goldCue: false,
    hold: null, fl: null, ft: 0, throws: [], stop: null, dropT: 0, swing: null, plan: null, flPre: null, fPre: null,
    boardsLeft: 2, boardsTotal: 2, hintTarget: null, hintId: null, hintIds: [], canHint: false, apShowPlan: false, apTime: 5,
    owned: false, restoreBusy: false, restoreMsg: '',
    parts: [], pops: [], sfx: [], whistle: 0, ap: { paused: false }, over: null, showcase: false, kb: false,
  };

  state.owned = !!monetization?.owns?.('unlock_game');
  monetization?.onChange?.(() => { state.owned = !!monetization.owns('unlock_game'); });

  // ---- storage -----------------------------------------------------------------------------------------------------------
  storage.get('prefs', null).then((v) => {
    if (v) {
      Object.assign(state.prefs, v);
      state.prefs.textScaleIdx = clampN(state.prefs.textScaleIdx ?? 0, 0, TEXT_SCALES.length - 1);
      state.prefs.apThinkIdx = clampN(state.prefs.apThinkIdx ?? 1, 0, AP_THINK_STEPS.length - 1);
      audio.setMuted(!state.prefs.sound);
    }
  });
  storage.get('stats', null).then((v) => { if (v) Object.assign(state.stats, v); });
  storage.get('coach', null).then((v) => { if (v) Object.assign(state.coach, v); });
  storage.get('setup', null).then((v) => { if (v && state.scene === 'title') Object.assign(state.setup, v); });
  storage.get('demoMatches', 0).then((v) => { state.demoMatches = Math.max(state.demoMatches, v); });
  const savePrefs = () => { storage.set('prefs', state.prefs); audio.setMuted(!state.prefs.sound); };
  const saveStats = () => { storage.set('stats', state.stats); storage.set('progress', { played: state.stats.played, wins: state.stats.won }); };

  // ---- sound (all synthesized; delayed tones are scheduled in update so it stays deterministic) ---------------------------------
  const isAuto = () => state.scene === 'autoplay' || state.scene === 'autoplay-over';
  // Auto Play is silent by design regardless of the player's sound setting: never surprise a viewer with sound from a demo.
  const tone = (o, delay = 0) => { if (!state.prefs.sound) return; if (delay > 0) state.sfx.push({ t: delay, o }); else audio.tone(o); };
  const sounds = {
    ui: () => tone({ freq: 520, to: 700, dur: 0.06, type: 'sine', vol: 0.07 }),
    swing: () => { tone({ freq: 160, to: 760, dur: 0.16, type: 'sawtooth', vol: 0.05 }); tone({ freq: 90, to: 60, dur: 0.12, type: 'triangle', vol: 0.12 }, 0.12); },
    throw: () => tone({ freq: 240, to: 620, dur: 0.18, type: 'triangle', vol: 0.06 }),
    clack: () => { tone({ freq: 340, to: 120, dur: 0.1, type: 'square', vol: 0.09 }); tone({ freq: 760, to: 300, dur: 0.07, type: 'triangle', vol: 0.07 }, 0.01); },
    thud: () => tone({ freq: 140, to: 60, dur: 0.18, type: 'triangle', vol: 0.12 }),
    nummer: (pts) => { [523, 659, 784, 1046].slice(0, 1 + pts).forEach((f, k) => tone({ freq: f, dur: 0.18, type: 'triangle', vol: 0.08 }, k * 0.08 + 0.001)); for (let b = 0; b < Math.min(3, pts + 1); b++) { tone({ freq: 830 + b * 37, dur: 0.55, type: 'sine', vol: 0.04 }, 0.1 + b * 0.19); tone({ freq: 1260 + b * 53, dur: 0.4, type: 'sine', vol: 0.025 }, 0.1 + b * 0.19); } },   // alpine cowbells ring for a Nummer
    miss: () => tone({ freq: 300, to: 180, dur: 0.22, type: 'triangle', vol: 0.07 }),
    win: () => [523, 659, 784, 1046, 1318].forEach((f, k) => tone({ freq: f, dur: 0.3, type: 'triangle', vol: 0.09 }, k * 0.14 + 0.001)),
    hold: (ten) => tone({ freq: 180 + 520 * ten, dur: 0.06, type: 'sine', vol: 0.035 }),
    gold: () => tone({ freq: 1180, dur: 0.07, type: 'sine', vol: 0.05 }),
  };

  // ---- effects (world coordinates; projected at draw time) ----------------------------------------------------------------------
  function burst(x, y, z, cols, n, speed = 7, size = 3) {
    if (state.prefs.calm) n = Math.ceil(n / 3);
    for (let k = 0; k < n; k++) {
      const a = fx.next() * Math.PI * 2, e = (fx.next() - 0.3) * 1.4, sp = speed * (0.3 + fx.next() * 0.8);
      state.parts.push({ x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(e) * sp + 2, vz: Math.sin(a) * sp, life: 0.5 + fx.next() * 0.5, max: 1, col: cols[k % cols.length], sz: size * (0.6 + fx.next() * 0.8) });
    }
  }
  const pop = (x, y, z, text, color = '#fff8e6', edge) => { state.pops.push({ x, y, z, text, color, edge, t: 0 }); };
  const GOLD = ['#ffe27a', '#fff4d6', '#f4c20d'], WOOD = ['#d49a52', '#f0c27a', '#a8702e'], GRASS = ['#6fbf4f', '#4f9a3a', '#cfe9a0'];

  // ---- helpers ------------------------------------------------------------------------------------------------------------------
  const say = (text) => { state.msg = text; };
  const inPlay = () => state.scene === 'play' || state.scene === 'autoplay';
  const humanBats = () => state.scene === 'play' && state.m && state.m.bat === 0;
  const humanFields = () => state.scene === 'play' && state.m && state.m.bat === 1;
  let glRef = null;   // the 3D presenter's projection of the last frame (null in the 2D art)
  const viewBat = () => (state.vb != null ? state.vb : state.m ? state.m.bat : 0);
  const camNow = () => cameraFor(lay(), viewBat() === 0 ? 'bat' : 'field');
  const coachDone = (k) => { state.coach[k] = (state.coach[k] || 0) + 1; storage.set('coach', state.coach); };
  const go = (scene) => { state.scene = scene; state.scroll = 0; state.menuOpen = false; };
  const think = () => AP_THINK_STEPS[state.prefs.apThinkIdx ?? 1];
  const freshHold = (aimX = 0, D = distanceFor(0.12, false), down = false) => ({ t: 0, tension: 0, rising: true, aimX, D, perfect: false, down });

  // ---- starting things ------------------------------------------------------------------------------------------------------------
  function resetView() {
    state.menuOpen = false; state.vb = null; state.fl = null; state.ft = 0; state.throws = []; state.stop = null; state.dropT = 0; state.swing = null; state.plan = null;
    state.flPre = null; state.fPre = null; state.hintTarget = null; state.hintId = null; state.hintIds = []; state.parts = []; state.pops = []; state.sfx = []; state.over = null;
    state.hold = freshHold(); state.ap = { paused: false }; state.kb = false; state.turn = null; state.rel = null; state.pend = null;
  }
  function startMatch() {
    if (state.demo && state.demoMatches >= DEMO_MATCHES) { go('demo-limit'); return; }
    if (state.demo) { state.demoMatches++; storage.set('demoMatches', state.demoMatches); }
    const s = state.setup; storage.set('setup', s);
    state.m = newMatch({ level: s.level, venue: s.venue, len: s.len, humanBats: s.first === 'bat', rng });
    go('play'); resetView(); beginStrike();
  }
  function startAutoPlay() {
    state.m = newMatch({ level: 'normal', venue: state.setup.venue, len: 4, humanBats: true, rng });
    go('autoplay'); resetView(); beginStrike();
  }
  function beginStrike() {
    const m = state.m, v = venueOf(m.venue);
    state.vb = null;
    // the wind drifts a little between strikes and never exceeds the venue's strongest
    m.wind = Math.round(clampN(m.wind + (rng.next() - 0.5) * 0.7, -v.wind, v.wind) * 10) / 10;
    Object.assign(state, { fl: null, ft: 0, throws: [], stop: null, dropT: 0, swing: null, plan: null, flPre: null, fPre: null, hintTarget: null, hintId: null, hintIds: [], apShowPlan: false, rel: null, pend: null });
    state.hold = freshHold();
    state.boardsTotal = MAX_THROWS[m.level]; state.boardsLeft = state.boardsTotal;
    if (state.scene === 'autoplay') {
      // plan the whole strike now (the SAME planners every computer side uses); THINK, then REVEAL, then play it out
      const pl = planStrike(m.level, rng, m.wind);
      state.plan = { ...pl };
      state.flPre = strikeFrom(rng, { power: pl.power, aimX: pl.aimX, perfect: false, wind: m.wind, level: m.level, human: false });
      state.fPre = planFielding(state.flPre, m.level, rng);
      state.ph = 'apthink'; state.apTime = think(); state.wait = state.apTime; state.canHint = false;
      say(`Watch & Learn: ${m.names[m.bat]} strikes. The computer is choosing a target away from the boards.`);
      return;
    }
    state.ph = 'ready'; state.wait = humanBats() ? 0.35 : 0.9;
    state.canHint = humanBats();
    if (humanBats()) say('You are the STRIKER. Press and hold to bend the rod.');
    else say(`You are DEFENDING. ${m.names[m.bat]} strikes: watch the puck, then tap a fielder.`);
  }

  // ---- the strike -----------------------------------------------------------------------------------------------------------------
  function mkThrow(id, th, who) {
    const f = FIELDERS[id], c = crossing(state.fl, f.z);
    return { id, th, who, chk: false, fx: false, peak: c ? clampN(c.y, 2.5, BOARD.reach) : 6.5, sx: c ? clampN(c.x - f.x, -BOARD.lat, BOARD.lat) : 0 };
  }
  function launch(pw, aimX, perfect, human, pre) {
    const m = state.m;
    state.fl = pre || strikeFrom(rng, { power: pw, aimX, perfect, wind: m.wind, level: m.level, human });
    state.ft = 0; state.ph = 'flight'; state.stop = null; state.dropT = 0; state.hintTarget = null; state.whistle = 0;
    if (!state.swing) state.swing = { t: WHIP_T, t0: state.hold ? state.hold.tension : pw };
    state.throws = [];
    const aiField = state.scene === 'autoplay' || m.bat === 0;
    if (aiField) {
      const plan = pre && state.fPre ? state.fPre : planFielding(state.fl, m.level, rng);
      state.throws = plan.map((q) => mkThrow(q.id, q.th, 'ai'));
    }
    state.canHint = humanFields();
    sounds.clack();
    burst(0, 0.8, 0, WOOD, 8, 4, 2);
    if (state.scene === 'autoplay') say(`${m.names[m.bat]} strike: ${Math.round(state.fl.D)} m. The boards try to stop it in the air.`);
    else if (humanBats()) say(`Away! ${Math.round(state.fl.D)} m. The other side tries to stop it with boards.`);
    else say('Tap the fielder the puck is heading for, when his ring turns gold.');
  }
  // the release starts the whip (the picture of the strike takes WHIP_T seconds); the puck leaves the Bock at the contact
  function release(pw, aimX, perfect, human, pre) {
    state.rel = { t0: state.hold ? state.hold.tension : pw };
    state.swing = { t: 0, t0: state.rel.t0 };
    state.pend = { pw, aimX, perfect, human, pre };
    state.ph = 'whip'; state.goldCue = false; state.canHint = false;
    sounds.swing();
    if (human) coachDone('bat');
  }
  // a human tap on the Ries: the nearest fielder throws his board
  function throwAt(X, Y) {
    if (!humanFields() || state.ph !== 'flight' || state.stop || state.boardsLeft <= 0) return false;
    let best = -1, bd = 1e9;
    if (glRef && glRef.fielder) {
      // the picture is 3D: the nearest fielder on the SCREEN (his feet-to-head middle), measured in his own body heights
      for (const f of FIELDERS) {
        if (state.throws.some((q) => q.id === f.id)) continue;
        const p = glRef.fielder(f.id), u = Math.max(8, p.s * 1.1), dx = (X - p.X) / (u * 1.8), dy = (Y - p.Y) / (u * 2.6), d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = f.id; }
      }
    } else {
      const cam = camNow(), g = unproj(cam, X, Y);
      for (const f of FIELDERS) {
        if (state.throws.some((q) => q.id === f.id)) continue;
        const dx = (g.x - f.x) / 3.5, dz = (g.z - f.z) / 15, d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = f.id; }
      }
    }
    return best >= 0 ? throwFielder(best) : false;
  }
  function throwFielder(id) {
    if (state.boardsLeft <= 0 || state.throws.some((q) => q.id === id) || !state.fl) return false;
    state.boardsLeft--;
    state.throws.push(mkThrow(id, state.ft, 'you'));
    state.throws[state.throws.length - 1].fx = true;
    if (!state.coachField) { state.coachField = true; coachDone('field'); }
    const f = FIELDERS[id]; sounds.throw();
    burst(f.x, 1, f.z, GRASS, 4, 3, 2);
    return true;
  }
  function stepFlight(dt) {
    const m = state.m, fl = state.fl;
    state.ft += dt;
    if (state.swing) { state.swing.t += dt; if (state.swing.t > 0.5) state.swing = null; }
    // the puck whistles
    state.whistle -= dt;
    if (state.whistle <= 0 && !state.stop) { const u = clampN(state.ft / fl.T, 0, 1); state.whistle = 0.11; tone({ freq: 620 + 420 * Math.sin(Math.PI * u), to: 560 + 380 * Math.sin(Math.PI * u), dur: 0.12, type: 'sine', vol: 0.03 }); }
    for (const q of state.throws) if (!q.fx && state.ft >= q.th) { q.fx = true; sounds.throw(); }
    if (state.stop) return;
    // a board meets the puck
    const due = [];
    for (const q of state.throws) {
      if (q.chk) continue;
      const f = FIELDERS[q.id], c = crossing(fl, f.z);
      if (c && state.ft >= c.t) { q.chk = true; if (boardStops(fl, q.th, f, m.level)) due.push({ q, c, f }); }
    }
    if (due.length) {
      due.sort((a, b) => a.c.t - b.c.t);
      const { c, f, q } = due[0];
      state.stop = { t: c.t, x: c.x, y: c.y, z: f.z, id: q.id };
      state.dropT = 0; sounds.clack();
      burst(c.x, c.y, f.z, WOOD.concat(GOLD), 18, 8, 3);
      finishFlight(resolveFlight(fl, state.throws, m.level));
      return;
    }
    if (state.ft >= fl.T) finishFlight(resolveFlight(fl, state.throws, m.level));
  }
  function finishFlight(res) {
    const m = state.m, fl = state.fl, bat = m.bat, calm = state.prefs.calm;
    state.vb = bat; // the camera and labels keep this side until the result is gone
    state.turn = applyStrike(m, res, fl);
    const nm = (i) => m.names[i], D = Math.round(fl.D);
    if (res.kind === 'stopped') {
      pop(res.x, res.y, res.z, 'Stopped!', '#ffe27a');
      say(`Stopped by line ${FIELDERS[res.id].r + 1}! The ${nm(1 - bat)} board meets the Nouss: no points.`);
    } else if (res.kind === 'landed') {
      sounds.thud(); sounds.nummer(res.points);
      burst(res.x, 0.3, res.z, GRASS.concat(GOLD), 16, 6, 3);
      pop(res.x, 0.5, res.z, `Nummer +${res.points}`, '#ffe27a');
      say(`Nummer! ${D} m for ${nm(bat)}: +${res.points}.`);
    } else if (res.kind === 'short') {
      sounds.miss(); pop(res.x, 0.5, Math.max(8, res.z), 'Too short', '#fff8e6');
      say(`${D} m: too short, the Nouss falls before the first line. No points.`);
    } else {
      sounds.miss(); pop(clampN(res.x, -RIES.half, RIES.half), 0.5, Math.min(res.z, RIES.len), 'Out of the Ries', '#ffb59a');
      say(Math.abs(fl.xL) > RIES.half ? 'Outside the side line: no points.' : 'Beyond the end of the Ries: no points.');
    }
    state.canHint = false; state.hintId = null; state.hintIds = []; state.hintTarget = null;
    state.ph = 'result'; state.wait = calm ? 1.0 : 1.7;
  }
  function afterResult() {
    const m = state.m;
    state.vb = null;
    if (m.done) { finishMatch(); return; }
    if (state.turn && state.turn.turnover) {
      state.ph = 'turnover'; state.wait = 2.0; state.fl = null; state.stop = null; state.throws = []; state.parts = []; state.pops = []; state.turn = null;
      say(m.bat === 0 ? (state.scene === 'play' ? 'Change over: now YOU strike.' : `Change over: ${m.names[0]} strike.`) : state.scene === 'play' ? 'Change over: now you FIELD.' : `Change over: ${m.names[m.bat]} strike.`);
      return;
    }
    beginStrike();
  }
  function finishMatch() {
    const m = state.m, auto = state.scene === 'autoplay';
    state.over = { winner: m.winner, youWon: !auto && m.winner === 0 };
    if (!auto) { state.stats.played++; if (m.winner === 0) state.stats.won++; saveStats(); }
    sounds.win(); say(m.winner < 0 ? 'The match is a draw.' : `${m.names[m.winner]} win the match.`);
    state.parts = []; state.pops = [];
    go(auto ? 'autoplay-over' : 'over');
  }

  // ---- buttons ------------------------------------------------------------------------------------------------------------------
  function useHint() {
    const m = state.m; if (!m || state.scene !== 'play') return;
    if (humanBats() && (state.ph === 'ready' || state.ph === 'hold')) {
      const h = hintStrike(m.level, m.wind);
      state.hintTarget = { x: h.x, D: h.D };
      const side = h.x < -1 ? 'left of centre' : h.x > 1 ? 'right of centre' : 'on the centre line', pts = pointsFor(h.D);
      say(`Hint: land it ${Math.abs(h.x).toFixed(0)} m ${side}, about ${Math.round(h.D)} m out (${pts} point${pts > 1 ? 's' : ''}): the boards cannot meet it. Aim into the wind.`);
    } else if (humanFields() && state.ph === 'flight' && state.fl) {
      const h = hintFielder(state.fl);
      if (h) { state.hintId = h.id; say('Hint: tap the lit fielder. The ring turns gold when it is time.'); } else say('Hint: no board can reach this one. Let it go.');
    }
  }
  function act(id) {
    const s = state;
    sounds.ui();
    if (id === 'new') go('setup');
    else if (id === 'about') { go('about'); s.aboutPage = 0; s.refFrom = 'title'; }
    else if (id === 'how') { go('how'); s.howPage = 0; s.refFrom = 'title'; }
    else if (id === 'rules') { go('rules'); s.rulesPage = 0; s.refFrom = 'title'; }
    else if (id === 'settings') go('settings');
    else if (id === 'restore') {
      if (s.restoreBusy || s.owned || !monetization) return;
      s.restoreBusy = true; s.restoreMsg = 'Checking with the store...';
      Promise.resolve(monetization.restore()).then(() => {
        s.owned = !!monetization.owns('unlock_game');
        s.restoreMsg = s.owned ? 'Purchase restored. Thank you!' : 'No earlier purchase found.';
      }).catch(() => { s.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { s.restoreBusy = false; });
    }
    else if (id === 'back') {
      if (s.scene === 'how' || s.scene === 'rules' || s.scene === 'about') {
        const to = s.refFrom || 'title'; go(to);
        if (to === 'play' || to === 'autoplay') s.menuOpen = true; // back to the Paused card, never straight into a live flight
      } else go('title');
    }
    else if (id === 'title') go('title');
    else if (id === 'page') s.scroll = 0;
    else if (id === 'textDec') { if (s.prefs.textScaleIdx > 0) { s.prefs.textScaleIdx--; savePrefs(); clampPages(); } }
    else if (id === 'textInc') { if (s.prefs.textScaleIdx < TEXT_SCALES.length - 1) { s.prefs.textScaleIdx++; savePrefs(); clampPages(); } }
    else if (id === 'start') startMatch();
    else if (id === 'autoplay') startAutoPlay();
    else if (id === 'apDec') { if (s.prefs.apThinkIdx > 0) { s.prefs.apThinkIdx--; savePrefs(); } }
    else if (id === 'apInc') { if (s.prefs.apThinkIdx < AP_THINK_STEPS.length - 1) { s.prefs.apThinkIdx++; savePrefs(); } }
    else if (id === 'appause') s.ap.paused = true;
    else if (id === 'apresume') s.ap.paused = false;
    else if (id.startsWith('first:')) s.setup.first = id.slice(6);
    else if (id.startsWith('lv:')) s.setup.level = id.slice(3);
    else if (id.startsWith('len:')) s.setup.len = Number(id.slice(4));
    else if (id.startsWith('venue:')) s.setup.venue = id.slice(6);
    else if (id.startsWith('set:')) { const k = id.slice(4); s.prefs[k] = !s.prefs[k]; savePrefs(); }
    else if (id === 'menu') { s.menuOpen = true; s.scroll = 0; }
    else if (id === 'resume') { s.menuOpen = false; s.scroll = 0; }
    else if (id === 'howmenu' || id === 'rulesmenu') { const from = s.scene; go(id === 'howmenu' ? 'how' : 'rules'); s.refFrom = from; s.howPage = 0; s.rulesPage = 0; }
    else if (id === 'leave') { s.fl = null; s.ph = 'ready'; go('title'); }
    else if (id === 'sound') { s.prefs.sound = !s.prefs.sound; savePrefs(); }
    else if (id === 'hint') useHint();
    else if (id === 'again') { if (s.scene === 'autoplay-over') startAutoPlay(); else startMatch(); }
  }
  function clampPages() { state.scroll = Math.min(state.scroll || 0, readerMax(state)); }

  // ---- the flow of a strike, one tick at a time ----------------------------------------------------------------------------------
  function flow(dt, input) {
    const m = state.m, ph = state.ph, h = state.hold;
    if (ph === 'flight') { stepFlight(dt); return; }
    if (ph === 'whip') {
      if (state.swing && state.swing.t >= WHIP_T) { const p = state.pend; state.pend = null; launch(p.pw, p.aimX, p.perfect, p.human, p.pre); }
      return;
    }
    if (ph === 'result') { if (state.stop) state.dropT += dt; state.wait -= dt; if (state.wait <= 0) afterResult(); return; }
    if (ph === 'turnover') { state.wait -= dt; if (state.wait <= 0) beginStrike(); return; }
    if (ph === 'apthink') {
      state.wait -= dt;
      if (state.wait <= 0) {
        state.ph = 'apreveal'; state.wait = AP_REVEAL; state.apShowPlan = true; state.hintIds = state.fPre.map((q) => q.id);
        const p = state.plan, pts = pointsFor(p.D), side = p.x < -1 ? 'left' : p.x > 1 ? 'right' : 'centre', n = state.fPre.length;
        say(`Target: ${Math.round(p.D)} m, ${side} of the Ries (${pts} point${pts > 1 ? 's' : ''}). ${n ? `${n} fielder${n > 1 ? 's' : ''} will read the flight and throw.` : 'No board can reach it.'}`);
      }
      return;
    }
    if (ph === 'apreveal') {
      state.wait -= dt;
      if (state.wait <= 0) { state.ph = 'windup'; state.wait = 0.7; state.windTotal = 0.7; state.hold = freshHold(state.plan.aimX, state.plan.D); }
      return;
    }
    if (ph === 'windup') {
      state.wait -= dt; const f = 1 - clampN(state.wait / (state.windTotal || 0.7), 0, 1), pw = state.plan ? state.plan.power : 0.6;
      h.tension = pw * f * f * (3 - 2 * f); h.aimX = state.plan ? state.plan.aimX : 0; h.D = state.plan ? state.plan.D : h.D;
      if (state.wait <= 0) release(pw, h.aimX, false, false, state.scene === 'autoplay' ? state.flPre : null);
      return;
    }
    if (ph === 'ready') {
      if (state.wait > 0) state.wait -= dt;
      if (state.scene === 'play' && m.bat === 1 && state.wait <= 0) {
        // the computer strikes: wind up, then release
        const pl = planStrike(m.level, rng, m.wind);
        state.plan = pl; state.ph = 'windup'; state.wait = 0.45 + 0.55 * pl.power; state.windTotal = state.wait;
        state.hold = freshHold(pl.aimX, pl.D);
        say(`${strikerName(m)} (${m.names[m.bat]}) winds up...`);
      }
      return;
    }
    if (ph === 'hold') {
      const ptr = input.pointer, down = ptr.down || state.kb;
      h.t += dt;
      const ten = tensionAt(h.t);
      h.rising = tensionAt(h.t + 0.01) >= ten;
      h.tension = ten;
      h.perfect = isPerfect(ten, h.rising);
      h.D = distanceFor(Math.max(ten, 0.12), h.perfect);
      if (!state.kb) {
        if (glRef && glRef.aimX) h.aimX = clampN(glRef.aimX(ptr.x, h.D), -RIES.half, RIES.half);
        else { const cam = camNow(); h.aimX = clampN(((ptr.x - cam.cx) / scaleAt(cam, h.D)) * (cam.dir > 0 ? 1 : -1), -RIES.half, RIES.half); }
      }
      if (h.perfect && !state.goldCue) { state.goldCue = true; sounds.gold(); } else if (!h.perfect) state.goldCue = false;
      state.holdSnd -= dt; if (state.holdSnd <= 0) { state.holdSnd = 0.1; sounds.hold(ten); }
      if (!down) {
        if (h.tension < 0.1) { state.ph = 'ready'; say('Hold a little longer to bend the rod, then let go.'); return; }
        release(h.tension, h.aimX, h.perfect, true, null);
      }
    }
  }

  // ---- showcase scenes (store screenshots only) ------------------------------------------------------------------------------------
  // main.js sets env.config.showcase in `?shot=1` mode only. A showcase is a real, legal position played by the real game code.
  function showMatch(opts) {
    state.m = newMatch({ level: 'normal', venue: opts.venue || 'emmental', len: opts.len || 8, humanBats: opts.bat !== false, rng });
    state.m.wind = opts.wind != null ? opts.wind : 0.8;
    state.m.score = opts.score || [0, 0];
    if (opts.strike) state.m.strike = opts.strike;
    state.prefs.guide = true; state.prefs.calm = false;
    go('play'); resetView(); beginStrike(); state.wait = 0; state.m.wind = opts.wind != null ? opts.wind : 0.8;
  }
  const SHOW = {
    hold() { showMatch({ score: [5, 3], strike: 3 }); state.ph = 'hold'; state.hold = { t: 1.0, tension: 0.9, rising: true, aimX: 3, D: distanceFor(0.9, true), perfect: true, down: true }; state.showcase = true; },
    ready() { showMatch({ score: [2, 2], strike: 2, venue: 'appenzell', wind: -1.1 }); state.showcase = true; },
    batflight() { showMatch({ score: [6, 4], strike: 4, venue: 'entlebuch' }); state.hold.tension = 0.8; state.fl = makeFlight(121, -6.8, 0.8); state.ft = 3.0; state.ph = 'flight'; state.throws = planFielding(state.fl, 'normal', rng).map((q) => mkThrow(q.id, q.th, 'ai')); state.showcase = true; },
    field() { showMatch({ bat: false, score: [4, 6], strike: 3 }); state.fl = makeFlight(112, 3.4, 0.6); state.ft = 2.3; state.ph = 'flight'; state.canHint = true; state.showcase = true; },
    now() { showMatch({ bat: false, score: [4, 6], strike: 3, venue: 'jura', wind: 1.3 }); state.fl = makeFlight(118, -4.0, 0.4); const c = crossing(state.fl, 105); state.ft = c.t - 0.5; state.ph = 'flight'; state.showcase = true; },
    stopped() {
      showMatch({ bat: false, score: [4, 6], strike: 3, venue: 'appenzell' });
      state.fl = makeFlight(118, -4.0, 0.4); const h = hintFielder(state.fl), c = crossing(state.fl, 105);
      state.ft = c.t - 0.55; state.ph = 'flight'; state.boardsLeft--; state.throws = [mkThrow(h.id, state.ft, 'you')]; state.ft = c.t - 0.001; stepFlight(0.002); state.dropT = 0.25; state.showcase = true;
    },
    nummer() { showMatch({ score: [7, 5], strike: 5 }); state.fl = makeFlight(142, 8.5, 0.2); state.ft = state.fl.T - 0.01; state.ph = 'flight'; stepFlight(0.02); state.wait = 5; state.showcase = true; },
    // moments of the strike for the 3D art review: `state.swing.t` is the seconds from the release
    wind1() { showMatch({ score: [3, 2], strike: 2 }); state.ph = 'hold'; state.hold = { t: 0.5, tension: 0.45, rising: true, aimX: 2, D: distanceFor(0.45, false), perfect: false, down: true }; state.showcase = true; },
    whip1() { showMatch({ score: [3, 2], strike: 2 }); state.ph = 'whip'; state.rel = { t0: 0.92 }; state.swing = { t: 0.07, t0: 0.92 }; state.showcase = true; },
    whip2() { showMatch({ score: [3, 2], strike: 2 }); state.ph = 'whip'; state.rel = { t0: 0.92 }; state.swing = { t: 0.15, t0: 0.92 }; state.showcase = true; },
    contact() { showMatch({ score: [3, 2], strike: 2 }); state.ph = 'whip'; state.rel = { t0: 0.92 }; state.swing = { t: 0.198, t0: 0.92 }; state.showcase = true; },
    follow() { showMatch({ score: [3, 2], strike: 2 }); state.rel = { t0: 0.92 }; state.fl = makeFlight(128, 2.5, 0.6); state.ft = 0.12; state.ph = 'flight'; state.showcase = true; },
    batthrow() { showMatch({ score: [6, 4], strike: 4 }); state.rel = { t0: 0.9 }; state.fl = makeFlight(118, -4.0, 0.4); const h = hintFielder(state.fl); state.throws = [mkThrow(h.id, h.at, 'ai')]; state.ft = h.at + 0.16; state.ph = 'flight'; state.showcase = true; },
    batstop() { showMatch({ score: [6, 4], strike: 4 }); state.rel = { t0: 0.9 }; state.fl = makeFlight(118, -4.0, 0.4); const h = hintFielder(state.fl); state.throws = [mkThrow(h.id, h.at, 'ai')]; state.ft = h.cross.t - 0.01; state.ph = 'flight'; stepFlight(0.02); state.dropT = 0.2; state.showcase = true; },
    icon() { showMatch({ score: [3, 2], strike: 2, venue: 'entlebuch' }); state.rel = { t0: 0.95 }; state.fl = makeFlight(130, 3, 0.4); state.ft = Number(new URLSearchParams(globalThis.location?.search || '').get('ift') ?? 0.05); state.ph = 'flight'; state.showcase = true; },
    fieldstart() { showMatch({ bat: false, score: [4, 6], strike: 3 }); state.ph = 'ready'; state.showcase = true; },
    fieldwhip() { showMatch({ bat: false, score: [4, 6], strike: 3 }); state.ph = 'whip'; state.rel = { t0: 0.85 }; state.swing = { t: 0.12, t0: 0.85 }; state.showcase = true; },
    fieldearly() { showMatch({ bat: false, score: [4, 6], strike: 3 }); state.fl = makeFlight(118, -4.0, 0.4); state.rel = { t0: 0.85 }; state.ft = 0.5; state.ph = 'flight'; state.showcase = true; },
    autoplay() { state.setup.venue = 'entlebuch'; startAutoPlay(); state.wait = 0.01; },
    over() { showMatch({ score: [14, 11], strike: 8 }); state.m.done = true; state.m.winner = 0; state.m.stopped = [6, 4]; state.m.long = [3, 2]; state.m.best = [152, 138]; state.stats.played = 4; state.stats.won = 2; finishMatch(); },
    setup() { go('setup'); },
    settings() { go('settings'); },
    rules() { go('rules'); state.jump = 4; },
    rules3() { go('rules'); state.prefs.textScaleIdx = 4; state.jump = 3; },
    how() { go('how'); state.jump = 1; },
    about() { go('about'); },
    title() { state.t = 8; },
  };
  function applyShowcase(name) { const f = SHOW[name]; if (f) f(); }

  const btnAt = (x, y) => screenButtons(state, lay()).find((b) => inRect(b, x, y) && (!b.clip || inRect(b.clip, x, y)));
  if (config.showcase) applyShowcase(config.showcase);

  return {
    update(dt, input) {
      const sc = state.scene, ptr = input.pointer, keys = input.keys.pressed, L = lay();
      if (sc === 'how' || sc === 'rules' || sc === 'about') clampPages(); // a rotation can change the scroll range
      const paused = sc === 'autoplay' && state.ap.paused;

      // pointer: buttons act on release (so a drag can scroll), the Ries reacts on press
      if (ptr.pressed) {
        const b = btnAt(ptr.x, ptr.y), afZone = sc === 'title' ? creditHit(L.title.lock) : null;
        state.press = { x: ptr.x, y: ptr.y, moved: false, s0: state.scroll, b: b && !b.dim ? b.id : null, af: Boolean(afZone && inRect(afZone, ptr.x, ptr.y)) };
        if (!b && sc === 'play' && !state.menuOpen && !state.showcase) {
          if (state.ph === 'ready' && humanBats() && state.wait <= 0) { state.ph = 'hold'; state.hold = freshHold(0, undefined, true); state.kb = false; state.hintTarget = null; state.press = null; state.goldCue = false; say('Slide to aim. Let go when the bar is in the gold.'); }
          else if (state.ph === 'flight' && humanFields()) { throwAt(ptr.x, ptr.y); state.press = null; }
        }
      }
      if (ptr.down && state.press) {
        const pr = state.press, dy = ptr.y - pr.y;
        if (Math.abs(dy) > 14 || Math.abs(ptr.x - pr.x) > 14) pr.moved = true;
        const sl = screenLayout(state, L), mx = sl ? sl.maxScroll : readerMax(state);
        if (pr.moved && mx > 0) state.scroll = Math.min(Math.max(pr.s0 - dy, 0), mx);
      }
      if (ptr.released && state.press) {
        const pr = state.press; state.press = null;
        if (!pr.moved && pr.b) { const b = btnAt(ptr.x, ptr.y); if (b && b.id === pr.b) act(b.id); }
        if (!pr.moved && pr.af && sc === 'title' && inRect(creditHit(L.title.lock), ptr.x, ptr.y)) env.openArcforgeHome?.();
      }
      // keyboard
      if (inPlay()) {
        if (keys.has('Escape')) { state.menuOpen = !state.menuOpen; state.scroll = 0; }
        if (!state.menuOpen && !paused && sc === 'play' && !state.showcase) {
          if (humanBats()) {
            const down = input.keys.down;
            if (state.ph === 'ready' && state.wait <= 0 && (keys.has('Space') || keys.has('Enter'))) { state.ph = 'hold'; state.kb = true; state.hold = freshHold(0, undefined, true); state.goldCue = false; say('Arrow keys aim. Let go of Space when the bar is in the gold.'); }
            if (state.ph === 'hold' && state.kb) {
              if (down.has('ArrowLeft')) state.hold.aimX = clampN(state.hold.aimX - 0.18, -RIES.half, RIES.half);
              if (down.has('ArrowRight')) state.hold.aimX = clampN(state.hold.aimX + 0.18, -RIES.half, RIES.half);
              if (!down.has('Space') && !down.has('Enter') && state.hold.t > 0.05) state.kb = false;
            }
          } else if (humanFields() && state.ph === 'flight' && (keys.has('Space') || keys.has('Enter'))) {
            const h = state.fl ? hintFielder(state.fl) : null; if (h) throwFielder(h.id);
          }
          if (keys.has('KeyH')) useHint();
        }
      } else {
        const sl = screenLayout(state, L);
        if (sl && sl.maxScroll > 0) { if (keys.has('ArrowDown')) state.scroll = Math.min(sl.maxScroll, (state.scroll || 0) + 80); if (keys.has('ArrowUp')) state.scroll = Math.max(0, (state.scroll || 0) - 80); }
        if (sc === 'how' || sc === 'about' || sc === 'rules') {
          const rmx = readerMax(state), set = (v) => { state.scroll = Math.max(0, Math.min(rmx, v)); };
          if (wheelInput.dy) { set((state.scroll || 0) + wheelInput.dy); wheelInput.dy = 0; }
          for (const [k, d] of [['ArrowDown', 80], ['ArrowUp', -80], ['PageDown', 500], ['PageUp', -500], ['Space', 500]]) if (keys.has(k)) set((state.scroll || 0) + d);
          if (keys.has('Home')) set(0); if (keys.has('End')) set(rmx);
          if (keys.has('Escape')) act('back');
        } else if (sl && wheelInput.dy) state.scroll = Math.max(0, Math.min(sl.maxScroll, (state.scroll || 0) + wheelInput.dy));
        wheelInput.dy = 0;
      }

      // everything below is the simulation: a paused Auto Play freezes ALL of it (timers, flights, particles)
      if (paused) return;
      state.t += dt;
      for (const p of state.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 14 * dt; if (p.y < 0) { p.y = 0; p.vy *= -0.3; } }
      state.parts = state.parts.filter((p) => p.life > 0);
      for (const p of state.pops) p.t += dt;
      state.pops = state.pops.filter((p) => p.t < 1.8);
      for (const e of state.sfx) e.t -= dt;
      for (const e of state.sfx.filter((q) => q.t <= 0)) audio.tone(e.o);
      state.sfx = state.sfx.filter((q) => q.t > 0);
      if (state.swing && state.ph !== 'flight' && !state.showcase) { state.swing.t += dt; if (state.swing.t > 0.5) state.swing = null; }
      if (inPlay() && !state.menuOpen && state.m && !state.showcase) flow(dt, input);
      if ((sc === 'over' || sc === 'autoplay-over') && state.over && state.t % 1.6 < dt) burst(fx.next() * 20 - 10, 8, 40 + fx.next() * 60, GOLD.concat(['#d93a2b']), 10, 6, 4);
    },
    render(ctx, view) {
      live.w = view?.width ?? meta.width; live.h = view?.height ?? meta.height;
      const L = layoutFor(live.w, live.h);
      // The kit's "Preview m:ss" pill must never sit on the scoreboard: in play it goes in the sky under the message plaque, on the right;
      // on every other screen it tucks into the top-right corner.
      const inMatch = state.scene === 'play' || state.scene === 'autoplay';
      meta.previewBadge = inMatch ? { x: L.U.x1 - 10, y: L.play.scene.y + 6, align: 'right' } : { x: L.U.x1 - 10, y: L.U.y0 + 4, align: 'right' };
      glRef = view && view.gl && view.gl.on ? view.gl : null;
      if (view && view.gl && view.gl.licenses && view.gl.licenses !== credits3d) { credits3d = view.gl.licenses; setCredits3d(credits3d); }
      draw(ctx, state, L, glRef);
    },
    getState: () => state,
    // Only real match play counts against the kit's free-preview timer. Menus, setup, settings, How/Rules/About, the pause menu,
    // result screens and Auto Play (a free teaching demo) are all exempt.
    isPreviewExempt: () => !(state.scene === 'play' && !state.menuOpen),
  };
}
