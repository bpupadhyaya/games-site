// Pearl Diving. State and flow. The season engine is in sim.js, drawing in hud.js / menus.js, the 3D presenter in web/view3d (it only reads getState()).
// Scenes: title, play (the season: S.phase says which screen), settings, journal, necklace, howto / about / rules, demolimit.
import { W, H, HUD, LY, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, READ, syncLayout, inRect, inCircle, setHudLayout, viewRegion } from './layout.js';
import * as K from './consts.js';
import * as sim from './sim.js';
import { TIPS, renderDive, renderSong, renderHaul, renderOpen, renderNecklace, diveRects, songRects, openRects, necklaceLayout, bedAt } from './hud.js';
import { titleView, drawFlatBackdrop, renderTitle, renderSea, renderSettings, renderDemoLimit, renderPause, renderHint, renderWatchEnd, renderWatchBar, renderPages, hitScreen, flowMeta, readerMeta, ensureLayout, resetMenus, resetPages, getLockTap, setLockDown } from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

export const meta = { width: W, height: H, fluid: { short: 720 }, previewBadge: { x: 700, y: 120, align: 'right' } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const THINK_STEPS = K.THINK_STEPS, REVEAL = K.REVEAL_SECS;

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  resetMenus();
  const fx = rng.fork();
  let shotMode = false, shotZoom = -1, noHud = false;
  try { shotMode = /[?&]shot=/.test(globalThis.location.search); } catch { shotMode = false; }
  try { const z = /[?&]zoom=(\d)/.exec(globalThis.location.search); if (z) shotZoom = Number(z[1]); } catch { shotZoom = -1; }
  try { noHud = /[?&]nohud/.test(globalThis.location.search); } catch { noHud = false; }
  const shotSeed = config.seed | 0;

  const state = {
    scene: 'title', back: 'title', has3d: false, t: 0, paused: false, pauseMenu: false, mode: 'play', v3: false, demo: !!config.demo, credits: '', shot: false, S: null,
    settings: { sound: true, music: true, textIdx: 0, thinkIdx: 1, tips: true },
    record: { seasons: 0, best: 0, bestStars: 0, bestPearl: 0, demoDays: 0, necklace: 0 },
    page: 0, resume: null, loaded: false, hint: null, watch: null, watchEnd: null, toast: '', toastT: 0, restoreMsg: '', selPearl: 0, ptr: { x: 0, y: 0, down: false },
    ui: { scroll: 0, drag: null }, viewRect: { x: 0, y: 0, w: W, h: H }, lyKey: '', lastPhase: '', seen: {}, songFx: 0, haulFx: 0, music: { next: 0, i: 0 }, warnT: -1,
  };

  // ---- persistence ---------------------------------------------------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  const persist = () => {
    const S = state.S; if (!S || state.mode !== 'play' || shotMode) return;
    const snap = JSON.parse(JSON.stringify(S)); snap.D = snap.H = snap.G = snap.O = null;
    if (['song', 'dive', 'divedone', 'haul', 'haulDone', 'open'].includes(snap.phase)) { snap.phase = 'plan'; snap.sum = { bank: null, shells: 0, gifted: 0, pearls: [], cost: 0, how: '', rest: false, ev: '', stam0: snap.stam }; snap.shells = []; }
    if (snap.phase === 'intro') return;
    state.resume = snap; storage.set('season', snap);
  };
  const clearResume = () => { state.resume = null; storage.remove('season'); };
  const validSave = (r) => !!r && typeof r.seed === 'number' && Array.isArray(r.journal) && Array.isArray(r.pearls) && !!r.phase && r.trip >= 0 && r.trip < K.TRIPS;
  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('season', null)]).then(([s, r, res]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    const st = state.settings; st.textIdx = clamp(st.textIdx | 0, 0, TEXT_SCALES.length - 1); st.thinkIdx = clamp(st.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (validSave(res) && !shotMode && res.phase !== 'season') state.resume = res;
    state.loaded = true; audio.setMuted?.(!st.sound);
  }).catch(() => { state.loaded = true; });

  // ---- sound ---------------------------------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 880, dur: 0.04, type: 'triangle', vol: 0.05 }),
    drum: () => tone({ freq: 120, to: 60, dur: 0.18, type: 'sine', vol: 0.2 }),
    clap: () => { tone({ freq: 1700, to: 900, dur: 0.05, type: 'square', vol: 0.05 }); tone({ freq: 200, to: 120, dur: 0.07, type: 'sine', vol: 0.1 }); },
    bubble: () => tone({ freq: 500 + fx.int(300), to: 1200, dur: 0.1, type: 'sine', vol: 0.04 }),
    splash: () => tone({ freq: 700, to: 120, dur: 0.5, type: 'sawtooth', vol: 0.03 }),
    pick: (q) => { tone({ freq: q === 'perfect' ? 1320 : 990, to: q === 'perfect' ? 1760 : 1100, dur: 0.14, type: 'triangle', vol: 0.09 }); },
    rough: () => tone({ freq: 180, to: 90, dur: 0.2, type: 'sawtooth', vol: 0.05 }),
    tug: () => { tone({ freq: 160, to: 100, dur: 0.15, type: 'square', vol: 0.06 }); },
    warn: () => tone({ freq: 440, to: 330, dur: 0.15, type: 'sine', vol: 0.06 }),
    chime: () => [0, 7, 12].forEach((n, i) => tone({ freq: 660 * Math.pow(2, n / 12), dur: 0.35 + i * 0.1, type: 'sine', vol: 0.07 })),
    pearl: () => [0, 4, 7, 12, 16].forEach((n, i) => tone({ freq: 784 * Math.pow(2, n / 12), dur: 0.45 + i * 0.08, type: 'sine', vol: 0.07 })),
    empty: () => tone({ freq: 220, to: 180, dur: 0.12, type: 'sine', vol: 0.04 }),
    coin: () => [0, 5].forEach((n, i) => tone({ freq: 1200 * Math.pow(2, n / 12), dur: 0.12 + i * 0.06, type: 'triangle', vol: 0.06 })),
    win: () => [0, 2, 4, 7, 9, 12].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.3 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  // a quiet work song: a five-note scale, a slow pulse, a different small variation every bar
  const SCALE = [0, 2, 4, 7, 9];
  const TUNE = [[0, 2, 4, 2], [4, 7, 4, 2], [0, 2, 0, -1], [-1, 0, 2, 0], [2, 4, 7, 9], [7, 4, 2, 4], [4, 2, 0, 2], [0, 0, -1, 0]];
  const music = (dt) => {
    const m = state.music; if (!state.settings.music || !state.settings.sound || state.paused || state.pauseMenu) return;
    if (!['title', 'play', 'journal', 'necklace'].includes(state.scene)) return;
    m.next -= dt; if (m.next > 0) return;
    const bar = TUNE[(m.i >> 2) % TUNE.length], n = bar[m.i % 4]; m.i++; m.next = 0.92;
    const deg = n < 0 ? SCALE[SCALE.length + n] - 12 : SCALE[n % 5] + (n >= 5 ? 12 : 0);
    audio.tone({ freq: 196 * Math.pow(2, deg / 12), dur: 0.8, type: 'sine', vol: 0.035 });
    if (m.i % 4 === 0) audio.tone({ freq: 98, dur: 1.4, type: 'sine', vol: 0.03 });
  };
  const toast = (text) => { state.toast = text; state.toastT = 2; };

  // ---- starting things --------------------------------------------------------------------------------------------------------------------------------------
  const resetUi = () => { state.ui.scroll = 0; state.ui.drag = null; state.hint = null; state.paused = false; state.pauseMenu = false; };
  const startSeason = (mode = 'play') => {
    if (mode === 'play' && state.demo && state.record.demoDays >= K.PREVIEW_DAYS_DEMO) { state.scene = 'demolimit'; resetUi(); return; }
    const S = sim.createSeason(fx.int(1 << 30) + 1, mode); state.S = S; state.mode = mode; state.seen = {}; state.watch = null; state.watchEnd = null;
    S.phase = 'intro'; state.scene = 'play'; state.lastPhase = ''; resetUi();
    if (mode === 'watch') { S.aiSkill = 0.85; sim.startSeason(S); sim.chooseProv(S, 1); }
  };
  const resumeSeason = () => {
    if (!state.resume) return;
    if (state.demo && state.record.demoDays >= K.PREVIEW_DAYS_DEMO) { clearResume(); state.scene = 'demolimit'; return; }
    state.S = JSON.parse(JSON.stringify(state.resume)); state.mode = 'play'; state.seen = {}; state.scene = 'play'; state.lastPhase = ''; state.watchEnd = null; resetUi();
    if (!state.S.sum) state.S.sum = { bank: null, shells: 0, gifted: 0, pearls: [], cost: 0, how: '', rest: false, ev: '', stam0: state.S.stam };
  };
  const leaveGame = () => {
    persist();
    state.scene = 'title'; resetUi(); state.watch = null; state.watchEnd = null; if (state.mode === 'watch') state.S = null; state.mode = 'play';
  };
  const finishSeason = () => {
    const S = state.S, rec = state.record;
    if (state.mode === 'play' && S.score) {
      rec.seasons++; rec.best = Math.max(rec.best, S.score.total); rec.bestStars = Math.max(rec.bestStars, S.score.stars); rec.bestPearl = Math.max(rec.bestPearl, S.bestPearl); rec.necklace = Math.max(rec.necklace, S.score.necklace.worth);
      clearResume(); save(); sfx.win();
    }
  };

  // ---- the coach (Think) and Watch & Learn ---------------------------------------------------------------------------------------------------------
  const openHint = () => {
    const S = state.S; if (!S) return;
    const h = sim.coach(S); if (!h) { toast('Nothing to think about right now'); return; }
    state.hint = h; state.ui.scroll = 0; sfx.tick();
  };
  const closeHint = () => { state.hint = null; state.ui.scroll = 0; };
  const applyHint = () => {
    const S = state.S, h = state.hint; if (!h || !S) { closeHint(); return; }
    if (h.kind === 'plan' && h.pick) { if (sim.choosePlan(S, h.pick) && state.demo && state.mode === 'play') { state.record.demoDays++; save(); } }
    else if (h.kind === 'dive' && S.D) { if (h.signal) sim.diveSignal(S, S.D); else if (h.bed >= 0) sim.diveGo(S.D, h.bed); }
    closeHint();
  };
  // Watch & Learn: the AI plays a sample two days. Decisions go THINK (configurable) -> REVEAL (2 s) -> ACT; the clap, the pulls and the opening are performed without a pause.
  const W0 = () => ({ phase: 'think', t: 0, dur: THINK_STEPS[state.settings.thinkIdx], key: '', text: '', choice: '', bed: -1 });
  const watchDecision = (key, text, extra, act, dt) => {
    let w = state.watch;
    if (!w || w.key !== key) { w = state.watch = { ...W0(), key, text, ...extra }; }
    w.t += dt;
    if (w.phase === 'think' && w.t >= w.dur) { w.phase = 'reveal'; w.t = 0; }
    else if (w.phase === 'reveal' && w.t >= REVEAL) { act(); state.watch = { ...W0(), phase: 'act', key: 'act', text: w.text, dur: 0 }; return true; }
    return false;
  };
  const caption = (text) => { const w = state.watch; if (!w || w.phase !== 'act' || w.key === '' || w.key === 'act') state.watch = { ...W0(), phase: 'act', key: '', text, dur: 0 }; else state.watch.text = text; if (state.watch.key === 'act') { state.watch.key = ''; state.watch.text = text; } };
  let watchWait = 0;
  const watchStep = (dt) => {
    const S = state.S; if (!S) return;
    if (state.paused) return;
    switch (S.phase) {
      case 'plan': {
        const h = sim.coach(S);
        watchDecision(`plan${S.dayNo}`, h.lines.join(' '), { choice: h.pick === 'rest' ? 'plan-rest' : `plan-${h.pick}` }, () => { sim.choosePlan(S, h.pick); }, dt);
        break;
      }
      case 'song': {
        const G = S.G; caption('Khalifa calls a pattern. The crew claps it back on the same beats.');
        if (G.step === 'answer') { const R0 = G.rounds[G.round]; R0.pat.forEach((s, i) => { if (!R0.hits.some((h) => h.i === i) && G.st >= s * G.beat) sim.songTap(S); }); }
        if (G.done) sim.finishSong(S);
        break;
      }
      case 'dive': {
        const D = S.D; sim.aiTick(S, D);
        if (D.phase === 'breath') caption('Breathing in slowly, and letting go in the green band for the most air.');
        else if (D.phase === 'descend') caption('Down the rope on the stone.');
        else if (D.phase === 'ascend') caption('Signalled in time, so the puller hauls up calmly.');
        else if (D.phase === 'bottom') {
          const pl = D.tx === null && !D.pick ? sim.aiPlan(D) : null;
          if (pl && (pl.kind === 'bed' || pl.kind === 'signal')) {
            const key = `d${S.dayNo}-${D.basket.length}-${D.beds.reduce((a, b) => a + b.left, 0)}-${pl.kind}${pl.bed ?? ''}`;
            const text = pl.kind === 'signal' ? `Breath ${Math.round(D.breath)} s. The way up needs ${D.ta.toFixed(0)} s plus a safety margin. Time to signal.` : `Breath ${Math.round(D.breath)} s. The best bed within reach has ${D.beds[pl.bed].left} shell${D.beds[pl.bed].left === 1 ? '' : 's'}${D.beds[pl.bed].old ? ' and is an old shell' : ''}.`;
            watchDecision(key, text, { bed: pl.kind === 'bed' ? pl.bed : -1 }, () => sim.aiAct(S, D, pl), dt);
            return;
          }
          caption(D.pick ? 'Picking the shell as the ring closes.' : D.tx !== null ? 'Swimming to the next bed.' : 'Waiting for the ring to meet the mark.');
        }
        break;
      }
      case 'divedone': watchWait += dt; caption('Back on deck with the basket.'); if (watchWait > 2.4) { watchWait = 0; sim.startHaul(S); } break;
      case 'haul': {
        const H0 = S.H; caption('Pull on the beat, hand over hand. Steady pulls keep Salim calm.');
        if (H0.phase === 'haul' && !H0.done) { const e = Math.min(H0.ph * sim.PULL, (1 - H0.ph) * sim.PULL); if (e < 0.04 && H0.T - (H0.lastT ?? -1) > 0.3) { sim.haulTap(S); H0.lastT = H0.T; } }
        break;
      }
      case 'haulDone': watchWait += dt; caption('Salim is up.'); if (watchWait > 2.0) { watchWait = 0; sim.startOpen(S); } break;
      case 'open': {
        const O = S.O; caption('Opening the shells. Old, pale shells hold pearls more often.');
        if (O.state === 'ready') sim.openTap(S); else if (O.state === 'show' && O.t > (O.cur && O.cur.pearl ? 1.8 : 0.9)) sim.openTap(S);
        if (O.state === 'summary') sim.endOpen(S);
        break;
      }
      case 'tale': {
        watchWait += dt; caption(S.ev && S.chosen < 0 ? 'An evening tale. The choices change money, spirit or standing.' : 'The tale is told.');
        if (S.chosen < 0 && S.ev && S.ev.choices.length) { if (watchWait > 3) { const c = S.ev.choices.find((x) => x.ok); if (c) sim.chooseTale(S, c.i); watchWait = 0; } }
        else if (watchWait > 2.8) { watchWait = 0; sim.endTale(S); }
        break;
      }
      case 'daysum': watchWait += dt; caption('The day is done.'); if (watchWait > 2.6) { watchWait = 0; if (S.dayNo >= 1) { state.watchEnd = { days: S.dayNo + 1, pearls: S.pearls.length, shells: S.shellsTotal }; state.watch = null; } else sim.endDay(S); } break;
      default: break;
    }
  };

  // ---- events from the sim: sounds ------------------------------------------------------------------------------------------------------------------------
  const consume = (src, key, f) => { if (!src || !src.ev) return; const seen = state.seen[key] ?? 0; let max = seen; for (const e of src.ev) { if (e.id <= seen) continue; max = Math.max(max, e.id); f(e); } state.seen[key] = max; };
  const sounds = (S) => {
    consume(S.G, 'G', (e) => { if (e.type === 'call') sfx.drum(); else if (e.type === 'perfect' || e.type === 'good') { sfx.clap(); state.songFx = state.t; } else if (e.type === 'extra') { sfx.rough(); state.songFx = state.t; } });
    consume(S.D, 'D', (e) => { if (e.type === 'release') sfx.splash(); else if (e.type === 'land' || e.type === 'arrive') sfx.bubble(); else if (e.type === 'got') sfx.pick(e.q); else if (e.type === 'broke') sfx.rough(); else if (e.type === 'signal') sfx.tug(); });
    consume(S.H, 'H', (e) => { if (e.type === 'tug') sfx.tug(); else if (e.type === 'pull') { sfx.clap(); state.haulFx = state.t; } });
    consume(S.O, 'O', (e) => { if (e.type === 'cut') sfx.rough(); else if (e.type === 'pearl') sfx.pearl(); else if (e.type === 'empty') sfx.empty(); });
    if (S.D && S.D.warn && S.D.phase === 'bottom' && Math.floor((S.clock || 0) * 2) !== state.warnT) { state.warnT = Math.floor((S.clock || 0) * 2); sfx.warn(); }
  };

  // ---- the play scene ---------------------------------------------------------------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) { const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)); state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
  }
  const updateFlow = (input, key, handler) => {
    const ptr = input.pointer;
    ensureLayout(state, key);
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) { const d = state.ui.drag; state.ui.drag = null; if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll)); else { const lay = flowMeta(); if (!(lay.lay && lay.lay.contentH > lay.bottom - lay.top)) handler(hitScreen(d.x0, d.y0, state.ui.scroll)); } }
    const mt = flowMeta(), max = mt && mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };
  const openPause = () => { if (state.scene !== 'play' || state.mode !== 'play') return; state.pauseMenu = true; state.ui.scroll = 0; };
  const closePause = () => { state.pauseMenu = false; state.ui.scroll = 0; };
  const handlePauseTap = (id) => {
    if (!id) return; sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.page = 0; } else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.page = 0; }
    else if (id === 'p-journal') { state.back = 'play'; state.scene = 'journal'; state.page = 0; } else if (id === 'p-neck') { state.back = 'play'; state.scene = 'necklace'; state.ui.scroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'quit') leaveGame();
  };
  const handleFlow = (S, id) => {
    if (!id) return; sfx.tick();
    switch (S.phase) {
      case 'intro': if (id === 'intro-go') sim.startSeason(S); else if (id === 'intro-back') leaveGame(); break;
      case 'prov': if (/^prov\d$/.test(id)) { sim.chooseProv(S, Number(id.slice(4))); persist(); } break;
      case 'plan':
        if (id.startsWith('plan-')) {
          if (state.mode === 'play' && state.demo && state.record.demoDays >= K.PREVIEW_DAYS_DEMO) { clearResume(); state.scene = 'demolimit'; return; }
          if (sim.choosePlan(S, id.slice(5))) { if (state.demo && state.mode === 'play') { state.record.demoDays++; save(); } } else toast('Not today');
        }
        break;
      case 'tale': if (/^tale\d$/.test(id)) sim.chooseTale(S, Number(id.slice(4))); else if (id === 'tale-next') sim.endTale(S); break;
      case 'daysum':
        if (id === 'ds-next') { if (sim.endDay(S) === 'harbour') toast('Muharraq at last'); } else if (id === 'ds-neck') { state.back = 'play'; state.scene = 'necklace'; state.ui.scroll = 0; } else if (id === 'ds-journal') { state.back = 'play'; state.scene = 'journal'; state.page = 0; }
        break;
      case 'divedone': if (id === 'dd-next') sim.startHaul(S); break;
      case 'haulDone': if (id === 'hd-next') sim.startOpen(S); break;
      case 'trade':
        if (id.startsWith('pr')) sim.tradeToggle(S, Number(id.slice(2)));
        else if (id === 'tr-neck') { state.back = 'play'; state.scene = 'necklace'; state.ui.scroll = 0; }
        else if (id === 'tr-go') { sim.tradeConfirm(S); sfx.coin(); }
        break;
      case 'budget': {
        const m = /^b-(debt|fam)-(dec|inc|max|need)$/.exec(id);
        if (m) { const [, k, a] = m; if (a === 'dec') sim.budgetStep(S, k, -1); else if (a === 'inc') sim.budgetStep(S, k, 1); else if (a === 'max') sim.budgetAll(S, k); else if (a === 'need') { S.B.fam = 0; S.B.fam = Math.min(Math.max(0, K.FAMILY_NEED - S.famCredit), Math.max(0, sim.budgetLeft(S))); } }
        else if (id === 'b-gift') { S.B.gift = S.B.gift ? 0 : K.GIFT; if (sim.budgetLeft(S) < 0) S.B.gift = 0; }
        else if (id === 'b-go') { sim.budgetConfirm(S); sfx.coin(); }
        break;
      }
      case 'season':
        if (id === 'se-again') startSeason(); else if (id === 'se-menu') { state.scene = 'title'; state.S = null; resetUi(); } else if (id === 'se-neck') { state.back = 'play'; state.scene = 'necklace'; state.ui.scroll = 0; } else if (id === 'se-journal') { state.back = 'play'; state.scene = 'journal'; state.page = 0; }
        break;
      default: break;
    }
  };
  const FLOWS = ['intro', 'prov', 'plan', 'tale', 'daysum', 'divedone', 'haulDone', 'trade', 'budget', 'season'];
  const updatePlay = (dt, input) => {
    const S = state.S, ptr = input.pointer, keys = input.keys, watch = state.mode === 'watch';
    if (!S) { state.scene = 'title'; return; }
    if (state.toastT > 0) { state.toastT -= dt; if (state.toastT <= 0) state.toast = ''; }
    if (state.pauseMenu) { updateFlow(input, 'pause', handlePauseTap); if (keys.pressed.has('Escape')) closePause(); return; }
    if (state.hint) { updateFlow(input, 'hint', (id) => { if (id === 'hint-do') applyHint(); else if (id === 'hint-close') closeHint(); }); return; }
    if (state.watchEnd) { updateFlow(input, 'watchend', (id) => { if (id === 'again') startSeason('watch'); else if (id === 'menu') leaveGame(); }); return; }
    if (ptr.pressed && !watch) {
      if (inRect(HUD.menu, ptr.x, ptr.y)) { sfx.tick(); openPause(); return; }
      if (inRect(HUD.think, ptr.x, ptr.y) && S.phase !== 'intro') { openHint(); return; }
    }
    if (watch) {
      if (ptr.pressed) {
        if (inRect(state.watchPauseRect, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); return; }
        if (inRect(state.watchQuitRect, ptr.x, ptr.y)) { leaveGame(); return; }
      }
      if (keys.pressed.has('Space') || keys.pressed.has('KeyP')) state.paused = !state.paused;
      if (keys.pressed.has('Escape')) { leaveGame(); return; }
    } else if (keys.pressed.has('Escape')) { openPause(); return; } else if (keys.pressed.has('KeyT')) { openHint(); return; }
    if (state.paused) return;
    if (FLOWS.includes(S.phase) && !watch) updateFlow(input, S.phase, (id) => handleFlow(S, id));
    if (!watch) actions(input, S);
    if (watch) watchStep(dt);
    sim.tick(S, dt);
    sounds(S);
    if (S.phase === 'song' && S.G && S.G.done && !watch) sim.finishSong(S);
    if (S.phase === 'open' && S.O && S.O.state === 'summary' && !watch) sim.endOpen(S);
    if (S.phase !== state.lastPhase) {
      state.lastPhase = S.phase; state.ui.scroll = 0; state.ui.drag = null; state.seen = {};
      if (['plan', 'trade', 'budget', 'prov', 'daysum', 'tale'].includes(S.phase)) persist();
      if (S.phase === 'season') finishSeason();
    }
  };
  function actions(input, S) {
    const ptr = input.pointer, keys = input.keys, safe = !inRect(HUD.menu, ptr.x, ptr.y) && !inRect(HUD.think, ptr.x, ptr.y) && !inRect(HUD.strip, ptr.x, ptr.y);
    if (S.phase === 'song' && S.G) {
      const rc = songRects();
      if (ptr.pressed && inRect(rc.skip, ptr.x, ptr.y)) { sfx.tick(); sim.finishSong(S, true); return; }
      if ((ptr.pressed && safe) || keys.pressed.has('Space')) sim.songTap(S);
    } else if (S.phase === 'dive' && S.D) {
      const D = S.D, rc = diveRects();
      if (D.phase === 'breath') {
        const down = (ptr.down && inCircle(rc.breathe, ptr.x, ptr.y)) || keys.down.has('Space');
        sim.diveHold(D, down);
      } else if (D.phase === 'bottom') {
        if (ptr.pressed) {
          if (inRect(rc.signal, ptr.x, ptr.y)) sim.diveSignal(S, D);
          else if (inCircle(rc.pick, ptr.x, ptr.y)) sim.divePick(D);
          else { const b = bedAt(state, ptr.x, ptr.y); if (b >= 0) sim.diveGo(D, b); }
        }
        if (keys.pressed.has('Space')) sim.divePick(D);
        if (keys.pressed.has('KeyS')) sim.diveSignal(S, D);
        if (keys.pressed.has('ArrowRight') || keys.pressed.has('ArrowLeft')) { const dir = keys.pressed.has('ArrowRight') ? 1 : -1; let best = -1, bd = 99; D.beds.forEach((b, i) => { if (b.left > 0 && (b.x - D.x) * dir > 0.05 && Math.abs(b.x - D.x) < bd) { bd = Math.abs(b.x - D.x); best = i; } }); if (best >= 0) sim.diveGo(D, best); }
      }
    } else if (S.phase === 'haul' && S.H) {
      if ((ptr.pressed && safe) || keys.pressed.has('Space')) { if (S.H.phase === 'haul') sim.haulTap(S); }
    } else if (S.phase === 'open' && S.O) {
      const rc = openRects();
      if (ptr.pressed && inRect(rc.all, ptr.x, ptr.y)) { sim.openAll(S); sfx.tick(); }
      else if ((ptr.pressed && safe) || keys.pressed.has('Space') || keys.pressed.has('Enter')) sim.openTap(S);
    }
  }

  // ---- menus --------------------------------------------------------------------------------------------------------------------------------------------------------
  const handleTitle = (id) => {
    if (!id) return; sfx.tick();
    if (id === 'play') startSeason(); else if (id === 'continue') resumeSeason();
    else if (id === 'watch') startSeason('watch');
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.page = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return; const st = state.settings; sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); } else if (id === 'set-music') st.music = !st.music; else if (id === 'set-tips') st.tips = !st.tips;
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1); else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1); else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') { state.restoreMsg = 'Checking with the store...'; Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; }); }
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    save();
  };
  function updateFlowScene(input, handler, key) {
    updateFlow(input, key, handler);
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
  }
  const backFrom = () => { state.scene = state.back === 'play' && state.S ? 'play' : 'title'; state.page = 0; state.ui.drag = null; };
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys, R = readerMeta();
    const close = () => backFrom();
    const setS = (v) => { state.page = clamp(v, 0, R.max); };
    const zoom = (d) => { state.settings.textIdx = clamp(state.settings.textIdx + d, 0, TEXT_SCALES.length - 1); state.page = 0; resetPages(); save(); };
    if (ptr.pressed) {
      if (inRect(REF_NEXT, ptr.x, ptr.y)) { if (state.page >= R.max - 4) close(); else setS(state.page + R.view * 0.85); state.ui.drag = null; }
      else if (inRect(REF_BACK, ptr.x, ptr.y)) close();
      else if (inRect(TEXT_DEC, ptr.x, ptr.y)) zoom(-1); else if (inRect(TEXT_INC, ptr.x, ptr.y)) zoom(1);
      else if (R.max > 0 && ptr.x >= READ.bar.x - 14 && ptr.x <= READ.bar.x + READ.bar.w + 14 && ptr.y >= READ.view.y && ptr.y <= READ.view.y + READ.view.h) state.ui.drag = { bar: true };
      else state.ui.drag = { y0: ptr.y, s0: state.page };
    }
    if (state.ui.drag && state.ui.drag.bar && ptr.down) setS(((ptr.y - READ.view.y) / READ.view.h) * R.max);
    else if (state.ui.drag && ptr.down) setS(state.ui.drag.s0 - (ptr.y - state.ui.drag.y0));
    if (ptr.released) state.ui.drag = null;
    if (state.wheel) { setS(state.page + state.wheel); state.wheel = 0; }
    if (keys.down.has('ArrowDown')) setS(state.page + 36); if (keys.down.has('ArrowUp')) setS(state.page - 36);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) setS(state.page + R.view * 0.85); if (keys.pressed.has('PageUp')) setS(state.page - R.view * 0.85);
    if (keys.pressed.has('End')) setS(R.max); if (keys.pressed.has('Home')) setS(0);
    if (keys.pressed.has('Equal') || keys.pressed.has('NumpadAdd')) zoom(1); if (keys.pressed.has('Minus') || keys.pressed.has('NumpadSubtract')) zoom(-1);
    if (keys.pressed.has('Escape')) close();
  };
  const updateNecklace = (input) => {
    const S = state.S, ptr = input.pointer; if (!S) { state.scene = 'title'; return; }
    const L = necklaceLayout(state), T = L.tray, max = Math.max(0, L.rows * L.cell - (T.h - 60));
    if (ptr.pressed) {
      state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0, x0: ptr.x };
      if (inRect(L.btns.done, ptr.x, ptr.y)) { backFrom(); state.ui.drag = null; return; }
      if (inRect(L.btns.arrange, ptr.x, ptr.y)) { sim.necklaceArrange(S); sfx.chime(); state.ui.drag = null; return; }
      if (inRect(L.btns.clear, ptr.x, ptr.y)) { [...S.necklace].forEach((id) => sim.necklaceRemove(S, id)); sfx.tick(); state.ui.drag = null; return; }
    }
    if (state.ui.drag && ptr.down && inRect(T, state.ui.drag.x0, state.ui.drag.y0)) { state.ui.drag.moved = Math.max(state.ui.drag.moved, Math.abs(ptr.y - state.ui.drag.y0)); if (state.ui.drag.moved > 10) state.ui.scroll = clamp(state.ui.drag.s0 - (ptr.y - state.ui.drag.y0), 0, max); }
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      if (d.moved < 10) {
        const sc = clamp(state.ui.scroll, 0, max);
        const g = L.grid.find((it) => Math.hypot(it.x - ptr.x, it.y - sc - ptr.y) <= Math.max(it.r + 8, 26));
        if (g && inRect(T, ptr.x, ptr.y)) { if (sim.necklaceAdd(S, g.p.id)) { sfx.pearl(); state.selPearl = g.p.id; } else toast('The string is full'); return; }
        const s = L.slots.find((q, i) => L.pearls[i] && Math.hypot(q.x - ptr.x, q.y - ptr.y) <= 30);
        if (s) { const p = L.pearls[s.i]; if (state.selPearl === p.id) { sim.necklaceRemove(S, p.id); state.selPearl = 0; sfx.tick(); } else state.selPearl = p.id; }
      }
    }
    if (input.keys.pressed.has('Escape')) backFrom();
  };

  // ---- shot presets: ?shot=1&seed=N picks a fixed, deterministic screen ----------------------------------------------------------------------------------------------------------
  const autoplayUntil = (S, stop, max = 400000) => {
    let g = 0;
    while (!stop(S) && g++ < max && S.phase !== 'season') {
      switch (S.phase) {
        case 'intro': sim.startSeason(S); break;
        case 'prov': sim.chooseProv(S, 1); break;
        case 'plan': { const h = sim.coach(S); if (!sim.choosePlan(S, h.pick)) sim.choosePlan(S, 'rest'); break; }
        case 'song': { const G = S.G; sim.songStep(S, 1 / 30); if (G.step === 'answer') { const R0 = G.rounds[G.round]; R0.pat.forEach((sl, i) => { if (!R0.hits.some((h) => h.i === i) && G.st >= sl * G.beat) sim.songTap(S); }); } if (G.done) sim.finishSong(S); break; }
        case 'dive': sim.aiTick(S, S.D); sim.diveStep(S, 1 / 30); S.clock = (S.clock || 0) + 1 / 30; break;
        case 'divedone': sim.startHaul(S); break;
        case 'haul': { const H0 = S.H; sim.haulStep(S, 1 / 30); if (H0.phase === 'haul' && !H0.done) { const e = Math.min(H0.ph * sim.PULL, (1 - H0.ph) * sim.PULL); if (e < 0.05 && H0.T - (H0.lastT ?? -1) > 0.3) { sim.haulTap(S); H0.lastT = H0.T; } } break; }
        case 'haulDone': sim.startOpen(S); break;
        case 'open': { const O = S.O; if (O.state === 'ready') sim.openTap(S); else if (O.state === 'show' && O.t > 1.0) sim.openTap(S); sim.openStep(S, 1 / 30); if (O.state === 'summary') sim.endOpen(S); break; }
        case 'tale': if (S.chosen < 0 && S.ev.choices.length) sim.chooseTale(S, 0); sim.endTale(S); break;
        case 'daysum': sim.endDay(S); break;
        case 'trade': sim.tradeConfirm(S); break;
        case 'budget': sim.budgetAll(S, 'fam'); sim.budgetAll(S, 'debt'); sim.budgetConfirm(S); break;
        default: break;
      }
    }
    return S;
  };
  const shotS = (stop, aiSkill = 0.8) => { const S = sim.createSeason(shotSeed * 7919 + 13); S.aiSkill = aiSkill; state.S = S; state.mode = 'play'; state.scene = 'play'; autoplayUntil(S, stop); state.lastPhase = S.phase; return S; };
  const applyPreset = () => {
    state.shot = true; state.settings.tips = false;
    if (shotZoom >= 0 && shotZoom < TEXT_SCALES.length) state.settings.textIdx = shotZoom;
    const n = ((shotSeed % 100) + 100) % 100;
    const keepNecklace = (S, k = 7) => { sim.trayPearls(S).sort((a, b) => b.value - a.value).slice(0, k).forEach((p) => sim.necklaceAdd(S, p.id)); sim.necklaceArrange(S); };
    const trade = () => shotS((S) => S.phase === 'trade');
    switch (n) {
      case 1: state.scene = 'title'; return;
      case 2: shotS((S) => S.phase === 'plan' && S.dayNo === 2); return;
      case 3: { const S = shotS((q) => q.phase === 'dive' && q.dayNo === 2); S.D.held = true; S.D.began = true; S.D.g = 0.78; return; }
      case 4: shotS((S) => S.phase === 'dive' && S.dayNo >= 2 && S.D.phase === 'bottom' && S.D.basket.length >= 2 && !S.D.pick && S.D.at >= 0 && S.D.beds[S.D.at].left > 0); return;
      case 5: shotS((S) => S.phase === 'dive' && S.dayNo >= 2 && S.D.phase === 'descend' && S.D.pt > 1.4); return;
      case 6: shotS((S) => S.phase === 'song' && S.G.step === 'answer' && S.G.st > 1.6); return;
      case 7: shotS((S) => S.phase === 'haul' && S.H.phase === 'haul' && S.H.prog >= 3); return;
      case 8: shotS((S) => S.phase === 'open' && S.O.state === 'show' && !!S.O.cur && !!S.O.cur.pearl && S.O.t > 0.7); return;
      case 9: shotS((S) => S.phase === 'tale' && !!S.ev && S.ev.choices.length > 0 && S.chosen < 0); return;
      case 10: keepNecklace(trade(), 2); return;
      case 11: { const S = trade(); keepNecklace(S, 9); state.scene = 'necklace'; state.back = 'play'; state.selPearl = S.necklace[4]; return; }
      case 12: shotS((S) => S.phase === 'season'); return;
      case 13: state.back = 'title'; state.scene = 'rules'; state.page = 0; return;
      case 14: state.back = 'title'; state.scene = 'howto'; return;
      case 15: state.back = 'title'; state.scene = 'about'; return;
      case 16: shotS((S) => S.phase === 'plan' && S.dayNo === 3); state.scene = 'journal'; state.back = 'play'; return;
      case 17: { startSeason('watch'); const S = state.S; autoplayUntil(S, (q) => q.phase === 'dive' && q.D.phase === 'bottom' && q.D.basket.length >= 1 && !q.D.pick); state.watch = { phase: 'think', t: 2, dur: 5, key: 'x', text: 'Breath 21 s. The best bed within reach has 2 shells and is an old shell.', choice: '', bed: S.D ? sim.bestBed(S.D) : -1 }; return; }
      case 18: state.scene = 'settings'; return;
      case 19: shotS((S) => S.phase === 'daysum' && S.dayNo === 2); return;
      case 20: startSeason(); return;
      case 21: shotS((S) => S.phase === 'budget'); return;
      case 22: shotS((S) => S.phase === 'prov' && !!S.started); return;
      case 23: shotS((S) => S.phase === 'plan' && S.dayNo === 2); state.pauseMenu = true; return;
      case 24: { const S = shotS((q) => q.phase === 'plan' && q.dayNo === 2); state.hint = sim.coach(S); return; }
      case 25: shotS((S) => S.phase === 'divedone'); return;
      case 26: shotS((S) => S.phase === 'dive' && S.dayNo >= 1 && S.D.phase === 'ascend' && S.D.pt > 1); return;
      case 27: shotS((S) => S.phase === 'haul' && S.H.phase === 'wait' && S.H.t > 1.2); return;
      case 28: shotS((S) => S.phase === 'open' && S.O.state === 'ready' && S.O.i === 1); return;
      case 33: state.settings.textIdx = 4; state.back = 'title'; state.scene = 'rules'; state.page = 3000; return;
      case 34: state.settings.textIdx = 4; shotS((S) => S.phase === 'plan' && S.dayNo === 2); return;
      case 35: state.settings.textIdx = 4; state.scene = 'title'; return;
      case 36: state.settings.textIdx = 4; shotS((S) => S.phase === 'tale' && !!S.ev && S.ev.choices.length > 0 && S.chosen < 0); return;
      case 37: state.settings.textIdx = 4; keepNecklace(trade(), 1); return;
      case 38: state.settings.textIdx = 4; state.scene = 'settings'; return;
      case 39: state.settings.textIdx = 4; shotS((S) => S.phase === 'dive' && S.D.phase === 'bottom' && S.D.basket.length >= 2); return;
      default: state.scene = 'title';
    }
  };

  // ---- the object the kit and the shell see --------------------------------------------------------------------------------------------------------------------------------------
  const aboutList = () => state.creditsList ?? ABOUT;
  const journalList = () => {
    const S = state.S;
    if (!S || !S.journal.length) return [{ title: 'Journal', p: ['Your journal fills as the season goes: where you dived, what the shells held, who you met, what you repaid. Begin a season to start writing it.'] }];
    return S.journal.map((e) => ({ title: e.title || (e.tp === 'harbour' ? 'In the harbour' : `Trip ${e.trip + 1}`), p: e.lines.length ? e.lines : ['...'] })).reverse();
  };
  function relayout() {
    syncLayout(meta.width, meta.height); setHudLayout(state.settings.textIdx);
    if (state.lyKey !== LY.key) {
      if (state.lyKey) { state.ui.drag = null; resetPages(); }
      state.lyKey = LY.key; setHudLayout(state.settings.textIdx);
      meta.previewBadge = { x: LY.U.x1 - 10, y: HUD.strip.y + HUD.strip.h + 14, align: 'right' };
    }
    const act = state.scene === 'play' && state.S && ['song', 'dive', 'haul', 'open'].includes(state.S.phase);
    state.viewRect = act ? viewRegion() : state.scene === 'title' ? titleView() : (LY.land ? { x: LY.U.x0, y: LY.U.y0, w: Math.round(LY.U.w * 0.56), h: LY.U.h } : { x: LY.U.x0, y: Math.round(LY.U.y0 + LY.U.h * 0.06), w: LY.U.w, h: Math.round(LY.U.h * 0.42) });
  }
  const game = {
    scrollBy(dy) { if (['rules', 'howto', 'about', 'journal'].includes(state.scene)) state.wheel = (state.wheel || 0) + dy; else { const mt = flowMeta(); const max = mt && mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0; state.ui.scroll = clamp(state.ui.scroll + dy, 0, max); } },
    // Free: menus, Rules, About, How to Play, the harbour, the journal, the necklace, pause, Watch & Learn. The 90 s preview counts only real play: song, dive, haul and opening shells.
    isPreviewExempt: () => !(state.scene === 'play' && state.mode === 'play' && !!state.S && ['song', 'dive', 'haul', 'open'].includes(state.S.phase) && !state.pauseMenu && !state.hint),
    setView3d(on) { state.v3 = !!on; },
    setHas3d(on) { state.has3d = !!on; },
    setCredits(text) {
      state.credits = String(text || '');
      const paras = state.credits.split(/\n{2,}/).map((s) => s.replace(/^#+\s*/gm, '').replace(/\n/g, ' ').trim()).filter(Boolean);
      if (paras.length) { state.creditsList = [...ABOUT, { title: 'Credits', p: paras }]; resetPages(); }
    },
    update(dt, input) {
      relayout();
      TIPS.off = !state.settings.tips;
      setPress(input.pointer);
      state.ptr = input.pointer;
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      music(dt);
      if (state.shotFreeze) return;
      switch (state.scene) {
        case 'title': {
          const lt = getLockTap(), pp = input.pointer;
          setLockDown(state.lockDown > state.t);
          if (lt && pp.pressed && pp.x >= lt.x && pp.x <= lt.x + lt.w && pp.y >= lt.y && pp.y <= lt.y + lt.h) { state.lockDown = state.t + 0.25; env.openArcforgeHome?.(); break; }
          updateFlowScene(input, handleTitle, 'title'); break;
        }
        case 'settings': updateFlowScene(input, handleSettings, 'settings'); break;
        case 'demolimit': updateFlowScene(input, (id) => { if (id === 'menu') { state.scene = 'title'; state.S = null; resetUi(); } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': case 'journal': updatePages(input); break;
        case 'necklace': updateNecklace(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx) {
      relayout();
      ctx.clearRect(0, 0, W, H);
      if (noHud) { state.v3 = state.v3; return; }
      const S = state.S;
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, aboutList(), 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'journal': state.jlen = S ? S.journal.reduce((a, e) => a + e.lines.length + 1, 0) : 0; renderPages(ctx, state, journalList(), 'Journal'); break;
        case 'necklace': renderNecklace(ctx, state); break;
        case 'play': if (S) {
          const ph = S.phase;
          if (!state.v3 && ['song', 'dive', 'haul', 'open'].includes(ph)) drawFlatBackdrop(ctx, state, ph === 'dive');   // the 2D fallback (no WebGL) paints its own sea
          if (ph === 'song') renderSong(ctx, state); else if (ph === 'dive') renderDive(ctx, state); else if (ph === 'haul') renderHaul(ctx, state); else if (ph === 'open') renderOpen(ctx, state);
          else renderSea(ctx, state, FLOWS.includes(ph) ? ph : 'plan');
          if (state.mode === 'watch' && state.watch && !state.watchEnd) renderWatchBar(ctx, state);
          if (state.toast) { const t = LY.toast; ctx.save(); ctx.fillStyle = 'rgba(3,32,40,0.9)'; ctx.fillRect(t.x, t.y, t.w, t.h); ctx.fillStyle = '#fff3d6'; ctx.font = `700 ${Math.max(22, LY.minText)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(state.toast, t.x + t.w / 2, t.y + t.h / 2); ctx.restore(); }
          if (state.pauseMenu) renderPause(ctx, state); else if (state.hint) renderHint(ctx, state); else if (state.watchEnd) renderWatchEnd(ctx, state);
        } break;
        default: break;
      }
    },
    getState: () => state,
  };
  if (shotMode) { applyPreset(); state.shotFreeze = true; }
  void TEXT_DEC; void TEXT_INC; void REF_BACK;
  return game;
}
