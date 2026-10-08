// Things the game logic (hit-testing) and the drawing code both need, so they can never disagree:
// the camera over the paper, the caption card, the screen rectangles of the play screen and the faces of the paper right now.
import { layout, playRects, autoRects, host } from './layout.js';
import { makeCam } from './paperview.js';
import { MODELS } from './models.js';
import { TEXT_SCALES, wrap } from './ui.js';
import { tr } from './content.js';
import { flatFaces, foldFaces, turnFaces, poseFaces, withCreases } from './paper.js';

export const stepOf = (P) => MODELS[P.mi].steps[P.k];
export const textScaleCap = (S) => Math.min(TEXT_SCALES[S.textIdx], 2);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// Caption for the current screen state: { label, text, lines, size, line, h }
export function captionOf(S, P) {
  const L = layout();
  const sc = textScaleCap(S);
  const size = Math.round(26 * sc * (L.land ? 0.96 : 1)), line = size * 1.3;
  let label = '', text = '';
  if (P.studio) { label = tr('studioBtn'); text = P.last ? tr('studioDone') : tr('studioHint'); }
  else {
    const m = MODELS[P.mi];
    if (P.k >= m.steps.length) { label = m.name; text = m.finish; }
    else { label = `${m.name} · ${tr('step', { a: P.k + 1, b: m.steps.length })}`; text = m.steps[P.k].text; }
  }
  const lab = Math.round(Math.max(size * 0.62, 11.5 / Math.max(0.3, host.px)));
  const w = (L.land ? Math.max(340, Math.min(560, (L.xr - L.xl) * 0.36)) : L.xr - L.xl) - 48;
  const lines = wrap(text, size, w);
  const extra = P.studio ? 84 : 26;
  const h = 22 + lab + 8 + lines.length * line + 14 + extra;
  return { label, text, lines, size, line, lab, h: Math.round(h), w };
}

export function rectsFor(S, P) {
  const L = layout();
  const cap = captionOf(S, P);
  const R = playRects(L, cap.h);
  return { L, cap, R, auto: S.scene === 'auto' ? autoRects(L, R) : null };
}

// Camera: the paper area's centre is the screen position of the look-at point (cx, cy in sheet units), S px per sheet unit.
export function camOf(P, board) {
  return makeCam({ x: board.x + board.w / 2, y: board.y + board.h / 2, S: P.cam.S, cx: P.cam.cx, cy: P.cam.cy, tilt: P.cam.tilt, yaw: P.cam.yaw });
}

// Zoom so that `b` (bounds in sheet units) fits the paper area, never larger than a gently enlarged full sheet.
export function fitTarget(board, b, extra = 0.34) {
  const fy = 0.95;
  const fit = (w, h) => Math.min(board.w / (w + extra), board.h / (h * fy + extra));
  const S = Math.min(fit(b.w, b.h), fit(1, 1) * 1.45);
  return { S: Math.max(S, 40), cx: b.cx, cy: b.cy };
}

// What the paper looks like right now: { faces, creases, mode } ready for drawFaces.
export function sceneOf(P) {
  const m = MODELS[P.mi];
  const flat = (st) => ({ faces: flatFaces(st), creases: st.creases, mode: {} });
  if (P.phase === 'reveal') {
    if (m.pose && P.poseK > 0) return { faces: poseFaces(P.st, m.pose, ease(Math.min(1, P.poseK))), creases: P.st.creases, mode: { posed: true } };
    return flat(P.st);
  }
  if (P.phase === 'turn' || (P.phase === 'undo' && P.anim.kind === 'turn')) {
    const psi = Math.PI * ease(Math.min(1, P.anim.t / P.anim.dur));
    return { faces: turnFaces(P.st, P.phase === 'undo' ? psi : psi), creases: P.st.creases, mode: {} };
  }
  if (P.phase === 'undo') {
    const pl = P.anim.plan;
    return { faces: foldFaces(P.st, pl, P.theta), creases: pl.creasesAll, mode: { fold: true, theta: P.theta, kind: pl.spec.kind } };
  }
  const pl = P.plan;
  if (pl && (P.theta > 1e-3 || P.phase !== 'idle' || pl.dir < 0)) {
    return { faces: foldFaces(P.st, pl, P.theta), creases: P.theta > 0.04 || pl.dir < 0 ? pl.creasesAll : P.st.creases, mode: { fold: true, theta: P.theta, kind: pl.spec.kind } };
  }
  return flat(P.st);
}
export { withCreases };
