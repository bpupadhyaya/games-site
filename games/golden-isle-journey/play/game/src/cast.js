// Character sheets used for screenshots and visual checks (seeds 9101, 9107-9110).
import { W, H, PAL, sky, finish, filigree, light, motes, shadow } from './stage.js';
import { figure, poses, tenCrowned, throne, stridePose, cycleLength } from './puppets.js';
import { portrait } from './portraits.js';
import { headShot, partsFor } from './paint/rig.js';
import { eagle } from './paint/creatures.js';
import { blit } from './paint/kit.js';

const WHO = ['prince', 'princess', 'brother', 'regent', 'swift', 'vking', 'tenking', 'eagle'];

export function renderCast(ctx, t) {
  sky(ctx, PAL.dusk.sky, null);
  light(ctx, W / 2, 700, 700, '255,170,100', 0.3);
  WHO.forEach((who, i) => portrait(ctx, { who, x: 96 + (i % 4) * 176, y: 165 + Math.floor(i / 4) * 300, r: 74, t }));
  ctx.fillStyle = 'rgba(8,3,8,0.7)'; ctx.fillRect(0, 780, W, H - 780);
  filigree(ctx, 20, 800, W - 40, 720, 0.7);
  const y = 1300;
  figure(ctx, { x: 90, y, s: 1.7, kind: 'prince', prop: 'bow', pose: poses.drawBow(t, 0.5, -0.05) });
  figure(ctx, { x: 240, y, s: 1.7, kind: 'princess', pose: poses.stand(t) });
  figure(ctx, { x: 370, y, s: 1.7, kind: 'brother', prop: 'bow', pose: poses.walk(t, 4) });
  figure(ctx, { x: 500, y, s: 1.7, kind: 'leaper', prop: 'mace', pose: { ...poses.stand(t), shF: 0.5, elF: 0.9 } });
  figure(ctx, { x: 620, y, s: 1.7, kind: 'king', pose: poses.stand(t) });
  figure(ctx, { x: 120, y: 1490, s: 1.1, kind: 'leaper', prop: 'mace', pose: poses.kneel(t) });
  figure(ctx, { x: 250, y: 1490, s: 1.1, kind: 'vanara', prop: 'stone', pose: poses.carry(t, 4) });
  figure(ctx, { x: 380, y: 1490, s: 1.1, kind: 'raider', prop: 'spear', pose: poses.walk(t, 5) });
  figure(ctx, { x: 500, y: 1490, s: 1.1, kind: 'citizen', prop: 'lamp', pose: poses.stand(t) });
  figure(ctx, { x: 620, y: 1490, s: 1.1, kind: 'woman', pose: poses.stand(t) });
  finish(ctx, 0.5);
}

// Close-up sheets: a single hero large, for judging the painting.
export function renderSheet(ctx, t, which) {
  sky(ctx, PAL.dusk.sky, null); light(ctx, W / 2, 800, 800, '255,170,100', 0.4);
  if (which === 'hands') { // isolated hand shapes, large: one row per hp, one column per kind (debug sheet, not shipped art)
    const kinds = ['prince', 'leaper', 'raider'];
    const hps = ['relaxed', 'grip', 'open', 'point'];
    hps.forEach((hp, r) => { const y = 260 + r * 340;
      ctx.fillStyle = '#fff'; ctx.font = '24px sans-serif'; ctx.fillText(hp, 10, y - 70);
      kinds.forEach((kind, c) => { const { S } = partsFor(kind, 0, true); ctx.save(); ctx.translate(140 + c * 200, y); ctx.scale(6, 6); blit(ctx, S.hand(hp)); ctx.restore(); }); });
    figure(ctx, { x: 250, y: 1650, s: 3.2, hi: true, kind: 'leaper', prop: 'mace', pose: { ...poses.stand(0.4), shF: 0.5, elF: 0.9, propA: 2.9 } });
    figure(ctx, { x: 570, y: 1650, s: 3.2, hi: true, kind: 'prince', prop: 'bow', pose: poses.drawBow(0.4, 0.8, -0.1) });
    return; }
  if (which === 'walk') { // gait strips: 10 frames across one cycle; the tick under each figure marks where the planted front foot should stay
    const rows = [['brother_f', false, 'bow'], ['princess', false, null], ['prince', false, null], ['leaper', false, 'mace'], ['prince_f', true, null], ['leaper', true, null]];
    rows.forEach(([kind, run, prop], r) => { const y = 270 + r * 250, sc = 0.78, C = cycleLength(kind, sc, run);
      ctx.strokeStyle = 'rgba(255,230,180,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, y + 6); ctx.lineTo(W - 10, y + 6); ctx.stroke();
      for (let i = 0; i < 10; i++) figure(ctx, { x: 40 + i * 71, y, s: sc, kind, prop, noShadow: true, cape: kind === 'leaper' && run ? '#2b8a62' : null, pose: stridePose(kind, C * i / 10, sc, { run, t: i * 0.12 }) }); });
    return; }
  if (which === 'faces') { // the four leads: calm, joyful large; the other moods and the in-game head size on the right
    ['prince', 'princess', 'brother', 'bharat'].forEach((k, i) => { const y = 330 + i * 385;
      headShot(ctx, k, 120, y, 4.6, 'calm'); headShot(ctx, k, 370, y, 4.6, 'joyful');
      ['determined', 'sorrowful', 'wrathful'].forEach((e, j) => headShot(ctx, k, 545 + (j % 2) * 105, y - 195 + Math.floor(j / 2) * 135, 1.6, e));
      figure(ctx, { x: 655, y: y + 75, s: 0.85, kind: k, pose: poses.stand(0.4), noShadow: true }); });
    return; }
  if (which === 'hanuman') {
    if (t >= 0) { // ceremonial dress large, field dress beside it, both heads, and the small in-flight figure
      figure(ctx, { x: 200, y: 1130, s: 3.3, hi: true, kind: 'leaper_c', prop: 'mace', pose: { ...poses.stand(0.4), shF: 0.5, elF: 0.9, propA: 2.9 } }); headShot(ctx, 'leaper_c', 545, 400, 4.0, 'calm');
      figure(ctx, { x: 560, y: 1130, s: 2.2, hi: true, kind: 'leaper', prop: 'mace', cape: '#2b8a62', pose: { ...poses.stand(0.4), shF: 0.5, elF: 0.9, propA: 2.9 } });
      headShot(ctx, 'leaper', 110, 250, 2.2, 'joyful'); headShot(ctx, 'leaper', 250, 250, 2.2, 'determined');
      figure(ctx, { x: 120, y: 1500, s: 1.6, kind: 'leaper', prop: 'mace', pose: poses.strike(0.3, 0.3) }); figure(ctx, { x: 330, y: 1500, s: 1.6, kind: 'leaper_c', prop: 'mace', pose: poses.kneel(0.3) }); figure(ctx, { x: 560, y: 1400, s: 1.3, kind: 'leaper', prop: 'mace', cape: '#2b8a62', pose: poses.fly(0.4) });
      finish(ctx, 0.2); return; }
    figure(ctx, { x: 330, y: 1250, s: 5.2, hi: true, kind: 'leaper', prop: 'mace', pose: { ...poses.stand(0.4), shF: 0.5, elF: 0.9, propA: 2.9 } });
    figure(ctx, { x: 120, y: 1490, s: 1.5, kind: 'leaper', prop: 'mace', pose: poses.strike(0.3, 0.5) });
    figure(ctx, { x: 560, y: 1490, s: 1.5, kind: 'leaper', pose: poses.fly(0.4) });
  } else if (which === 'throne') {
    throne(ctx, 360, 1300, 560, 900);
    tenCrowned(ctx, { x: 360, y: 1200, s: 1.5, t, heads: null, seated: true });
  } else if (which === 'pair') {
    figure(ctx, { x: 170, y: 1230, s: 2.9, hi: true, kind: 'prince', prop: 'bow', pose: poses.holdBow(0.4) });
    figure(ctx, { x: 520, y: 1230, s: 2.9, hi: true, kind: 'princess', pose: poses.stand(0.4) });
    headShot(ctx, 'prince', 150, 420, 4.6, 'calm'); headShot(ctx, 'princess', 400, 420, 4.6, 'calm'); headShot(ctx, 'prince_f', 620, 420, 4.0, 'determined');
    figure(ctx, { x: 110, y: 1510, s: 1.25, kind: 'prince_f', prop: 'bow', pose: poses.drawBow(0.4, 0.8, -0.1) }); figure(ctx, { x: 300, y: 1510, s: 1.25, kind: 'princess_f', pose: poses.walk(0.3, 4) });
    figure(ctx, { x: 450, y: 1510, s: 1.25, kind: 'prince', pose: poses.walk(0.9, 4) }); figure(ctx, { x: 610, y: 1510, s: 1.25, kind: 'princess', pose: poses.walk(0.5, 4) });
  } else if (which === 'men') {
    eagle(ctx, 300, 300, 1.45, 0.12, 1); eagle(ctx, 590, 560, 0.62, 0.5, -1);
    figure(ctx, { x: 120, y: 1500, s: 2.0, hi: true, kind: 'brother', prop: 'bow', pose: poses.holdBow(0.4) });
    figure(ctx, { x: 350, y: 1500, s: 2.0, hi: true, kind: 'king', pose: poses.stand(0.4) });
    figure(ctx, { x: 580, y: 1500, s: 2.0, hi: true, kind: 'raider', prop: 'spear', pose: { ...poses.stand(0.4), shF: 0.7, elF: 0.9, propA: 3.1 } });
    figure(ctx, { x: 100, y: 1000, s: 1.45, kind: 'vking', pose: poses.stand(0.4) });
    figure(ctx, { x: 270, y: 1000, s: 1.45, kind: 'vanara', v: 2, prop: 'stone', pose: poses.carry(0.4, 4) });
    figure(ctx, { x: 450, y: 1000, s: 1.45, kind: 'vanara', v: 3, prop: 'mace', pose: poses.strike(0.3, 0.4) }); figure(ctx, { x: 620, y: 1000, s: 1.45, kind: 'bharat', pose: poses.stand(0.4) });
  }
  finish(ctx, 0.4);
}

// The app icon: the leaper in flight against a glowing dusk sky, inside a gold border. Drawn in the
// square (0, 420)-(720, 1140) of the canvas so a screenshot can be cropped to it.
import { sun, sea, skyline, clouds, stars, vignette, rays } from './stage.js';

export function renderIcon(ctx, t) {
  const Y = 420, S = 720;
  ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.beginPath(); ctx.rect(0, Y, S, S); ctx.clip(); ctx.translate(0, Y - 0);
  sky(ctx, PAL.dusk.sky, null);
  stars(ctx, 0.8, t, 0, 260);
  sun(ctx, 470, 500, 130, '255,206,130');
  light(ctx, 470, 500, 430, '255,170,100', 0.6);
  rays(ctx, { x: 470, y: 500, dir: -Math.PI / 2, n: 9, len: 800, spread: 2.4, rgb: '255,196,120', alpha: 0.2 });
  clouds(ctx, { y: 120, h: 200, scroll: 0, color: 'rgba(90,40,90,0.55)', n: 4, seed: 3 });
  skyline(ctx, { base: 640, scroll: 40, color: '#2a1438', seed: 5, h: 120, gap: 100, kind: 'lanka', lit: '255,200,110', t: 0 });
  sea(ctx, { y: 632, t: 0, scroll: 0, colors: ['#3a2a5e', '#2a1f4e', '#1d163e', '#140f2e', '#0c0920'], crest: '255,190,130', bottom: S + 40 });
  light(ctx, 330, 320, 320, '255,205,130', 0.45);
  figure(ctx, { x: 300, y: 430, s: 1.9, hi: true, kind: 'leaper', prop: 'mace', cape: '#2b8a62', pose: poses.fly(0.4) });
  vignette(ctx, 0.5);
  ctx.restore();
}
