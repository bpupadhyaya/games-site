// Turns a solver step (solver.js nextStep) into a headline and a plain-language reason, in English or Japanese.
import { getLang } from './content.js';
import { FILLED, CROSSED } from './solver.js';

const ja = () => getLang() === 'ja';
export const lineName = (axis, k) => (ja() ? `${k + 1}${axis === 'row' ? '行目' : '列目'}` : `${axis === 'row' ? 'Row' : 'Column'} ${k + 1}`);
export const clueText = (clue) => (clue.length ? clue.join(' ') : '0');

function headOf(step) {
  const f = step.cells.filter((c) => c.v === FILLED).length, x = step.cells.filter((c) => c.v === CROSSED).length;
  const ln = lineName(step.axis, step.k);
  if (ja()) {
    const parts = [];
    if (f) parts.push(`${f}マスを塗る`);
    if (x) parts.push(`${x}マスにバツ`);
    return `${ln}: ${parts.join('、')}`;
  }
  const parts = [];
  if (f) parts.push(`fill ${f} square${f > 1 ? 's' : ''}`);
  if (x) parts.push(`cross out ${x}`);
  const text = parts.join(' and ');
  return `${ln}: ${text}`;
}

function reasonOf(step) {
  const w = step.why, c = clueText(step.clue), ln = lineName(step.axis, step.k);
  if (ja()) {
    switch (w.tech) {
      case 'zero': return `${ln}のヒントは0なので、この線のマスはすべて空です。`;
      case 'full': return `ヒント「${c}」は、連続の間の空きを入れてちょうど${w.need}マス必要で、線の長さも${w.n}マスです。置き方は一通りしかありません。`;
      case 'complete': return `塗られたマスはすでにヒント「${c}」と一致しています。この線の残りはすべて空です。`;
      case 'overlap': return `ヒント「${c}」には${w.n}マス中${w.need}マス必要で、余りは${w.slack}マスだけです。${w.nth}番目の連続（${w.block}マス）は左右どちらにずらしても、真ん中の${w.cells}マスを必ず通ります。だからそこは塗られます。`;
      case 'edge': return w.side === 'start'
        ? `${w.shifted ? '端のバツのすぐ隣' : '線の端'}のマスが塗られているので、最初の連続（${w.block}マス）はそこから始まります。残りを塗り、すぐ後ろにバツをつけます。`
        : `${w.shifted ? '端のバツのすぐ隣' : '線の端'}のマスが塗られているので、最後の連続（${w.block}マス）はそこで終わります。残りを塗り、すぐ手前にバツをつけます。`;
      case 'gap': return `${w.run}マスだけの空きは、最も短い連続（${w.smallest}マス）より短いので、何も入りません。バツをつけます。`;
      default: return `ヒント「${c}」の連続を、すでにある印と合う形ですべて置いてみると、これらのマスはどの置き方でも同じになります。`;
    }
  }
  switch (w.tech) {
    case 'zero': return `${ln} has the clue 0, so every square in it is empty.`;
    case 'full': return `The clue ${c} needs ${w.need} squares (the runs plus one gap between them) and the line is exactly ${w.n} long, so there is only one way to place it.`;
    case 'complete': return `The filled squares already match the clue ${c}, so everything else in this line is empty.`;
    case 'overlap': return `The clue ${c} needs ${w.need} of the ${w.n} squares, leaving only ${w.slack} spare. Slide run ${w.nth} (${w.block} long) all the way left or all the way right and it still covers the middle ${w.cells} squares, so those are filled.`;
    case 'edge': return w.side === 'start'
      ? `A filled square ${w.shifted ? 'sits right next to the crosses at the start of the line' : 'touches the start of the line'}, so the first run (${w.block} long) begins right there. Fill the rest of it and cross out the square just after it.`
      : `A filled square ${w.shifted ? 'sits right next to the crosses at the end of the line' : 'touches the end of the line'}, so the last run (${w.block} long) finishes right there. Fill the rest of it and cross out the square just before it.`;
    case 'gap': return `A stretch of ${w.run} open square${w.run > 1 ? 's' : ''} is shorter than the smallest run left (${w.smallest}), so nothing can fit there. Cross it out.`;
    default: return `Try every way to place the runs ${c} in this line, with the marks already there. All of them agree on these squares.`;
  }
}

export function explainStep(step) {
  let why = reasonOf(step);
  const f = step.cells.some((c) => c.v === FILLED), x = step.cells.some((c) => c.v === CROSSED);
  const t = step.why.tech;
  if (f && x && (t === 'overlap' || t === 'edge')) why += ja() ? ' バツをつけるマスは、どの置き方でも届かないマスです。' : ' The squares to cross out are ones that no way of placing the runs can reach.';
  else if (f && x && t === 'gap') why += ja() ? ' 塗るマスは、残りの連続のどの置き方でも同じになるマスです。' : ' The squares to fill are the ones every placement of the remaining runs agrees on.';
  return { head: headOf(step), why };
}

export function explainBad(bad, puz) {
  const clue = bad.axis === 'row' ? puz.rows[bad.k] : puz.cols[bad.k];
  const ln = lineName(bad.axis, bad.k);
  return {
    head: ja() ? `${ln}を確認` : `Check ${ln}`,
    why: ja() ? `${ln}の印がヒント「${clueText(clue)}」と合いません。どれかが間違っています。空のはずのマスを塗っていないか、塗るはずのマスにバツをつけていないか見てください。`
      : `The marks in ${ln} do not fit its clue ${clueText(clue)}, so one of them is wrong. Look for a filled square that should be empty, or a crossed square that should be filled.`,
  };
}
