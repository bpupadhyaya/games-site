// The reasons shown by the Think button and in Watch & Learn. Every number comes from the engine (sim.js / ai.js):
// the route time from the real timeline, the chance from the same model the computer players use.
import { evaluateRound, airtime, needTime, HOME, dist } from './sim.js';
import { stoneName } from './content.js';

const pct = (v) => Math.min(99, Math.round(Math.max(0, Math.min(1, v)) * 100));
const sec = (v) => (Math.round(v * 100) / 100).toFixed(2);
const join = (L, names) => (names.length === 1 ? names[0] : L === 'ko' ? names.join(', ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

export function explainScatter(L) {
  return L === 'ko'
    ? '화면 가운데 근처에 돌을 뿌리세요. 너무 좁으면 돌이 서로 붙어 손이 스치고, 너무 넓으면 손이 멀리 가야 합니다. 누른 곳에서 바깥으로 끌어 원의 크기를 정하세요. 150 정도가 알맞습니다.'
    : 'Scatter near the middle of the mat. Too tight and the stones touch, so your hand brushes them; too wide and the hand has far to travel. Drag out from where you press to set the circle. About 150 wide is a good size.';
}

export function explainHold(L, five, ch) {
  const best = ch.values[0], worst = ch.values[ch.values.length - 1];
  const nb = stoneName(L, best.id), nw = stoneName(L, worst.id);
  if (Math.abs(best.v - worst.v) < 0.02) {
    return L === 'ko' ? `어느 돌을 들어도 비슷합니다. ${nb} 돌이 가장 무난합니다. 이 판은 약 ${pct(best.v)}%로 깰 수 있습니다.` : `Any stone works about as well here. The ${nb} stone is the safest. About ${pct(best.v)}% to clear this stage.`;
  }
  return L === 'ko'
    ? `${nb} 돌을 손에 드세요. 그 돌이 빠지면 남은 돌들을 서로 스치지 않고 집을 수 있어 이 판을 깰 확률이 약 ${pct(best.v)}%입니다. ${nw} 돌을 들면 약 ${pct(worst.v)}%밖에 되지 않습니다.`
    : `Hold the ${nb} stone. With it lifted out of the way the rest can be taken without brushing each other: about ${pct(best.v)}% to clear this stage. Holding the ${nw} stone would be only about ${pct(worst.v)}%.`;
}

export function explainPlan(L, mat, rdef, plan, ranked) {
  const roll0 = { ang: 0, u: 0 };
  if (rdef.kind === 'take') {
    const names = plan.targets.map((id) => stoneName(L, id));
    const ev = evaluateRound(mat, rdef, { targets: plan.targets, h: plan.h }, roll0);
    const need = needTime(mat, rdef, { targets: plan.targets }), T = airtime(plan.h);
    // would the nearest-first order have brushed a stone?
    const left = mat.slice(), near = [];
    let px = HOME.x, py = HOME.y;
    while (near.length < rdef.take && left.length) { left.sort((a, b) => dist(px, py, a.x, a.y) - dist(px, py, b.x, b.y)); const s = left.shift(); near.push(s.id); px = s.x; py = s.y; }
    // only mention it when the nearest-first set is the same stones in a different order, or a clipped alternative exists
    const alt = evaluateRound(mat, rdef, { targets: near, h: plan.h }, roll0);
    let extra = '';
    if (alt.fault && near.join() !== plan.targets.join()) {
      const hit = stoneName(L, alt.fault.id);
      extra = L === 'ko' ? ` 가까운 돌부터 집으면 ${hit} 돌을 스치게 됩니다.` : ` Going for the nearest stones first would brush the ${hit} stone.`;
    }
    if (ev.fault) extra += L === 'ko' ? ' (이 판에서는 스치지 않는 길이 없어 가장 덜 위험한 길입니다.)' : ' (No clean route exists here; this is the least risky.)';
    const head = rdef.take === 1
      ? (L === 'ko' ? `${names[0]} 돌을 집으세요.` : `Take the ${names[0]} stone.`)
      : (L === 'ko' ? `${names.join(' → ')} 돌 순서로 집으세요.` : `Take the ${join(L, names)} stones in this order.`);
    return L === 'ko'
      ? `${head} 길이 다른 돌을 스치지 않고 약 ${sec(need)}초가 걸립니다.${extra} 높이 약 ${pct((plan.h - 0.2) / 0.8)}%로 던지면 ${sec(T)}초 떠 있어 ${sec(T - ev.tBack)}초 여유가 남습니다. 성공 확률 약 ${pct(plan.p)}%.`
      : `${head} The route takes about ${sec(need)} s and keeps clear of the others.${extra} Toss to about ${pct((plan.h - 0.2) / 0.8)}% power: the stone stays up ${sec(T)} s, leaving about ${sec(T - ev.tBack)} s to spare. Chance this works: about ${pct(plan.p)}%.`;
  }
  if (rdef.kind === 'set') {
    const ev = evaluateRound(mat, rdef, { spot: plan.spot, h: plan.h }, roll0);
    const T = airtime(plan.h);
    return L === 'ko'
      ? `표시된 자리에 네 개를 모아 놓으세요. 손에서 너무 멀지 않아야 다녀오는 시간이 짧습니다. 높이 약 ${pct((plan.h - 0.2) / 0.8)}%로 던지면 ${sec(T)}초 떠 있어 ${sec(T - ev.tBack)}초 여유가 남습니다. 성공 확률 약 ${pct(plan.p)}%.`
      : `Set the four stones down at the marked spot: far enough from your hand to be legal, close enough to keep the trip short. Toss to about ${pct((plan.h - 0.2) / 0.8)}% power: ${sec(T)} s in the air leaves about ${sec(T - ev.tBack)} s to spare. Chance this works: about ${pct(plan.p)}%.`;
  }
  const ev = evaluateRound(mat, rdef, { h: plan.h }, roll0);
  const T = airtime(plan.h);
  return L === 'ko'
    ? `던진 뒤 네 개를 한꺼번에 쓸어 담고 돌아와야 합니다. 높이 약 ${pct((plan.h - 0.2) / 0.8)}%로 던지면 ${sec(T)}초 떠 있어 ${sec(T - ev.tBack)}초 여유가 남습니다. 성공 확률 약 ${pct(plan.p)}%.`
    : `Toss, sweep up all four stones and get back. Toss to about ${pct((plan.h - 0.2) / 0.8)}% power: ${sec(T)} s in the air leaves about ${sec(T - ev.tBack)} s to spare. Chance this works: about ${pct(plan.p)}%.`;
}

export function explainKkCharge(L) {
  return L === 'ko'
    ? '중간 높이(약 60%)로 던지세요. 너무 높이 던지면 돌이 넓게 흩어져 한 손으로 다 받기 어렵고, 너무 낮으면 손을 뒤집을 시간이 모자랍니다.'
    : 'Toss to about 60% power. Too high and the stones spread out so one hand cannot cover them; too low and there is no time to flip the hand.';
}
export function explainKkTap(L, b) {
  return L === 'ko'
    ? `지금 이 순간 ${b.n}개가 손등 높이에 내려와 있습니다. 반지름 안에 모여 있는 곳(표시된 링)에 손을 대고 있다가 돌이 내려올 때 손을 떼세요. 이렇게 하면 ${b.n}개를 받을 수 있습니다.`
    : `At this moment ${b.n} stones are low enough. Hold your palm over where they gather (the marked ring) and let go just as they drop to hand height. That would catch ${b.n}.`;
}
