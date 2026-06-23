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
};

const CARD_RARITY={common:1,uncommon:2,rare:3};

/* ---------- Enemy templates (ปรับยากขึ้น) ---------- */
const PVP_ENEMIES = [
  {name:'Slime',    spr:'🟢', hp:38, atk:8,  pat:['atk','atk','def']},
  {name:'Bat',      spr:'🦇', hp:30, atk:11, pat:['atk','atk','atk']},
  {name:'Golem',    spr:'🗿', hp:58, atk:8,  pat:['def','atk','atk'], armor:4, desc:'เกราะหนา (ลดดาเมจ)'},
  {name:'Wraith',   spr:'👻', hp:44, atk:10, pat:['atk','def','atk']},
  {name:'Troll',    spr:'🧌', hp:54, atk:9,  pat:['atk','atk','heal'], regen:7, desc:'ฟื้นเลือดตัวเอง'},
  {name:'Cactus',   spr:'🌵', hp:46, atk:7,  pat:['def','atk','def'], thorns:5, desc:'หนาม (ตีโดนเจ็บเอง)'},
  {name:'Assassin', spr:'🥷', hp:28, atk:16, pat:['atk','atk','atk'], desc:'ตีแรงมาก HP น้อย'},
  {name:'Mimic',    spr:'🎁', hp:48, atk:10, pat:['def','atk','rage'], desc:'ยิ่งโดนตียิ่งโกรธ'},
  {name:'Shaman',   spr:'🧙', hp:42, atk:9,  pat:['heal','atk','def'], regen:6, desc:'หมอผีฟื้นเลือด'},
];
// บอสชั้น 21
const PVP_BOSS = {name:'Tower Lord',spr:'👹', hp:150, atk:13, pat:['atk','def','rage','atk'], armor:3, desc:'เจ้าหอคอย — บอสสุดท้าย'};

/* ---------- Stat allocation system (10 แต้ม กระจาย 6 stat) ---------- */
const PVP_STATS = {
  atk:  {id:'atk',  name:'⚔️ ATK',  per:'การ์ดโจมตีกาย +1 ดาเมจ/แต้ม',         max:10},
  hp:   {id:'hp',   name:'❤️ HP',   per:'เลือดสูงสุด +6/แต้ม',                  max:10},
  def:  {id:'def',  name:'🛡️ DEF',  per:'ลดดาเมจที่โดน 3%/แต้ม (สูงสุด 30%)',     max:10},
  int:  {id:'int',  name:'🔮 INT',  per:'เวท/ไฟ/พิษ +1/แต้ม',                   max:10},
  spd:  {id:'spd',  name:'💨 SPD',  per:'จั่วเพิ่มเทิร์นแรก +1 ใบ ทุก 2 แต้ม',  max:10},
  mana: {id:'mana', name:'💎 MANA', per:'มานาสูงสุด +1 ทุก 4 แต้ม (เพดาน +2)',  max:8},
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
  // DEF — ลดดาเมจที่เข้าตัวเป็น % (3%/แต้ม เพดาน 30%) — สเกลกับดาเมจศัตรู ไม่ตันค่าตายตัว
  B._defReduce=Math.min(0.30, (s.def||0)*0.03);
  // SPD — จั่วเพิ่มเทิร์นแรก +1 ใบ ทุก 2 แต้ม
  B._wealthDraw=(B._wealthDraw||0)+Math.floor((s.spd||0)/2);
  // MANA — +1 ทุก 4 แต้ม เพดาน +2
  B.maxMana=(B.maxMana||3)+Math.min(2,Math.floor((s.mana||0)/4));
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
/* ---------- Dynamic Floor Modifiers (กฎพิเศษประจำชั้น — mirror ทุกคน) ---------- */
const FLOOR_MODIFIERS = {
  4:  {id:'firefloor', ic:'🔥', name:'พื้นที่ไฟลุก',  desc:'ผู้เล่นและศัตรูเริ่มเทิร์นด้วยไฟติด 2'},
  9:  {id:'manadense', ic:'💎', name:'มานาหนาแน่น',  desc:'มานาสูงสุด +1 ทั้งด่าน — เล่นการ์ดได้รัวขึ้น'},
  14: {id:'noheal',    ic:'🚫', name:'ห้ามรักษากาย',  desc:'งดผลฮีลและดูดเลือด 100% — ต้องใช้โล่รับ'},
  17: {id:'doubledmg', ic:'⚡', name:'พลังทวีคูณ',    desc:'ดาเมจที่ดีลใส่ศัตรู ×1.5 (แต่ระวังศัตรูแรงด้วย)'},
};
function floorModifier(floor){ return FLOOR_MODIFIERS[floor] || null; }

function createBattle(seed, floor, customDeck, sabotage){
  // deterministic enemy pick from shared seed + floor (mirror!)
  const rng = mulberryFrom((seed||1) * 131 + floor * 977);
  // ชั้น 21 = บอสสุดท้าย, ชั้นอื่นสุ่มจาก seed
  const isBoss = floor>=21;
  const tmpl = isBoss ? PVP_BOSS : PVP_ENEMIES[Math.floor(rng() * PVP_ENEMIES.length)];
  // scale enemy by floor (บอสไม่สเกลซ้ำ เพราะ HP ฐานสูงอยู่แล้ว)
  let hpScale = isBoss ? 1 : (1 + floor * 0.10);
  // SABOTAGE: น้ำยาคลุ้มคลั่ง — enemy HP +20%
  if(sabotage && sabotage.enemyHpBoost) hpScale *= (1 + sabotage.enemyHpBoost);
  const enemy = {
    name: tmpl.name, spr: tmpl.spr,
    hp: Math.round(tmpl.hp * hpScale), maxHp: Math.round(tmpl.hp * hpScale),
    atk: tmpl.atk + Math.floor(floor/2), pat: tmpl.pat, patIdx: 0,
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
  // SABOTAGE: เผาการ์ด — สุ่มลบการ์ดบนกองจั่ว 1 ใบ
  if(sabotage && sabotage.cardBurn && deck.length>0){
    deck.shift();   // ลบใบบนสุด (กองสับแล้ว = สุ่มอยู่แล้ว)
  }
  const mod = floorModifier(floor);
  const B = {
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
    _blind: !!(sabotage && sabotage.blind),       // มองไม่เห็นท่าศัตรู 2 เทิร์นแรก
    // floor modifier
    _mod: mod ? mod.id : null,
    _rng: rng,
  };
  // มานาหนาแน่น (ชั้น 9): มานาสูงสุด +1
  if(B._mod==='manadense'){ B.maxMana=4; B.mana=4; }
  return B;
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
  B.thorns = 0;   // หนามหมดอายุทุกเทิร์น
  const sb = B._noBlock ? 0 : (B.startBlock||0);   // SABOTAGE: ห้ามบล็อก = ไม่มี startBlock
  // bulwark: บล็อกค้างข้ามเทิร์น
  if(B._keepBlock && !B._noBlock){ B.block = (B.block||0) + sb; B._keepBlock=false; }
  else B.block = sb;
  let n = 5;
  if(B._wealthDraw && B.turn===1) n += B._wealthDraw;
  B_drawCard(B, n);
  // === Floor modifiers (เทิร์นแรก) ===
  if(B.turn===1){
    // 🔥 ไฟลุก — ผู้เล่นและศัตรูติดไฟ 2
    if(B._mod==='firefloor'){
      B._playerBurn=(B._playerBurn||0)+2;
      B.enemy.burn=(B.enemy.burn||0)+2;
    }
  }
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
  if(card.cost > B.mana) return {ok:false, reason:'mana'};
  B.mana -= card.cost;
  B.hand.splice(handIdx, 1);
  B.disc.push(cid);

  const log = [];
  // echo: การ์ดโจมตีใบถัดไปดีล 2 เท่า
  if(card.echo){ B._echo = true; log.push('🔊 Echo! ใบโจมตีถัดไป ×2'); }

  // damage
  if(card.dmg){
    const hits = card.hits || 1;
    let bonus = 0;
    if(card.type==='attack') bonus = (B.atkBonus||0);   // ATK stat
    else if(card.type==='magic') bonus = (B.intBonus||0); // INT stat
    if(B._weaken) bonus -= 3;                            // SABOTAGE: อ่อนแอ ตีเบาลง -3
    let mult = 1;
    if(B._echo && (card.type==='attack'||card.type==='magic')){ mult = 2; B._echo = false; log.push('🔊 ×2!'); }
    if(B._mod==='doubledmg') mult *= 1.5;               // ⚡ พลังทวีคูณ
    let dealtTotal = 0;
    for(let h=0; h<hits; h++) dealtTotal += B_dealToEnemy(B, Math.max(1,Math.round((card.dmg + bonus)*mult)), log);
    // lifesteal: ฟื้นเท่าดาเมจที่ดีลจริง (ห้ามฮีล = ไม่ฟื้น)
    if(card.lifesteal && B.php!=null && B._mod!=='noheal'){
      B.php = Math.min(B.pmaxHp, B.php + dealtTotal);
      log.push(`🩸 ฟื้น ${dealtTotal}`);
    } else if(card.lifesteal && B._mod==='noheal'){
      log.push('🚫 ห้ามรักษา! ดูดเลือดไม่ติด');
    }
  }
  if(card.block){
    if(B._noBlock){ log.push('🔓 โล่ถูกทำลาย! บล็อกไม่ติด'); }   // SABOTAGE: ห้ามบล็อก
    else { B.block += card.block; log.push(`+${card.block} บล็อก`); }
  }
  if(card.thorns){ B.thorns = (B.thorns||0) + card.thorns; log.push(`🌵 หนาม ${card.thorns}`); }
  if(card.keepBlock){ B._keepBlock = true; }
  if(card.heal){
    if(B._mod==='noheal'){ log.push('🚫 ห้ามรักษา! ฮีลไม่ติด'); }
    else { B.php = Math.min(B.pmaxHp, B.php + card.heal); log.push(`ฟื้น ${card.heal}`); }
  }
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

  // enemy dead?
  if(B.enemy.hp <= 0){ B.over = true; B.won = true; }
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
  // mimic/boss rage: ยิ่งโดนตียิ่งโกรธ (เพิ่ม atk)
  if(B.enemy.pat.includes('rage')) B.enemy._dmgTaken = (B.enemy._dmgTaken||0) + (before - B.enemy.hp);
  if(log) log.push(`ดีล ${amt}`);
  return before - B.enemy.hp;   // คืนดาเมจจริงที่เข้า (สำหรับ lifesteal)
}
function B_endTurn(B){
  // discard hand
  B.disc = B.disc.concat(B.hand);
  B.hand = [];
  // 🔥 ไฟลุก — ผู้เล่นโดนไฟกัดตอนจบเทิร์น
  if(B._playerBurn > 0 && B.php!=null){
    B.php = Math.max(0, B.php - B._playerBurn);
    B._playerBurn = Math.max(0, B._playerBurn - 1);
    if(B.php <= 0){ B.over = true; B.won = false; return {enemyActions:[{type:'burn',dmg:1}]}; }
  }
  // enemy burn tick
  if(B.enemy.burn > 0){
    B.enemy.hp = Math.max(0, B.enemy.hp - B.enemy.burn);
    B.enemy.burn = Math.max(0, B.enemy.burn - 1);
    if(B.enemy.hp <= 0){ B.over = true; B.won = true; return {enemyActions:[]}; }
  }
  // enemy poison tick (พิษไม่ลดลง — ดีลคงที่จนหมดเอง? ที่นี่ลดทีละ 1)
  if(B.enemy.poison > 0){
    B.enemy.hp = Math.max(0, B.enemy.hp - B.enemy.poison);
    B.enemy.poison = Math.max(0, B.enemy.poison - 1);
    if(B.enemy.hp <= 0){ B.over = true; B.won = true; return {enemyActions:[]}; }
  }
  // enemy acts
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
    // DEF stat: ลดดาเมจเป็น % (สเกลกับดาเมจ ไม่ตัน)
    if(B._defReduce>0) dmg = Math.max(1, Math.round(dmg * (1 - B._defReduce)));
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
