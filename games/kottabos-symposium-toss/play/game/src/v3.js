// Shared hand-off between the 2D UI (view.js, menus.js, art.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is flipped by the presenter only while a WebGL context is alive; with it off every screen draws exactly
// as it did before (the 2D fallback). The 2D layer records what the presenter needs (events as they fire, where the title hero goes).
export const v3 = {
  on: false,
  events: [],          // sim events as they fire in play (hit, ting, plink, sink, clang ...), consumed by the presenter each frame
  heroRect: null,      // title screen: { x, y, w, h } in virtual units where the live 3D hero goes
  pressed: null,       // { x, y } while the pointer is down
  dim: 0,              // 0..1: how much the flow screens dim the 3D scene behind them
};
