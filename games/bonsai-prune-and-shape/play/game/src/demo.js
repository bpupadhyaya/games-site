// Demo trees for the title screen, figures and lessons: a commission trained by the coach for a while. Pure and deterministic; cached.
import { makeTree, stepTree, geo } from './tree.js';
import { advise, applyAdvice } from './coach.js';
import { commissionById } from './species.js';

const cache = new Map();
// Grows commission `id` for `seconds` of tree time (dt 0.2), asking the coach every 4 s when `train` is true.
export function demoTree(id, seconds = 56, train = true) {
  const key = id + ':' + seconds + ':' + train; if (cache.has(key)) return cache.get(key);
  const T = makeTree(id); void commissionById;
  for (let t = 0, n = 0; t < seconds; t += 0.2, n++) { stepTree(T, 0.2); if (train && n % 20 === 19) applyAdvice(T, advise(T)); }
  geo(T); cache.set(key, T); return T;
}
