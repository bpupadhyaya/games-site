// 3D fisher for Bozo Net Casting (game-owned presenter). The simulation (web/src) is untouched and pure: this file only READS the pose numbers
// the art layer hands it (hand targets, body twist) and poses a real 3D person (platform/view3d athlete) from behind. It renders into a small
// transparent WebGL canvas with a near-orthographic camera and returns a `blit` that the 2D art draws between the back and front halves of the
// net ring. Any failure (no WebGL2, context loss, import error) returns null and art.js draws its 2D figure instead.
const LIB = '../vendor3d/index.js';
const RX = 1.0, Y0 = -0.12, Y1 = 2.1;             // metres copied out: x in [-RX, RX], y in [Y0, Y1]
const DIST = 60, ELEV = 14 * Math.PI / 180;       // far, narrow camera behind and a little above the fisher

export async function createFisherRenderer({ quality = 'medium' } = {}) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fisher', e); return null; }
  const { createStage, loadHuman, buildClip, THREE } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;left:-99999px;top:0;width:100px;height:100px;pointer-events:none;visibility:hidden';
  document.body.appendChild(canvas);
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', transparent: true, shadows: false, preserveDrawingBuffer: true, mode: 'continuous' });
  if (!stage.supported) { canvas.remove(); return null; }
  stage.setSky(null, null);
  let human;
  try {
    human = await loadHuman({ character: 'athlete_m', skin: 'brown', hair: 'black', castShadow: false,
      kit: { top: '#2f4a7a', bottoms: '#5a4a36', socks: '#5a4a36', shoes: '#4a3a28', trim: '#6286c0' } });
  } catch (e) { console.warn('view3d character failed', e); stage.dispose(); return null; }
  try { human.setKit({ top: '#2f4a7a', bottoms: '#5a4a36', socks: '#6b4a30', shoes: '#6b4a30' }); } catch { /* cosmetic */ }
  stage.add(human); stage.track(human);
  human.play('ready_stance', { fade: 0 });
  human.update(0);
  human.setFacing(0);                              // facing +z, away from the camera, which sits behind at -z

  // A wide woven hat: flat brim and a low crown, kept upright above the head bone's world position.
  const hatMat = new THREE.MeshStandardMaterial({ color: 0xd8b878, roughness: 0.9 });
  const hat = new THREE.Group();
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.018, 40), hatMat); hat.add(brim);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.125, 0.12, 32), hatMat); crown.position.y = 0.07; hat.add(crown);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.128, 0.025, 32), new THREE.MeshStandardMaterial({ color: 0x7a5a2a, roughness: 0.9 })); band.position.y = 0.03; hat.add(band);
  stage.add(hat);

  // One looping clip indexed by body twist: t = (twist + 0.5) in 0..1. Positive twist = turn towards the fisher's RIGHT (screen right from behind).
  const keys = [];
  for (let k = 0; k <= 10; k++) {
    const t = k / 10, tw = (t - 0.5) * 2;           // -1..1
    keys.push({ t, ease: 'linear', pose: {
      Spine: { flex: 7, twist: -34 * tw, side: 4 * tw },
      Head: { twist: 14 * tw, flex: -4 },
      Pelvis: { pos: [0, -0.03, 0], twist: -6 * tw },
      R_Thigh: { flex: 6 }, L_Thigh: { flex: 6 }, R_Calf: { flex: 10 }, L_Calf: { flex: 10 },
    } });
  }
  human.addClip(buildClip(human, { name: 'twist', duration: 1, fps: 30, base: 'ready_stance', keys, fingers: 'relaxed' }));
  human.play('twist', { fade: 0, speed: 0 });

  const sh = { L: human.bonePosition('L_UpperArm'), R: human.bonePosition('R_UpperArm') };
  let lastT = null, light = '', lost = false;
  stage.onContextLost(() => { lost = true; });
  stage.onContextRestored(() => { lost = false; });
  const v = new THREE.Vector3();

  // o: { hands: [[x,y],[x,y]] metres (screen-right, up; [0] = fisher's left hand, [1] = right), z: [zL, zR] forward metres, twist (rad),
  //      mode, u, night, warm, t, grip: [bool, bool] }.  Draws nothing yet: returns { blit(ctx, k), hand(i) } or null.
  const render = function (k, o) {
    if (lost || stage.contextLost) return null;
    try {
      let w = Math.max(16, Math.round(2 * RX * k)), h = Math.max(16, Math.round((Y1 - Y0) * k));
      const cap = Math.min(1, 1100 / Math.max(w, h)); w = Math.round(w * cap); h = Math.round(h * cap);
      if (canvas.clientWidth !== w || canvas.clientHeight !== h) { canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; }
      stage.setSize(w, h);
      const cam = stage.camera, ym = (Y0 + Y1) / 2;
      cam.fov = (2 * Math.atan((Y1 - Y0) / 2 / DIST) * 180) / Math.PI;
      cam.position.set(0, ym + DIST * Math.sin(ELEV), -DIST * Math.cos(ELEV)); cam.lookAt(0, ym, 0); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      const want = o.night ? 'night' : o.warm ? 'evening' : 'day';
      if (want !== light) { light = want; stage.setLighting(want); stage.setSky(null, null); }
      const tr = human.current, tw = Math.max(-1, Math.min(1, (o.twist || 0) / 0.5));
      if (tr) { tr.speed = 0; tr.warp = null; tr.time = (tw * 0.5 + 0.5) * tr.clip.dur; }
      // hand targets in world space (the fisher faces +z; screen right is world -x)
      const aim = (i) => ({ x: -o.hands[i][0], y: o.hands[i][1], z: o.z[i] });
      human.setReach('L', aim(0), { weight: 1, pole: { x: -o.hands[0][0] + 0.25, y: o.hands[0][1] - 0.45, z: o.z[0] - 0.25 } });
      human.setReach('R', aim(1), { weight: 1, pole: { x: -o.hands[1][0] - 0.25, y: o.hands[1][1] - 0.45, z: o.z[1] - 0.25 } });
      human.setFingers('L', o.grip[0] ? 'fist' : 'relaxed'); human.setFingers('R', o.grip[1] ? 'fist' : 'open');
      const dt = lastT === null ? 0 : Math.min(0.1, Math.max(0, o.t - lastT)); lastT = o.t;
      stage.update(dt, { renderNow: false });
      if (stage.contextLost) return null;
      const hp = human.bonePosition('Head'); hat.position.set(hp.x, hp.y + 0.1, hp.z); hat.rotation.set(0, 0, 0);
      stage.render();
      // project the hands to screen (metres from the feet, right/up) so the folded net can hang from the real hand
      const proj = (name, bone) => {
        const p = bone ? human.bonePosition(bone) : human.handPosition(name); v.set(p.x, p.y, p.z).project(cam);
        return { x: v.x * RX, y: ym + v.y * (Y1 - Y0) / 2 };
      };
      const hl = proj('L'), hr = proj('R');
      const fl = proj(null, 'L_Foot'), fr = proj(null, 'R_Foot'), tl = proj(null, 'L_Toe0'), tr2 = proj(null, 'R_Toe0');
      const feet = [[(fl.x + tl.x) / 2, (fl.y + tl.y) / 2], [(fr.x + tr2.x) / 2, (fr.y + tr2.y) / 2]];
      // the trainers of the athlete model are cut off at the ankle: the fisher stands barefoot in the hull's water-line shadow
      return { blit(ctx) {
        // full above 0.3 m, fading to nothing by 0.17 m (strips of the same image)
        const W2 = 2 * RX * k, H2 = (Y1 - Y0) * k, py = (y) => -y * k, S = 6, top = 0.3, bot = 0.17;
        ctx.save(); ctx.beginPath(); ctx.rect(-RX * k, -Y1 * k, W2, (Y1 - top) * k); ctx.clip(); ctx.drawImage(canvas, -RX * k, -Y1 * k, W2, H2); ctx.restore();
        for (let s = 0; s < S; s++) {
          const y1 = top - ((top - bot) * s) / S, y0 = top - ((top - bot) * (s + 1)) / S;
          ctx.save(); ctx.globalAlpha *= 1 - (s + 0.5) / S; ctx.beginPath(); ctx.rect(-RX * k, py(y1), W2, (y1 - y0) * k + 0.5); ctx.clip(); ctx.drawImage(canvas, -RX * k, -Y1 * k, W2, H2); ctx.restore();
        }
      }, handL: hl, handR: hr, feet };
    } catch (e) { lost = true; console.warn('3D fisher disabled', e); return null; }
  };
  render.stage = stage;                              // dev only: context-loss test
  return render;
}
