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

/* ---------- Draft: skill trees (เลือก 3 จาก 5) ---------- */
const PVP_SKILLS = {
  offense:  {id:'offense',  name:'⚔️ Offense', desc:'การ์ดโจมตี +2 ดาเมจ',    apply:b=>b.atkBonus=(b.atkBonus||0)+2},
  control:  {id:'control',  name:'🧊 Control', desc:'เริ่มเทิร์นมีบล็อก +3',    apply:b=>b.startBlock=(b.startBlock||0)+3},
  speed:    {id:'speed',    name:'💨 Speed',   desc:'มานาสูงสุด +1',           apply:b=>b.maxMana=(b.maxMana||3)+1},
  holy:     {id:'holy',     name:'✨ Holy',    desc:'เริ่มแต่ละศึกฟื้น 6 HP',  apply:b=>b._holyHeal=6},
  wealth:   {id:'wealth',   name:'💰 Wealth',  desc:'เริ่มต่อสู้จั่วเพิ่ม 1 ใบ', apply:b=>b._wealthDraw=1},
};
const PVP_SKILL_IDS = Object.keys(PVP_SKILLS);

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

/* ---------- Apply drafted loadout to a battle ---------- */
function applyLoadout(B, loadout){
  if(!loadout)return;
  (loadout.skills||[]).forEach(sid=>{
    const sk=PVP_SKILLS[sid];
    if(sk&&sk.apply) sk.apply(B);
  });
  if(B._holyHeal && B.php!=null) B.php=Math.min(B.pmaxHp, B.php + B._holyHeal);
}

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
  return {
    floor, enemy,
    maxMana: 3, mana: 3,
    php: null, pmaxHp: null,
    block: 0, burn: 0,
    atkBonus: 0, startBlock: 0,
    deck, hand: [], disc: [],
    turn: 1, over: false, won: false,
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
  B.thorns = 0;   // หนามหมดอายุทุกเทิร์น
  // bulwark: บล็อกค้างข้ามเทิร์น
  if(B._keepBlock){ B.block = (B.block||0) + (B.startBlock||0); B._keepBlock=false; }
  else B.block = B.startBlock || 0;
  let n = 5;
  if(B._wealthDraw && B.turn===1) n += B._wealthDraw;
  B_drawCard(B, n);
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
    let bonus = (card.type==='attack' ? (B.atkBonus||0) : 0);
    let mult = 1;
    if(B._echo && (card.type==='attack'||card.type==='magic')){ mult = 2; B._echo = false; log.push('🔊 ×2!'); }
    let dealtTotal = 0;
    for(let h=0; h<hits; h++) dealtTotal += B_dealToEnemy(B, (card.dmg + bonus)*mult, log);
    // lifesteal: ฟื้นเท่าดาเมจที่ดีลจริง
    if(card.lifesteal && B.php!=null){
      B.php = Math.min(B.pmaxHp, B.php + dealtTotal);
      log.push(`🩸 ฟื้น ${dealtTotal}`);
    }
  }
  if(card.block){ B.block += card.block; log.push(`+${card.block} บล็อก`); }
  if(card.thorns){ B.thorns = (B.thorns||0) + card.thorns; log.push(`🌵 หนาม ${card.thorns}`); }
  if(card.keepBlock){ B._keepBlock = true; }
  if(card.heal){ B.php = Math.min(B.pmaxHp, B.php + card.heal); log.push(`ฟื้น ${card.heal}`); }
  if(card.manaGain){ B.mana += card.manaGain; log.push(`มานา +${card.manaGain}`); }
  if(card.draw){ B_drawCard(B, card.draw); log.push(`หยิบ ${card.draw}`); }
  if(card.burn){ B.enemy.burn = (B.enemy.burn||0) + card.burn; log.push(`ไฟ ${card.burn}`); }
  if(card.poison){ B.enemy.poison = (B.enemy.poison||0) + card.poison; log.push(`☠️ พิษ ${card.poison}`); }
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
