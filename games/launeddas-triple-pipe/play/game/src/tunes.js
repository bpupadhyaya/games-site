// The four tunes. A tune is a tuning (tonic and the five pad pitches), a tempo, named phrases and an arrangement.
// A phrase is 16 steps (eighth notes). Step tokens: `.` rest, digits 1-5 = one note on that lane (1 2 = low pipe, 3 4 5 = high pipe),
// several digits = played together (`13`), `T4` = a quick trill (the note and its repeat half a step later).
// Lanes: 0 L1, 1 L2 (mancosa, the left-hand pipe)  2 H1, 3 H2, 4 H3 (mancosedda, the right-hand pipe).

export const LANE_NAMES = ['Low 1', 'Low 2', 'High 1', 'High 2', 'High 3'];
export const PIPE_OF = [0, 0, 1, 1, 1];            // 0 mancosa, 1 mancosedda

export const TUNES = [
  {
    id: 'ballu-tundu', name: 'Ballu Tundu', form: 'round dance', blurb: 'A slow circle dance. Plenty of rests to breathe in.',
    bpm: 88, tonic: 50, low: [0, 4], high: [7, 9, 12], stars: 1,
    phrases: {
      A: '3 . 4 . 5 . 4 . 3 . . . 1 . . .',
      a: '3 . 4 . 5 . 5 4 3 . 4 . 2 . . .',
      B: '5 . 4 . 3 . 4 . 5 . . . 2 . 1 .',
      b: '5 4 3 . 4 3 . . 1 . 2 . 1 . . .',
    },
    arrangement: 'A a A B b B A a b A',
  },
  {
    id: 'passu-torrau', name: 'Passu Torrau', form: 'step dance', blurb: 'Steps that turn back. Low and high pipes answer each other.',
    bpm: 100, tonic: 52, low: [0, 3], high: [7, 10, 12], stars: 2,
    phrases: {
      A: '3 4 . 5 4 . 3 . 1 . 2 . 3 . . .',
      a: '3 4 . 5 4 . 3 . 1 . 2 . 13 . . .',
      B: '5 . 4 3 . 4 5 . T5 . 4 . 2 . 1 .',
      C: '4 . 3 . 24 . 3 . 4 . 5 . 4 3 . .',
    },
    arrangement: 'A a B A C B a C A B',
  },
  {
    id: 'fiorassiu', name: 'Fiorassiu', form: 'flower tune', blurb: 'Bright and quick, with ornaments that need a steady squeeze.',
    bpm: 112, tonic: 55, low: [0, 5], high: [9, 12, 14], stars: 3,
    phrases: {
      A: '3 3 4 . 5 4 3 . 1 . 2 1 . . . .',
      B: '5 4 5 . T4 . 3 4 . 5 . 25 . . 1 .',
      C: '1 . 3 . 4 . 5 4 3 4 5 . 2 . 13 .',
      D: 'T5 . 4 3 . 4 3 . 2 1 . 2 . . . .',
    },
    arrangement: 'A B C D A C B D A B C D',
  },
  {
    id: 'puntu-organu', name: "Punt'e Organu", form: 'organ-point dance', blurb: 'The fast one. A minor second turns the mood. Breathe or fall silent.',
    bpm: 126, tonic: 57, low: [0, 3], high: [7, 8, 12], stars: 4,
    phrases: {
      A: '3 4 5 4 3 4 5 . 2 1 2 . 15 . . .',
      B: '5 5 4 4 3 . T3 . 4 5 . 2 1 . . .',
      C: '13 . 24 . 35 . 4 . T5 4 3 . 2 . 1 .',
      D: '5 4 3 4 5 . 5 . 4 3 2 3 4 . . .',
    },
    arrangement: 'A B C D B A D C A B C D',
  },
];
export const TUNE_BY_ID = Object.fromEntries(TUNES.map((t, i) => [t.id, i]));

export const LEAD = 3.2;                 // seconds of count-in before the first step
export const STEPS_PER_PHRASE = 16;

// midi note -> Hz
export const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
export const laneMidi = (tune, lane) => tune.tonic + 12 + (lane < 2 ? tune.low[lane] : tune.high[lane - 2]);

// Builds the chart: [{ at, lane, st: 0 pending | 1 hit | 2 missed, g: grade }] sorted by time, plus the end time.
export function buildChart(tune) {
  const stepDur = 60 / tune.bpm / 2;
  const notes = [];
  let step = 0;
  for (const key of tune.arrangement.split(' ')) {
    const toks = tune.phrases[key].split(' ');
    toks.forEach((tok, i) => {
      const s = step + i;
      if (tok === '.') return;
      const trill = tok[0] === 'T';
      const digits = trill ? tok.slice(1) : tok;
      for (const ch of digits) {
        const lane = Number(ch) - 1;
        notes.push({ at: LEAD + s * stepDur, lane, st: 0, g: 0 });
        if (trill) notes.push({ at: LEAD + (s + 0.5) * stepDur, lane, st: 0, g: 0 });
      }
    });
    step += STEPS_PER_PHRASE;
  }
  notes.sort((a, b) => a.at - b.at || a.lane - b.lane);
  return { notes, end: LEAD + step * stepDur + 0.6, stepDur, phraseCount: step / STEPS_PER_PHRASE };
}
