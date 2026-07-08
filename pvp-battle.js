/* ============================================================
   pvp-battle.js — Minimal self-contained battle engine for PvP
   ตัด dependency ของ solo (map/relic/skill/ultimate) ออก
   เหลือแก่น: เด็ค + มือ + มานา + เล่นการ์ด + ศัตรู + เทิร์น
   ออกแบบให้ state อยู่ใน object เดียว (BATTLE) เพื่อ sync ง่าย
   ============================================================ */

/* ---------- Card database ---------- */
const PVP_CARDS = {
  // --- พื้นฐาน ---
  strike:   {id:'strike',  name:'Strike',     cost:1, type:'attack',  dmg:6,  rarity:'common', desc:'6 ดาเมจ'},
  heavy:    {id:'heavy',   name:'Heavy Blow', cost:2, type:'attack',  dmg:14, rarity:'common', desc:'14 ดาเมจ'},
  slash:    {id:'slash',   name:'Slash',      cost:1, type:'attack',  dmg:4, hits:2, rarity:'common', desc:'4 ดาเมจ ×2'},
  guard:    {id:'guard',   name:'Guard',      cost:1, type:'defense', block:6,  rarity:'common', desc:'+6 บล็อก'},
  ironwall: {id:'ironwall',name:'Iron Wall',  cost:2, type:'defense', block:14, rarity:'common', desc:'+14 บล็อก'},
  potion:   {id:'potion',  name:'Potion',     cost:1, type:'skill',   heal:8,  rarity:'common', desc:'ฟื้น 8 HP'},
  quickdraw:{id:'quickdraw',name:'Quick Draw',cost:1, type:'skill',   draw:2,  rarity:'common', desc:'หยิบ 2 ใบ'},
  fireball: {id:'fireball',name:'Fireball',   cost:2, type:'magic',   dmg:10, burn:3, rarity:'common', desc:'10 ดมจ + ไฟ 3'},
  daze:     {id:'daze',    name:'Daze 💫',    cost:1, type:'curse',   curse:true, desc:'คำสาป! เล่นไม่ได้ผล (เปลืองที่ในมือ)'},

  // --- กลุ่ม Combo/จั่ว (เด็คหมุนเร็ว) ---
  jab:      {id:'jab',     name:'Jab',        cost:0, type:'attack',  dmg:3,  rarity:'common', desc:'3 ดาเมจ (ฟรี)'},
  flurry:   {id:'flurry',  name:'Flurry',     cost:1, type:'attack',  dmg:2, hits:3, rarity:'uncommon', desc:'2 ดาเมจ ×3'},
  adrenaline:{id:'adrenaline',name:'Adrenaline',cost:0,type:'skill',  manaGain:2, draw:1, rarity:'uncommon', desc:'มานา+2 + จั่ว 1 (ฟรี)'},
  echo:     {id:'echo',    name:'Echo',       cost:1, type:'skill',   echo:true, rarity:'rare', desc:'การ์ดโจมตีใบถัดไปดีล 2 เท่า'},

  // --- กลุ่ม Block/หนาม (ตั้งรับสวนกลับ) ---
  thorns:   {id:'thorns',  name:'Thorns',     cost:1, type:'defense', block:5, thorns:3, rarity:'uncommon', desc:'+5 บล็อก + หนาม 3 (สะท้อนเมื่อโดนตี)'},
  bulwark:  {id:'bulwark', name:'Bulwark',    cost:2, type:'defense', block:10, keepBlock:true, rarity:'rare', desc:'+10 บล็อก + บล็อกไม่หายเทิร์นหน้า'},
  bash:     {id:'bash',    name:'Bash',       cost:2, type:'attack',  dmg:8, block:8, rarity:'uncommon', desc:'8 ดาเมจ + 8 บล็อก'},

  // --- กลุ่ม Burn/พิษ (ดาเมจต่อเนื่อง) ---
  poisondart:{id:'poisondart',name:'Poison Dart',cost:1,type:'magic', dmg:2, poison:4, rarity:'uncommon', desc:'2 ดมจ + พิษ 4'},
  ignite:   {id:'ignite',  name:'Ignite',     cost:2, type:'magic',   burn:8, rarity:'uncommon', desc:'ไฟ 8 (ดาเมจต่อเนื่อง)'},

  // --- กลุ่ม Lifesteal/ยืนระยะ ---
  vampire:  {id:'vampire', name:'Vampire Strike',cost:2,type:'attack', dmg:8, lifesteal:true, rarity:'rare', desc:'8 ดาเมจ + ฟื้นเท่าดาเมจที่ดีล'},
  drain:    {id:'drain',   name:'Life Drain', cost:1, type:'magic',   dmg:5, lifesteal:true, rarity:'uncommon', desc:'5 ดมจ + ฟื้นเท่าที่ดีล'},

  // --- กลุ่ม High-risk ---
  allin:    {id:'allin',   name:'All In',     cost:2, type:'attack',  dmg:22, selfDmg:6, rarity:'rare', desc:'22 ดาเมจ — แต่เสีย 6 HP'},
  reckless: {id:'reckless',name:'Reckless',   cost:1, type:'attack',  dmg:10, discardRandom:1, rarity:'uncommon', desc:'10 ดาเมจ — ทิ้งการ์ดสุ่ม 1 ใบ'},

  // --- กลุ่มกลไกพิเศษ (scaling/combo/เสี่ยงดวง/build-around) ---
  grudge:   {id:'grudge',  name:'ดาบสะสมแค้น', cost:1, type:'attack', dmg:4, grudge:2, rarity:'uncommon', desc:'4 ดมจ — แรงขึ้นถาวร +2 ทุกครั้งที่เล่น (ศึกนี้)'},
  finisher: {id:'finisher',name:'ท่าไม้ตาย',   cost:1, type:'attack', comboDmg:3, rarity:'uncommon', desc:'3 ดมจ × จำนวนการ์ดที่เล่นเทิร์นนี้ (รวมใบนี้)'},
  snakefang:{id:'snakefang',name:'เขี้ยวอสรพิษ',cost:1, type:'attack', dmg:7, freeIfPoison:true, rarity:'uncommon', desc:'7 ดมจ — ฟรี ถ้าศัตรูติดพิษ'},
  coinflip: {id:'coinflip',name:'เหรียญเสี่ยงทาย',cost:1,type:'attack', dmg:25, gamble:true, rarity:'rare', desc:'หัวก้อย 50/50 — ดีล 25 หรือพลาดเปล่า!'},
  execute:  {id:'execute', name:'ประหาร',      cost:2, type:'attack', dmg:8, execute:0.3, rarity:'rare', desc:'8 ดมจ — ศัตรูเลือด ≤30% ตายทันที (เว้นบอส)'},
  venomburst:{id:'venomburst',name:'พิษระเบิด', cost:2, type:'magic', detonate:2, rarity:'rare', desc:'จุดระเบิดพิษทั้งหมด ดีล ×2 ทันที'},
  timebomb: {id:'timebomb',name:'ระเบิดเวลา',  cost:1, type:'magic', bomb:14, bombTurns:2, rarity:'uncommon', desc:'ครบ 2 เทิร์น ระเบิด 14 ดมจ (+INT)'},

  // --- Legendary (หายาก เปลี่ยนเกม) ---
  dragonheart:{id:'dragonheart',name:'หัวใจมังกร',cost:0,type:'skill', manaMax:1, draw:1, rarity:'legendary', desc:'มานาสูงสุด +1 ทั้งศึก + จั่ว 1'},
  thornking:{id:'thornking',name:'ราชันย์หนาม', cost:2, type:'defense', block:8, thorns:6, thornsPersist:true, rarity:'legendary', desc:'+8 บล็อก + หนาม 6 คงอยู่ทั้งศึก'},
};

const CARD_RARITY={common:1,uncommon:2,rare:3,legendary:4};

// ไอคอนการ์ด (game-icons.net — CC BY 3.0, ดูเครดิตใน assets/CREDITS.txt) — ไฟล์ตั้งชื่อตาม card id
Object.keys(PVP_CARDS).forEach(id=>{ PVP_CARDS[id].ico='assets/cards/'+id+'.svg'; });

/* ---------- Enemy templates (ปรับยากขึ้น) ---------- */
// สไปรต์จาก Dungeon Crawl Stone Soup tiles (CC0) — spr(emoji) เป็น fallback ถ้ารูปโหลดไม่ขึ้น
const PVP_ENEMIES = [
  {name:'Slime',    spr:'🟢', img:'assets/enemies/slime.png',    hp:38, atk:8,  pat:['atk','atk','def']},
  {name:'Bat',      spr:'🦇', img:'assets/enemies/bat.png',      hp:30, atk:11, pat:['atk','atk','atk']},
  {name:'Golem',    spr:'🗿', img:'assets/enemies/golem.png',    hp:58, atk:8,  pat:['def','atk','atk'], armor:4, desc:'เกราะหนา (ลดดาเมจ)'},
  {name:'Wraith',   spr:'👻', img:'assets/enemies/wraith.png',   hp:44, atk:10, pat:['atk','def','atk']},
  {name:'Troll',    spr:'🧌', img:'assets/enemies/troll.png',    hp:54, atk:9,  pat:['atk','atk','heal'], regen:7, desc:'ฟื้นเลือดตัวเอง'},
  {name:'Cactus',   spr:'🌵', img:'assets/enemies/cactus.png',   hp:46, atk:7,  pat:['def','atk','def'], thorns:5, desc:'หนาม (ตีโดนเจ็บเอง)'},
  {name:'Assassin', spr:'🥷', img:'assets/enemies/assassin.png', hp:28, atk:16, pat:['atk','atk','atk'], desc:'ตีแรงมาก HP น้อย'},
  {name:'Mimic',    spr:'🎁', img:'assets/enemies/mimic.png',    hp:48, atk:10, pat:['def','atk','rage'], desc:'ยิ่งโดนตียิ่งโกรธ'},
  {name:'Shaman',   spr:'🧙', img:'assets/enemies/shaman.png',   hp:42, atk:9,  pat:['heal','atk','def'], regen:6, desc:'หมอผีฟื้นเลือด'},
];
// บอสชั้น 21
const PVP_BOSS = {name:'Tower Lord',spr:'👹', img:'assets/enemies/boss.png', hp:150, atk:13, pat:['atk','def','rage','atk'], armor:3, desc:'เจ้าหอคอย — บอสสุดท้าย'};

// ศัตรูแบ่ง tier ตามช่วงชั้น — ตัวโหด (Assassin) ไม่โผล่ชั้นต้น + ไล่ระดับความยาก
// index อ้างอิงลำดับใน PVP_ENEMIES
const PVP_ENEMY_TIERS = {
  early:[0,1,5],     // ชั้น 1-7:  Slime, Bat, Cactus
  mid:  [2,3,4,8],   // ชั้น 8-14: Golem, Wraith, Troll, Shaman
  late: [6,7,2,4],   // ชั้น 15-20: Assassin, Mimic, Golem, Troll
};
// เลือกศัตรูประจำชั้น — deterministic จาก seed+floor (mirror ทุกเครื่อง) + ไม่ซ้ำกับชั้นก่อนหน้า
function pvpEnemyForFloor(seed, floor){
  const pool = floor<=7 ? PVP_ENEMY_TIERS.early : floor<=14 ? PVP_ENEMY_TIERS.mid : PVP_ENEMY_TIERS.late;
  const rng = mulberryFrom((seed||1)*769 + floor*613);
  let idx = Math.floor(rng()*pool.length);
  if(floor>1){
    const prev = pvpEnemyForFloor(seed, floor-1);
    if(PVP_ENEMIES[pool[idx]]===prev) idx=(idx+1)%pool.length;
  }
  return PVP_ENEMIES[pool[idx]];
}

/* ---------- Stat allocation system (10 แต้ม กระจาย 6 stat) ---------- */
const PVP_STATS = {
  atk:  {id:'atk',  name:'⚔️ ATK',  per:'การ์ดโจมตีกาย +1 ดาเมจ/แต้ม',         max:10},
  hp:   {id:'hp',   name:'❤️ HP',   per:'เลือดสูงสุด +6/แต้ม',                  max:10},
  def:  {id:'def',  name:'🛡️ DEF',  per:'เริ่มเทิร์นมีบล็อก +1/แต้ม',           max:10},
  int:  {id:'int',  name:'🔮 INT',  per:'เวท/ไฟ/พิษ +1/แต้ม',                   max:10},
  spd:  {id:'spd',  name:'💨 SPD',  per:'จั่วเพิ่ม +1 ใบทุกเทิร์น ทุก 3 แต้ม (สูงสุด +2)', max:6},
  mana: {id:'mana', name:'💎 MANA', per:'มานาสูงสุด +1 ทุก 3 แต้ม (สูงสุด +2)',  max:6},
};
const PVP_STAT_IDS = Object.keys(PVP_STATS);
const STAT_POINTS_TOTAL = 10;

/* ---------- Draft: card pool for packs (เน้นการ์ดใหม่ที่มีกลไก) ---------- */
const PVP_PACK_POOL = [
  // การ์ดใหม่ออกบ่อย (สร้าง build)
  'jab','flurry','adrenaline','echo',
  'thorns','bulwark','bash',
  'poisondart','ignite',
  'vampire','drain',
  'allin','reckless',
  // การ์ดพื้นบางส่วน (ยังเจอได้)
  'heavy','ironwall','fireball','quickdraw',
];

/* ---------- Apply stat allocation to a battle ---------- */
/* หมายเหตุ: HP ไม่ apply ที่นี่ — ตั้งที่ ME.maxHp ครั้งเดียวตอนจบ draft
   (กัน HP สะสมทุก battle) ส่วน atk/int/def/spd/mana apply ต่อ battle ได้ปกติ */
function applyLoadout(B, loadout){
  if(!loadout)return;
  const s=loadout.stats||{};
  // ATK — โบนัสการ์ดโจมตีกาย
  B.atkBonus=(B.atkBonus||0)+(s.atk||0);
  // INT — โบนัสเวท/ไฟ/พิษ
  B.intBonus=(B.intBonus||0)+(s.int||0);
  // DEF — เริ่มเทิร์นมีบล็อก +1/แต้ม
  B.startBlock=(B.startBlock||0)+(s.def||0);
  // SPD — จั่วเพิ่ม +1 ใบทุกเทิร์น ทุก 3 แต้ม (สูงสุด +2)
  B._extraDraw=(B._extraDraw||0)+Math.min(2,Math.floor((s.spd||0)/3));
  // MANA — +1 ทุก 3 แต้ม เพดาน +2
  B.maxMana=(B.maxMana||3)+Math.min(2,Math.floor((s.mana||0)/3));
}
// คำนวณ HP สูงสุดจากแต้ม (ใช้ตอนจบ draft) — ฐาน 100 + 6/แต้ม
function maxHpFromStats(stats){ return 100 + (stats&&stats.hp?stats.hp*6:0); }

/* ---------- Starter deck ---------- */
function pvpStarterDeck(){
  const d=[];
  for(let i=0;i<4;i++)d.push('strike');
  for(let i=0;i<3;i++)d.push('guard');
  d.push('slash','heavy','potion','fireball','quickdraw');
  return d;
}

/* ---------- Battle state factory ---------- */
function createBattle(seed, floor, customDeck, sabotage){
  // deterministic enemy pick from shared seed + floor (mirror!)
  const rng = mulberryFrom((seed||1) * 131 + floor * 977);
  // ชั้น 21 = บอสสุดท้าย, ชั้นอื่นสุ่มจาก seed
  const isBoss = floor>=21;
  const tmpl = isBoss ? PVP_BOSS : pvpEnemyForFloor(seed, floor);   // tier ตามชั้น + ไม่ซ้ำชั้นก่อนหน้า
  // scale enemy by floor (บอสไม่สเกลซ้ำ เพราะ HP ฐานสูงอยู่แล้ว)
  let hpScale = isBoss ? 1 : (1 + floor * 0.10);
  // SABOTAGE: น้ำยาคลุ้มคลั่ง — enemy HP +20%
  if(sabotage && sabotage.enemyHpBoost) hpScale *= (1 + sabotage.enemyHpBoost);
  const enemy = {
    name: tmpl.name, spr: tmpl.spr, img: tmpl.img||null,
    hp: Math.round(tmpl.hp * hpScale), maxHp: Math.round(tmpl.hp * hpScale),
    atk: tmpl.atk + Math.floor(floor*0.4), pat: tmpl.pat, patIdx: 0,   // สเกล atk นุ่มลง (เดิม /2 ชั้นท้ายโหดเกิน)
    block: 0, burn: 0,
    // gimmicks
    armor: tmpl.armor||0,      // ลดดาเมจที่รับทุกครั้ง
    regen: tmpl.regen||0,      // ฟื้นเลือดตอน 'heal'
    thorns: tmpl.thorns||0,    // สะท้อนดาเมจเมื่อโดนตี
    isBoss,
  };
  let baseDeck = (customDeck && customDeck.length) ? customDeck.slice() : pvpStarterDeck();
  // SABOTAGE: โซ่ตรวน — เพิ่มการ์ดคำสาป Daze
  if(sabotage && sabotage.curseCards){
    for(let i=0;i<sabotage.curseCards;i++) baseDeck.push('daze');
  }
  const deck = shuffleSeeded(baseDeck, rng);
  return {
    floor, enemy,
    maxMana: 3, mana: 3,
    php: null, pmaxHp: null,
    block: 0, burn: 0,
    atkBonus: 0, startBlock: 0,
    deck, hand: [], disc: [],
    turn: 1, over: false, won: false,
    // sabotage flags
    _noBlock: !!(sabotage && sabotage.noBlock),   // เล่นการ์ดบล็อกไม่ได้
    _weaken: !!(sabotage && sabotage.weaken),     // ตีเบาลง + โดนแรงขึ้น
    _rng: rng,
  };
}

/* ---------- Seeded RNG helpers ---------- */
function mulberryFrom(seedInt){
  let s = seedInt | 0;
  return function(){
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffleSeeded(arr, rng){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(rng() * (i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

/* ---------- Core battle actions (mutate B) ---------- */
function B_drawCard(B, n){
  for(let i=0;i<n;i++){
    if(B.deck.length===0){
      if(B.disc.length===0) break;
      B.deck = shuffleSeeded(B.disc, B._rng);
      B.disc = [];
    }
    B.hand.push(B.deck.shift());
  }
}
function B_startTurn(B){
  B.mana = B.maxMana;
  if(!B._thornsPersist) B.thorns = 0;   // หนามหมดอายุทุกเทิร์น (เว้นราชันย์หนาม)
  B._playedThisTurn = 0;                // นับการ์ดที่เล่นเทิร์นนี้ (ท่าไม้ตาย)
  const sb = B._noBlock ? 0 : (B.startBlock||0);   // SABOTAGE: ห้ามบล็อก = ไม่มี startBlock
  // bulwark: บล็อกค้างข้ามเทิร์น
  if(B._keepBlock && !B._noBlock){ B.block = (B.block||0) + sb; B._keepBlock=false; }
  else B.block = sb;
  const n = 5 + (B._extraDraw||0);      // SPD: จั่วเพิ่มทุกเทิร์น
  B_drawCard(B, n);
}
// ค่าร่ายจริง (การ์ดบางใบมีเงื่อนไขลดค่าร่าย เช่น เขี้ยวอสรพิษฟรีถ้าศัตรูติดพิษ)
function B_cardCost(B, card){
  if(card.freeIfPoison && (B.enemy.poison||0) > 0) return 0;
  return card.cost;
}
function B_playCard(B, handIdx){
  const cid = B.hand[handIdx];
  const card = PVP_CARDS[cid];
  if(!card) return {ok:false};
  // curse card: เล่นได้แต่ไม่มีผล (เปลืองที่/มานา)
  if(card.curse){
    B.hand.splice(handIdx, 1);
    B.disc.push(cid);
    return {ok:true, log:['💫 คำสาป! ไม่มีผล'], cid};
  }
  const cost = B_cardCost(B, card);
  if(cost > B.mana) return {ok:false, reason:'mana'};
  B.mana -= cost;
  B.hand.splice(handIdx, 1);
  B.disc.push(cid);
  B._playedThisTurn = (B._playedThisTurn||0) + 1;

  const log = [];
  // echo: การ์ดโจมตีใบถัดไปดีล 2 เท่า
  if(card.echo){ B._echo = true; log.push('🔊 Echo! ใบโจมตีถัดไป ×2'); }

  // damage (รองรับกลไก combo / scaling / เสี่ยงดวง)
  let atkDmg = card.dmg || 0;
  if(card.comboDmg) atkDmg = card.comboDmg * (B._playedThisTurn||1);   // ท่าไม้ตาย: × การ์ดที่เล่นเทิร์นนี้
  if(card.grudge){                                                     // ดาบสะสมแค้น: แรงขึ้นถาวรในศึกนี้
    atkDmg += (B._grudge||0);
    B._grudge = (B._grudge||0) + card.grudge;
  }
  if(card.gamble){                                                     // เหรียญเสี่ยงทาย 50/50
    if(B._rng() < 0.5){ atkDmg = 0; log.push('🪙 ออกก้อย — พลาด!'); }
    else log.push('🪙 ออกหัว!');
  }
  if(atkDmg > 0){
    const hits = card.hits || 1;
    let bonus = 0;
    if(card.type==='attack') bonus = (B.atkBonus||0);   // ATK stat
    else if(card.type==='magic') bonus = (B.intBonus||0); // INT stat
    if(B._weaken) bonus -= 3;                            // SABOTAGE: อ่อนแอ ตีเบาลง -3
    let mult = 1;
    if(B._echo && (card.type==='attack'||card.type==='magic')){ mult = 2; B._echo = false; log.push('🔊 ×2!'); }
    let dealtTotal = 0;
    for(let h=0; h<hits; h++) dealtTotal += B_dealToEnemy(B, Math.max(1,(atkDmg + bonus))*mult, log);
    // lifesteal: ฟื้นเท่าดาเมจที่ดีลจริง
    if(card.lifesteal && B.php!=null){
      B.php = Math.min(B.pmaxHp, B.php + dealtTotal);
      log.push(`🩸 ฟื้น ${dealtTotal}`);
    }
  }
  // ประหาร: เลือดต่ำพอ = ตายทันที (บอสไม่โดน)
  if(card.execute && !B.enemy.isBoss && B.enemy.hp > 0 && B.enemy.hp <= B.enemy.maxHp * card.execute){
    B.enemy.hp = 0;
    log.push('⚰️ ประหาร!');
  }
  // พิษระเบิด: เผาพิษทั้งหมดเป็นดาเมจทันที
  if(card.detonate){
    const p = B.enemy.poison || 0;
    if(p > 0){
      B.enemy.poison = 0;
      B_dealToEnemy(B, p * card.detonate + (B.intBonus||0), log);
      log.push('☠️💥 พิษระเบิด!');
    } else log.push('ไม่มีพิษให้จุดระเบิด');
  }
  // ระเบิดเวลา: ครบกำหนดค่อยระเบิด (ข้ามบล็อก/เกราะ)
  if(card.bomb){
    if(!B.enemy._bombs) B.enemy._bombs = [];
    const bd = card.bomb + (B.intBonus||0);
    B.enemy._bombs.push({turns: card.bombTurns||2, dmg: bd});
    log.push(`💣 ตั้งระเบิด ${bd} (${card.bombTurns||2} เทิร์น)`);
  }
  // หัวใจมังกร: มานาสูงสุดเพิ่มทั้งศึก
  if(card.manaMax){ B.maxMana += card.manaMax; B.mana += card.manaMax; log.push(`💎 มานาสูงสุด +${card.manaMax}!`); }
  // ราชันย์หนาม: หนามไม่หมดอายุ
  if(card.thornsPersist){ B._thornsPersist = true; }
  if(card.block){
    if(B._noBlock){ log.push('🔓 โล่ถูกทำลาย! บล็อกไม่ติด'); }   // SABOTAGE: ห้ามบล็อก
    else { B.block += card.block; log.push(`+${card.block} บล็อก`); }
  }
  if(card.thorns){ B.thorns = (B.thorns||0) + card.thorns; log.push(`🌵 หนาม ${card.thorns}`); }
  if(card.keepBlock){ B._keepBlock = true; }
  if(card.heal){ B.php = Math.min(B.pmaxHp, B.php + card.heal); log.push(`ฟื้น ${card.heal}`); }
  if(card.manaGain){ B.mana += card.manaGain; log.push(`มานา +${card.manaGain}`); }
  if(card.draw){ B_drawCard(B, card.draw); log.push(`หยิบ ${card.draw}`); }
  if(card.burn){ B.enemy.burn = (B.enemy.burn||0) + card.burn + (B.intBonus||0); log.push(`ไฟ ${card.burn+(B.intBonus||0)}`); }
  if(card.poison){ B.enemy.poison = (B.enemy.poison||0) + card.poison + (B.intBonus||0); log.push(`☠️ พิษ ${card.poison+(B.intBonus||0)}`); }
  if(card.selfDmg && B.php!=null){ B.php = Math.max(0, B.php - card.selfDmg); log.push(`💥 เสีย ${card.selfDmg} HP`); if(B.php<=0){B.over=true;B.won=false;} }
  if(card.discardRandom && B.hand.length>0){
    for(let i=0;i<card.discardRandom && B.hand.length>0;i++){
      const idx=Math.floor(B._rng()*B.hand.length);
      B.disc.push(B.hand.splice(idx,1)[0]);
    }
    log.push(`ทิ้งการ์ดสุ่ม`);
  }

  // enemy dead? (ถ้าผู้เล่นตายเองในจังหวะเดียวกัน เช่น All In ห้ามพลิกเป็นชนะ)
  if(B.enemy.hp <= 0 && !(B.php!=null && B.php<=0)){ B.over = true; B.won = true; }
  return {ok:true, log, cid};
}
function B_dealToEnemy(B, amt, log){
  let dmg = amt;
  // enemy armor ลดดาเมจ
  if(B.enemy.armor) dmg = Math.max(1, dmg - B.enemy.armor);
  if(B.enemy.block > 0){
    const absorbed = Math.min(B.enemy.block, dmg);
    B.enemy.block -= absorbed; dmg -= absorbed;
  }
  const before = B.enemy.hp;
  B.enemy.hp = Math.max(0, B.enemy.hp - dmg);
  const dealt = before - B.enemy.hp;
  // mimic/boss rage: ยิ่งโดนตียิ่งโกรธ (เพิ่ม atk)
  if(B.enemy.pat.includes('rage')) B.enemy._dmgTaken = (B.enemy._dmgTaken||0) + dealt;
  if(log) log.push(`ดีล ${dealt}`);   // แสดงดาเมจจริงหลังหักเกราะ/บล็อก
  return dealt;   // คืนดาเมจจริงที่เข้า (สำหรับ lifesteal)
}
// เฟส 1 ของการจบเทิร์น: ทิ้งมือ + ดาเมจต่อเนื่อง (ไฟ/พิษ/ระเบิดเวลา)
// แยกออกมาให้ UI เว้นจังหวะระหว่างเฟสได้
function B_endTurnTicks(B){
  // discard hand
  B.disc = B.disc.concat(B.hand);
  B.hand = [];
  // enemy burn tick
  if(B.enemy.burn > 0){
    B.enemy.hp = Math.max(0, B.enemy.hp - B.enemy.burn);
    B.enemy.burn = Math.max(0, B.enemy.burn - 1);
    if(B.enemy.hp <= 0){ B.over = true; B.won = true; return; }
  }
  // enemy poison tick (พิษไม่ลดลง — ดีลคงที่จนหมดเอง? ที่นี่ลดทีละ 1)
  if(B.enemy.poison > 0){
    B.enemy.hp = Math.max(0, B.enemy.hp - B.enemy.poison);
    B.enemy.poison = Math.max(0, B.enemy.poison - 1);
    if(B.enemy.hp <= 0){ B.over = true; B.won = true; return; }
  }
  // time bomb tick — ครบกำหนดระเบิดใส่ HP ตรงๆ (ข้ามบล็อก/เกราะ)
  if(B.enemy._bombs && B.enemy._bombs.length){
    const keep = [];
    for(const bm of B.enemy._bombs){
      bm.turns--;
      if(bm.turns <= 0) B.enemy.hp = Math.max(0, B.enemy.hp - bm.dmg);
      else keep.push(bm);
    }
    B.enemy._bombs = keep;
    if(B.enemy.hp <= 0){ B.over = true; B.won = true; return; }
  }
}
// เฟส 2+3 รวม: ศัตรูออกท่า + ขึ้นเทิร์นใหม่ (ตัว wrapper เดิม — ใช้ในเทสต์/โหมดไม่มี animation)
function B_endTurn(B){
  B_endTurnTicks(B);
  if(B.over) return {enemyActions:[]};
  const actions = B_enemyAct(B);
  B.turn++;
  if(!B.over) B_startTurn(B);
  return {enemyActions: actions};
}
function B_enemyAct(B){
  const e = B.enemy;
  e.block = 0;
  const move = e.pat[e.patIdx % e.pat.length];
  e.patIdx++;
  const actions = [];
  if(move === 'atk' || move === 'rage'){
    let dmg = e.atk;
    // rage: ยิ่งโดนตีมา ยิ่งแรง
    if(move === 'rage') dmg += Math.floor((e._dmgTaken||0) / 8);
    if(B._weaken) dmg = Math.round(dmg * 1.5);   // SABOTAGE: อ่อนแอ โดนแรงขึ้น 50%
    if(B.block > 0){
      const absorbed = Math.min(B.block, dmg);
      B.block -= absorbed; dmg -= absorbed;
    }
    B.php = Math.max(0, B.php - dmg);
    actions.push({type:'atk', dmg});
    // player thorns: สะท้อนดาเมจกลับ
    if(B.thorns > 0){
      e.hp = Math.max(0, e.hp - B.thorns);
      actions.push({type:'thorns', dmg:B.thorns});
      if(e.hp<=0){ B.over=true; B.won=true; }
    }
    if(B.php <= 0){ B.over = true; B.won = false; }
  } else if(move === 'def'){
    e.block += 8;
    actions.push({type:'def', block:8});
  } else if(move === 'heal'){
    const amt = e.regen || 4;
    e.hp = Math.min(e.maxHp, e.hp + amt);
    actions.push({type:'heal', amt});
  }
  return actions;
}
function B_enemyIntent(B){
  const e = B.enemy;
  const move = e.pat[e.patIdx % e.pat.length];
  if(move === 'atk') return {icon:'⚔️', txt:`โจมตี ${e.atk}`};
  if(move === 'rage'){ const bonus=Math.floor((e._dmgTaken||0)/8); return {icon:'😡', txt:`โกรธ! โจมตี ${e.atk+bonus}`}; }
  if(move === 'def') return {icon:'🛡️', txt:`ตั้งรับ +8`};
  if(move === 'heal') return {icon:'💚', txt:`ฟื้น ${e.regen||4}`};
  return {icon:'❓', txt:'?'};
}
