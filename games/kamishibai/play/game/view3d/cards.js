// Picture cards in 3D: each card is a thin paper slab with its painted picture (drawn by the same 2D painter the fallback uses) on the front.
// Textures are cached (LRU); the front card on the stage re-draws a few times a second so its picture lives (sun rays, bobbing figures).
import { THREE } from '../vendor3d/index.js';
import { drawCard } from '../src/art.js';
import { STORIES } from '../src/stories.js';
import { cardBackFace } from '../src/cardface.js';
import { captionFor } from '../src/stories.js';
import { CARD_W, CARD_H } from './butai.js';

const TEX_W = 640, TEX_H = 480;

let GEO = null;
function cardGeometry() {
  if (GEO) return GEO;
  const w = CARD_W, h = CARD_H, r = Math.min(w, h) * 0.06, d = 0.004;
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.0007, bevelSize: 0.0007, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -d / 2);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  uv.needsUpdate = true;
  GEO = g;
  return g;
}

export function createCardKit({ maxTex = 28, aniso = 4 } = {}) {
  const cache = new Map();       // key -> { tex, canvas, t }
  let tick = 0;
  const paintFront = (cv, card, t, anim) => {
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#fbf4de'; g.fillRect(0, 0, cv.width, cv.height);
    drawCard(g, card, { x: 0, y: 0, w: cv.width, h: cv.height }, { t, anim, shadowAlpha: 0, radius: 1 });
  };
  const paintBack = (cv, text) => {
    const g = cv.getContext('2d');
    g.fillStyle = '#f4ead0'; g.fillRect(0, 0, cv.width, cv.height);
    const k = cv.width / 300; g.save(); g.scale(k, k);
    cardBackFace(g, { x: 0, y: 0, w: 300, h: 225 }, text);
    g.restore();
  };
  function texture(key, make, redraw) {
    let e = cache.get(key);
    if (!e) {
      const cv = document.createElement('canvas'); cv.width = TEX_W; cv.height = TEX_H;
      make(cv);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = aniso; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
      e = { tex, cv, t: 0, last: 0, redraw };
      cache.set(key, e);
      if (cache.size > maxTex) {
        let oldest = null;
        for (const [k, v] of cache) if (!v.pinned && (!oldest || v.last < oldest[1].last)) oldest = [k, v];
        if (oldest) { oldest[1].tex.dispose(); cache.delete(oldest[0]); }
      }
    }
    e.last = ++tick;
    return e;
  }
  const front = (story, idx) => texture(`f:${story}:${idx}`, (cv) => paintFront(cv, STORIES[story].cards[idx], 0, false));
  const back = (story, idx, tier, show) => { const text = show ? captionFor(STORIES[story].cards[idx], tier) : 'Lines are hidden in Settings.'; return texture(`b:${story}:${idx}:${show ? tier : 'x'}`, (cv) => paintBack(cv, text)); };
  // a living picture: redraws the same texture with the clock (for the card on the stage)
  const live = (story, idx, t) => {
    const key = `l:${story}:${idx}`;
    const e = texture(key, (cv) => paintFront(cv, STORIES[story].cards[idx], t, true));
    e.pinned = true;
    if (t - e.t > 0.09 || t < e.t) { paintFront(e.cv, STORIES[story].cards[idx], t, true); e.tex.needsUpdate = true; e.t = t; }
    return e;
  };
  const unpinLive = () => { for (const [k, v] of cache) if (k[0] === 'l') v.pinned = false; };
  return { front, back, live, unpinLive, dispose() { for (const v of cache.values()) v.tex.dispose(); cache.clear(); } };
}

// One physical card. `setFace(entry)` swaps the picture; transform it like any Object3D (x, y metres, z towards the audience).
export function makeCardMesh() {
  const paper = new THREE.MeshStandardMaterial({ color: '#efe5c6', roughness: 0.9 });
  const face = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.78, metalness: 0, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.34 });
  const m = new THREE.Mesh(cardGeometry(), [face, paper]);
  m.castShadow = true; m.receiveShadow = true;
  m.userData.setFace = (e) => {
    if (m.userData.face === e) return;
    m.userData.face = e;
    face.map = e ? e.tex : null; face.emissiveMap = e ? e.tex : null; face.needsUpdate = true;
  };
  return m;
}
