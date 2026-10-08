// All reader text: About, How to Play and the exhaustive Rules. Every number here is the number the simulation uses (see jump.js, hills.js, sim.js).
export const ABOUT = [
  { title: 'Ski Jump Fjord', p: [
    'Ride the in-run, jump at the lip, fly with your skis in the sweet angle and land in a telemark, on four hills above a Norwegian fjord. Three rounds against seven other jumpers decide the medals.',
    'A lifelike jumper (a man or a woman, your choice in Settings), real wind that pushes you around, and flight physics that are worked out every moment of the jump: the angle of your body, the speed of the air and the gusts all decide how far you go.'] },
  { title: 'About the sport', art: 'hill', p: [
    'Ski jumping grew up in the mountains of Norway in the nineteenth century and is now enjoyed all over the world. Jumpers glide down an ice track, spring off the take-off table and fly for several seconds with their skis spread in a V.',
    'The K-point marks the size of a hill. Landing on it is worth 60 points, and every metre further or shorter adds or removes points. Five judges mark the style from 0 to 20.'] },
  { title: 'How it is made', p: [
    'The hill, the jumper and the weather are simulated, and the jump is played from a fixed number of steps each second, so the same jump always gives the same result.',
    'No real events, teams or brands appear here: the competitors have plain first names and the jumpers wear plain suits.'] },
];

export const HOWTO = [
  { title: 'The competition', p: [
    'Jump three rounds against seven computer jumpers on the hill you choose. Your points from every round are added up, and your rank decides Gold, Silver or Bronze.',
    'Practice gives you single jumps for training. The Daily Cup is the same wind and the same rivals for everyone on the same day.'] },
  { title: 'Controls', art: 'ring', p: [
    'One thumb. HOLD the screen to crouch down the in-run. LIFT your finger when the ring closes on the lip to jump. In the air, TOUCH and DRAG: up and down is the angle of your skis, left and right keeps them level. LIFT your finger again as the ring closes on the snow to land.',
    'Keyboard: hold Space or the Down arrow to crouch, release to jump and to land. Arrow keys fly: Up and Down change the angle, Left and Right level the skis. P pauses and T opens Think.'] },
  { title: 'Choosing a gate', p: [
    'Before each jump you see the wind and choose a start gate. A higher gate gives more speed and a longer jump, but 4.2 points are taken off. A lower gate adds 4.2 points. The wind arrow shows head wind and cross wind.'] },
  { title: 'In the air', art: 'band', p: [
    'The tall gauge on the right shows the angle of your skis (the white marker) and the green band where they make the most lift. The band is steep at first and gets flatter as you fly. Keep the marker in the band.',
    'The bar along the bottom shows how level your skis are. The wind pushes you sideways: drag against it to bring the marker back to the middle.'] },
  { title: 'Landing', p: [
    'Watch the ring near the bottom: it closes as the snow arrives. Lift your finger right then for a telemark. Early or late gives a plain or rough landing, and a hard landing with bad timing is a fall.'] },
  { title: 'Think and Watch & Learn', art: 'think', p: [
    'Think shows a hint for what to do right now. Watch & Learn plays a whole competition by itself, one step at a time: it thinks, shows its choice, then does it. You can pause it, and make the thinking time shorter or longer.'] },
];

export const RULES = [
  { title: 'The competition', p: [
    'You and seven rivals jump three rounds. In every round everyone jumps once; the rivals jump right after you.',
    'Your points for a jump are: distance points, plus the style marks, plus or minus the wind and gate compensation. The three rounds are added up. First place is Gold, second Silver, third Bronze.',
    'Competition levels: Village hill (wide green band, light gusts, generous timing), Regional cup (the standard challenge), World class (narrow band, strong gusts, tight timing). The rivals also jump a little better at World class.'] },
  { title: 'The four hills', art: 'hill', p: [
    'Valley Hill (small, K 60): 2.4 points per metre. Fjord Hill (normal, K 90): 2.0 points per metre. Cliff Hill (large, K 120): 1.8 points per metre. Ice Flying Hill (flying, K 185): 1.2 points per metre.',
    'The K-point is the distance that scores 60 distance points. Distance points = 60 + (distance minus K) times the points per metre, so a jump shorter than K loses points.',
    'The distance is measured along the slope at the heels of your skis, to the nearest half metre. Where you touch down is what counts, even if you fall.'] },
  { title: 'The in-run', p: [
    'After a short start signal you slide down the ice track. Hold the screen (or Space, or the Down arrow) to crouch. A full crouch makes you small and fast; standing up costs speed. Crouch builds in about 0.4 s and drops in under 0.3 s.',
    'A higher gate starts you higher on the in-run: more speed. The gate choices are low (starts at 20 percent of the way down), middle (10 percent) and high (the very top).',
    'Speed at the lip is about 20 m/s on Valley Hill, 23 on Fjord Hill, 25 on Cliff Hill and 27 on the Ice Flying Hill with a full crouch from the middle gate.'] },
  { title: 'The take-off', art: 'ring', p: [
    'The jump zone opens 0.57 s (Village hill), 0.42 s (Regional cup) or 0.33 s (World class) before the lip. Inside it, lifting your finger (or tapping if you are not touching) is your jump. A ring closes on the lip marker so you can see the moment.',
    'Timing quality: perfect within 0.04 s of the lip (Village), 0.03 s (Regional), 0.023 s (World class). It falls to about half at three times that and to nothing at ten times that.',
    'A jump up to 0.1 s after the lip still counts but is late. No jump at all gives almost no spring. The spring adds up to 3.8 m/s upwards. A very early jump also costs a few percent of your speed.',
    'A poor take-off sets your skis rocking: the angle and the level start to wobble.'] },
  { title: 'The flight: the angle', art: 'band', p: [
    'Your skis fly at an angle to the air. Drag up for a bigger angle (more lift, more drag) and down for a smaller one. The angle follows your thumb with a little delay, and gusts push it.',
    'The green band is where the skis make the most lift. It starts at about 41 degrees right after the take-off, eases down to about 26 degrees over the first 1.7 seconds, and rises by up to 7 degrees in the last second before the snow so you flare for the landing. Gusts make it drift a few degrees.',
    'The band is plus or minus 6.5 degrees wide (Village hill), 4.5 (Regional cup) or 3.2 (World class). Outside the band you lose lift and gain drag: the further out, up to 8 degrees away, the worse, and past 8 degrees the loss is at its maximum.'] },
  { title: 'The flight: the level', p: [
    'Your skis also roll to the side. This is unstable: left alone, the roll gets bigger by itself, and gusts and cross wind push it. Drag sideways to level them (left drag turns the skis to the left).',
    'A big roll costs lift and adds drag, and it counts against your style. Cross wind also slides you sideways.',
    'Wind: a head wind gives more air over your skis and a longer jump; a tail wind shortens it. Wind compensation takes that into account (see the points).'] },
  { title: 'The landing', art: 'ring', p: [
    'A ring near the bottom closes as the snow arrives. Lift your finger (or tap if you are not touching) as it closes. Lifts or taps from 0.45 s before touch-down to 0.2 s after it are counted, the nearest one wins; nothing in that time is the worst timing.',
    'Telemark: timing quality at least 0.82 (within about 0.055 s on Regional cup). Clean landing: quality at least 0.4 (within about 0.135 s). Anything worse is a rough landing.',
    'A fall happens when the touch-down is hard and the timing was bad: a closing speed over 6.4 m/s with a quality under 0.7, over 9.5 m/s with a quality under 0.95, or landing beyond 1.28 times K with a quality under 0.9. Landing past the steep part of the hill is hard.'] },
  { title: 'Style marks', art: 'judges', p: [
    'Five judges each give a mark from 0 to 20 in halves. The highest and the lowest are dropped and the other three are added, so the style total is at most 60.',
    'A judge starts at 19.2. Take-off timing can cost up to 1.4. A wobbly flight (angle far from the band, skis rolling) can cost up to 5.2. A telemark costs up to 0.6, a clean landing at least 1.2 and a rough one 3.0, and a fall 7.5 or more. Each judge sees it a little differently, within half a mark.'] },
  { title: 'Wind and gate points', p: [
    'Wind compensation = minus the head wind in m/s times a factor: 2.5 on Valley Hill, 3.75 on Fjord Hill, 5 on Cliff Hill, 6 on the Ice Flying Hill. A tail wind adds points; a head wind takes them away.',
    'Gate compensation: low gate +4.2 points, middle gate 0, high gate minus 4.2.',
    'Total for a jump = distance points + style marks + wind compensation + gate compensation, to one decimal place and never below zero.'] },
  { title: 'The rivals', p: [
    'The seven rivals are computer jumpers with steady hands of different quality. They fly with the same physics as you, with their own wind each time, and sometimes choose a different gate. They are ranked by total points after each round.'] },
  { title: 'Practice and Daily Cup', p: [
    'Practice is a single jump on any hill and level, as many times as you like.',
    'The Daily Cup is a three-round competition on Fjord Hill at the Regional cup level. The wind and the rivals depend on the date, so everyone has the same day.'] },
  { title: 'Replay, pause, Think', p: [
    'After every jump you can watch a slow-motion replay at half speed. Pause stops everything. Think shows a hint without changing anything.',
    'Watch & Learn plays the competition with the computer: THINK (2 to 10 seconds, you choose), REVEAL (2 seconds, showing the choice), then ACT. It stops at the gate, the in-run, the take-off, the flight and the landing. Pause freezes the whole loop, including the motion.'] },
  { title: 'Free preview', p: [
    'The first 90 seconds of real play are free. Menus, Rules, About, Watch & Learn and paused time never count. After that, one unlock opens the whole game.'] },
];
