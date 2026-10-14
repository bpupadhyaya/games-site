// Shared flag between the 3D presenter (web/view3d) and the 2D drawing: true while the 3D scene is live behind the (transparent) kit
// canvas. When it is false (no WebGL2, lost context, ?fig=2d) the 2D scene in scene.js and porter.js is drawn exactly as before.
export const mode3d = { on: false };
