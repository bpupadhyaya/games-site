// Crowd helper: many people on one stage with automatic LOD, cheap far-away animation and one blob shadow each.
// three.js cannot GPU-instance skinned meshes, so "instancing-friendly" here means: every person shares one geometry set, one skeleton layout and one clip table, the
// light level is ONE draw call per person, and distant people are animated at a reduced rate.
//   const crowd = createCrowd(stage, { farEvery: 2 });          crowd.add(human, { phase: 0.37 });   crowd.update(dt);   crowd.stats()
import * as THREE from './three.js';

export function createCrowd(stage, { farEvery = 2, nearEvery = 1 } = {}) {
  const list = []; let frame = 0;
  const api = {
    list,
    add(human, { phase = 0 } = {}) {
      if (!human.lodSets || !human.lodSets.ready) throw new Error('view3d crowd: load the humans with loadHuman({ lod: "auto" })');
      stage.add(human); human.lodAuto = false;                    // the crowd drives LOD (and the animation rate) itself
      const entry = { human, acc: 0, phase };
      const tr = human.layers.base.current; if (tr && phase) tr.time = (phase * tr.clip.dur) % tr.clip.dur;
      list.push(entry); return entry;
    },
    remove(human) { const i = list.findIndex((e) => e.human === human); if (i >= 0) { list.splice(i, 1); stage.remove(human); } },
    /** Advance every person. LOD from screen size; light-level people update every `farEvery` frames with the accumulated dt. */
    update(dt) {
      frame++;
      const cam = stage.camera; cam.updateMatrixWorld();
      const vh = stage.renderer.domElement.height / stage.renderer.getPixelRatio();
      for (const e of list) {
        const h = e.human; h.autoLOD(cam, vh, stage.lodPolicy);
        e.acc += dt;
        const every = h.lod === 2 ? farEvery : nearEvery;
        if ((frame + list.indexOf(e)) % every === 0) { h.update(e.acc); e.acc = 0; }
      }
      if (stage.blobs) stage.blobs.sync(list.map((e) => e.human));
    },
    /** Counts per level (call after a render for triangles / draw calls from the renderer). */
    stats() {
      const levels = [0, 0, 0]; for (const e of list) levels[e.human.lod || 0]++;
      const info = stage.renderer.info.render;
      return { people: list.length, full: levels[0], medium: levels[1], light: levels[2], triangles: info.triangles, drawCalls: info.calls };
    },
  };
  return api;
}
