// Words of the game: How to Play, Rules, About. Every number printed on the Rules pages is read from the engine's K table,
// so the Rules always describe what the code actually does.
import { K, TRAILS, CHAPTERS } from './engine.js';

const pct = (v) => `${Math.round(v * 100)}%`;
const f1 = (v) => (Math.round(v * 10) / 10).toString();
const f2 = (v) => (Math.round(v * 100) / 100).toString();

// A block is { h } heading, { p } paragraph, { li: [..] } bullets, { art } illustration drawn by the game's own art, { note }.
export const DOCS = {
  howto: {
    title: 'How to Play',
    pages: [
      { title: 'The job', blocks: [
        { p: 'You are a porter on a hill trail in Nepal. On your back is a loaded doko, the tall woven basket, held by the namlo, a strap across your forehead. Carry it to the village without letting the goods fall.' },
        { art: 'load' },
        { li: ['Keep the load upright: lean to steady it.', 'Mind your breath: rest before you run out.', 'Reach the village before dusk with every item.'] },
      ] },
      { title: 'Walk, lean, pace', blocks: [
        { p: 'Touch and hold anywhere to walk. Lift your thumb to stop: the porter props the doko on his T-stick and rests.' },
        { art: 'pad' },
        { li: ['Drag sideways from where you touched to LEAN. The load tips toward the way it falls: lean that way to bring it back.', 'Drag up to hurry, down to slow your steps.', 'On a keyboard: hold Space, then arrows. Left and right lean, up and down set the pace.'] },
      ] },
      { title: 'What the trail does', blocks: [
        { art: 'segments' },
        { li: ['Climbs pull the load: lean forward and keep a calm pace.', 'Stone steps jolt it: slow down.', 'Bridges sway: break your step, and you cannot prop the load on them.', 'Gusts push the load: lean into them as they arrive.', 'A chautara, the stone rest platform, is where to rest well.'] },
      ] },
      { title: 'Breath and daylight', blocks: [
        { p: 'The breath bar drains as you walk, faster on climbs and with heavy loads. Lift your thumb to rest and it fills. Rest on a chautara and it fills much faster, and a fallen item is repacked.' },
        { p: 'The sky moves from morning to dusk while you walk and rest. Arrive before dusk for the best stars.' },
        { art: 'stars' },
      ] },
      { title: 'Hints and Watch and Learn', blocks: [
        { p: 'Tap the lamp for a hint: what is coming up and how to meet it, with the right lean and pace shown on the control circle.' },
        { p: 'Watch and Learn plays a whole trail for you. It stops before each hazard to explain it, shows what it will do, then walks it. Pause it at any moment.' },
      ] },
    ],
  },
  rules: {
    title: 'Rules',
    pages: [
      { title: 'Goal and stars', blocks: [
        { p: `Each trail is a walk from the start to the village at the end. You begin with a number of goods (5 to 8). You win a trail by arriving with at least one item. You lose it if the last item falls.` },
        { li: ['1 star: arrive with any goods.', `2 stars: arrive before dusk with at least ${pct(0.75)} of the goods.`, '3 stars: arrive before dusk with every item and without ever being forced to stop for breath.'] },
        { p: 'A repacked item counts as kept. Gentle mode and hints never change the stars.' },
      ] },
      { title: 'Controls', blocks: [
        { li: [
          'Hold = walk. Release = stop and rest.',
          `Lean: drag sideways from the touch point, full lean at about 110 units. The torso follows with a short lag (${f2(K.LEAN_LAG)} s).`,
          `Pace: drag up or down from the touch point. The range is ${f1(K.PACE_MIN)}x to ${f1(K.PACE_MAX)}x of a normal stride; it eases to the new pace in about ${f2(K.PACE_LAG)} s.`,
          `Walking speed is ${f2(K.WALK_V)} m/s at pace 1.0 on the flat. Climbing slows you, descending quickens you a little, and stone steps slow you to about ${pct(0.62 * (1 - 1.3 * 0.32))} of that.`,
        ] },
      ] },
      { title: 'The load', blocks: [
        { p: `The basket's lean is an angle that falls over by itself, like a broom balanced on a palm. The heavier the load, the faster it falls: its instability is ${f1(K.G0)} + ${f2(K.G_PER_KG)} per kilogram above 25.` },
        { p: `A full lean pushes back with strength ${f1(K.CTRL)}, in the same units as the instability above, and damping is ${f1(K.DAMP)} (a little less in the rain). Small, steady corrections work best.` },
        { art: 'sway' },
        { p: `If the angle passes ${f1(K.SPILL_ANGLE)} radians (about 29 degrees) the basket slips and one item falls. The porter then re-seats the load at ${pct(K.RESEAT)} of that angle, and a slip cannot repeat for ${f1(K.SPILL_COOLDOWN)} seconds.` },
      ] },
      { title: 'The trail', blocks: [
        { li: [
          `Flat: no slope. Small footfall sway and random wobble always act on the load.`,
          `Climb (about 6 to 18 degrees): pulls the load, so you need to lean forward; costs breath ${f1(K.BREATH_PER_SLOPE)} per radian more.`,
          'Descent: the opposite pull, lean back; a little faster, and breath is not spent faster.',
          `Stone steps: a step every ${f2(K.STEP_LEN)} m. Each step jolts the load by a random amount, more at a quick pace, and the whole flight costs 20% more breath.`,
          `Bridge: sways with its own rhythm. Each bridge has a pace to avoid (0.78x or 1.22x): within ${f2(K.BRIDGE_WIDTH)} of it the sway is up to ${f1(1 + K.BRIDGE_RES)} times bigger. The load cannot be propped on a bridge.`,
          'Gust: a push of about a second from front or back. It is announced a few metres ahead.',
          'Rain: less damping, so the load swings longer.',
          'Chautara: a level stone platform for resting.',
        ] },
      ] },
      { title: 'Breath', blocks: [
        { p: `Breath runs from full to empty. It drains at ${K.BREATH_DRAIN} per second on the flat for a 30 kg load, scaled by the load, the slope, and the pace to the power of 1.5.` },
        { p: `Resting restores ${K.BREATH_REST} per second on the flat, ${pct(K.REST_SLOPE)} of that on a slope or steps, ${pct(K.REST_BRIDGE)} on a bridge and ${K.REST_CHAUTARA} times on a chautara.` },
        { p: `Below ${pct(K.LOW_BREATH)} the porter slows, and as breath runs out the load shakes more and your lean has less effect. At zero he must stop for ${K.HALT_TIME} seconds and will not walk again until he has recovered ${pct(K.HALT_RECOVER)}.` },
      ] },
      { title: 'Rest and repack', blocks: [
        { p: `A resting porter props the doko on the T-stick: the load stays still and the lean settles. This works on level ground, slopes and rest platforms, but not on a bridge.` },
        { p: `On a chautara, resting for ${f1(K.REPACK_TIME)} seconds repacks one fallen item, once per platform. Resting costs daylight, so rest where it pays.` },
      ] },
      { title: 'Daylight', blocks: [
        { p: `Each trail has a day length: ${f1(K.DAY_PAR)} times the time an ideal walk takes, plus a few seconds for each rest platform. When it runs out the sky is dusk and 2 and 3 stars are no longer possible.` },
        { p: 'The Long Road has no end and no dusk: the sky simply cycles.' },
      ] },
      { title: 'Modes', blocks: [
        { li: [
          `Walk the Trail: ${TRAILS.length} trails in ${CHAPTERS.length} chapters, each unlocking the next.`,
          'Long Road: one endless trail that gets harder. The score is the distance, plus 10 for each rest platform reached. It ends when the last item falls.',
          'Daily Trail: the same trail for everyone each day. Finish it to build a streak.',
          'Watch and Learn: the game plays a trail and explains each hazard. It is always free to use.',
          'Gentle mode (Settings): the load is easier to hold and jolts are softer.',
        ] },
      ] },
      { title: 'What is simplified', blocks: [
        { p: 'Real loads and trails vary enormously, and real porters read the trail with their whole body. The numbers here are simplifications chosen to make a calm, readable balance game, not measurements. Paths, bridges and villages are invented.' },
      ] },
    ],
  },
  about: {
    title: 'About',
    pages: [
      { title: 'Doko Porter Trail', blocks: [
        { p: 'Across the hills of Nepal, goods have long travelled on people\'s backs. The doko is a tall woven basket carried with a namlo, a strap across the forehead. A T-shaped stick, the tokma, lets the porter rest the load without putting it down. A porter is often called a bhariya.' },
        { p: 'Along the old trails are chautara, stone resting platforms built beside trees, where a carrier can sit and the doko can be set on the wall.' },
        { p: 'This game is a respectful trade story, not a spectacle: the work is hard, and so is the skill of doing it well.' },
      ] },
      { title: 'Credits', blocks: [
        { p: 'Tradition: the hill communities of Nepal. Paths, bridges and villages in the game are invented.' },
        { p: 'The porter is a 3D person shown with the shared Arcforge 3D layer; the basket, goods, trail and effects are drawn with plain canvas graphics. Fonts: Barlow Condensed and Fredoka, both under the SIL Open Font License.' },
        { p: 'Part of Arcforge, a collection of world heritage games.' },
      ] },
    ],
  },
};

export const COACH_THINK = [3, 5, 8, 10];
