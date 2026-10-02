// Every word the player reads, in English and Korean. English is a complete, first-class choice ("Play in English"),
// Korean (공기놀이) is the named alternative; the two are never mixed on one screen (apart from the two language
// buttons themselves). Numbers in the Rules come from sim.js constants where they appear in code.
import { STAGES, CHARGE_SECS, SET_MIN_HOME, KK, FLICK_T } from './sim.js';

const en = {
  you: 'You', p1: 'Player 1', p2: 'Player 2',
  turnStart: 'Turn: {name}', perfect: 'Perfect!', good: 'Good catch', caught: 'Caught',
  fail_clip: 'Brushed a stone', fail_late: 'Hand too slow', fail_slow: 'Missed the catch', fail_early: 'Too early',
  stageClear: 'Stage {n} cleared!', kkCaught: '{n} on the back of the hand', kkNone: 'Dropped', kkKept: '+{n}',
  tryAgain: 'Try that stage again',
  turnKk: '{name} scores {n}. Turn passes.', turnKk0: '{name} scores nothing this time. Turn passes.', turnFault: '{name} drops it at stage {stage}. Turn passes.',
  needPlan: 'Finish your plan first', inFull: 'In the full game',
  restoring: 'Checking with the store...', restored: 'Purchase restored. Thank you!', noPurchase: 'No previous purchase found.', storeDown: 'The store is not available right now.',
  howtoTitle: 'How to Play', aboutTitle: 'About', rulesTitle: 'Rules',
  stageShort: 'Stage {n}', lessonLabel: 'Lesson {n}',
  c_ai: '{name} is playing', c_scatter: 'Drag on the mat to scatter, then let go', c_scattering: 'Stones fly out...', c_hold: 'Tap the stone you will hold and toss',
  c_take: 'Tap {n} more of {k} stones to take, in order', c_clip: 'This route brushes a stone: change the order or the stones', c_ready: 'Hold the pad to set the height, release to toss',
  c_set: 'Tap the mat to set the four stones down', c_sweep: 'Hold the pad: toss, sweep all four, catch', c_charge: 'Release to toss', c_exec: 'Tap when the ring closes on the stone',
  c_ok: 'Caught it!', c_fail: 'Not this time', c_kcharge: 'Hold the pad to toss all five stones', c_kflight: 'Press the mat under the stones, let go as they drop',
  c_kcatch: 'Now the flick: get ready to catch them again', c_kmiss: 'None stayed on the hand', c_kflick: 'Tap as the stones come down', c_kdone: 'Points counted', c_clear: 'Stage cleared', c_turnend: 'Turn over',
  beatThink: 'THINK', beatReveal: 'REVEAL', beatAct: 'ACT',
  pad_ai: '{name} is playing', pad_hold: 'HOLD TO TOSS', pad_plan: 'Make your plan first', pad_release: 'RELEASE TO TOSS', pad_catch: 'TAP TO CATCH',
  pad_kflight: 'Press the mat, let go to catch', pad_scatter: 'Drag on the mat above', pad_holdstone: 'Tap a stone above',
  pad_cap0: 'Route {route} s', pad_cap: 'Route {route} s · In the air {air} s',
  w_dec: 'Think −', w_inc: 'Think +', w_resume: 'Resume', w_exit: 'Exit', pause: 'Pause', think: 'Think', clear: 'Clear',
  hintTitle: 'Think', revealTitle: 'The plan',
  m_continue: 'Continue Match', m_continueSub: '{a} - {b} · Stage {stage}', m_play: 'Play', m_learn: 'Learn the Stages', m_learnSub: 'Six short lessons, one stage at a time',
  m_watch: 'Watch & Learn', m_watchSub: 'Two computer players play while you learn why', m_howto: 'How to Play', m_rules: 'Rules', m_about: 'About', m_settings: 'Settings',
  s_title: 'New Match', s_opp: 'Play against', s_cpu: 'Computer', s_pass: 'Pass and play', s_level: 'Choose the level', s_won: 'won {n}',
  s_target: 'First to', s_points: '{n} points', s_quick: 'Quick match', s_standard: 'Standard match', s_long: 'Long match', s_start: 'Start the match',
  l_title: 'Learn the Stages', l_intro: 'Each lesson plays one real stage with coaching. Repeat any lesson as often as you like.', l_done: 'Done', l_goal: 'Goal', l_start: 'Start the lesson',
  l_complete: 'Lesson complete', l_next: 'Next lesson', l_again: 'Practice again', l_all: 'All lessons',
  back: 'Back', soundOn: 'Sound: On', soundOff: 'Sound: Off', calmOn: 'Calm effects: On', calmOff: 'Calm effects: Off', calmSub: 'No screen shake or flashes',
  set_lang: 'Language', textSize: 'Text size: {n}%', smaller: 'A−  Smaller', larger: 'A+  Larger', thinkTime: 'Watch & Learn thinking time: {n} s', shorter: 'Shorter', longer: 'Longer',
  restore: 'Restore purchases',
  r_wins: '{name} wins', r_youWin: 'You win the match!', r_stats: 'Turns played: {turns}. Best kkeokki: {kk}.', r_vs: 'Against {name}, you have won {n}.',
  r_again: 'Rematch', r_new: 'New match', r_menu: 'Main menu',
  paused: 'Paused', resume: 'Resume', soundOnShort: 'Sound: On', soundOffShort: 'Sound: Off', calmOnShort: 'Calm: On', calmOffShort: 'Calm: Off', quit: 'Quit to menu',
  d_title: 'That is the free preview', d_body: 'You have played the free matches of the web demo. The full game on iPhone and Android has every level, every lesson and unlimited matches.',
  more: 'more', up: 'up', cont: 'cont.', page: 'Page {a} of {b}', close: 'Close', done: 'Done', next: 'Next',
  // coaching lines for the lessons (lesson number from 0, phase)
  tip_0_scatter: 'Lesson 1: press in the middle, drag outward to size the circle, let go', tip_0_hold: 'Tap one stone to hold: it will be the one you toss', tip_0_plan: 'Tap one stone to take, then hold the pad to toss',
  tip_1_plan: 'Take two stones per toss: tap them in the order you want to go', tip_2_plan: 'Three at once, then the last one: plan a route that touches nothing else',
  tip_3_plan: 'Stage 4: tap the mat to set all four stones down together, then toss', tip_4_kcharge: 'Kkeokki: hold the pad for a medium toss', tip_4_kflight: 'Press under the stones, let go as they fall',
  tip_5_plan: 'The straight path brushes a stone. Press Think to see a clean order',
};

const ko = {
  you: '나', p1: '플레이어 1', p2: '플레이어 2',
  turnStart: '차례: {name}', perfect: '완벽해요!', good: '좋은 받기', caught: '받았어요',
  fail_clip: '다른 돌을 건드렸어요', fail_late: '손이 늦었어요', fail_slow: '받기를 놓쳤어요', fail_early: '너무 일렀어요',
  stageClear: '{n}단 성공!', kkCaught: '손등에 {n}개', kkNone: '떨어뜨렸어요', kkKept: '+{n}',
  tryAgain: '이 단을 다시 해 보세요',
  turnKk: '{name} {n}점. 차례가 넘어갑니다.', turnKk0: '{name} 이번엔 0점. 차례가 넘어갑니다.', turnFault: '{name}이(가) {stage}단에서 떨어뜨렸어요. 차례가 넘어갑니다.',
  needPlan: '먼저 계획을 마치세요', inFull: '정식 버전에서',
  restoring: '스토어에 확인하는 중...', restored: '구매를 복원했어요. 감사합니다!', noPurchase: '이전 구매 내역이 없어요.', storeDown: '지금은 스토어를 쓸 수 없어요.',
  howtoTitle: '게임 방법', aboutTitle: '소개', rulesTitle: '규칙',
  stageShort: '{n}단', lessonLabel: '배우기 {n}',
  c_ai: '{name} 차례입니다', c_scatter: '판 위에서 끌었다가 놓아 돌을 뿌리세요', c_scattering: '돌이 흩어집니다...', c_hold: '손에 쥐고 던질 돌을 누르세요',
  c_take: '집을 돌을 순서대로 {n}개 더 누르세요 (모두 {k}개)', c_clip: '이 길은 다른 돌을 건드려요. 순서나 돌을 바꿔 보세요', c_ready: '패드를 눌러 높이를 정하고, 떼면 던져요',
  c_set: '판을 눌러 네 개를 놓을 자리를 정하세요', c_sweep: '패드를 누르세요: 던지고, 네 개를 쓸어 담고, 받아요', c_charge: '떼면 던져요', c_exec: '링이 돌에 닿을 때 누르세요',
  c_ok: '받았어요!', c_fail: '이번엔 아쉬워요', c_kcharge: '패드를 눌러 다섯 개를 모두 던지세요', c_kflight: '돌 아래 판을 누르고 있다가 떨어질 때 떼세요',
  c_kcatch: '이제 튕기기: 다시 받을 준비를 하세요', c_kmiss: '손등에 남은 돌이 없어요', c_kflick: '돌이 내려올 때 누르세요', c_kdone: '점수를 셉니다', c_clear: '단 성공', c_turnend: '차례 끝',
  beatThink: '생각', beatReveal: '공개', beatAct: '실행',
  pad_ai: '{name} 차례입니다', pad_hold: '눌러서 던지기', pad_plan: '먼저 계획을 세우세요', pad_release: '떼면 던져요', pad_catch: '눌러서 받기',
  pad_kflight: '판을 눌렀다 떼서 받기', pad_scatter: '위의 판을 끌어 보세요', pad_holdstone: '위의 돌을 눌러 보세요',
  pad_cap0: '길 {route}초', pad_cap: '길 {route}초 · 공중 {air}초',
  w_dec: '생각 −', w_inc: '생각 +', w_resume: '계속', w_exit: '나가기', pause: '일시정지', think: '생각', clear: '지우기',
  hintTitle: '생각', revealTitle: '계획',
  m_continue: '이어서 하기', m_continueSub: '{a} - {b} · {stage}단', m_play: '놀기', m_learn: '단계별로 배우기', m_learnSub: '한 단씩, 짧은 배우기 여섯 개',
  m_watch: '보며 배우기', m_watchSub: '컴퓨터 둘이 놀며 이유를 보여줘요', m_howto: '게임 방법', m_rules: '규칙', m_about: '소개', m_settings: '설정',
  s_title: '새 대결', s_opp: '상대', s_cpu: '컴퓨터', s_pass: '둘이서 번갈아', s_level: '단계를 고르세요', s_won: '{n}승',
  s_target: '먼저 얻는 점수', s_points: '{n}점', s_quick: '짧은 대결', s_standard: '보통 대결', s_long: '긴 대결', s_start: '대결 시작',
  l_title: '단계별로 배우기', l_intro: '각 배우기는 실제 한 단을 코칭과 함께 해 봅니다. 몇 번이든 다시 할 수 있어요.', l_done: '완료', l_goal: '목표', l_start: '배우기 시작',
  l_complete: '배우기 완료', l_next: '다음 배우기', l_again: '다시 연습', l_all: '배우기 목록',
  back: '뒤로', soundOn: '소리: 켬', soundOff: '소리: 끔', calmOn: '차분한 효과: 켬', calmOff: '차분한 효과: 끔', calmSub: '화면 흔들림과 번쩍임 없음',
  set_lang: '언어', textSize: '글자 크기: {n}%', smaller: 'A−  작게', larger: 'A+  크게', thinkTime: '보며 배우기 생각 시간: {n}초', shorter: '짧게', longer: '길게',
  restore: '구매 복원',
  r_wins: '{name} 승리', r_youWin: '대결에서 이겼어요!', r_stats: '진행한 차례: {turns}. 최고 꺾기: {kk}.', r_vs: '{name}에게 지금까지 {n}번 이겼어요.',
  r_again: '다시 대결', r_new: '새 대결', r_menu: '처음 화면',
  paused: '일시정지', resume: '계속하기', soundOnShort: '소리: 켬', soundOffShort: '소리: 끔', calmOnShort: '차분: 켬', calmOffShort: '차분: 끔', quit: '처음 화면으로',
  d_title: '무료 체험은 여기까지예요', d_body: '웹 체험판의 무료 대결을 모두 해 보셨어요. iPhone과 Android 정식 버전에는 모든 단계, 모든 배우기, 끝없는 대결이 들어 있어요.',
  more: '더 보기', up: '위로', cont: '이어서', page: '{a} / {b} 쪽', close: '닫기', done: '완료', next: '다음',
  tip_0_scatter: '배우기 1: 가운데를 누르고 바깥으로 끌어 원의 크기를 정한 뒤 놓으세요', tip_0_hold: '돌 하나를 눌러 쥐세요: 그 돌을 던질 거예요', tip_0_plan: '집을 돌 하나를 누른 뒤 패드를 눌러 던지세요',
  tip_1_plan: '한 번에 두 개씩 집어요: 가고 싶은 순서대로 눌러 보세요', tip_2_plan: '세 개를 한꺼번에, 그다음 남은 하나: 다른 돌을 건드리지 않는 길을 짜 보세요',
  tip_3_plan: '4단: 판을 눌러 네 개를 한곳에 놓고 던지세요', tip_4_kcharge: '꺾기: 패드를 눌러 중간 높이로 던지세요', tip_4_kflight: '돌 아래를 누르고 있다가 떨어질 때 떼세요',
  tip_5_plan: '곧장 가는 길은 돌을 건드려요. 생각 버튼으로 깨끗한 순서를 확인하세요',
};

const DICT = { en, ko };
export function tx(lang, key, vars, soft) {
  let s = (DICT[lang] ?? en)[key];
  if (s === undefined) { if (soft) return null; s = en[key] ?? key; }
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
}

export const STONE_NAMES = {
  en: ['ivory', 'slate', 'rose', 'jade', 'amber'],
  ko: ['상아색', '청회색', '분홍', '옥색', '호박색'],
};
export const stoneName = (lang, id) => (STONE_NAMES[lang] ?? STONE_NAMES.en)[id % 5];

const STAGE_NAMES = {
  en: ['One at a time', 'Two at a time', 'Three, then one', 'Set and sweep', 'Kkeokki'],
  ko: ['한 개씩', '두 개씩', '세 개 그리고 한 개', '놓고 쓸기', '꺾기'],
};
export const stageName = (lang, n) => (STAGE_NAMES[lang] ?? STAGE_NAMES.en)[Math.max(0, Math.min(4, n - 1))];

// ---- lessons ---------------------------------------------------------------------------------------------
const LESSON_TEXT = {
  en: {
    one: { title: 'One at a time', short: 'Scatter, hold a stone, take one per toss', body: ['You hold five pebbles. Scatter them on the mat: press where you want the middle to be and drag outward to set how wide. Then tap the one stone you will keep in your hand and toss.', 'Each toss, take exactly one stone from the mat and catch the falling stone. Four tosses clear the stage.'], goal: 'Take all four stones, one per toss.', done: 'You can scatter, hold a stone and take one at a time. Next: two at a time.' },
    two: { title: 'Two at a time', short: 'Take two stones per toss', body: ['Now take two stones in the same toss. Tap them in the order the hand should visit. Longer routes need a higher toss.', 'Watch the markers on the toss pad: red is the least height that can work, green is safe.'], goal: 'Clear both tosses.', done: 'Two at a time is about routes and time. Next: three, then one.' },
    three: { title: 'Three, then one', short: 'Take three, then the last one', body: ['The first toss takes three stones, the second takes the last one. Choose the stone to hold so the other four are easy to reach.', 'Press Think if you like: it names the stone to hold and the order to take.'], goal: 'Take three, then the last stone.', done: 'You can plan a three-stone route. Next: set and sweep.' },
    four: { title: 'Set and sweep', short: 'Put four down together, then sweep them up', body: ['No scatter this time. First toss: set the other four stones down together in a tight square at a spot you choose, at least ' + SET_MIN_HOME + ' units from your hand, and catch.', 'Second toss: sweep all four up at once and catch.'], goal: 'Set the stones, then sweep them up.', done: 'Set and sweep is a timing stage. Next: kkeokki.' },
    kk: { title: 'Kkeokki', short: 'Throw all five and catch on the back of the hand', body: ['Throw all five stones up. Press the mat under them with your palm and let go as they drop: every stone inside the ring and low enough stays on the back of your hand.', 'Then flick the stones you caught and catch them again. Each stone you keep is a point.'], goal: 'Keep at least one stone.', done: 'That is the whole game: four stages and kkeokki.' },
    route: { title: 'Reading the route', short: 'Avoid brushing a stone', body: ['The ribbon shows the path your hand will take. If it touches a stone you are not taking, that is a fault, and the stone is marked in red.', 'Here the stones are placed so the obvious order brushes one. Try the Think button, then change the order.'], goal: 'Clear stage 3 on this mat.', done: 'You can read a route before you commit to it.' },
  },
  ko: {
    one: { title: '한 개씩', short: '돌을 뿌리고, 하나를 쥐고, 한 번에 한 개씩', body: ['다섯 개의 돌을 쥐고 있어요. 가운데가 될 곳을 누르고 바깥으로 끌어 넓이를 정한 뒤 놓으면 돌이 뿌려집니다. 그다음 손에 쥐고 던질 돌 하나를 누르세요.', '한 번 던질 때마다 판의 돌 하나를 집고 떨어지는 돌을 받으세요. 네 번 던지면 이 단이 끝납니다.'], goal: '네 개를 한 번에 하나씩 모두 집기.', done: '뿌리고, 돌을 쥐고, 한 개씩 집는 법을 익혔어요. 다음은 두 개씩입니다.' },
    two: { title: '두 개씩', short: '한 번 던질 때 두 개 집기', body: ['이번에는 같은 던지기에 돌 두 개를 집어요. 손이 갈 순서대로 눌러 보세요. 길이 길수록 더 높이 던져야 해요.', '던지기 패드의 표시를 보세요: 빨강은 이 정도는 던져야 한다는 최소 높이, 초록은 안전한 높이예요.'], goal: '두 번의 던지기를 모두 성공하기.', done: '두 개씩은 길과 시간의 싸움이에요. 다음은 세 개 그리고 한 개입니다.' },
    three: { title: '세 개 그리고 한 개', short: '세 개를 집고 마지막 하나', body: ['첫 번째 던지기에는 돌 세 개, 두 번째에는 남은 하나를 집어요. 나머지 네 개가 손에 닿기 쉽도록 쥘 돌을 잘 고르세요.', '생각 버튼을 누르면 쥘 돌과 집을 순서를 알려 줘요.'], goal: '세 개를 집고, 마지막 돌 집기.', done: '세 개짜리 길을 짤 수 있게 되었어요. 다음은 놓고 쓸기입니다.' },
    four: { title: '놓고 쓸기', short: '네 개를 한곳에 놓고 한꺼번에 쓸기', body: ['이번에는 뿌리지 않아요. 첫 번째 던지기에서는 나머지 네 개를 손에서 ' + SET_MIN_HOME + ' 이상 떨어진 곳에 네모로 모아 놓고 받으세요.', '두 번째 던지기에서는 네 개를 한꺼번에 쓸어 담고 받으세요.'], goal: '돌을 놓고, 쓸어 담기.', done: '놓고 쓸기는 타이밍의 단이에요. 다음은 꺾기입니다.' },
    kk: { title: '꺾기', short: '다섯 개를 던져 손등으로 받기', body: ['다섯 개를 모두 위로 던지세요. 돌 아래의 판을 손바닥으로 누르고 있다가 떨어질 때 떼세요: 링 안에서 충분히 낮아진 돌은 손등에 남습니다.', '그다음 받은 돌을 다시 튕겨 올려 받아요. 남긴 돌 하나가 1점이에요.'], goal: '돌을 한 개 이상 남기기.', done: '이게 놀이의 전부예요: 네 단과 꺾기.' },
    route: { title: '길 읽기', short: '돌을 건드리지 않기', body: ['리본은 손이 지나갈 길이에요. 집지 않을 돌에 닿으면 반칙이고, 그 돌에 빨간 표시가 나타나요.', '여기서는 뻔한 순서로 가면 돌 하나를 건드리도록 놓여 있어요. 생각 버튼을 눌러 보고 순서를 바꿔 보세요.'], goal: '이 판에서 3단 성공하기.', done: '정하기 전에 길을 읽을 수 있게 되었어요.' },
  },
};
export const lessonText = (lang, id) => (LESSON_TEXT[lang] ?? LESSON_TEXT.en)[id];

// ---- About / How to play / Rules --------------------------------------------------------------------------
const HEAD = Math.round(CHARGE_SECS * 10) / 10;
const PAGES = {
  en: {
    about: [
      { title: 'Gonggi', art: 'stones', p: ['Gonggi (공기놀이) is a traditional Korean game played with five small stones. A player tosses one stone into the air, picks up other stones from the floor with the same hand, and catches the falling stone before it lands.', 'The first stage takes one stone at a time, then two, then three and one, then all four together, and the last stage flicks all five stones onto the back of the hand.'] },
      { title: 'A game of many names', p: ['Tossing and catching small stones is played in many parts of the world under many names, such as knucklebones, jacks, five stones, gutte and otedama. This game does not claim one place of origin for the family.', 'Gonggi has its own stages and scoring, and families and regions play it with small differences. This version follows the common stage order and the Rules page says exactly what it does.'] },
      { title: 'About this version', p: ['The mat is inspired by bojagi, the Korean patchwork cloth made of pieced fabric joined with flat seams. The glass ring is your hand; the game shows the path and the timing instead of a drawn person.', 'Play against five computer levels or a friend on the same phone, learn each stage in six short lessons, or watch two computer players and see why they choose what they choose. You can play in English or in Korean from the title screen or Settings.'] },
    ],
    howto: [
      { title: 'The idea', art: 'stones', p: ['You hold five pebbles. Toss one into the air, take other stones from the mat with the same hand, and catch the falling stone before it lands. Climb through the stages; the last one is kkeokki, where all five stones are flicked onto the back of your hand.'] },
      { title: 'Scatter and hold', art: 'scatter', p: ['On stages 1 to 3 you start by scattering. Press on the mat where you want the middle and drag outward to set how wide, then let go. A tight scatter makes pairs easy but can leave stones touching; a wide scatter gives the hand a long way to go.', 'Then tap the one stone you will hold and toss. Holding a stone that sits in the middle of the others lifts it out of the way.'] },
      { title: 'Plan a round', art: 'route', p: ['Tap the stones to take, in the order the hand should visit. A ribbon shows the route. If the ribbon touches a stone you are not taking, that stone turns red: the hand would brush it, which is a fault.', 'On stage 4 you tap the mat to choose where to set the four stones down.'] },
      { title: 'Toss and catch', art: 'gauge', p: ['Press and hold the toss pad. The longer you hold, the higher the toss and the longer the stone stays up, but a higher stone falls faster, so the catch is harder to time. On the pad, the red mark is the shortest toss that can work and the green mark is a safe one.', 'Let go to toss. The hand collects the stones by itself. When the ring around the landing spot closes onto the stone, tap anywhere to catch it. A tap just before or after is fine; a tap too far off drops the stone.'] },
      { title: 'Kkeokki', art: 'kk', p: ['Hold the pad and let go to throw all five stones. Then press the mat under the falling stones: a ring shows what your palm covers. Keep your finger down, move it to follow the stones, and let go as they drop to hand height. Stones inside the ring stay on the back of your hand.', 'Then the stones you caught are flicked up again: tap as they come down. Each stone you keep is one point.'] },
      { title: 'Think, Learn and Watch', p: ['Think shows the best plan the engine can find and says why, with the chance it works. Learn the Stages has six short lessons. Watch & Learn plays two computer players in beats: THINK, then REVEAL the plan, then ACT. You can pause at any time.', 'Keys on a computer: Space to hold and release, Enter to scatter, H for Think, P to pause.'] },
    ],
    rules: [
      { title: 'The pieces', art: 'stones', p: ['Five round pebbles, numbered 0 to 4 and told apart by colour: ivory, slate, rose, jade, amber. A patchwork mat. Your hand, shown as a glass ring that rests at the bottom of the mat.', 'One stone is held and tossed. The others lie on the mat or are held in the other hand.'] },
      { title: 'Turns and winning', p: ['Players take turns. On your turn you play the stages in order starting from the stage you reached, and you keep going until you make a fault or finish kkeokki. After a fault your next turn starts again at the same stage with a fresh scatter.', 'Points come only from kkeokki. After kkeokki your turn ends and your next turn starts at stage 1. The match is played to 5, 10 or 15 points. Both players always get the same number of turns: the match ends after the round of turns in which someone reaches the target, and the higher score wins. If the scores are level, play goes on.'] },
      { title: 'The scatter', art: 'scatter', p: ['At the start of stages 1, 2 and 3 you scatter all five stones. You choose the centre by pressing and the spread by dragging: the spread is 80 to 260 units around the centre. Each stone lands at a random place inside the circle. Stones that would overlap are pushed apart until they just clear each other. A quick tap without dragging scatters at a spread of 150.', 'Then you choose which stone to hold. It is lifted off the mat and is the stone you toss on this stage.'] },
      { title: 'Stage 1: one at a time', p: ['Four tosses. Each toss you take exactly one stone from the mat and catch the falling stone. The four stones on the mat must all be taken.'] },
      { title: 'Stage 2: two at a time', p: ['Two tosses. Each toss you take two stones from the mat, in the order you choose, and catch the falling stone.'] },
      { title: 'Stage 3: three, then one', p: ['Two tosses. The first takes three stones, the second takes the last stone.'] },
      { title: 'Stage 4: set and sweep', p: ['There is no scatter. On the first toss you set the other four stones down together in a tight square at a spot you choose and catch. The spot must be at least ' + SET_MIN_HOME + ' units from your hand. On the second toss the hand goes to the square, sweeps up all four and catches.'] },
      { title: 'How a toss works', art: 'gauge', p: ['Hold the pad to charge the toss. Holding for ' + HEAD + ' seconds gives full power; the toss starts at 20 percent. The stone is in the air for 0.55 seconds plus 0.85 seconds times the power, so from about 0.72 to 1.4 seconds.', 'It does not land exactly at your hand: it drifts up to 160 units times the power from the hand rest, in a random direction (less up and down the mat than side to side). The hand moves at a fixed speed, pauses 0.06 seconds for each stone it takes, and must be back under the stone before it lands.'] },
      { title: 'The catch', p: ['A ring closes onto the landing spot. Tap anywhere while it is closing. The tap counts if it falls from about 0.23 seconds before to 0.28 seconds after the landing at low power, narrowing to about 0.13 before and 0.16 after at full power, because a high stone falls faster. A tap before the window opens is ignored. Perfect and Good catches are only shown for fun and do not change the score.'] },
      { title: 'Faults', art: 'clip', p: ['A fault ends your turn. The faults are: the hand brushes a stone it is not taking (the hand path is about 24 units wide and a stone is 48 units across); the hand is not back under the stone when it lands; you do not tap inside the catch timing range.', 'The route preview shows the first, and the toss pad marks show the second, before you commit.'] },
      { title: 'Kkeokki: the throw', art: 'kk', p: ['All five stones are thrown up together. Higher throws give more time but spread the stones further. Press the mat while they are in the air: the ring shows your palm, about 108 units across from the centre. You can drag your finger to follow the stones. Let go to catch.', 'A stone stays on the back of your hand only if it is on its way down, low enough (under 100 units high) and inside the ring at the moment you let go.'] },
      { title: 'Kkeokki: the flick', p: ['The stones you caught are flicked up and must be caught again in the grip: a ring closes, and you tap when they come down. Within 0.10 seconds of the right moment you keep every stone; within 0.18 you lose one; within 0.26 you lose two; later you lose them all. Each stone you keep is one point. Traditional extras such as bonus tricks are not included.'] },
      { title: 'Computer players', p: ['There are five levels: Sprout, Pebble, Stream, Mountain and Master. They plan with the same rules you do. Lower levels sometimes miss that a route brushes a stone, choose a less careful route, hold the pad with a wobble and tap with a wider timing error. Higher levels are steadier. In simulation each level beats the one below it more often than not.'] },
      { title: 'Pass and play', p: ['Two people can share one phone. Player 1 and Player 2 alternate turns with the same rules. The phone is handed over when the turn banner appears.'] },
      { title: 'Think, Learn and Watch & Learn', p: ['Think gives the engine\'s best plan for the current choice, with the reason and the chance it works. Learn the Stages plays each stage as a lesson, with the fault retried right away. Watch & Learn plays two computer players: THINK (you can set 2 to 10 seconds), REVEAL (2 seconds, with the plan shown), then ACT. Pause stops everything and resumes exactly where it stopped.'] },
      { title: 'Saving', p: ['A match against the computer or a friend is saved when each round is planned and when you pause. Continue on the title screen resumes it paused, so nothing is lost the moment you return.'] },
    ],
  },
  ko: {
    about: [
      { title: '공기놀이', art: 'stones', p: ['공기놀이는 작은 돌 다섯 개로 하는 우리의 전통 놀이입니다. 돌 하나를 위로 던지고, 같은 손으로 바닥의 다른 돌을 집은 뒤, 던진 돌이 떨어지기 전에 받습니다.', '첫 단은 한 개씩, 그다음 두 개씩, 세 개 그리고 한 개, 네 개를 한꺼번에, 마지막 단은 다섯 개를 모두 던져 손등으로 받는 꺾기입니다.'] },
      { title: '이름이 많은 놀이', p: ['작은 돌을 던지고 받는 놀이는 세계 여러 곳에서 여러 이름으로 전해집니다. 널리 알려진 이름으로는 너클본, 잭스, 파이브 스톤즈, 구테, 오테다마 같은 것이 있어요. 이 게임은 이 놀이의 한 곳을 발상지라고 주장하지 않습니다.', '공기놀이에는 고유한 단계와 점수 규칙이 있고, 집안이나 지역마다 조금씩 다르게 놀기도 합니다. 이 버전은 흔히 쓰는 단계 순서를 따르고, 규칙 쪽에서 정확히 어떻게 했는지 밝혀 둡니다.'] },
      { title: '이 버전에 대해', p: ['판은 천 조각을 이어 만든 우리의 보자기에서 영감을 얻었습니다. 유리 같은 링이 손이에요. 사람을 그리는 대신 손이 지나갈 길과 타이밍을 보여 줍니다.', '컴퓨터 다섯 단계나 한 폰에서 친구와 겨루고, 여섯 개의 짧은 배우기로 단계를 익히고, 컴퓨터 둘이 노는 걸 보며 왜 그렇게 고르는지 배울 수 있어요. 처음 화면이나 설정에서 한국어와 영어를 고를 수 있습니다.'] },
    ],
    howto: [
      { title: '놀이의 방법', art: 'stones', p: ['다섯 개의 돌을 쥐고 있어요. 하나를 위로 던지고, 같은 손으로 판의 다른 돌을 집고, 떨어지는 돌이 땅에 닿기 전에 받으세요. 단을 올라가다 마지막은 다섯 개를 모두 던져 손등으로 받는 꺾기입니다.'] },
      { title: '뿌리고 쥐기', art: 'scatter', p: ['1단에서 3단까지는 돌을 뿌리며 시작해요. 가운데가 될 곳을 누르고 바깥으로 끌어 넓이를 정한 뒤 놓으세요. 좁게 뿌리면 짝을 집기 쉽지만 돌이 붙을 수 있고, 넓게 뿌리면 손이 멀리 가야 해요.', '그다음 손에 쥐고 던질 돌 하나를 누르세요. 다른 돌들 한가운데 있는 돌을 쥐면 길이 열립니다.'] },
      { title: '한 번의 계획', art: 'route', p: ['집을 돌을 손이 갈 순서대로 누르세요. 리본이 길을 보여 줘요. 리본이 집지 않을 돌에 닿으면 그 돌이 빨갛게 변해요. 손이 건드리게 되니 반칙입니다.', '4단에서는 판을 눌러 네 개를 놓을 자리를 정해요.'] },
      { title: '던지고 받기', art: 'gauge', p: ['던지기 패드를 누르고 있으세요. 오래 누를수록 높이 날아 오래 떠 있지만, 높은 돌은 더 빨리 떨어져 받는 타이밍이 어려워요. 패드의 빨간 표시는 통할 수 있는 가장 짧은 던지기, 초록 표시는 안전한 던지기예요.', '손을 떼면 던져요. 돌은 손이 알아서 집어요. 떨어질 자리를 감싼 링이 돌에 닿을 때 화면 아무 데나 눌러 받으세요. 조금 일찍이나 늦게는 괜찮지만, 너무 어긋나면 떨어뜨려요.'] },
      { title: '꺾기', art: 'kk', p: ['패드를 눌렀다 떼어 다섯 개를 모두 던지세요. 그다음 떨어지는 돌 아래의 판을 누르세요. 링이 손바닥이 덮는 범위예요. 손가락을 누른 채 돌을 따라 움직이다가 돌이 손 높이로 내려올 때 떼세요. 링 안의 돌이 손등에 남아요.', '받은 돌은 다시 튕겨 올라가고, 내려올 때 눌러 받으세요. 남긴 돌 하나가 1점이에요.'] },
      { title: '생각, 배우기, 보며 배우기', p: ['생각 버튼은 엔진이 찾은 가장 좋은 계획을 이유와 성공 확률과 함께 보여 줘요. 단계별로 배우기에는 짧은 배우기 여섯 개가 있어요. 보며 배우기는 컴퓨터 둘이 생각, 공개, 실행의 차례로 노는 모습을 보여 주며 언제든 멈출 수 있어요.', '컴퓨터 키: 스페이스는 누르고 떼기, 엔터는 뿌리기, H는 생각, P는 일시정지.'] },
    ],
    rules: [
      { title: '놀이 도구', art: 'stones', p: ['둥근 돌 다섯 개: 0번부터 4번까지, 색으로 구분해요(상아색, 청회색, 분홍, 옥색, 호박색). 조각을 이은 판. 그리고 판 아래쪽에 있는 유리 링으로 나타낸 손.', '돌 하나는 손에 쥐고 던지고, 나머지는 판 위에 있거나 다른 손에 쥐고 있어요.'] },
      { title: '차례와 승리', p: ['번갈아 차례를 해요. 자기 차례에는 지금까지 올라간 단부터 차례로 하고, 반칙을 하거나 꺾기를 마칠 때까지 계속해요. 반칙한 뒤 다음 차례에는 같은 단을 새로 뿌려서 다시 시작해요.', '점수는 꺾기에서만 나요. 꺾기 후에는 차례가 끝나고 다음 차례는 1단부터 다시 시작해요. 5점, 10점, 15점 중 정한 점수까지 겨뤄요. 두 사람은 항상 같은 횟수의 차례를 하고, 누군가 목표 점수에 닿은 차례 묶음이 끝나면 높은 점수가 이겨요. 점수가 같으면 계속해요.'] },
      { title: '뿌리기', art: 'scatter', p: ['1단, 2단, 3단을 시작할 때 다섯 개를 모두 뿌려요. 누른 곳이 가운데이고 끈 길이가 넓이예요. 넓이는 가운데에서 80에서 260까지입니다. 돌은 원 안 무작위 자리에 떨어지고, 겹치는 돌은 겨우 떨어질 만큼 밀려나요. 끌지 않고 가볍게 누르면 넓이 150으로 뿌려요.', '그다음 쥘 돌을 고르세요. 그 돌은 판에서 빠지고 이 단에서 던지는 돌이 돼요.'] },
      { title: '1단: 한 개씩', p: ['던지기 네 번. 매번 판의 돌을 정확히 한 개 집고 떨어지는 돌을 받아요. 판의 돌 네 개를 모두 집어야 해요.'] },
      { title: '2단: 두 개씩', p: ['던지기 두 번. 매번 판의 돌 두 개를 고른 순서대로 집고 떨어지는 돌을 받아요.'] },
      { title: '3단: 세 개 그리고 한 개', p: ['던지기 두 번. 첫 번째에 세 개, 두 번째에 마지막 한 개를 집어요.'] },
      { title: '4단: 놓고 쓸기', p: ['뿌리지 않아요. 첫 번째 던지기에서 나머지 네 개를 고른 자리에 네모로 모아 놓고 받아요. 그 자리는 손에서 ' + SET_MIN_HOME + ' 이상 떨어져야 해요. 두 번째 던지기에서는 손이 그 네모로 가서 네 개를 한꺼번에 쓸어 담고 받아요.'] },
      { title: '던지기의 원리', art: 'gauge', p: ['패드를 누르고 있으면 던지는 힘이 모여요. ' + HEAD + '초 누르면 최대이고, 처음은 20%예요. 돌은 0.55초에 힘×0.85초를 더한 만큼 떠 있어요. 대략 0.72초에서 1.4초입니다.', '돌은 손이 있던 자리에 정확히 내려오지 않아요. 힘×160 이내에서 무작위 방향으로 벗어나요(앞뒤보다 좌우로 더 벗어나요). 손은 일정한 속도로 움직이고 돌 하나를 집을 때마다 0.06초 멈추며, 돌이 떨어지기 전에 아래로 돌아와야 해요.'] },
      { title: '받기', p: ['링이 떨어질 자리로 좁혀져요. 좁혀지는 동안 화면 아무 데나 누르세요. 낮은 힘에서는 떨어지기 약 0.23초 전부터 0.28초 후까지, 최대 힘에서는 약 0.13초 전부터 0.16초 후까지 눌러야 인정돼요. 높이 던진 돌이 더 빨리 떨어지기 때문이에요. 창이 열리기 전에 누르면 무시돼요. 완벽함과 좋음은 보기 위한 표시일 뿐 점수는 바뀌지 않아요.'] },
      { title: '반칙', art: 'clip', p: ['반칙하면 차례가 끝나요. 반칙은 이렇습니다: 손이 집지 않을 돌을 건드린 경우(손길의 너비는 약 24, 돌의 지름은 48이에요), 돌이 떨어질 때 손이 아래에 돌아와 있지 않은 경우, 받기 창 안에서 누르지 못한 경우.', '첫째는 길 미리보기가, 둘째는 던지기 패드의 표시가 던지기 전에 알려 줘요.'] },
      { title: '꺾기: 던지기', art: 'kk', p: ['다섯 개를 모두 한꺼번에 위로 던져요. 높이 던질수록 시간은 늘지만 돌이 더 넓게 흩어져요. 돌이 공중에 있을 때 판을 누르세요. 링이 손바닥이 덮는 범위로, 반지름이 약 108이에요. 손가락을 끌어 돌을 따라갈 수 있고, 떼면 받아요.', '손등에 남으려면 돌이 내려오는 중이어야 하고, 충분히 낮고(높이 100 이하), 손을 떼는 순간 링 안에 있어야 해요.'] },
      { title: '꺾기: 튕기기', p: ['받은 돌은 다시 튕겨 올라가고 손으로 쥐어 받아야 해요. 링이 좁혀지고 돌이 내려올 때 누르세요. 알맞은 순간에서 0.10초 안이면 모두 남기고, 0.18초 안이면 한 개를 잃고, 0.26초 안이면 두 개를 잃고, 그보다 늦으면 모두 잃어요. 남긴 돌 하나가 1점이에요. 보너스 기술 같은 전통의 덧붙임은 넣지 않았어요.'] },
      { title: '컴퓨터 상대', p: ['다섯 단계가 있어요: 새싹, 조약돌, 시냇물, 산, 달인. 모두 여러분과 같은 규칙으로 계획해요. 낮은 단계는 길이 돌을 건드린다는 걸 가끔 놓치고, 덜 조심스러운 길을 고르고, 패드를 흔들리게 누르고, 누르는 타이밍이 더 어긋나요. 높은 단계일수록 안정적이에요. 시뮬레이션에서 각 단계는 바로 아래 단계를 더 자주 이겨요.'] },
      { title: '둘이서 번갈아', p: ['한 폰을 둘이 나눠 쓸 수 있어요. 플레이어 1과 2가 같은 규칙으로 번갈아 차례를 해요. 차례 안내가 뜨면 폰을 넘기세요.'] },
      { title: '생각, 배우기, 보며 배우기', p: ['생각 버튼은 지금 고르는 순간의 가장 좋은 계획을 이유와 성공 확률과 함께 알려 줘요. 단계별로 배우기는 각 단을 배우기로 하며, 반칙하면 바로 다시 해요. 보며 배우기는 컴퓨터 둘이 생각(2초에서 10초), 공개(2초, 계획이 보여요), 실행의 순서로 놀아요. 일시정지는 모든 것을 멈추고 멈춘 자리에서 그대로 이어져요.'] },
      { title: '저장', p: ['컴퓨터나 친구와의 대결은 매 판을 계획할 때와 일시정지할 때 저장돼요. 처음 화면의 이어서 하기는 일시정지된 채로 열려서 돌아오자마자 손해 보는 일이 없어요.'] },
    ],
  },
};
export const pagesFor = (lang, key) => (PAGES[lang] ?? PAGES.en)[key];
void STAGES; void KK; void FLICK_T;
