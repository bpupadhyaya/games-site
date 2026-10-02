// The levels. Each layout is five rows of four letters (one letter per block, '.' = empty cell). `min` is the fewest
// possible moves, worked out offline by solving every layout completely with engine.js (the test re-checks all of them).
// Four chapters of eight, easiest to hardest by `min`. Names are Three Kingdoms story titles used as plain names.

export const LEVELS = [
  { id: 'dawn-patrol', ch: 0, n: ['Dawn Patrol', '黎明巡营'], rows: ["ABCD","AEED",".FF.","GFFH","GIJH"], min: 5 },
  { id: 'two-guards', ch: 0, n: ['Two Guards', '双将守关'], rows: ["AABB","CCDD","EFFG",".FF.",".HH."], min: 8 },
  { id: 'red-cliffs', ch: 0, n: ['Red Cliffs', '赤壁'], rows: ["AABB","CCDD",".EE.","FEEG",".HHI"], min: 11 },
  { id: 'peach-garden', ch: 0, n: ['Peach Garden', '桃园结义'], rows: ["AABB","CCDD","EFFG","HFFI",".JJ."], min: 14 },
  { id: 'three-visits', ch: 0, n: ['Three Visits', '三顾茅庐'], rows: ["AABB",".CC.","DCCE","FFGG",".HH."], min: 17 },
  { id: 'straw-boats', ch: 0, n: ['Straw Boats', '草船借箭'], rows: ["AABB","CDD.","EDDF","GGHH",".II."], min: 20 },
  { id: 'linked-chains', ch: 0, n: ['Linked Chains', '连环计'], rows: ["AABB","CDDE","FDDG",".HH.","IIJJ"], min: 23 },
  { id: 'plum-thirst', ch: 0, n: ['Plums for Thirst', '望梅止渴'], rows: [".AB.","CDDE","CDDE","FGHI","FJJI"], min: 26 },
  { id: 'empty-fort', ch: 1, n: ['The Empty Fort', '空城计'], rows: ["AA.B",".CC.","DCCE","FFGG","HHII"], min: 30 },
  { id: 'lone-rider', ch: 1, n: ['Lone Rider', '单骑救主'], rows: ["ABBC","DBBE","FFGG","HHII",".JJ."], min: 34 },
  { id: 'changban-slope', ch: 1, n: ['Changban Slope', '长坂坡'], rows: ["AB.C","ADEC","FGGH","FGGH","IJJ."], min: 38 },
  { id: 'five-passes', ch: 1, n: ['Five Passes', '过五关'], rows: ["ABB.",".BB.","CCDD","EEFF","GHHI"], min: 42 },
  { id: 'seven-captures', ch: 1, n: ['Seven Captures', '七擒七纵'], rows: [".AA.","BCCD","EFFG","HFFG","IIJJ"], min: 46 },
  { id: 'east-wind', ch: 1, n: ['The East Wind', '借东风'], rows: [".AAB","CAAD","C.ED","FGHI","FJJI"], min: 50 },
  { id: 'banquet-blade', ch: 1, n: ['Banquet Blade', '单刀赴会'], rows: ["ABBC","DBBE","FGHI","FGHI",".JJ."], min: 54 },
  { id: 'burning-camps', ch: 1, n: ['Burning Camps', '火烧连营'], rows: ["ABCC","DEE.","DEE.","FFGG","HIIJ"], min: 58 },
  { id: 'longzhong-plan', ch: 2, n: ['Longzhong Plan', '隆中对'], rows: [".AA.","BAAC","BDEC","FGHI","FJJI"], min: 60 },
  { id: 'beacon-fires', ch: 2, n: ['Beacon Fires', '烽火'], rows: [".AA.","BAAC","BDEC","FDEG","HIIJ"], min: 63 },
  { id: 'lone-boat', ch: 2, n: ['Lone Boat', '孤舟'], rows: [".AAB",".AAB","CDEF","GGHH","IIJJ"], min: 66 },
  { id: 'northern-march', ch: 2, n: ['Northern March', '北伐'], rows: ["ABBC","ABBC","D..E","DFGE","HIIJ"], min: 69 },
  { id: 'jieting-gate', ch: 2, n: ['Jieting Gate', '街亭'], rows: ["A..B","ACCB","DCCE","FGGH","FIJH"], min: 72 },
  { id: 'mount-qi', ch: 2, n: ['Mount Qi', '祁山'], rows: ["ABBC","ABBD","EEFF",".GH.","IIJJ"], min: 74 },
  { id: 'wuzhang-plains', ch: 2, n: ['Wuzhang Plains', '五丈原'], rows: [".AA.","BAAC","BDDC","EFGH","IFGJ"], min: 76 },
  { id: 'hanzhong-road', ch: 2, n: ['Hanzhong Road', '汉中'], rows: ["ABBC","ABBC","D..E","DFFG","HIJG"], min: 78 },
  { id: 'heng-dao-li-ma', ch: 3, n: ['Heng Dao Li Ma', '横刀立马'], rows: ["ABBC","ABBC","DEEF","DGHF","I..J"], min: 81 },
  { id: 'long-siege', ch: 3, n: ['Long Siege', '围城'], rows: ["ABBC","ABBD",".EE.","FGGH","IIJJ"], min: 83 },
  { id: 'narrow-road', ch: 3, n: ['Narrow Road', '狭路相逢'], rows: ["ABB.","ABBC",".DDE","FGGH","IIJJ"], min: 85 },
  { id: 'iron-chains', ch: 3, n: ['Iron Chains', '铁索横江'], rows: ["ABBC","ABB.","DDE.","FGEH","FIJH"], min: 87 },
  { id: 'last-stand', ch: 3, n: ['Last Stand', '背水一战'], rows: ["ABBC","ABBD","EFFD","EGH.",".IHJ"], min: 89 },
  { id: 'sealed-pass', ch: 3, n: ['Sealed Pass', '水泄不通'], rows: ["ABBC",".BBC","DEEF","DGHF","IG.J"], min: 91 },
  { id: 'tiger-pass', ch: 3, n: ['Tiger Pass', '虎牢关'], rows: ["ABB.","ABBC","DEEF","D.GF","HIGJ"], min: 93 },
  { id: 'huarong-pass', ch: 3, n: ['Huarong Pass', '华容道'], rows: ["ABCC","DDCC","EFF.","GGH.","IIHJ"], min: 95 },
];

// The first moves of the optimal solution of Heng Dao Li Ma: [block index, column, row]. The title screen replays them.
export const HDLM_MOVES = [[6,1,4],[9,2,4],[5,3,3],[4,2,2],[3,1,2],[8,0,3],[6,0,4],[3,1,3],[4,0,2],[7,3,2],[9,2,2],[3,2,3],[8,1,4],[4,0,3],[9,0,2],[7,1,2],[3,2,2],[5,3,2],[8,3,4],[6,2,4],[4,0,4],[7,0,3],[3,1,2],[5,2,2],[2,3,2],[1,2,0]];
