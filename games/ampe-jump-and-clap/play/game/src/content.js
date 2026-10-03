// All reading text. Every number comes from consts.js so the Rules page can never drift from the engine.
import { TEMPOS, TIMING, LEVELS, AIR, JUMP_H, TARGETS, PRACTICE_BPM, RING_DUR } from './consts.js';

const ms = (x) => `${Math.round(x * 1000)} ms`;
const S = TIMING.standard, R = TIMING.relaxed;
const bpmList = TEMPOS.filter((t) => t.id !== 'practice' && !t.to).map((t) => `${t.name} ${t.bpm}`).join(', ');
const rising = TEMPOS.find((t) => t.to);
const cm = Math.round(JUMP_H * 100);

export const ABOUT = [
  { title: 'Ampe', p: [
    'Ampe is a children\'s jumping and clapping game from Ghana, also played in other countries of West Africa. It needs no equipment: two or more players face each other, clap and jump together, and throw out one foot.',
    'This is one common way to play it. Other groups keep score a little differently, and the chants and claps change from place to place.',
  ] },
  { title: 'About this version', p: [
    'Two figures face each other in a playground yard. A steady beat runs, both players clap and jump, and the foot you choose with the LEFT and RIGHT buttons is thrown out at the top of the jump.',
    'The computer opponent has five levels. The higher ones watch your habits and try to read your next foot, so rhythm is only half of the game: you also have to be hard to read.',
    'Jump and clap along if you like. It is a game to play with your whole body.',
  ] },
  { title: 'Credit', p: ['Thanks to the many Ghanaian children and families who have played and passed on this game.'] },
];

export const HOWTO = [
  { title: 'The beat', p: ['A steady beat runs. Each round is two beats: a small clap and hop, then the big jump with a clap. The drum and the swinging metronome at the top keep time.'] },
  { title: 'Choose a foot', p: [
    'A ring closes on the gold target just above the buttons. Tap LEFT or RIGHT as the ring reaches the target, exactly when your player takes off.',
    'The first tap in the timing window counts. A little early or late still counts, but a perfect tap earns a better grade.',
  ] },
  { title: 'The reveal', p: ['At the top of the jump both players clap and throw out the chosen foot. Letters L and R appear by the feet.'] },
  { title: 'Who scores', p: [
    'One player Leads, the other Follows. When the feet are the SAME, the Leader scores. When they are DIFFERENT, the Follower scores and becomes the Leader.',
    'A banner always tells you what you need: MATCH the computer\'s foot, or DIFFER from it.',
  ] },
  { title: 'Winning', p: [`The first to ${TARGETS[0]} points (or ${TARGETS[1]} in a full game) wins. The beat gets faster in Rising tempo.`] },
  { title: 'Think, Learn and Watch', p: ['Think shows what the computer tends to do and what you tend to do. Learn has six short lessons. Watch & Learn plays two computers against each other and explains each choice. Practice lets you tap with the beat without a score.'] },
];

export function rulesPages() {
  return [
    { title: 'The game', p: [
      'Ampe is played by two players who face each other. They clap and jump together, and at the top of each jump each one throws out one foot, left or right.',
      'In this game you play against the computer, or watch two computers play.',
    ] },
    { title: 'A round', p: [
      'A round lasts two beats. Beat 1: both players clap and make a small hop. Beat 2: both players take off, clap at the top of the jump and throw out the chosen foot.',
      `The big jump lasts ${ms(AIR)} and rises about ${cm} cm. Take-off is half the jump before beat 2; the feet are shown exactly on beat 2.`,
    ] },
    { title: 'Leader and Follower', p: [
      'In every round one player is the Leader and the other is the Follower. You lead the first round.',
      'If both players throw the SAME foot (both left or both right), the Leader scores one point and stays the Leader.',
      'If the feet are DIFFERENT, the Follower scores one point and becomes the Leader for the next round.',
    ] },
    { title: 'Choosing your foot', p: [
      `A ring closes on a target. It starts closing ${ms(RING_DUR)} before take-off and reaches the target at the moment of take-off. Tap LEFT or RIGHT (keyboard: A or Left arrow, D or Right arrow) around that moment.`,
      'Your first tap inside the timing window locks your foot for the round. Later taps in the same round do nothing.',
    ] },
    { title: 'Timing windows', p: [
      `Standard timing: PERFECT within ${ms(S.perfect)} of take-off, GOOD within ${ms(S.good)}, OK within ${ms(S.okEarly)} early or ${ms(S.okLate)} late.`,
      `Relaxed timing: PERFECT within ${ms(R.perfect)}, GOOD within ${ms(R.good)}, OK up to ${ms(R.okEarly)} early or ${ms(R.okLate)} late.`,
      'The grade shows how well you kept time. It never changes who scores: the foot you chose is thrown whatever the grade.',
    ] },
    { title: 'Early and missed taps', p: [
      `A tap earlier than the window (up to ${ms(S.early)} before take-off) shows TOO EARLY and is ignored: tap again. A tap after the window has closed shows TOO LATE and is ignored.`,
      `If no tap lands in the window, the beat is MISSED: your player stumbles, throws no foot, and the other player scores the point (and becomes the Leader if they were the Follower). If both players miss, the round is replayed. In Learn and Practice a miss costs nothing.`,
    ] },
    { title: 'Winning a game', p: [
      `A game is played to ${TARGETS[0]} points (quick) or ${TARGETS[1]} points (full). The first player to reach the target wins at once; there is no deuce.`,
    ] },
    { title: 'Tempo', p: [
      `Fixed tempos in beats per minute: ${bpmList}. Rising starts at ${rising.bpm} and adds ${rising.step} every ${rising.every} rounds, up to ${rising.to}.`,
      `Practice runs at ${PRACTICE_BPM} beats per minute.`,
    ] },
    { title: 'The five computer levels', p: LEVELS.map((l) => `Level ${l.id}, ${l.name}: ${l.blurb}`).concat([
      'Each level beats the one below it in long runs of games. The computer picks its foot before you tap and never sees your tap. Nobody can beat a player who chooses completely at random: the computer can only win by reading habits.',
    ]) },
    { title: 'Think', p: [
      'Think pauses the game and shows two things from the real history of the match: what you tend to do (and what to change) and what the computer tends to do. It never shows the computer\'s foot for the coming round.',
    ] },
    { title: 'Learn, Practice, Watch & Learn', p: [
      'Learn: six short lessons that teach the beat, each foot, and how to read a pattern as Leader and as Follower.',
      'Practice: an endless slow rhythm with no score so you can learn the timing.',
      'Watch & Learn: two computers play. Before each round you see THINK (what each side expects), REVEAL (what each chose) and then the round is played. Pause freezes everything.',
    ] },
    { title: 'Saving and settings', p: [
      'A match in progress is saved after every point. Continue on the title screen resumes it paused, with a new count-in.',
      'Settings: sound, drum volume, text size (100% to 300%), timing (Standard or Relaxed), a sync adjustment for your device, thinking time for Watch & Learn.',
    ] },
  ];
}

export const LESSONS = [
  { id: 'beat', title: '1. Feel the beat', goal: 'Tap on the ring 5 times out of 8', cfg: { mode: 'practice', tempo: 'practice', maxRounds: 8, script: [1] }, need: 5, kind: 'timing',
    intro: ['Tap LEFT or RIGHT as the ring reaches the gold target. Keep time with the drum and the swinging metronome.', 'Any foot is fine here. Only your timing counts.'] },
  { id: 'left', title: '2. The left foot', goal: 'Throw LEFT on time 5 times out of 6', cfg: { mode: 'practice', tempo: 'practice', maxRounds: 6, script: [1] }, need: 5, kind: 'left',
    intro: ['Your LEFT button throws your left foot. Throw it every round, in time.'] },
  { id: 'right', title: '3. The right foot', goal: 'Throw RIGHT on time 5 times out of 6', cfg: { mode: 'practice', tempo: 'practice', maxRounds: 6, script: [0] }, need: 5, kind: 'right',
    intro: ['Now the RIGHT foot, every round, in time.'] },
  { id: 'lead', title: '4. Leading: match', goal: 'Match the feet 4 times out of 6', cfg: { mode: 'learn', tempo: 'practice', maxRounds: 6, script: [1, 1, 0, 0, 1, 1, 0, 0], leader: 0 }, need: 4, kind: 'match',
    intro: ['You are the Leader. You score when the feet match.', 'This opponent plays a pattern: Right, Right, Left, Left, and again. Spot it and match it.'] },
  { id: 'follow', title: '5. Following: differ', goal: 'Differ from the opponent 5 times out of 6', cfg: { mode: 'learn', tempo: 'practice', maxRounds: 6, script: [1, 0, 1, 0, 1, 0], leader: 1 }, need: 5, kind: 'differ',
    intro: ['The opponent is the Leader. You score when the feet are DIFFERENT.', 'This opponent switches feet every round. Spot it and do the opposite.'] },
  { id: 'read', title: '6. Beat a habit', goal: 'Win a game to 5 against level 2', cfg: { mode: 'match', tempo: 'slow', target: 5, levels: [3, 2] }, need: 1, kind: 'win',
    intro: ['A real game to 5 points against a level 2 opponent. Use Think if you like.', 'Vary your feet so you are hard to read, and read theirs.'] },
];
