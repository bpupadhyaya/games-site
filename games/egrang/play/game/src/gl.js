// The optional 3D people layer (web/view3d). main.js sets GL.p once the presenter is ready; every draw call checks it, so without WebGL2, with
// ?nogl, or while the assets are still loading the 2D figures play unchanged.
export const GL = { p: null };
export const gl3d = () => (GL.p && GL.p.ready && !GL.p.lost ? GL.p : null);
