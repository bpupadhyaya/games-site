// Host-shell facts shared by every game. Browser/WebView only (safe to import anywhere: every read is guarded).
//
// `hostBackVisible()`: true when a floating host back button may cover the top-left corner of the page. The shells publish
// `window.__hostBack` (and `window.__safeInsets.back`); it defaults to "present" when the flag is missing (browsers, old
// shells) and is false only when explicitly false. Same logic as the expression games use inline:
//   s && s.back !== false && window.__hostBack !== false ? 56 * px : 0     (s = window.__safeInsets)
export const hostBackVisible = () => {
  const g = globalThis;
  return g.__hostBack !== false && g.__safeInsets?.back !== false;
};
