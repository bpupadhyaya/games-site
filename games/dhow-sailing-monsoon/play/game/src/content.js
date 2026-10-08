// Text for How to Play, Rules and About. Numbers come straight from the engine modules so the Rules cannot drift from the code.
import { KN, SIGHT_R, HARBOUR_R, COAST_HALF } from './sim.js';
import { LEVELS, SEASONS, GOODS, PORTS } from './data.js';
import { START_MONTH, GOAL_COINS, GOAL_REP, MONTH_LIMIT, HIRE, WAGE, WATER_PRICE, HULL_PRICE, SAIL_PRICE, HOLD_STEPS, HOLD_COST, PORT_FEE } from './economy.js';
import { MONTHS } from './core.js';

export const CREDITS_FALLBACK = ['# 3D people and credits', 'The 3D dhow, sea and sky are drawn by this game. The sailors use a licensed 3D person model and motion data; their licence texts ship with the game.'];

export const HOWTO = [
  { t: 'title', text: 'How to Play', size: 44 },
  { t: 'para', text: 'You are the nakhoda, the captain, of a wooden dhow with one big triangular sail. You trade between the harbours of the Indian Ocean and ride the monsoon winds. Each voyage is a passage you sail yourself in real time.' },
  { t: 'h', text: '1. Steer' },
  { t: 'fig', key: 'dial', h: 300 },
  { t: 'para', text: 'Drag on the round compass to choose the course you want. The dhow turns slowly toward it, like a real ship. The white arrow is the wind. The red wedge is where the lateen sail cannot work: never point the bow into it. The teal flag is your harbour, as far as you can tell.' },
  { t: 'h', text: '2. Trim the sail' },
  { t: 'fig', key: 'sheet', h: 280 },
  { t: 'para', text: 'Drag the sheet slider. Pull it down to haul the sail in, push it up to let it out. If the sail shakes, haul in. If it goes flat and stalls, let out. When it is full and drawing, the speed climbs. On Gentle and Seasoned a teal band shows the right range.' },
  { t: 'h', text: '3. Know where you are' },
  { t: 'para', text: 'Your position on the chart is only an estimate, with a yellow circle of doubt. At night, tap Sight and tap NOW when the star meets the edge of the kamal card. A good sight fixes your latitude and shrinks the circle. When you see land the doubt vanishes.' },
  { t: 'h', text: '4. Meet the weather' },
  { t: 'para', text: 'Reefs show as pale water and breakers: steer round them. A squall is a dark wall of rain: choose to reef, run or press on. In a calm you can pull the sweeps or wait. A small dhow may need your water.' },
  { t: 'h', text: '5. Trade' },
  { t: 'para', text: 'In Career mode, buy cargo where it is cheap and sell where it is dear, choose your crew, repair the dhow and wait for the right monsoon. Reach 3,000 coins and a good name to become a Master Nakhoda.' },
  { t: 'para', text: 'Auto Play shows the computer sailing a whole passage and explaining each decision. Tap the ? button for a hint while you sail.' },
];

const pol = (b) => b;
export const RULES = [
  { t: 'title', text: 'Rules', size: 44, sub: 'Every rule of the game, as the game itself uses it.' },
  { t: 'h', text: 'The goal' },
  { t: 'para', text: `Career: trade from port to port until you own ${GOAL_COINS.toLocaleString('en-US')} coins and have a reputation of ${GOAL_REP}; you then become a Master Nakhoda. You have ${MONTH_LIMIT} months to do it; after that your rank is judged and you may keep sailing. Passage: sail one leg of your choice for stars. Daily Passage: the same leg, season and weather for everyone today. Auto Play: watch the computer sail.` },
  { t: 'h', text: 'A passage' },
  { t: 'para', text: `You start in the harbour you leave and sail to a harbour on the far coast. The chart shows the route. You arrive when you come within ${HARBOUR_R} metres of the harbour mouth. The coast is a line across the end of the route; land is seen from ${SIGHT_R} metres. Running onto the coast damages the hull and stops the boat. The coast extends ${COAST_HALF} metres either side of the harbour; past its ends the sea is open.` },
  { t: 'para', text: 'A passage ends in one of four ways: you arrive; the hull is destroyed (wrecked); you stay without water for 22 seconds (thirst); or you are at sea longer than 3.4 times the par time (lost). Par time is the length of the route divided by 5 metres per second.' },
  { t: 'h', text: 'The wind and the monsoons' },
  { t: 'fig', key: 'monsoon', h: 250 },
  { t: 'para', text: `The wind comes from a direction and has a speed shown in knots (the game's metres per second times ${KN}). It drifts and gusts all the time.` },
  ...Object.values(SEASONS).map((s) => ({ t: 'para', text: `${s.name}: wind from ${s.from} degrees, average ${Math.round(s.speed * KN)} knots, direction wanders up to ${s.vary} degrees. ${s.blurb}` })),
  { t: 'para', text: `The calendar picks the season: ${MONTHS[10]} to ${MONTHS[2]} is kaskazi, ${MONTHS[4]} to ${MONTHS[8]} is kusi, and ${MONTHS[3]} and ${MONTHS[9]} are between the monsoons. A leg is "fair" when the wind blows within 70 degrees of your direction of travel, "mixed" within 120 degrees, otherwise "foul" and you must tack.` },
  { t: 'h', text: 'Steering' },
  { t: 'para', text: 'Choose a heading by dragging on the compass (keys: Left and Right). The boat turns toward it at a rate that grows with speed, about 12 degrees per second at a standstill up to about 31 at full speed, and it eases into the turn. Turning is slower with a badly damaged hull.' },
  { t: 'h', text: 'The lateen sail' },
  { t: 'fig', key: 'polar', h: 300 },
  { t: 'para', text: 'The wind angle is the angle between your bow and the direction the wind comes from: 0 is straight into the wind, 90 is a beam reach, 180 is running before it. Inside about 34 degrees the sail gives no drive and the dhow is "in irons". Drive rises quickly to a best near 105 degrees, and falls to 70 percent dead downwind because a lateen sail runs poorly.' },
  { t: 'para', text: 'Drive by angle: 34 degrees 0, 44 degrees 50 percent, 56 degrees 78 percent, 80 degrees 95 percent, 105 degrees 100 percent, 135 degrees 90 percent, 160 degrees 78 percent, 180 degrees 70 percent.' },
  { t: 'h', text: 'The sheet' },
  { t: 'para', text: `The sheet slider sets the sail's angle from the centre line, from 4 degrees (hauled in) to 88 degrees (let out). The best angle is half the wind angle plus 2 degrees, never below 6 or above 86. How far you may be from it depends on the difficulty: ${LEVELS.map((l) => `${l.name} ${l.trimW} degrees`).join(', ')}. Too far out and the sail shakes (luffs); too far in and it stalls, which forgives 30 percent more room than a shaking sail. Efficiency falls with the square of the error.` },
  { t: 'para', text: 'Speed: the target speed is 5.6 times (drive times efficiency times sail area) to the power 0.8, times (wind speed over 8) to the power 0.7, times the sail condition factor, up to a hull limit of 7.4 metres per second (11.8 knots). The boat speeds up with a time constant of 3 seconds and slows with 2.2.' },
  { t: 'h', text: 'Tacking and the yard' },
  { t: 'para', text: 'When the wind crosses from one side to the other (more than 7 degrees past dead ahead or dead astern) the crew must dip the yard round the mast. This takes 5.4 seconds minus 0.65 for each sailor, between 1.8 and 5, and 40 percent longer when morale is below 25. While the yard is dipped the drive is only 15 percent. Hold a course just inside 7 degrees of dead downwind to avoid dipping.' },
  { t: 'h', text: 'Reefing, gusts and strain' },
  { t: 'para', text: 'Reefing takes in 42 percent of the sail and moves slowly (about 2.5 seconds). The overpower number is (wind times sail area over 11.5) squared, times (0.45 plus 0.55 times efficiency), times a factor of 1.0 across the wind and 0.78 running before it. Above 1.0 the sail strains; at full strain it splits, losing 22 sail condition. Above 2.0 for 2.5 seconds the dhow broaches: 10 hull damage, 10 percent of the cargo lost and the speed drops to 30 percent. Sail condition (0 to 100) lowers top speed by up to 45 percent. A sailmaker reduces strain by 18 percent.' },
  { t: 'h', text: 'Leeway and current' },
  { t: 'para', text: 'Close to the wind a dhow slides sideways, up to 7 degrees, so she goes where her nose does not point. Currents also push the ship: the African coast runs north in the kusi at 0.8 metres per second (a 1.3 knot set) and south in the kaskazi at 0.4; open Arabian Sea currents are 0.3. Your chart does not know about either.' },
  { t: 'h', text: 'Finding your way' },
  { t: 'fig', key: 'chart', h: 250 },
  { t: 'para', text: 'The chart position is dead reckoning: your heading and your log speed, with a small compass error (up to 6 to 10 degrees, depending on difficulty) and a log error of up to 10 percent. The yellow circle grows as the real error grows. The teal band on the compass shows how far off the harbour may be from your estimate.' },
  { t: 'fig', key: 'kamal', h: 250 },
  { t: 'para', text: 'Star sight: at night (the sky between 78 and 22 percent of a day), when no squall is blowing, press Sight. A star marker swings across the card for up to 9 seconds. Tap NOW as it meets the centre. A sight within the teal window gives quality; the window is wide on Gentle, narrow on Master, and wider with a navigator. A good sight places your estimate on your true latitude; a poor one leaves up to 55 metres of error (66 on Master). A sight fixes the north-south line only; east-west stays estimated. Sights need 4 seconds between them. When land is sighted, your estimate snaps to the truth.' },
  { t: 'h', text: 'Hazards' },
  { t: 'para', text: `Reef: a circle of rock and shoal 30 to 56 metres in radius, seen as pale water and breakers from 260 metres. Touching it costs 14 plus twice your speed in hull points, 5 percent of the cargo, 6 morale, and stops you to 30 percent speed. Some reefs form a narrow channel.` },
  { t: 'para', text: 'Squall: shown by a dark horizon and a 9 second warning with three choices. Reef the sail, run before it (the helm turns downwind and the sheet is set for you until it passes), or press on. For 22 seconds the wind is 1.8 to 2.1 times stronger and turns 25 to 50 degrees. A reefed boat shakes the reef out again 6 seconds after the squall.' },
  { t: 'para', text: 'Calm: for 24 to 32 seconds the wind falls to about a tenth. Take the sweeps (adds up to 0.95 metres per second with five sailors, less with fewer, and costs morale) or wait (skips time at six times speed). A dhow in need: a small dhow within 120 metres drifting with no water. Sharing costs 12 percent of your water and gains 5 reputation and 8 morale; sailing on costs 1 reputation. You have 9 seconds to decide.' },
  { t: 'h', text: 'Water and morale' },
  { t: 'para', text: 'Water drains with the size of the crew and with time; one full tank lasts three times the par time with a crew of three. If it reaches zero, thirst builds, morale falls, and after 22 seconds the passage fails. Morale rises slowly when you sail fast and falls when becalmed, on a reef, or when pulling the sweeps.' },
  { t: 'h', text: 'Stars and score' },
  { t: 'para', text: 'A passage earns one star for arriving, a second if your time is under 1.15 times the par, a third if you finish with at least 70 hull and sighted land within 260 metres of the harbour line. Reputation changes by +3 for beating the par, +1 for under 1.4 times it, -6 for failing, plus decisions along the way.' },
  { t: 'h', text: 'Career: calendar and cargo' },
  { t: 'para', text: `The calendar starts in ${MONTHS[START_MONTH]} of year 1. Every leg takes its listed days (more than 1.5 times the par adds a quarter, a failure adds 5), a month is 30 days. Eight goods are traded: ${GOODS.map((g) => g.name.toLowerCase()).join(', ')}. Your hold holds ${HOLD_STEPS.join(', ')} units after upgrades costing ${HOLD_COST[1]} and ${HOLD_COST[2]} coins.` },
  { t: 'para', text: `Each port has a multiplier for each good (cheap where it is made, dear where it is wanted) and a slow drift by month. You pay about 6 percent above the middle price and sell about 6 percent below, reduced by up to 10 percent with high reputation. Every unit you buy or sell moves the price by 1.2 percent at once, and a little more that fades over about a month, so a hold of one good sold in one port soon pays less: spread your cargo over several goods and several ports. Selling and buying are done by tapping the Buy and Sell buttons; the lot size can be 1, 5 or 10.` },
  { t: 'h', text: 'Career: crew, ship and money' },
  { t: 'para', text: `Hiring costs ${HIRE.sailors} coins for a sailor (up to five), ${HIRE.navigator} for a navigator and ${HIRE.sailmaker} for a sailmaker (one each). Daily wages are ${WAGE.sailors} per sailor, ${WAGE.navigator} for the navigator and ${WAGE.sailmaker} for the sailmaker. Wages for the days of a voyage, and a port fee of ${PORT_FEE}, are paid on arrival. Water barrels cost ${WATER_PRICE} coins (six at most, each a fifth of a tank). Repairs cost ${HULL_PRICE} coins per hull point and ${SAIL_PRICE} per sail point.` },
  { t: 'para', text: `A failed passage costs 60 coins for a wreck or 40 otherwise, plus wages, loses half of the cargo, and costs 6 reputation; if it leaves you without coins or cargo, a harbour merchant stakes you 120 coins once (and costs 3 reputation); you return to the port you left with at least 35 hull. Malacca opens when reputation reaches ${GOAL_REP} after three arrivals. Harbour talk once per visit asks a question: a right answer gives 4 coins and a lore card.` },
  { t: 'h', text: 'Auto Play and hints' },
  { t: 'para', text: 'Auto Play cycles THINK (2, 5, 8 or 10 seconds as you choose), REVEAL (2 seconds, the choices are highlighted) and ACT, at decision points: leaving harbour, a new wind, a squall, a night sight, a dhow in need, landfall. PAUSE freezes everything exactly. The ? hint during your own sailing explains the wind, the best heading and sheet, and what is ahead; you have 3 hints per passage.' },
  { t: 'h', text: 'Controls' },
  { t: 'para', text: 'Touch: drag the compass to steer, drag the sheet slider, tap Reef, Sight and Sweeps. The camera button cycles chase, side, bow and orbit views. Keyboard: Left/Right steer, Up/Down sheet, R reef, K sight and N for NOW, W sweeps, P pause, T hint, C camera.' },
  { t: 'h', text: 'Free preview' },
  { t: 'para', text: 'You can sail for 90 seconds free. Menus, Rules, About, Auto Play and the paused hint do not count. Then you can unlock the full game once, and the web demo allows two passages.' },
];
void pol; void PORTS;

export const ABOUT = [
  { t: 'title', text: 'About', size: 44, sub: 'Dhow Sailing' },
  { t: 'para', text: 'Dhow Sailing is a sailing and trading game of the Indian Ocean monsoon world, in the time of the wooden lateen-rigged ships called dhows. You sail real legs between Kilwa, Mombasa, Aden, Muscat, Surat, Calicut and Malacca in true 3D water, trim the sail with your fingers, steer by wind and stars, choose cargo and crew, and learn how the monsoons carried a whole ocean together.' },
  { t: 'para', text: 'Places and the star names are real. The ships, crews, voyages and events are made up for the game. The sailors are shown with respect for the people of the coasts who made this trade.' },
  { t: 'h', text: 'Made by' },
  { t: 'para', text: 'Arcforge, World Heritage Games. Real 3D water, sky, ships and stars are drawn by the game itself.' },
];
