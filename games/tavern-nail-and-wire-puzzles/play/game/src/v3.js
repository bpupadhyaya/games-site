// Hand-off between the flat UI layer and the 3D presenter (pure data; nothing here touches the simulation).
// on: the WebGL scene is behind the transparent canvas; req: the wire scene this frame wants drawn (rect + scene description).
export const v3 = { on: false, req: null, grip: null, t: 0, look: 'taproom' };
