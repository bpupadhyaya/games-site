// Names and commentary-style callouts. First names / nicknames only (no real people).
export const NAMES = ['Kofi', 'Mei', 'Tane', 'Arjun', 'Sadia', 'Thabo', 'Nimal', 'Liam', 'Priya', 'Imran', 'Zara', 'Mateo', 'Ayesha', 'Jabu', 'Hemi', 'Rohan', 'Chloe', 'Dev', 'Amara', 'Kasun', 'Ravi', 'Tess', 'Omar', 'Lena', 'Sione', 'Fatima', 'Jack', 'Anil', 'Noor', 'Ben', 'Kwame', 'Isla', 'Vikram', 'Hana', 'Brodie', 'Sunil', 'Mere', 'Callum', 'Rizwan', 'Tariq'];
export const NICKS = ['Spud', 'Bails', 'Rocket', 'Toast', 'Nugget', 'Duck', 'Biscuit', 'Smiley', 'Chips', 'Turbo', 'Sparrow', 'Bunny'];

export function teamNames(rng, n, exclude = []) {
  const pool = rng.shuffle(NAMES.filter((x) => !exclude.includes(x)));
  return pool.slice(0, n);
}

const P = (rng, arr) => rng.pick(arr);

export function boundaryLine(rng, kind, shot, aerial) {
  if (kind === 6) return P(rng, [`SIX! ${cap(shot)} and it is gone!`, 'SIX! Into the next postcode!', 'SIX! Clean as a whistle.', `SIX! ${cap(shot)}, absolutely launched.`, 'SIX! Out of the screws.']);
  return P(rng, [`FOUR! ${cap(shot)}, pure timing.`, 'FOUR! Found the gap.', `FOUR! ${cap(shot)} races away.`, aerial ? 'FOUR! In the air but safe, it bounces over the rope.' : 'FOUR! Pinged along the grass.', 'FOUR! No-one is catching that.']);
}
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function runsLine(rng, runs, shot) {
  if (runs === 0) return P(rng, ['Dot ball. Well fielded.', 'No run. Good ball.', 'Straight to a fielder.', `${cap(shot)}, but no run.`, 'Defended solidly.']);
  if (runs === 1) return P(rng, ['Single. Strike rotates.', `${cap(shot)} for one.`, 'Pushed into the gap, they scamper one.', 'One run.']);
  if (runs === 2) return P(rng, ['Two! Good running.', `${cap(shot)}, they come back for two.`, 'Two runs, sharp between the wickets.']);
  if (runs === 3) return P(rng, ['Three! Great running and no boundary needed.', 'They run three, hearts in mouths.']);
  return `${runs} runs! Superb running.`;
}
export const wicketLine = (rng, how, who, bowler) => {
  if (how === 'bowled') return P(rng, [`BOWLED! ${who} is castled.`, `BOWLED! Timber, ${bowler} strikes.`, `BOWLED! Through the gate, ${who} is gone.`]);
  if (how === 'caught') return P(rng, [`CAUGHT! ${who} finds the fielder.`, `OUT! A good catch, ${who} has to go.`, `CAUGHT! ${bowler} gets the breakthrough.`]);
  if (how === 'caught behind') return P(rng, [`CAUGHT BEHIND! A thin edge, ${who} is gone.`, 'GONE! Straight into the keeper\'s gloves.']);
  if (how === 'runout') return P(rng, [`RUN OUT! ${who} is short of the crease.`, `RUN OUT! A direct hit and ${who} walks.`, `RUN OUT! Mix-up and ${who} pays for it.`]);
  if (how === 'sixout') return `SIX AND OUT! ${who} clears the fence and the house rule says that is that.`;
  return `OUT! ${who} has to go.`;
};
export const missLines = (rng) => P(rng, ['Swing and a miss!', 'Beaten all ends up.', 'Missed it completely.', 'Left alone, it goes through.']);
export const edgeLines = (rng) => P(rng, ['Edged! It flies.', 'A thick edge, off it goes.', 'Top edge, in the air.']);
export const wideLine = (rng) => P(rng, ['WIDE. Extra run, bowl it again.', 'Wide! Too far outside.', 'Wide! Overpitched with the line.']);
export const noBallLine = (rng) => P(rng, ['NO BALL! Free hit coming.', 'NO BALL, a full toss above the waist. Free hit!']);
export const byeLine = (rng) => P(rng, ['Bye! It squirts away from the keeper.', 'A bye. They steal one.']);
export const droppedLine = (rng) => P(rng, ['DROPPED! A lifeline.', 'Put down! That one hit the hands.']);
export const overLine = (rng, runs, wk) => `End of the over: ${runs} run${runs === 1 ? '' : 's'}${wk ? `, ${wk} wicket${wk === 1 ? '' : 's'}` : ''}.`;

export const TIMING_CALLS = { PERFECT: 'Perfect timing', GOOD: 'Good timing' };
