// Text for About, How to Play and the Rules book. Numbers come from sim.js / courses.js so the Rules always match the engine.
import { PHYS, SCORE, STAR_PLACE, DEMO_RUNS, GATE_PERFECT } from './sim.js';
import { COURSES } from './courses.js';

export const THINK_CHOICES = [3, 5, 8, 10];
export const REVEAL_SECONDS = 2;
const m1 = (v) => (Math.round(v * 10) / 10).toString();
const m2 = (v) => (Math.round(v * 100) / 100).toString();

export const ABOUT = {
  title: 'About',
  blocks: [
    { h: 'Hoop Rolling Trundle' },
    { p: 'Rolling a hoop is one of the oldest children\'s games in the world. Children rolling hoops are shown on ancient Greek vases and in old Chinese pictures of children at play, and in the lanes and village streets of Victorian Britain trundling a hoop was everyday play: a metal ring, a stick with a hook or a fork on the end, and the aim of keeping the ring rolling upright for as long and as far as possible.' },
    { p: 'The trick is that a rolling hoop stands up by itself only while it moves. Slow it down and it wobbles and falls; keep it moving with a push of the stick and it runs straight and true. Steering is done by leaning it: a nudge on one side and the ring curves away from you. Children raced each other, rolled through gaps between stones and weaved between market stalls.' },
    { h: 'About this game' },
    { p: 'Hoop Rolling Trundle turns that into a course game. You push, brake and steer the hoop with one finger through eight courses of gates, bends, cobbles, mud, plank bridges and hills, against three rivals. Rolling through the middle of a gate scores a Perfect; a hoop that is going too slowly, or leans too far, falls.' },
    { p: 'The players are generic 3D characters, not portraits of real children. The lanes, markets and fair are original scenery in the style of a nineteenth-century village; no national flags, emblems or brands are used.' },
    { p: 'This is a game for fun. It simplifies the real thing: a real hoop is steered by the stick touching the rim; here your finger is the stick.' },
    { h: 'Credits' },
    { p: 'Made by Arcforge, a collection of heritage games from around the world. All sound is synthesised on your device. Text is set in Fredoka (SIL Open Font License 1.1). Drawn with plain canvas graphics; no ads, works offline.' },
  ],
};

export const HOWTO = {
  title: 'How to Play',
  blocks: [
    { h: 'The goal' },
    { p: 'Roll your hoop down the road, through the striped gates, and across the finish line before your rivals. You never stop the hoop to think: you keep it moving, balanced, and on line.' },
    { fig: 'hoop', hh: 210 },
    { h: 'One finger: push, brake and steer' },
    { p: 'Put your finger on the screen. Below the hoop, the stick pushes it and it speeds up. Raise your finger above the hoop and the stick pulls back: the hoop brakes. Take your finger off and it simply coasts and slows.' },
    { p: 'Slide your finger to the left or right of the hoop and it leans that way and curves toward it. The further you slide, the harder it leans. Slide back to the middle to straighten up.' },
    { fig: 'stick', hh: 300 },
    { h: 'Balance' },
    { p: 'The bar at the bottom shows the lean of the hoop. Keep the white dot in the green. Cobbles, puddles and a hard steer push it toward the red; a slow hoop leans over on its own, so keep pushing. In the red, it falls.' },
    { fig: 'balance', hh: 140 },
    { h: 'Gates' },
    { p: 'Roll between the posts of each gate. The middle scores a Perfect, anywhere else between the posts is Good. Miss the gap and you score nothing and lose your chain. Hitting a post knocks you off line and slows you down.' },
    { fig: 'gate', hh: 230 },
    { h: 'The ground' },
    { p: 'Grass drags and shakes the hoop, mud drags hard, cobbles rattle it and puddles slow you and tip it. On a plank bridge the water on either side is a fall. Brake before tight bends: a hoop going too fast cannot turn sharply enough.' },
    { fig: 'surface', hh: 230 },
    { h: 'Three ways to play' },
    { li: 'Practice: a steadier hoop, quick recovery from falls, weaker rivals and a hint button that shows the ideal line.' },
    { li: 'Race: the real thing. Your finishing place sets your stars.' },
    { li: 'Watch and Learn: the game rolls the course for you, thinking out loud before each section. Pause it any time.' },
    { h: 'On a keyboard' },
    { p: 'Hold Space (or Up or W) to push, Down or S to brake, Left and Right (or A and D) to steer. P or Escape pauses, H is the hint in Practice.' },
  ],
};

export function rulesPages() {
  const C0 = COURSES[0], CL = COURSES[COURSES.length - 1];
  const rows = COURSES.map((c) => ({ li: `${c.name}: ${c.length} m, ${c.gates.length} gates, par ${c.par} s. ${c.blurb}` }));
  return [
    {
      title: 'The race',
      blocks: [
        { h: 'The setup' },
        { p: `There are ${COURSES.length} courses, from ${C0.length} m to ${CL.length} m. You roll against three rivals who share the road with you. Hoops never collide with each other, so nobody can block you, but everyone has to pass the same gates.` },
        { p: 'A three-second countdown, then everyone is off. The race ends about two seconds after you cross the finish line, and your place is read from the standings at that moment: those who finished are ranked by time and the rest by how far they got. A race that has not ended after 400 seconds is stopped and counts as unfinished.' },
        { h: 'The courses' },
        ...rows,
        { p: 'The road, the gates and the puddles of each course are fixed, so you can learn them and improve. Rivals keep the same names and skill on each course.' },
      ],
    },
    {
      title: 'The stick',
      blocks: [
        { h: 'Push and brake' },
        { fig: 'stick', hh: 300 },
        { p: 'Your finger is the stick. Its height compared with the hoop sets the push: at or below the hoop it is full push; as you move it up past the hoop the push fades to nothing, there is a short band of coasting (no push, no brake), and higher up it turns into brake. Lifting your finger off the screen gives no push and no brake: the hoop coasts.' },
        { p: `A full push accelerates the hoop by up to ${m1(PHYS.A_PUSH)} m/s per second, less as it nears its limit. On level road the top speed is about 6 m/s. Braking slows it by up to ${m1(PHYS.BRAKE)} m/s per second.` },
        { h: 'Steer' },
        { p: `How far your finger is to the left or right of the hoop (up to about a fifth of the screen width) is the steer, from -1 to +1. A small area around the middle counts as straight. The hoop leans toward your finger: the lean it aims for is ${m2(PHYS.LEAN_MAX)} times the steer.` },
        { h: 'Keyboard' },
        { p: 'Space, Up or W push; Down or S brake; Left and Right or A and D steer; P or Escape pause; H gives the hint in Practice.' },
      ],
    },
    {
      title: 'Balance and speed',
      blocks: [
        { h: 'Lean' },
        { fig: 'balance', hh: 140 },
        { p: 'The balance bar shows how far over the hoop is leaning, from -1 (fallen left) to +1 (fallen right). The bar is green up to 0.5, amber to 0.8 and red beyond. At more than 1 in either direction the hoop falls.' },
        { h: 'Why it falls' },
        { p: `A hoop only stays up while it rolls. Below about ${m1(PHYS.V_STAB)} m/s it starts to tip on its own and fights your steering, and below about ${m1(PHYS.V_STAB * (1 - PHYS.KP / PHYS.INST0))} m/s it tips over by itself. Above ${m1(PHYS.V_STAB)} m/s the hoop is steady. So a hoop with no push and no speed leans over and falls, and a hoop that is going fast is easy to keep upright but harder to steer sharply.` },
        { h: 'Turning' },
        { p: `A leaning hoop turns toward its lean, up to ${m2(PHYS.TURN)} radians per second for a lean of 1, and fully only above about 2.5 m/s. The tighter the bend, the more lean it needs: at a hairpin you must be slow enough that the lean you can hold is enough to follow the road.` },
        { h: 'Kicks' },
        { p: 'Cobbles, grass, puddles, posts and walls each give the hoop a sideways knock. The knock gets bigger the faster you are going and you must catch it with a small steer to the other side.' },
      ],
    },
    {
      title: 'Gates and score',
      blocks: [
        { h: 'Gates' },
        { fig: 'gate', hh: 230 },
        { p: `Each gate is two posts a fixed distance apart (${m1(Math.min(...COURSES.map((c) => c.gates[c.gates.length - 1].w)))} to ${m1(Math.max(...COURSES.map((c) => c.gates[0].w)))} m; later gates on a course are narrower). When you pass the line between the posts the game checks where you crossed. Crossing within ${Math.round(GATE_PERFECT * 100)}% of the way from the middle of the gap to a post is a Perfect; anywhere else inside the posts is Good; outside the posts is a miss.` },
        { p: 'A post is a solid object. Touching one knocks you sideways, halves your speed and breaks your chain.' },
        { h: 'Score' },
        { li: `A Perfect scores ${SCORE.perfect}, a Good scores ${SCORE.good}.` },
        { li: `Each gate in a row (your chain) adds ${SCORE.chainStep} more than the one before, up to ${SCORE.chainMax}. A miss, a post or a fall ends the chain.` },
        { li: `Finishing adds ${SCORE.finish}. Your place adds ${SCORE.place.join(', ')} for 1st to 4th.` },
        { li: `Every second faster than the course's par time adds ${SCORE.perSecond}.` },
        { h: 'Stars' },
        { p: `1st place earns ${STAR_PLACE[0]} stars, 2nd ${STAR_PLACE[1]}, and 3rd or 4th ${STAR_PLACE[2]}. Practice does not award stars. Your best place, time and score on each course are kept on your device.` },
      ],
    },
    {
      title: 'The ground',
      blocks: [
        { h: 'What each ground does' },
        { fig: 'surface', hh: 230 },
        { li: 'Road: normal ground.' },
        { li: 'Grass beside the road: strong drag and constant small kicks. The kerbs are low; the ground beyond them is grass.' },
        { li: `Walls: ${m1(PHYS.WALL)} m beyond the edge of the road the world stops: you bounce off, lose speed and get a hard knock.` },
        { li: 'Cobbles: a steady rattle that kicks the hoop every fraction of a second.' },
        { li: 'Mud: very heavy drag and no rattle. Carry speed in and keep pushing.' },
        { li: `Puddles: going through one slows the hoop to ${Math.round(PHYS.PUDDLE_SLOW * 100)}% of its speed once, and gives a sideways knock.` },
        { li: 'Plank bridges: narrow road with water on both sides. Going over the edge is a fall into the water.' },
        { li: 'Hills: uphill slows you, downhill speeds you up. The grade is gentle but long.' },
      ],
    },
    {
      title: 'Falls and recovery',
      blocks: [
        { h: 'Falling' },
        { p: 'You fall if the lean passes 1 in either direction, or if you roll off a plank bridge into the water. A fall ends your chain and stops you where you are.' },
        { h: 'Getting up' },
        { p: `In a race you are down for ${m1(PHYS.DOWN_T)} seconds (${m1(PHYS.DOWN_T_PRACTICE)} in Practice), then you stand the hoop up where it fell and push on with a gentle start. After a fall into the water you are put back in the middle of the road. Rivals fall and get up the same way.` },
        { h: 'Practice help' },
        { p: 'In Practice the hoop is steadier (the self-tipping is reduced and kicks are smaller), recovery is quicker and rivals are weaker, so you can learn the course.' },
      ],
    },
    {
      title: 'Watch and Learn',
      blocks: [
        { h: 'The game rolls, you study' },
        { p: 'Watch and Learn runs a race with the same physics and rivals as Race. The performer is the same controller the rivals use, at its best. Before each section of the course the clock stops and the game goes through three steps.' },
        { li: `Think: the performer looks at what is ahead. You choose how long this lasts in Settings (${THINK_CHOICES.join(', ')} seconds; 5 is the default and 10 is the longest).` },
        { li: `Reveal: for ${REVEAL_SECONDS} seconds the line ahead is drawn on the road as a gold dotted path, with a ring at the middle of the next gate.` },
        { li: 'Act: the clock runs again and the section is rolled.' },
        { p: 'Pause stops everything, including the Think and Reveal timers, and resumes exactly where it stopped. In Practice the hint button does a Reveal for you: it stops the clock for a moment, draws the line and tells you whether to brake, steer or push.' },
        { h: 'Settings' },
        { p: 'Sound, think time, control hints, text size (to 300%) and reduced motion are in Settings, reachable from the main menu.' },
      ],
    },
    {
      title: 'Free preview and demo',
      blocks: [
        { h: 'Trying it first' },
        { p: 'The full game has a free preview of real play; menus, Rules, Watch and Learn and results are always free. When the preview ends you can unlock the whole game once, or restore an earlier purchase.' },
        { p: `The public web demo is limited to ${DEMO_RUNS} runs on the first course, so it is a taste of the game; the apps for iPhone and Android hold everything.` },
      ],
    },
  ];
}
