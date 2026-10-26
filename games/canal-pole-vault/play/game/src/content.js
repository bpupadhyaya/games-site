// All reader text: About, How to Play and the exhaustive Rules. Every number here is the number the simulation uses (see jump.js, venues.js, sim.js).
export const ABOUT = [
  { title: 'Canal Pole Vault', p: [
    'Sprint along the run-up, plant a long pole in the canal, climb it as it swings and let go to land as far as you can on the sand bed of the far bank. Four canals get wider as you go, and seven other jumpers try to beat your best mark.',
    'A lifelike jumper (a man or a woman, your choice in Settings), a real pendulum for the pole, wind over the polder and a calm landscape of reeds, cows and windmills. The pole is simulated every moment: your speed, the plant, when you climb and when you let go all decide the mark.'] },
  { title: 'About the sport', art: 'canal', p: [
    'Fierljeppen is a sport from Friesland in the north of the Netherlands. Its name is Frisian for far leaping. In the flat polder country, people crossed the many ditches by planting a long pole in the water and swinging over; today it is a competition on a sand-bed canal, with marks of more than twenty metres.',
    'A jumper sprints down a short bridge or bank, leaps onto a pole standing in the water, climbs it as it tips and lands on the far sand. The mark is measured from the board to where the feet first touch the sand.'] },
  { title: 'How it is made', p: [
    'The canal, the pole, the jumper and the weather are simulated, and the jump is played from a fixed number of steps each second, so the same jump always gives the same result. Rules simplify the sport: the pole stays straight in one plane, and the sizes of the canals and poles are chosen for play.',
    'No real events, teams, clubs or brands appear here: the competitors have plain first names and the jumpers wear plain clothes.'] },
];

export const HOWTO = [
  { title: 'The competition', p: [
    'Jump three times on the canal you choose. Your best mark counts, and seven computer jumpers jump after you each round. Your rank at the end decides Gold, Silver or Bronze.',
    'Practice gives you single jumps for training. The Daily Cup is the same wind and the same rivals for everyone on the same day.'] },
  { title: '1. The run-up', art: 'beat', p: [
    'Tap anywhere to start. Discs travel along the lane at the bottom to the ring: tap as a disc meets the ring. The closer to the beat, the more speed you gain; a missed beat costs speed. The pole only goes over the upright with enough speed.'] },
  { title: '2. The plant', p: [
    'Near the end of the run the lane turns into the plant lane. Tap once as the runner reaches the board. A good plant catches the pole at the right height with all your speed; too early grabs it low, too late grabs it high and clumsy.'] },
  { title: '3. The climb', art: 'dial', p: [
    'Now HOLD the screen to climb the pole and let go of it to rest. The dial shows the pole: the green mark is the upright. Before the pole is over the upright, climbing slows its swing, so wait for the green light, then climb. The grip bar empties while you climb and fills again while you rest.'] },
  { title: '4. Let go', art: 'letgo', p: [
    'Press one of the five LET GO buttons when the pole is high and falling towards the sand. High hangs in the air longer, Flat flies faster and reaches further. The flag in the picture shows where you would land with the lean selected; the gold button is the best lean now.',
    'Keyboard: Space to climb, the 1 to 5 keys or the Left and Right arrows with Enter to let go, P pauses and T opens Think.'] },
  { title: 'Think and Watch & Learn', art: 'think', p: [
    'Think shows a hint for what to do right now. Watch & Learn plays a whole competition by itself, one step at a time: it thinks, shows its choice, then does it. You can pause it, and make the thinking time shorter or longer.'] },
];

export const RULES = [
  { title: 'The competition', p: [
    'You and seven rivals jump three times each. Everyone jumps in every round and the rivals jump right after you, in the same wind.',
    'Your best mark counts. Ranks go by best mark, and a tie goes to the better second jump. First place is Gold, second Silver, third Bronze.',
    'Levels: Village meet (wide timing, a guide flag and a light, a forgiving swing), Provincial cup (the standard challenge), Championship (tight timing, gusts, no flag and no light). The rivals also jump a little better at the Championship.'] },
  { title: 'The four canals', art: 'canal', p: [
    'Village Ditch: 14.5 m of water, 11 m pole. Reed Canal: 16.5 m, 12 m pole. Windmill Cut: 18.5 m, 13 m pole. Big Water: 20.5 m, 13.5 m pole.',
    'The water is measured from the board to the beginning of the sand bed. Your mark is the distance from the board to where your feet first touch the sand. Landing in the water counts nothing.'] },
  { title: 'The run-up', art: 'beat', p: [
    'The run starts 24 m before the board. A beat comes every 0.46 s. A tap counts for a beat if it lands within the timing margin: 0.15 s (Village meet), 0.12 s (Provincial cup) or 0.10 s (Championship). The quality of a tap is one minus its distance to the beat divided by the margin.',
    'A tap adds 0.2 plus 0.62 times its quality to your target speed (in m/s). The target speed is capped at 8.4, 8.2 or 8.0 m/s. A beat with no tap takes 0.7 m/s away (never below 1.2) and a tap far from any beat takes 0.25 away. Your actual speed follows the target smoothly.',
    'The beats stop 3.4 m before the take-off point.'] },
  { title: 'The plant', p: [
    'In the last 3.4 m the plant zone is open, and a tap there is your leap onto the pole. The first 0.14 s of the zone are ignored so your last beat tap is not taken for a plant.',
    'The ideal take-off point is 0.35 m before the board. The plant error is how far you were from it. Inside 0.40 m (Village meet), 0.32 m (Provincial cup) or 0.25 m (Championship) the pole takes all your speed. At 1.15 m, 0.9 m or 0.7 m the transfer has fallen to 45 percent, and further out it keeps falling to a floor of 25 percent.',
    'The height of the grab is 3.1 m plus 1.5 times the error in metres (early is lower, late is higher), between 1.4 m and 5.0 m. A leap more than 2.4 m early drops short into the water. If you never plant, you run 1.6 m past the take-off point and the plant is made for you, late.'] },
  { title: 'The pole', art: 'dial', p: [
    'The pole stands in the water leaning back towards the bank. The three marks put it 0.7 m nearer (leaning 10 degrees), in the usual place (16 degrees) or 0.7 m further (19 degrees). The further mark reaches 0.7 m more but needs a faster run to get over the upright.',
    'The jumper is a weight on the pole at a distance from its foot. The pole swings like an upside-down pendulum: gravity pulls it over once it passes the upright and slows it before. Your run speed times the plant transfer, times 0.26, divided by the grab distance, is how fast it starts to swing (times 1.12 at Village meet, 0.96 at Championship).',
    'If the pole is leaning back and its swing stops, it falls back; once it is 34 degrees behind the upright it has swung you into the water: no mark. The sooner the pole is over the upright, the earlier you can climb safely.'] },
  { title: 'The climb', p: [
    'Holding the screen (Space on a keyboard) climbs at up to 2.1 m/s. While you climb the swing slows: the weight moves out along the pole, and the swing keeps its turning momentum, so it turns more slowly. A climber who goes up before the pole is over the upright can stall it.',
    'Your grip empties at 0.19 per second of climbing and refills at 0.3 per second of rest. When the grip falls under 35 percent the climb slows, down to 30 percent of full speed with an empty grip. The green light on the dial says the pole would still go over the upright if you keep climbing.',
    'The top of the pole is the end of the climb. Wind: a head wind slows the swing a little and the flight; a tail wind helps. A gust factor of 0.4, 1.0 or 1.7 sets how strong the wind of the level is.'] },
  { title: 'The let-go', art: 'letgo', p: [
    'You let go with one of five leans. Each pushes you off the pole at 3.0 m/s on top of the pole speed, at an angle of 44 degrees (High), 34 (Up), 24 (Mid), 14 (Long) or 4 (Flat). The legs then reach 0, 0.25, 0.5, 0.75 or 1.0 m in front of the body on landing.',
    'If you do not let go, the pole releases you itself when it reaches 72 degrees, or when you are lower than 1.2 m above the water with the pole past 29 degrees.',
    'The flag shows where you would touch down with the lean now chosen. It is a forecast with the same physics; the gold button is the best lean at this moment.'] },
  { title: 'The landing and the mark', p: [
    'The first touch of the feet decides everything: on the sand it is your mark in metres to the centimetre, in the water it counts nothing. The sand rises gently out of the water at the beginning of the sand bed.',
    'A rough landing happens when you drop faster than 9.2 m/s with a Long or Flat lean, or faster than 10.6 m/s with any lean: half a metre is taken off your mark. Anything else is a clean landing.'] },
  { title: 'The rivals', p: [
    'The seven rivals are computer jumpers of different quality. They run the same canal in the same wind with the same physics, tap with their own timing, and read the pole and choose when to let go. They are ranked by best mark after each round.'] },
  { title: 'Practice and Daily Cup', p: [
    'Practice is a single jump on any canal and level, as many times as you like.',
    'The Daily Cup is a three-jump competition on the Reed Canal at the Provincial cup level. The wind and the rivals depend on the date, so everyone has the same day.'] },
  { title: 'Replay, pause, Think', p: [
    'After every jump you can watch a slow-motion replay at half speed. Pause stops everything. Think shows a hint without changing anything.',
    'Watch & Learn plays the competition with the computer: THINK (2 to 10 seconds, you choose), REVEAL (2 seconds, showing the choice), then ACT. It stops at the pole mark, the run-up, the plant, the climb and the let-go. Pause freezes the whole loop, including the motion.'] },
  { title: 'Free to play', p: [
    'Free to play with short ads; go ad-free once.'] },
];
