// Card data. Two kinds:
//   arrow — named, strong, SPENT when played: it leaves the run for good.
//   tech  — a technique: modest, reusable, cycles through the discard pile.
// Numbers here are the source of truth; tune them with design/sim.mjs.
//
// fx fields (all optional):
//   dmg, hits      damage per hit, number of hits (default 1)
//   all            hits every enemy
//   pierce         ignores enemy Guard
//   guard          gain Guard
//   draw           draw cards
//   focus          gain Focus this turn
//   aim            add to the next attack's damage
//   weak, exposed  apply to the target for N turns
//   ward           answers every matching enemy intent; otherwise gives wardGuard
//   patient        extra Guard if no Arrow was played this turn
//   measured       refund the cost when overkill is 3 or less
//   once           a technique usable once per fight

export const ELEMENTS = ['ember', 'stone', 'gale', 'storm', 'flare', 'tide'];

// BEATS[a] === b means a card of element a answers an attack of element b.
export const BEATS = { tide: 'ember', ember: 'stone', stone: 'gale', gale: 'storm', storm: 'flare', flare: 'tide' };

export const ELEMENT_NAMES = { ember: 'Ember', stone: 'Stone', gale: 'Gale', storm: 'Storm', flare: 'Flare', tide: 'Tide' };
export const BEAT_VERBS = { tide: 'quenches', ember: 'cracks', stone: 'stills', gale: 'scatters', storm: 'veils', flare: 'dries' };

export const WARD_GUARD = 4;
export const RIPOSTE_MULT = 1.5;
export const RARITY_VALUE = { starter: 8, common: 10, uncommon: 20, rare: 40 };

const arrow = (id, name, element, rarity, cost, fx, extra = {}) => ({ id, name, kind: 'arrow', element, rarity, cost, fx, ...extra });
const tech = (id, name, element, rarity, cost, fx) => ({ id, name, kind: 'tech', element, rarity, cost, fx });

const LIST = [
  // ---- Techniques: starters
  tech('reed', 'Reed Shaft', null, 'starter', 1, { dmg: 5 }),
  tech('brace', 'Brace', null, 'starter', 1, { guard: 6 }),
  tech('breath', 'Steady Breath', null, 'starter', 0, { draw: 1, guard: 2 }),
  // Added to your discard by curses. Never drafted, never part of the run's quiver.
  tech('frayed_string', 'Frayed String', null, 'starter', 1, { exhaust: true }),
  // Carried from the Last Letter event. Costs too much to ever play; +40 Legend if you reach the end holding it.
  tech('letter', 'The Last Letter', null, 'starter', 3, { keepsake: true }),

  // ---- Techniques: the six Wards (element = the Ward's own element)
  tech('ward_tide', 'Tide Ward', 'tide', 'common', 1, { ward: true }),
  tech('ward_ember', 'Ember Ward', 'ember', 'common', 1, { ward: true }),
  tech('ward_stone', 'Stone Ward', 'stone', 'common', 1, { ward: true }),
  tech('ward_gale', 'Gale Ward', 'gale', 'common', 1, { ward: true }),
  tech('ward_storm', 'Storm Ward', 'storm', 'common', 1, { ward: true }),
  tech('ward_flare', 'Flare Ward', 'flare', 'common', 1, { ward: true }),

  // ---- Techniques: drafted
  tech('aim', 'Take Aim', null, 'common', 1, { aim: 6 }),
  tech('hold', 'Hold the Draw', null, 'uncommon', 1, { aim: 4, draw: 1 }),
  tech('twin_reeds', 'Twin Reeds', null, 'common', 1, { dmg: 3, hits: 2 }),
  tech('weighted', 'Weighted Reed', null, 'common', 2, { dmg: 11 }),
  tech('reed_volley', 'Reed Volley', null, 'uncommon', 2, { dmg: 4, hits: 2, all: true }),
  tech('dig_in', 'Dig In', null, 'common', 2, { guard: 14 }),
  tech('slip', 'Slip Aside', null, 'common', 1, { guard: 4, draw: 1 }),
  tech('patience', 'Patience', null, 'uncommon', 1, { guard: 5, patient: 6 }),
  tech('read_wind', 'Read the Wind', null, 'common', 1, { draw: 2 }),
  tech('center', 'Center', null, 'uncommon', 0, { focus: 1, once: true }),
  tech('find_gap', 'Find the Gap', null, 'uncommon', 1, { exposed: 2 }),
  tech('pinning', 'Pinning Shot', null, 'common', 1, { dmg: 3, weak: 2 }),

  // ---- Arrows: starters
  arrow('first_promise', 'First Promise', null, 'starter', 2, { dmg: 20 }),
  arrow('ashwake', 'Ashwake', 'ember', 'starter', 1, { dmg: 14 }),
  arrow('grayfeather', 'Grayfeather', 'gale', 'starter', 1, { dmg: 12 }),
  arrow('riverglass', 'Riverglass', 'tide', 'starter', 1, { dmg: 12 }),
  arrow('old_faithful', 'Old Faithful', null, 'starter', 1, { dmg: 13 }),

  // ---- Arrows: Ember
  arrow('cinderline', 'Cinderline', 'ember', 'common', 1, { dmg: 13 }),
  arrow('kilnheart', 'Kilnheart', 'ember', 'uncommon', 2, { dmg: 24 }),
  arrow('last_ember', 'Last Ember of Varr', 'ember', 'rare', 2, { dmg: 18, all: true }),

  // ---- Arrows: Tide
  arrow('undertow', 'Undertow', 'tide', 'common', 1, { dmg: 11, weak: 1 }),
  arrow('moonpull', 'Moonpull', 'tide', 'uncommon', 2, { dmg: 22, weak: 1 }),
  arrow('drowned_bell', 'The Drowned Bell', 'tide', 'rare', 3, { dmg: 38 }),

  // ---- Arrows: Flare
  arrow('noonspike', 'Noonspike', 'flare', 'common', 1, { dmg: 13 }),
  arrow('glasswright', 'Glasswright', 'flare', 'uncommon', 1, { dmg: 10, pierce: true, exposed: 2 }),
  arrow('dawnbreaker', 'Dawnbreaker', 'flare', 'rare', 2, { dmg: 28, pierce: true }),

  // ---- Arrows: Storm
  arrow('squallneedle', 'Squallneedle', 'storm', 'common', 1, { dmg: 6, hits: 2 }),
  arrow('thunderhead', 'Thunderhead', 'storm', 'uncommon', 2, { dmg: 8, hits: 3 }),
  arrow('long_rumble', 'The Long Rumble', 'storm', 'rare', 3, { dmg: 11, hits: 2, all: true }),

  // ---- Arrows: Gale
  arrow('whisperwind', 'Whisperwind', 'gale', 'common', 0, { dmg: 9 }),
  arrow('kitestring', 'Kitestring', 'gale', 'uncommon', 1, { dmg: 12, draw: 1 }),
  arrow('hollow_gale', 'Hollow Gale', 'gale', 'rare', 1, { dmg: 18, focus: 1 }),

  // ---- Arrows: Stone
  arrow('cairnsplitter', 'Cairnsplitter', 'stone', 'common', 2, { dmg: 17, guard: 5 }),
  arrow('graywake', 'Graywake', 'stone', 'uncommon', 2, { dmg: 15, guard: 10 }),
  arrow('mountains_word', "Mountain's Word", 'stone', 'rare', 3, { dmg: 30, guard: 12 }),

  // ---- Arrows: neutral
  arrow('accord', 'Needle of Accord', null, 'common', 1, { dmg: 11 }),
  arrow('plainsong', 'Plainsong', null, 'common', 1, { dmg: 9, draw: 1 }),
  arrow('oathmark', 'Oathmark', null, 'uncommon', 1, { dmg: 15, measured: true }),
  arrow('keepers_due', "Keeper's Due", null, 'uncommon', 2, { dmg: 26 }),
  arrow('widows_thread', "Widow's Thread", null, 'rare', 2, { dmg: 16, hits: 2 }),
  arrow('the_unasked', 'The Unasked', null, 'rare', 0, { dmg: 24 }),

  // ---- design/CONTENT-SPEC.md, section 3
  arrow('hearthguard', 'Hearthguard', 'ember', 'common', 2, { dmg: 14, held: { guard: 5 } }),
  arrow('heliograph', 'Heliograph', 'flare', 'uncommon', 1, { dmg: 9, ifAnswers: { focus: 1 } }),
  arrow('pyre_of_names', 'Pyre of Names', 'ember', 'rare', 2, { dmg: 8, perSpent: 3 }),
  // Only ever won: the reward for ending the Answering Storm before it blows itself out.
  arrow('stormglass', 'Stormglass', 'storm', 'rare', 2, { dmg: 10, hits: 2, answerAny: true }, { bonus: true }),

  // ---- Ember (answers Stone)
  arrow('brand', 'The Brand', 'ember', 'common', 1, { dmg: 10, exposed: 1 }),
  arrow('forgebreath', 'Forgebreath', 'ember', 'uncommon', 2, { dmg: 9, hits: 2, onKill: { focus: 1 } }),
  arrow('slagfall', 'Slagfall', 'ember', 'uncommon', 3, { dmg: 16, all: true, selfDmg: 4 }),
  arrow('sunken_coal', 'The Sunken Coal', 'ember', 'rare', 1, { dmg: 12, retain: true, ifAnswers: { aim: 8 } }),

  // ---- Tide (answers Ember)
  arrow('saltline', 'Saltline', 'tide', 'common', 1, { dmg: 9, strengthDown: 1 }),
  arrow('low_water', 'Low Water', 'tide', 'common', 1, { dmg: 12, overkillToGuard: true }),
  arrow('springtide', 'Springtide', 'tide', 'uncommon', 2, { dmg: 18, ifAnswers: { draw: 2 } }),
  arrow('brinewake', 'Brinewake', 'tide', 'uncommon', 1, { dmg: 8, all: true, weak: 1 }),
  arrow('nine_fathoms', 'Nine Fathoms', 'tide', 'rare', 3, { dmg: 26, heal: 8 }),
  arrow('the_quiet_flood', 'The Quiet Flood', 'tide', 'rare', 2, { dmg: 10, stun: true }),

  // ---- Flare (answers Tide)
  arrow('glint', 'Glint', 'flare', 'common', 0, { dmg: 7, pierce: true }),
  arrow('highnoon', 'Highnoon', 'flare', 'common', 2, { dmg: 16, exposed: 1 }),
  arrow('burning_glass', 'Burning Glass', 'flare', 'uncommon', 2, { dmg: 12, pierce: true, lastArrow: 12 }),
  arrow('solstice', 'Solstice', 'flare', 'rare', 3, { dmg: 20, pierce: true, exposed: 3 }),
  arrow('white_hour', 'The White Hour', 'flare', 'rare', 2, { dmg: 14, all: true, pierce: true }),

  // ---- Storm (answers Flare)
  arrow('static', 'Static', 'storm', 'common', 1, { dmg: 4, hits: 3 }),
  arrow('rainshadow', 'Rainshadow', 'storm', 'common', 1, { dmg: 10, guard: 4 }),
  arrow('anvilcloud', 'Anvilcloud', 'storm', 'uncommon', 2, { dmg: 7, hits: 3, onKill: { draw: 1 } }),
  arrow('forked_word', 'The Forked Word', 'storm', 'uncommon', 2, { dmg: 11, hits: 2, spread: true }),
  arrow('eye_of_the_squall', 'Eye of the Squall', 'storm', 'rare', 2, { dmg: 6, hits: 4, held: { guard: 8 } }),
  arrow('thunder_ledger', 'The Thunder Ledger', 'storm', 'rare', 3, { dmg: 12, perUnspent: 2 }),

  // ---- Gale (answers Storm)
  arrow('crosswind', 'Crosswind', 'gale', 'common', 1, { dmg: 10, draw: 1 }),
  arrow('feathersend', 'Feathersend', 'gale', 'common', 0, { dmg: 6, retain: true }),
  arrow('updraft', 'Updraft', 'gale', 'uncommon', 1, { dmg: 11, ifAnswers: { draw: 1, focus: 1 } }),
  arrow('windlass', 'Windlass', 'gale', 'uncommon', 2, { dmg: 14, addReeds: 2 }),
  arrow('the_long_breath', 'The Long Breath', 'gale', 'rare', 1, { dmg: 15, retain: true, held: { guard: 4 } }),
  arrow('zephyrs_due', "Zephyr's Due", 'gale', 'rare', 0, { dmg: 10, focus: 2 }),

  // ---- Stone (answers Gale)
  arrow('waystone', 'Waystone', 'stone', 'common', 1, { dmg: 8, guard: 8 }),
  arrow('scree', 'Scree', 'stone', 'common', 2, { dmg: 8, all: true, guard: 4 }),
  arrow('keystone', 'Keystone', 'stone', 'uncommon', 2, { dmg: 12, held: { guard: 9 } }),
  arrow('plumbline', 'Plumbline', 'stone', 'uncommon', 1, { dmg: 13, measured: true }),
  arrow('bedrock_oath', 'Bedrock Oath', 'stone', 'rare', 3, { dmg: 22, guardFromDmg: true }),
  arrow('the_standing_stone', 'The Standing Stone', 'stone', 'rare', 2, { dmg: 16, strengthDown: 3 }),

  // ---- Neutral Arrows
  arrow('journeyman', 'Journeyman', null, 'common', 1, { dmg: 12 }),
  arrow('paired_shaft', 'Paired Shaft', null, 'common', 1, { dmg: 7, hits: 2 }),
  arrow('lantern_shot', 'Lantern Shot', null, 'uncommon', 1, { dmg: 8, exposed: 2, draw: 1 }),
  arrow('full_quiver', 'Full Quiver', null, 'uncommon', 2, { dmg: 6, perUnspent: 2 }),
  arrow('empty_quiver', 'Empty Quiver', null, 'uncommon', 2, { dmg: 6, perSpent: 2 }),
  arrow('the_open_hand', 'The Open Hand', null, 'rare', 2, { dmg: 14, answerAny: true }),
  arrow('last_light', 'Last Light', null, 'rare', 2, { dmg: 18, lastArrow: 18 }),
  arrow('the_unready', 'The Unready', null, 'rare', 1, { dmg: 30, foul: true }),
  arrow('knife_in_the_dark', 'Knife in the Dark', null, 'uncommon', 0, { dmg: 16, pierce: true, foul: true }),

  // ---- Techniques
  tech('braced_shot', 'Braced Shot', null, 'uncommon', 2, { guardToDmg: true }),
  tech('bank_the_fire', 'Bank the Fire', null, 'common', 1, { guard: 7, retain: true }),
  tech('string_walk', 'String Walk', null, 'common', 0, { aim: 3 }),
  tech('full_draw', 'Full Draw', null, 'uncommon', 2, { aim: 14 }),
  tech('mark_the_joint', 'Mark the Joint', null, 'common', 1, { exposed: 1, draw: 1 }),
  tech('fletch', 'Fletch', null, 'common', 1, { addReeds: 2 }),
  tech('heavy_volley', 'Heavy Volley', null, 'uncommon', 3, { dmg: 6, hits: 2, all: true }),
  tech('hamstring', 'Hamstring', null, 'common', 1, { dmg: 4, strengthDown: 1 }),
  tech('breathe_out', 'Breathe Out', null, 'common', 0, { guard: 3, patientDraw: 1 }),
  tech('counsel', 'Counsel', null, 'uncommon', 1, { draw: 3, counsel: true }),
  tech('steady_hands', 'Steady Hands', null, 'uncommon', 1, { focusNext: 1 }),
  tech('ward_mastery', 'Ward Mastery', null, 'rare', 1, { ward: true, answerAny: true, ifAnswers: { draw: 1 }, once: true }),
  tech('read_the_field', 'Read the Field', null, 'common', 0, { draw: 1 }),
  tech('hold_the_line', 'Hold the Line', null, 'uncommon', 2, { guard: 10, weak: 1, all: true }),
  tech('dirty_trick', 'Dirty Trick', null, 'uncommon', 0, { stun: true, foul: true }),
  tech('pay_the_piper', 'Pay the Piper', null, 'rare', 0, { focus: 2, draw: 2, foul: true, once: true }),
  tech('old_scar', 'Old Scar', null, 'common', 1, { guard: 5, lowHpGuard: 5 }),
  tech('measure_twice', 'Measure Twice', null, 'uncommon', 1, { measureNext: true }),
  tech('oathkeepers_calm', "Oathkeeper's Calm", null, 'rare', 1, { calm: { guard: 10, draw: 1, elseGuard: 4 } }),
  tech('second_wind', 'Second Wind', null, 'uncommon', 1, { heal: 4, once: true }),
  tech('tighten_the_string', 'Tighten the String', null, 'common', 1, { aim: 5, guard: 3 }),
];


export const CARDS = Object.fromEntries(LIST.map((c) => [c.id, c]));
export const CARD_IDS = LIST.map((c) => c.id);

export const STARTING_QUIVER = ['reed', 'reed', 'reed', 'reed', 'brace', 'brace', 'brace', 'breath', 'ward_tide', 'ward_stone', 'first_promise', 'ashwake', 'grayfeather', 'riverglass', 'old_faithful'];

export const cardValue = (card) => (card.kind === 'arrow' ? RARITY_VALUE[card.rarity] : 0);

// The gains a `grant`-style field hands out, as a short phrase ("draw 2, +1 Focus").
const gains = (g) => [g.draw && `draw ${g.draw}`, g.focus && `+${g.focus} Focus`, g.guard && `+${g.guard} Guard`, g.aim && `Aim +${g.aim}`, g.marks && `+${g.marks} Marks`].filter(Boolean).join(', ');

// One short rules line, generated from fx so the text can never disagree with the numbers.
export function describe(card) {
  const fx = card.fx;
  const parts = [];
  if (fx.foul) parts.push('BREAKS THE COVENANT.');
  if (fx.ward) parts.push(fx.answerAny ? `Answer one attack, any element. If none, gain ${WARD_GUARD} Guard.` : `Answer ${ELEMENT_NAMES[BEATS[card.element]]} attacks. If none, gain ${WARD_GUARD} Guard.`);
  if (fx.guardToDmg) parts.push('Deal damage equal to your Guard.');
  if (fx.dmg) {
    const hits = fx.hits && fx.hits > 1 ? ` ×${fx.hits}` : '';
    parts.push(`Deal ${fx.dmg}${hits}${fx.all ? ' to all' : ''}.`);
  }
  if (fx.pierce) parts.push('Pierces Guard.');
  if (fx.perUnspent) parts.push(`+${fx.perUnspent} per unspent Arrow.`);
  if (fx.perSpent) parts.push(`+${fx.perSpent} per Arrow Spent.`);
  if (fx.lastArrow) parts.push(`+${fx.lastArrow} if your only Arrow in hand.`);
  if (fx.spread) parts.push('Each hit finds a random enemy.');
  if (fx.overkillToGuard) parts.push('Overkill becomes Guard.');
  if (fx.guardFromDmg) parts.push('Gain Guard equal to the damage dealt.');
  if (fx.guard) parts.push(`Gain ${fx.guard} Guard.`);
  if (fx.patient) parts.push(`+${fx.patient} if no Arrow loosed this turn.`);
  if (fx.aim) parts.push(`Next attack +${fx.aim}.`);
  if (fx.draw) parts.push(`Draw ${fx.draw}.`);
  if (fx.focus) parts.push(`Gain ${fx.focus} Focus.`);
  if (fx.heal) parts.push(`Heal ${fx.heal}.`);
  if (fx.lowHpGuard) parts.push(`+${fx.lowHpGuard} Guard if below half Resolve.`);
  if (fx.calm) parts.push(`If Unblemished: ${fx.calm.guard} Guard and draw ${fx.calm.draw}. Otherwise ${fx.calm.elseGuard} Guard.`);
  if (fx.patientDraw) parts.push(`Draw ${fx.patientDraw} if no Arrow loosed this turn.`);
  if (fx.focusNext) parts.push(`Next turn +${fx.focusNext} Focus.`);
  if (fx.measureNext) parts.push('Your next Arrow refunds its cost if overkill ≤ 3.');
  if (fx.counsel) parts.push('Then discard your costliest unplayable card.');
  if (fx.selfDmg) parts.push(`Lose ${fx.selfDmg} Resolve.`);
  if (fx.weak) parts.push(`Weak ${fx.weak}${fx.all ? ' (all)' : ''}.`);
  if (fx.exposed) parts.push(`Exposed ${fx.exposed}${fx.all ? ' (all)' : ''}.`);
  if (fx.strengthDown) parts.push(`Target loses ${fx.strengthDown} Strength.`);
  if (fx.stun) parts.push('Stun: it skips its turn.');
  if (fx.addReeds) parts.push(`Add ${fx.addReeds} Reed Shafts to your hand.`);
  if (fx.onKill) parts.push(`On kill: ${gains(fx.onKill)}.`);
  if (fx.ifAnswers) parts.push(`If it answers: ${gains(fx.ifAnswers)}.`);
  if (fx.held) parts.push(`Held at end of turn: +${fx.held.guard} Guard.`);
  if (fx.retain) parts.push('Retain.');
  if (fx.measured) parts.push('Refund cost if overkill ≤ 3.');
  if (fx.once) parts.push('Once per fight.');
  if (fx.exhaust) parts.push('A useless knot. Playing it removes it for this fight.');
  if (fx.keepsake) parts.push('Not for playing. Carry it to the end: +40 Legend.');
  return parts.join(' ');
}
