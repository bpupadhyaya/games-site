// Text for About, How to Play and the Rules reference. Every number below was checked against the engine: sim.js (sea, swell,
// strokes, impacts, heel, surfing, turn, finish), ai.js (rivals), match.js (lanes, order). Metres and seconds.
// A section is { title, art?, p: [paragraphs] }; the reader flows every section into one scrolling page.

export const ABOUT = [
  { title: 'Pirogue Coastal Canoe Race', art: 'course', p: [
    'Pirogues are long, narrow fishing canoes, traditionally dug from a single tree trunk and painted in bold bands of colour. Along the Atlantic coast of West Africa, from Senegal to Benin and beyond, crews paddle them out through the surf every morning to fish.',
    'Fishing communities there also race their pirogues in regattas: crews paddle out through the breaking waves, round a buoy and come racing back to the beach on the swell.',
  ] },
  { title: 'More than strength', p: [
    'A pirogue is fast and unforgiving. It has to meet each wave bow-on and with speed, the crew must lean and brace to keep it upright, and on the way home a skilled crew will catch a swell from behind and ride it. Rhythm is everything: paddlers stroke together, on the beat.',
  ] },
  { title: 'This version', p: [
    'Pirogue Coastal Canoe Race is a short, simplified retelling for play on a phone. You paddle a painted two-person pirogue with taps on the left and right of the screen, race three crews in their own lanes, and learn to read the sea. You can also race the clock alone, pass the phone to a friend, or watch a coach crew race and explain its choices.',
    'It is a game of skill only, with no stakes of any kind. The Rules page lists everything that is simplified.',
  ] },
  { title: 'Learn more', p: [
    'If you would like to see the real thing, coastal fishing communities and regatta organisers in West Africa are the best teachers. This game is only a small, friendly doorway to their tradition.',
  ] },
];

export const HOWTO = [
  { title: 'The race', art: 'course', p: [
    'Paddle out through the surf to the orange buoy in your lane, round it, and race back to the beach between the two gate floats. Three rival crews race in their own lanes through the same sea. The best time wins.',
  ] },
  { title: 'Paddle', art: 'strokes', p: [
    'Tap the left half of the screen to paddle on the left, the right half to paddle on the right. A left stroke swings the bow to the right and a right stroke swings it left, so alternate to go straight and use one side to steer. (You can swap this in Settings.)',
  ] },
  { title: 'Keep the beat', art: 'ring', p: [
    'The ring on each pad is the rhythm of the crew. The hand sweeps round once a second. Tap when it is in the green arc: that is a stroke in time, and the bright arc is a perfect stroke. Tapping too fast gives a weak stroke and waiting too long loses speed.',
  ] },
  { title: 'Punch the surf', art: 'punch', p: [
    'Swells come in sets. A label shows when the next crest reaches the bow. Stroke just before it hits, with the bow pointing straight at it, and you punch through. Hit it slowly or at an angle and it slaps the hull and slows you.',
  ] },
  { title: 'Brace', art: 'brace', p: [
    'Waves heel the boat. The gauge shows the lean. When it turns amber, paddle on the low side: the stroke braces the hull and levels it. Heel too far and the boat swamps and you lose time bailing.',
  ] },
  { title: 'Ride the swell home', art: 'surf', p: [
    'After the buoy the swells come from behind. When a crest catches up with the stern, make two perfect strokes in a row with the bow straight and you catch it: the pirogue is carried at wave speed. Steer with side strokes to keep it straight, or it broaches.',
  ] },
  { title: 'Hint and Watch & Learn', p: [
    'Hint searches the next few seconds and tells you which side to stroke and when. Watch & Learn races a coach crew: before each big wave the race pauses so you can see what it thinks and why, and Pause stops everything exactly where it is.',
  ] },
];

export const RULES = [
  { title: 'The course', art: 'course', p: [
    'Every race goes from the beach out to a buoy and back, 104 to 136 metres each way depending on the sea. Four boats start side by side on the beach, each in its own lane 7 metres apart. There are no collisions between boats.',
    'The buoy and the finish gate are in your own lane. The turn is automatic: when you reach the buoy the boat swings round it (about 1.2 seconds, a little longer if you are wide). Arriving close to your lane line is faster on the way out of the turn than arriving wide.',
  ] },
  { title: 'Strokes', art: 'strokes', p: [
    'Each tap is one stroke by both crew on that side. A stroke on the left swings the bow right by a few degrees, a stroke on the right swings it left; the bow slowly straightens by itself.',
    'Each stroke adds speed. How much depends on the time since your last stroke: under half a second the stroke is weak, between 0.5 and 0.78 seconds it is in time and strongest (at 0.64 s), and after that it loses a little power. The speed you can reach is limited, so quick tapping does not pay.',
  ] },
  { title: 'The rhythm ring', art: 'ring', p: [
    'The ring on the pads shows the time since your last stroke on a one-second circle. The pale green arc is 0.5 to 0.78 seconds (in time). The bright green arc is 0.55 to 0.74 seconds (perfect).',
  ] },
  { title: 'Sea and current', p: [
    'Swells travel toward the beach in sets of three to five, with lulls between. Taller swells hit harder. Swells closer than 28 metres to the beach are breaking, and hit about a quarter harder.',
    'A cross current pushes the boat sideways, stronger on some courses and changing along the way. The streaks on the water show it. Steer slightly into it to hold your lane. Missing the finish gate by more than 6 metres adds 0.8 seconds for every extra metre.',
  ] },
  { title: 'Hitting a swell', art: 'punch', p: [
    'When a crest reaches the bow, the game compares your speed, how straight the bow is, and whether you stroked in the 0.3 seconds before (or just after) contact with how big the swell is.',
    'A clean punch costs a little speed. A slap costs about 40% of your speed and heels the boat toward the side the crest arrived on. Getting stuffed costs about 70% of your speed, heels the boat hard, and can swamp it.',
  ] },
  { title: 'Heel and bracing', art: 'brace', p: [
    'The gauge shows how far the boat leans, left or right, between -1 and +1. It levels itself slowly. A stroke on the low side braces and cuts the lean to about a third; a stroke on the high side does nothing for the lean.',
    'If the lean goes past full, the boat swamps: it stops, nothing you do counts for 2.4 seconds while the crew bails, then it carries on. A heeled boat is also a little slower.',
  ] },
  { title: 'Surfing home', art: 'surf', p: [
    'On the way home, swells at least 0.4 metres tall overtake you from behind. If two perfect strokes in a row land while a crest is within 3.6 metres behind the boat, with the bow within 20 degrees of straight, the boat not heeled by more than 0.6 on the gauge, and some speed, you catch it.',
    'A caught swell carries you at the speed of the wave for 2.6 seconds plus about 4 seconds for each metre of wave height, or until the beach. The wave turns the bow a little; correct it with strokes on the opposite side. If the bow swings past 35 degrees the boat broaches: the ride ends, speed drops and the boat heels hard.',
  ] },
  { title: 'Finishing and places', p: [
    'Your time starts at the GO and stops when the boat crosses the beach line. Places go by time, penalties included. Race against three crews (Easy, Medium or Hard sets), Time Trial alone against your best time, or Two Players taking turns on the same sea; the lower time wins.',
    'Rivals use the same boat physics as you, and the rival crews differ in how steady their rhythm is, how often they miss a swell, how fast they brace, and a little in strength.',
  ] },
  { title: 'Simplifications', p: [
    'Real pirogues hold many paddlers, ride higher swells in deeper water and use sails and bailers; here two paddlers stand for the whole crew, the sea is a simple set of swell lines, and the course is shortened so a race takes about a minute and a half.',
  ] },
];
