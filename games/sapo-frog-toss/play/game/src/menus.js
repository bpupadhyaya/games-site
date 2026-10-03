// Every screen that is not the play screen: title, setup, settings, learn list, result, pause, the set-up sheet, and the paginated
// About / How to Play / Rules reader with its illustrations (drawn with the game's own hole layout). Pure drawing.
import { W, H, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS } from './layout.js';
import { FONT, NUM, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { drawRoom, drawTable, drawHoles, drawActors, drawParts, DISC_COL, TAU } from './scene.js';
import { PROFILES, ASSIST, pname } from './ai.js';
import { LENGTHS, DISCS } from './engine.js';
import { HOLES, MOUTH, HW, TD, A, FROG } from './phys.js';
import { ABOUT, HOWTO, RULES, LESSONS } from './content.js';
import { SPIN_NAMES, STYLE_NAMES, sideName } from './view.js';
import { tr, pick, getLang } from './i18n.js';

// ---- flow screens ------------------------------------------------------------------------------
let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
export function ensureLayout(state, key) {
  if (LAID.key === key && LAID.lay) return;
  const defs = {
    title: [titleWidgets, 0, H], setup: [setupWidgets, 0, 1130], settings: [settingsWidgets, 0, H], learn: [learnWidgets, 0, H],
    result: [(st) => (st.m.cfg.mode === 'learn' ? lessonResultWidgets(st) : resultWidgets(st)), 0, H], demolimit: [demoLimitWidgets, 0, H], sheet: [sheetWidgets, 90, H - 20], why: [whyWidgets, 90, H - 20],
  };
  const d = defs[key];
  if (!d) return;
  const lay = flowLayout(estCtx, d[0](state), TEXT_SCALES[state.settings.textIdx], key === 'sheet' || key === 'why' ? { x: 50, w: 620 } : undefined);
  LAID = { key, lay, top: d[1], bottom: d[2], h: lay.contentH };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }
export const invalidateLayout = () => { LAID = { key: '', lay: null, top: 0, bottom: H }; readerCache.clear(); };

const spaced = (ctx, text, cx, y, gap) => {
  const ws = [...text].map((ch) => ctx.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) + gap * (text.length - 1);
  let x = cx - total / 2;
  [...text].forEach((ch, i) => { ctx.fillText(ch, x + ws[i] / 2, y); x += ws[i] + gap; });
};

// ---- the live table behind the title and menus ----------------------------------------------------------------------------------
export function drawAttract(ctx, state) {
  const a = state.att;
  drawRoom(ctx, state.t); drawTable(ctx, state.t); drawHoles(ctx, { holeFlash: a.flash }, state.t);
  drawActors(ctx, state.t, a.sim.discs, a.alpha, { holeFlash: a.flash, simT: a.sim.t }, {});
  drawParts(ctx, a.parts);
}
function heroArt() {
  return {
    t: 'art', h: 330,
    draw(ctx, w) {
      const cx = w / 2;
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = `700 24px ${FONT}`; ctx.fillStyle = 'rgba(233,193,95,0.95)';
      spaced(ctx, tr('THE FROG TOSS', 'EL JUEGO DEL SAPO'), cx, 76, 8);
      ctx.font = `800 150px ${NUM}`;
      textShadow(ctx, 'SAPO', cx, 206, '#fff4d6', 18);
      ctx.strokeStyle = 'rgba(233,193,95,0.85)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - 250, 238); ctx.lineTo(cx - 40, 238); ctx.moveTo(cx + 40, 238); ctx.lineTo(cx + 250, 238); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, 238, 9, 0, TAU); ctx.fillStyle = '#e9c15f'; ctx.fill();
      ctx.restore();
    },
  };
}
const SOUND = (on) => (on ? tr('Sound: On', 'Sonido: Sí') : tr('Sound: Off', 'Sonido: No'));
export const langRow = (row, state) => [
  { t: 'btn', id: 'lang-en', label: 'Play in English', row, active: getLang() === 'en', h: 64 },
  { t: 'btn', id: 'lang-es', label: 'Jugar en español', row, active: getLang() === 'es', h: 64 },
];
export function titleWidgets(state) {
  const wd = [heroArt(), { t: 'gap', h: 290 }];
  if (state.resume) {
    const r = state.resume, who = r.cfg.mode === 'two' ? tr('Two players', 'Dos jugadores') : pname(PROFILES[r.cfg.opp] ?? PROFILES[0]);
    wd.push({ t: 'btn', id: 'continue', label: tr('Continue match', 'Continuar partida'), sub: `${who}, ${r.scores[0]} - ${r.scores[1]}`, primary: true, h: 92 });
    wd.push({ t: 'btn', id: 'play', label: tr('New match vs Computer', 'Nueva partida vs computadora'), h: 80 });
  } else wd.push({ t: 'btn', id: 'play', label: tr('Play vs Computer', 'Jugar contra la computadora'), primary: true, h: 80 });
  wd.push({ t: 'btn', id: 'two', h: 64, label: tr('Two Players', 'Dos jugadores'), row: 1 });
  wd.push({ t: 'btn', id: 'watch', h: 64, label: tr('Watch & Learn', 'Mirar y aprender'), row: 1 });
  wd.push({ t: 'btn', id: 'learn', h: 64, label: tr('Learn', 'Aprender'), row: 2 });
  wd.push({ t: 'btn', id: 'howto', h: 64, label: tr('How to Play', 'Cómo jugar'), row: 2 });
  wd.push({ t: 'btn', id: 'rules', h: 64, label: tr('Rules', 'Reglas'), row: 3 });
  wd.push({ t: 'btn', id: 'about', h: 64, label: tr('About', 'Acerca de'), row: 3 });
  wd.push({ t: 'btn', id: 'settings', h: 64, label: tr('Settings', 'Ajustes'), row: 4 });
  wd.push({ t: 'btn', id: 'sound', h: 64, label: SOUND(state.settings.sound), row: 4 });
  wd.push(...langRow(5, state));
  return wd;
}
const SEC = (label) => ({ t: 'p', label, bold: true, color: '#ffe9bf', size: 26 });
export function setupWidgets(state) {
  const s = state.setup, demo = state.demo, rec = state.record ?? {};
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: s.mode === 'two' ? tr('Two Players', 'Dos jugadores') : tr('New Match', 'Nueva partida'), size: 48 }];
  if (s.mode !== 'two') {
    wd.push(SEC(tr('Choose your opponent', 'Elige a tu rival')));
    PROFILES.forEach((pf, i) => {
      const won = (rec.wins ?? [])[i] ?? 0, locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i}`, label: pname(pf), sub: locked ? tr('In the full game', 'En el juego completo') : `${tr(pf.tagEn, pf.tagEs)}${won ? tr(` · won ${won}`, ` · ganadas ${won}`) : ''}`, stars: locked ? 0 : pf.stars, active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: 92 });
    });
  }
  wd.push(SEC(tr('Match length', 'Duración')));
  LENGTHS.forEach((l) => {
    const locked = demo && l.id > 0;
    wd.push({ t: 'btn', id: `len${l.id}`, label: tr(l.en, l.es), sub: locked ? tr('In the full game', 'En el juego completo') : tr(l.noteEn, l.noteEs), active: s.len === l.id && !locked, disabled: locked, hitDisabled: true, h: 84 });
  });
  wd.push(SEC(tr('Aim steadiness', 'Firmeza de puntería')));
  ASSIST.forEach((a, i) => wd.push({ t: 'btn', id: `as${i}`, label: tr(a.en, a.es), row: 11, active: state.settings.assist === i }));
  wd.push({ t: 'gap', h: 24 });
  return wd;
}
export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: tr('Settings', 'Ajustes'), size: 48 },
    { t: 'btn', id: 'set-sound', label: SOUND(st.sound) },
    SEC(tr(`Aim steadiness: ${tr(ASSIST[st.assist].en, ASSIST[st.assist].es)}`, `Firmeza de puntería: ${ASSIST[st.assist].es}`)),
    ...ASSIST.map((a, i) => ({ t: 'btn', id: `as${i}`, label: tr(a.en, a.es), row: 12, active: st.assist === i })),
    SEC(tr(`Text size: ${Math.round(sc * 100)}%`, `Tamaño del texto: ${Math.round(sc * 100)}%`)),
    { t: 'btn', id: 'txt-dec', label: tr('A−  Smaller', 'A−  Menor'), row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: tr('A+  Larger', 'A+  Mayor'), row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    SEC(tr(`Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, `Tiempo de pensar en Mirar y aprender: ${THINK_STEPS[st.thinkIdx]} s`)),
    { t: 'btn', id: 'think-dec', label: tr('Shorter', 'Más corto'), row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: tr('Longer', 'Más largo'), row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    SEC(tr('Language', 'Idioma')),
    ...langRow(6, state),
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: tr('Restore purchases', 'Restaurar compras'), dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9bf' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: tr('Back', 'Atrás'), primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}
export function learnWidgets(state) {
  const done = state.record.learn ?? 0;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: tr('Learn', 'Aprender'), size: 48 }, { t: 'p', label: tr('Six short lessons with a goal each. They are free, always.', 'Seis lecciones cortas con una meta cada una. Son gratis, siempre.'), size: 24, color: '#ffe9bf' }];
  LESSONS.forEach((l, i) => wd.push({ t: 'btn', id: `lesson${i}`, label: `${i + 1}. ${pick(l.title)}`, sub: i < done ? tr('Done', 'Hecha') : i === done ? tr('Next up', 'Siguiente') : tr('Open', 'Abierta'), active: i < done, primary: i === done, h: 92 }));
  wd.push({ t: 'gap', h: 10 }, { t: 'btn', id: 'back', label: tr('Back', 'Atrás'), dark: true, h: 84 }, { t: 'gap', h: 30 });
  return wd;
}
export function resultWidgets(state) {
  const m = state.m, o = m.over, mode = m.cfg.mode, winner = o.win;
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const nm = (s) => sideName(state, s);
  const title = winner < 0 ? tr('A draw', 'Empate') : mode === 'two' ? tr(`Player ${winner + 1} wins`, `Gana el jugador ${winner + 1}`) : mode === 'watch' ? tr(`${nm(winner)} wins`, `Gana ${nm(winner)}`) : winner === 0 ? tr('You win!', '¡Ganaste!') : tr('You lose', 'Perdiste');
  const wd = [{ t: 'gap', h: big ? 20 : 50 }, { t: 'h', label: title, size: 62, cap: big ? 1.2 : 1.5 }, { t: 'h', label: `${m.scores[0]} – ${m.scores[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' },
    { t: 'p', label: `${nm(0)}  vs  ${nm(1)}`, bold: true, color: '#ffe9bf', size: 24, cap: 2 }];
  const a = m.stats[0], b = m.stats[1];
  const rows = [[tr('Frog mouth drops', 'Fichas en la boca'), a.mouth, b.mouth], [tr('Mill drops', 'Fichas en el molino'), a.mill, b.mill], [tr('Discs in holes', 'Fichas en agujeros'), a.in, b.in], [tr('Best disc', 'Mejor ficha'), a.best, b.best], [tr('Closest bonuses', 'Bonificaciones de cercanía'), a.closest, b.closest]];
  rows.forEach(([k, x, y]) => wd.push({ t: 'p', label: `${k}:  ${x}  –  ${y}`, size: 24, cap: 2.4 }));
  if (mode === 'ai') wd.push({ t: 'p', label: tr(`Matches won against ${pname(PROFILES[m.cfg.opp])}: ${(state.record.wins ?? [])[m.cfg.opp] ?? 0}`, `Partidas ganadas a ${pname(PROFILES[m.cfg.opp])}: ${(state.record.wins ?? [])[m.cfg.opp] ?? 0}`), size: 22, cap: 2, color: '#ffe9bf' });
  wd.push({ t: 'gap', h: 16 });
  wd.push({ t: 'btn', id: 'again', label: mode === 'watch' ? tr('Watch another', 'Ver otra') : tr('Rematch', 'Revancha'), primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: tr('New match', 'Nueva partida'), row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: tr('Main menu', 'Menú principal'), row: 6, dark: true });
  wd.push({ t: 'gap', h: 30 });
  return wd;
}
export function lessonResultWidgets(state) {
  const L = state.m.lesson, won = L.passed, last = L.idx >= LESSONS.length - 1;
  const wd = [{ t: 'gap', h: 60 }, { t: 'h', label: won ? tr('Lesson passed', 'Lección superada') : tr('Not this time', 'Esta vez no'), size: 56 },
    { t: 'p', label: won ? tr(`${L.title}: goal reached in ${L.used} ${L.used === 1 ? 'throw' : 'throws'}.`, `${L.title}: meta lograda en ${L.used} ${L.used === 1 ? 'tiro' : 'tiros'}.`) : tr(`${L.title}: the goal was not reached in ${L.tries} throws. Try the Think button.`, `${L.title}: no se logró la meta en ${L.tries} tiros. Prueba el botón Pensar.`), size: 26 }, { t: 'gap', h: 16 }];
  if (won && !last) wd.push({ t: 'btn', id: 'lnext', label: tr('Next lesson', 'Siguiente lección'), primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'lagain', label: won ? tr('Play it again', 'Jugarla otra vez') : tr('Try again', 'Intentar de nuevo'), primary: !(won && !last), h: 84 });
  wd.push({ t: 'btn', id: 'lmenu', label: tr('Lessons', 'Lecciones'), dark: true, h: 84 }, { t: 'gap', h: 30 });
  return wd;
}
export function pauseWidgets(state) {
  const st = state.settings, learn = state.m && state.m.cfg.mode === 'learn';
  return [
    { t: 'h', label: tr('Paused', 'En pausa'), size: 52 },
    ...(learn ? [{ t: 'p', label: state.m.lesson.text, size: 22, color: '#ffe9bf' }] : []),
    { t: 'btn', id: 'resume', label: tr('Resume', 'Seguir'), primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: tr('Rules', 'Reglas'), row: 7 },
    { t: 'btn', id: 'p-howto', label: tr('How to Play', 'Cómo jugar'), row: 7 },
    { t: 'btn', id: 'p-sound', label: SOUND(st.sound) },
    { t: 'btn', id: 'quit', label: tr('Quit to menu', 'Salir al menú'), sub: learn ? tr('Back to the lessons', 'Volver a las lecciones') : tr('Your match is kept', 'Tu partida se guarda'), dark: true },
  ];
}
// The set-up sheet used at the larger text sizes instead of the inline controls.
export function sheetWidgets(state) {
  const p = state.plan, ax = Math.round(p.ax * 100), az = Math.round(p.az * 100);
  const side = (v) => (v === 0 ? tr('centre', 'centro') : v < 0 ? tr(`${-v} cm left`, `${-v} cm a la izquierda`) : tr(`${v} cm right`, `${v} cm a la derecha`));
  return [
    { t: 'h', label: tr('Set up your throw', 'Prepara tu tiro'), size: 40 },
    SEC(tr(`Throw: ${STYLE_NAMES()[p.style]}`, `Tiro: ${STYLE_NAMES()[p.style]}`)),
    { t: 'btn', id: 'style0', label: STYLE_NAMES()[0], row: 1, active: p.style === 0 },
    { t: 'btn', id: 'style1', label: STYLE_NAMES()[1], row: 1, active: p.style === 1 },
    SEC(tr(`Spin: ${SPIN_NAMES()[p.spin + 2]}`, `Efecto: ${SPIN_NAMES()[p.spin + 2]}`)),
    { t: 'btn', id: 'spin-', label: tr('◄ Spin left', '◄ Efecto izq.'), row: 2, disabled: p.spin <= -2 },
    { t: 'btn', id: 'spin+', label: tr('Spin right ►', 'Efecto der. ►'), row: 2, disabled: p.spin >= 2 },
    SEC(tr(`Landing spot: ${side(ax)}`, `Punto de caída: ${side(ax)}`)),
    { t: 'btn', id: 'aim-', label: tr('◄ Aim left', '◄ Apuntar izq.'), row: 3 },
    { t: 'btn', id: 'aim+', label: tr('Aim right ►', 'Apuntar der. ►'), row: 3 },
    SEC(tr(`Distance: ${az} cm from the front edge`, `Distancia: ${az} cm desde el borde delantero`)),
    { t: 'btn', id: 'dist-', label: tr('Nearer', 'Más cerca'), row: 4 },
    { t: 'btn', id: 'dist+', label: tr('Further', 'Más lejos'), row: 4 },
    { t: 'btn', id: 'think', label: state.hint && state.hint.busy ? tr('Thinking...', 'Pensando...') : tr('Think', 'Pensar'), dark: true },
    ...(state.hint && !state.hint.busy ? [{ t: 'p', label: state.hint.text, size: 22, color: '#bff3ff' }, { t: 'btn', id: 'use', label: tr('Use this line', 'Usar esta jugada'), primary: true }] : []),
    { t: 'btn', id: 'close', label: tr('Done', 'Listo'), primary: true, h: 88 },
    { t: 'btn', id: 'smenu', label: tr('Menu', 'Menú'), sub: tr('Pause, rules, quit (your match is kept)', 'Pausa, reglas, salir (tu partida se guarda)'), dark: true, h: 84 },
    { t: 'gap', h: 20 },
  ];
}
export function whyWidgets(state) {
  return [
    { t: 'h', label: state.why.title, size: 40 },
    { t: 'p', label: state.why.text, size: 26, color: '#e8fbff', align: 'left' },
    { t: 'btn', id: 'wclose', label: tr('Close', 'Cerrar'), primary: true, h: 88 },
    { t: 'gap', h: 20 },
  ];
}
export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: tr('That is the free preview', 'Esa es la vista previa gratuita'), size: 48 },
    { t: 'p', label: tr('You have played the two short matches of the web demo. The full game on iPhone and Android has all five opponents, three match lengths, Two Players and your saved records.', 'Has jugado las dos partidas cortas de la demo web. El juego completo en iPhone y Android tiene los cinco rivales, tres duraciones, Dos jugadores y tus récords guardados.'), size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: tr('Main menu', 'Menú principal'), primary: true },
  ];
}
export function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(6,10,8,${a * 0.7})`); g.addColorStop(0.5, `rgba(6,10,8,${a})`); g.addColorStop(1, `rgba(6,10,8,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(6,10,8,0)'); g.addColorStop(1, 'rgba(6,10,8,0.75)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 54, bottom - 40, 108, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.92)'; ctx.fill();
    ctx.fillStyle = '#2a1d10'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tr('▼ more', '▼ más'), cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 54, top + 8, 108, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.92)'; ctx.fill();
    ctx.fillStyle = '#2a1d10'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tr('▲ up', '▲ arriba'), cx, top + 24);
  }
}
function drawFlowScreen(ctx, state, key, widgets, top, bottom, opts) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, widgets, sc, opts);
  LAID = { key, lay, top, bottom, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
    roundPath(ctx, W - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,240,204,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
  return { scroll, maxScroll, lay };
}
function backdrop(ctx, state, a) { ctx.save(); drawAttract(ctx, state); ctx.restore(); scrim(ctx, a); }
export function renderTitle(ctx, state) {
  drawAttract(ctx, state);
  const g = ctx.createLinearGradient(0, 560, 0, H); g.addColorStop(0, 'rgba(8,5,3,0)'); g.addColorStop(0.35, 'rgba(8,5,3,0.82)'); g.addColorStop(1, 'rgba(8,5,3,0.95)');
  ctx.fillStyle = g; ctx.fillRect(0, 560, W, H - 560);
  const t = ctx.createLinearGradient(0, 0, 0, 330); t.addColorStop(0, 'rgba(8,5,3,0.85)'); t.addColorStop(1, 'rgba(8,5,3,0)'); ctx.fillStyle = t; ctx.fillRect(0, 0, W, 330);
  drawFlowScreen(ctx, state, 'title', titleWidgets(state), 0, H);
  ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.6)'; ctx.textBaseline = 'alphabetic';
  if (state.demo) ctx.fillText(tr('Web demo', 'Demo web'), W / 2, H - 14);
}
export function renderSetup(ctx, state) {
  backdrop(ctx, state, 0.7);
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state), 0, 1130);
  const g = ctx.createLinearGradient(0, 1100, 0, H);
  g.addColorStop(0, 'rgba(6,10,8,0)'); g.addColorStop(0.2, 'rgba(6,10,8,0.88)'); g.addColorStop(1, 'rgba(6,10,8,0.96)');
  ctx.fillStyle = g; ctx.fillRect(0, 1100, W, H - 1100);
  drawButton(ctx, SETUP_PINS.start, tr('Start the match', 'Empezar la partida'), { primary: true, size: 32 });
  drawButton(ctx, SETUP_PINS.back, tr('Back', 'Atrás'), { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, 1140); }
}
export function renderSettings(ctx, state) { backdrop(ctx, state, 0.74); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state), 0, H); }
export function renderLearn(ctx, state) { backdrop(ctx, state, 0.7); drawFlowScreen(ctx, state, 'learn', learnWidgets(state), 0, H); }
export function renderResult(ctx, state) { backdrop(ctx, state, 0.84); drawFlowScreen(ctx, state, 'result', state.m.cfg.mode === 'learn' ? lessonResultWidgets(state) : resultWidgets(state), 0, H); }
export function renderDemoLimit(ctx, state) { backdrop(ctx, state, 0.76); drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets(), 0, H); }
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state), sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, wd, sc, { x: 60, w: 600 });
  const top = 70, bottom = H - 70;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, 30, y0 - 20, 660, ch + 40, { r: 30, fill: 'rgba(24,18,12,0.94)', stroke: 'rgba(233,193,95,0.55)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, 30, 660);
}
export function renderWhy(ctx, state) {
  scrim(ctx, 0.78);
  const top = 90, bottom = H - 20;
  panel(ctx, 20, top - 20, 680, bottom - top + 30, { r: 28, fill: 'rgba(24,18,12,0.97)', stroke: 'rgba(125,232,255,0.55)' });
  drawFlowScreen(ctx, state, 'why', whyWidgets(state), top, bottom, { x: 50, w: 620 });
}
export function renderSheet(ctx, state) {
  scrim(ctx, 0.7);
  const top = 90, bottom = H - 20;
  panel(ctx, 20, top - 20, 680, bottom - top + 30, { r: 28, fill: 'rgba(24,18,12,0.96)', stroke: 'rgba(233,193,95,0.55)' });
  drawFlowScreen(ctx, state, 'sheet', sheetWidgets(state), top, bottom, { x: 50, w: 620 });
}

// ---- reference pages --------------------------------------------------------------------------
const PANEL = { x: 34, y: 100, w: 652, h: 1030 };
// The reference pages (Rules, How to Play, About) are one scrolling reader: the text is laid out once for the chosen text size and
// the player scrolls it (drag, wheel, keys, or the Down button). `REF` is what the update loop needs to know about the last drawing.
const REF = { max: 0, vh: 1, vp: { x: PANEL.x, y: PANEL.y + 92, w: PANEL.w, h: PANEL.h - 92 - 66 } };
export const refMeta = () => REF;
function buildReader(ctx, list, scale) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PANEL.w - 96;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const items = []; let y = 14;
  list.forEach((sec, si) => {
    if (si > 0) { items.push({ k: 'rule', y: y - 4 }); y += 12; }
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, pick(sec.title), tw);
    items.push({ k: 'title', y, lines: tl, fs: secFs }); y += tl.length * secFs * 1.2 + 16;
    if (sec.art) { items.push({ k: 'art', y, h: 258, art: sec.art }); y += 270; }
    ctx.font = `400 ${fs}px ${FONT}`;
    sec.p.forEach((para, pi) => {
      if (pi > 0) y += lh * 0.45;
      wrapLines(ctx, pick(para), tw).forEach((l) => { items.push({ k: 'line', y, text: l, fs }); y += lh; });
    });
    y += 26;
  });
  return { items, h: y, fs, lh };
}
const readerCache = new Map();
export function renderPages(ctx, state, list, header, key) {
  backdrop(ctx, state, 0.72);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${key}:${getLang()}:${sc}`;
  let rd = readerCache.get(pkey);
  if (!rd) { rd = buildReader(ctx, list, sc); readerCache.set(pkey, rd); }
  const vp = REF.vp;
  REF.vh = vp.h; REF.max = Math.max(0, rd.h - vp.h);
  const scroll = Math.max(0, Math.min(state.ui.scroll, REF.max)); state.ui.scroll = scroll;
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(247,238,214,0.97)', stroke: 'rgba(154,116,36,0.8)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.redDark; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, W / 2, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(110,76,40,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(vp.x + 6, vp.y, vp.w - 12, vp.h); ctx.clip();
  const X0 = PANEL.x + 48, oy = vp.y - scroll;
  for (const it of rd.items) {
    const yy = oy + it.y;
    if (it.k === 'title') {
      if (yy > vp.y + vp.h || yy + it.lines.length * it.fs * 1.2 < vp.y) continue;
      ctx.textAlign = 'center'; ctx.fillStyle = C.red; ctx.font = `700 ${it.fs}px ${FONT}`;
      it.lines.forEach((l, k) => ctx.fillText(l, W / 2 - 8, yy + it.fs * (0.9 + k * 1.2) - 8));
    } else if (it.k === 'art') {
      if (yy > vp.y + vp.h || yy + it.h < vp.y) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, yy, PANEL.w - 52, it.h); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, yy, PANEL.w - 92, it.h - 12, state); ctx.restore();
    } else if (it.k === 'rule') {
      ctx.strokeStyle = 'rgba(110,76,40,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, yy); ctx.lineTo(PANEL.x + PANEL.w - 92, yy); ctx.stroke();
    } else {
      if (yy > vp.y + vp.h || yy + rd.lh < vp.y) continue;
      ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.font = `400 ${it.fs}px ${FONT}`; ctx.fillText(it.text, X0, yy + it.fs * 0.85);
    }
  }
  ctx.restore();
  if (REF.max > 0) {
    const tx = PANEL.x + PANEL.w - 22, th = Math.max(54, vp.h * (vp.h / rd.h)), ty = vp.y + (scroll / REF.max) * (vp.h - th);
    roundPath(ctx, tx, vp.y, 8, vp.h, 4); ctx.fillStyle = 'rgba(110,76,40,0.16)'; ctx.fill();
    roundPath(ctx, tx, ty, 8, th, 4); ctx.fillStyle = 'rgba(154,116,36,0.85)'; ctx.fill();
  }
  const pct = REF.max > 0 ? Math.round(100 * scroll / REF.max) : 100;
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(70,50,30,0.75)';
  ctx.fillText(REF.max > 0 ? tr(`Scroll to read: ${pct}%`, `Desliza para leer: ${pct}%`) : tr('All shown', 'Todo visible'), W / 2, PANEL.y + PANEL.h - 28);
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff3d6'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(sc * 100)}%`, W / 2, 56);
  drawButton(ctx, REF_BACK, tr('Close', 'Cerrar'), { size: 32 });
  drawButton(ctx, REF_NEXT, scroll < REF.max - 4 ? tr('More ▼', 'Más ▼') : tr('Done', 'Listo'), { primary: true, size: 32 });
}

// ---- illustrations: drawn with the game's own table layout -------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') {
  ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y);
}
function notes(ctx, x, y, maxW, items, size = 18) {
  let yy = y;
  items.forEach(([text, col]) => { ctx.font = `700 ${size}px ${FONT}`; wrapLines(ctx, text, maxW).forEach((l) => { label(ctx, l, x, yy, size, col, 'left'); yy += size * 1.3; }); yy += size * 0.6; });
}
const stage = (ctx, x, y, w, h) => {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#2a1a0f'); g.addColorStop(1, '#4a2f1a');
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(154,116,36,0.7)'; ctx.lineWidth = 2; ctx.stroke();
};
function topDisc(ctx, cx, cy, r, side, o = {}) {
  const col = DISC_COL[side];
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = col.top1; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = o.hot ? '#7dffa0' : col.edge; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, TAU); ctx.lineWidth = 2.5; ctx.strokeStyle = col.ring; ctx.stroke(); ctx.restore();
}
// The table from above: back at the top, the player below.
function topTable(ctx, ox, oy, m, o = {}) {
  const X = (x) => ox + (x + HW) * m, Y = (z) => oy + (TD - z) * m;
  roundPath(ctx, X(-HW), Y(TD), 2 * HW * m, TD * m, 6); ctx.fillStyle = '#9a6734'; ctx.fill(); ctx.strokeStyle = '#d9ae52'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#2f5a52'; ctx.fillRect(X(-HW), Y(TD) - 7, 2 * HW * m, 7);
  ctx.beginPath(); ctx.arc(X(FROG.x), Y(FROG.z), FROG.r * m, 0, TAU); ctx.fillStyle = '#d9ae52'; ctx.fill(); ctx.strokeStyle = '#6b470f'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#1b1109'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(X(sd * 0.055), Y(FROG.z - 0.03), 3, 0, TAU); ctx.fill(); }
  HOLES.forEach((h) => {
    ctx.beginPath(); ctx.arc(X(h.x), Y(h.z), h.R * m, 0, TAU); ctx.fillStyle = '#120a04'; ctx.fill(); ctx.strokeStyle = '#d9ae52'; ctx.lineWidth = 2.5; ctx.stroke();
    if (o.values) { ctx.save(); ctx.font = `800 ${h.id === 'mouth' ? 19 : 16}px ${NUM}`; ctx.textAlign = 'center'; ctx.fillStyle = h.id === 'mouth' ? '#ffd36a' : '#fff2cf'; ctx.fillText(String(h.v), X(h.x), Y(h.z) + (h.id === 'mouth' ? 38 + (o.dy ?? 0) : 29)); ctx.restore(); }
  });
  return { X, Y };
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A_ = {
    table() {
      stage(ctx, 0, 0, w, h);
      const m = (h - 30) / 0.98;
      topTable(ctx, 16, 20, m, { values: true });
      notes(ctx, 16 + 0.9 * m + 22, 52, w - (16 + 0.9 * m + 22) - 14, [[tr('The back board and the frog are at the far end. You throw from below.', 'El tablero y la rana están al fondo. Lanzas desde abajo.'), '#fff2cf'], [tr('Points are painted beside each hole.', 'Los puntos están pintados junto a cada agujero.'), '#ffe08a']], 17);
    },
    styles() {
      stage(ctx, 0, 0, w, h);
      // a side view: the table as a line, a lob (high arc) and a drive (low arc) landing at the same spot
      const gx0 = 30, gx1 = w - 30, gy = h - 40, land = w * 0.62, startX = gx0 + 10, startY = gy - 70;
      ctx.strokeStyle = '#d9ae52'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(w * 0.5, gy); ctx.lineTo(gx1, gy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(gx0, gy + 22); ctx.lineTo(w * 0.5 - 10, gy + 22); ctx.strokeStyle = 'rgba(255,235,200,0.35)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.lineWidth = 4; ctx.setLineDash([8, 7]);
      ctx.strokeStyle = '#ffe08a'; ctx.beginPath(); ctx.moveTo(startX, startY); ctx.quadraticCurveTo((startX + land) / 2, startY - 190, land, gy); ctx.stroke();
      ctx.strokeStyle = '#7de8ff'; ctx.beginPath(); ctx.moveTo(startX, startY); ctx.quadraticCurveTo((startX + land) / 2, startY - 50, land, gy); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#7de8ff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(land, gy - 4); ctx.lineTo(land + 80, gy - 4); ctx.stroke();
      ctx.strokeStyle = '#ffe08a'; ctx.beginPath(); ctx.moveTo(land, gy - 4); ctx.lineTo(land + 26, gy - 4); ctx.stroke();
      label(ctx, tr('Lob: high, steep, stays near', 'Alto: arco alto, queda cerca'), w * 0.1, 34, 18, '#ffe08a', 'left');
      label(ctx, tr('Drive: low, skids on', 'Rasante: bajo, se desliza'), w * 0.1, 60, 18, '#7de8ff', 'left');
      topDisc(ctx, startX, startY, 14, 0);
    },
    closest() {
      stage(ctx, 0, 0, w, h);
      const m = (h - 30) / 0.98, { X, Y } = topTable(ctx, 16, 20, m, { values: false });
      topDisc(ctx, X(0.08), Y(0.5), 0.04 * m, 0, { hot: true }); topDisc(ctx, X(-0.22), Y(0.62), 0.04 * m, 1); topDisc(ctx, X(0.25), Y(0.3), 0.04 * m, 1); topDisc(ctx, X(-0.1), Y(0.2), 0.04 * m, 0);
      ctx.strokeStyle = '#7dffa0'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(X(0.08), Y(0.5)); ctx.lineTo(X(0), Y(0.555)); ctx.stroke(); ctx.setLineDash([]);
      notes(ctx, 16 + 0.9 * m + 22, 52, w - (16 + 0.9 * m + 22) - 14, [[tr('The loose disc nearest the centre of the mouth earns the bonus.', 'La ficha suelta más cercana al centro de la boca gana la bonificación.'), '#fff2cf'], [tr('Green: the closest one.', 'Verde: la más cercana.'), '#7dffa0']], 17);
    },
  };
  (A_[key] ?? A_.table)();
  ctx.restore();
}
export { ABOUT, HOWTO, RULES, DISCS };
