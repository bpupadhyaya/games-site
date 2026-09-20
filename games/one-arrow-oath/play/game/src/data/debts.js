// Debts: power now, a failure later. Every Debt in the Ledger comes due during the final fight,
// at the start of the player's turn 2 or 3 (rolled when that fight begins).
//   gain — applied when the Debt is taken (see rules/run.js takeDebt)
//   due  — applied when it comes due (see rules/battle.js applyDueEffects)
// `interactive` Debts need the player to pick something when taken (see run.pending).

export const DEBTS = {
  borrowed_tuning: {
    name: 'Borrowed Tuning',
    offer: 'A rare Arrow, yours tonight.',
    dueName: 'Forgotten Tuning',
    dueText: 'Your costliest Arrow in hand is Spent with no effect.',
    gain: { rareArrow: 1 },
    due: { forgetArrow: true },
  },
  sunk_wheel: {
    name: 'Mended Wheel',
    offer: 'Heal 16 Resolve now.',
    dueName: 'Sinking Wheel',
    dueText: 'Lose all Guard. 2 less Focus this turn.',
    gain: { heal: 16 },
    due: { loseGuard: true, focus: -2 },
  },
  lenders_marks: {
    name: "Lender's Marks",
    offer: 'Take 60 Marks.',
    dueName: 'The Collector',
    dueText: 'Lose 9 Resolve.',
    gain: { marks: 60 },
    due: { resolve: -9 },
  },
  hired_spotter: {
    name: 'Hired Spotter',
    offer: 'Start your next 3 fights with 8 Guard.',
    dueName: 'The Spotter Talks',
    dueText: 'You are Exposed for 2 turns.',
    gain: { spotterFights: 3 },
    due: { exposed: 2 },
  },
  blank_cheque: {
    name: 'The Blank Cheque',
    offer: 'Remove any 2 cards from your quiver.',
    dueName: 'Short Hand',
    dueText: 'Two random cards leave your hand this turn.',
    gain: { removeCards: 2 },
    due: { loseHand: 2 },
    interactive: true,
  },
  borrowed_years: {
    name: 'Borrowed Years',
    offer: '+8 maximum Resolve, and heal 8.',
    dueName: 'The Years Return',
    dueText: 'Lose 8 maximum Resolve.',
    gain: { maxResolve: 8, heal: 8 },
    due: { maxResolve: -8 },
  },
  silent_partner: {
    name: 'The Silent Partner',
    offer: 'Your next 2 fights start with 2 extra Focus.',
    dueName: 'The Partner Speaks',
    dueText: '0 Focus this turn.',
    gain: { silentFights: 2 },
    due: { focusZero: true },
  },
  forged_seal: {
    name: 'The Forged Seal',
    offer: 'Tuner prices are halved. Breaks the Covenant.',
    dueName: 'Seal Broken',
    dueText: 'Lose 40 Marks, or 6 Resolve if you cannot pay.',
    gain: { tunerHalf: true, breaksCovenant: true },
    due: { payMarks: 40, elseResolve: 6 },
  },
  promised_arrow: {
    name: 'The Promised Arrow',
    offer: 'Choose one of three rare Arrows.',
    dueName: 'The Promise Kept',
    dueText: 'That Arrow is Spent with no effect. If you already spent it, lose 10 Resolve.',
    gain: { chooseRare: 3 },
    due: { promiseKept: true },
    interactive: true,
  },
  mercenary_shield: {
    name: 'Hired Shields',
    offer: 'Every fight this day starts with 6 Guard.',
    dueName: 'Wages Due',
    dueText: 'Every enemy gains 10 Guard.',
    gain: { hiredShieldAct: true },
    due: { enemyGuard: 10 },
  },
  night_march: {
    name: 'The Night March',
    offer: 'Skip the next step of the road.',
    dueName: 'Exhaustion',
    dueText: 'You are Weak for 3 turns.',
    gain: { skipStep: true },
    due: { weak: 3 },
  },
  two_masters: {
    name: 'Two Masters',
    offer: 'Take the gains of two other Debts.',
    dueName: 'Both Masters Call',
    dueText: 'Both of those Debts come due on the same turn.',
    gain: { twoMasters: true },
    due: { twoMasters: true },
  },
};

export const DEBT_IDS = Object.keys(DEBTS);
// Two Masters can only bind Debts that need no choice from the player.
export const LINKABLE_DEBTS = DEBT_IDS.filter((id) => !DEBTS[id].interactive && id !== 'two_masters');
export const SETTLE_COST_MAX_RESOLVE = 5;
