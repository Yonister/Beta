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
  vampire:  {id:'vampire', name:'Vampire Strike',cost:2,type:'attack', dmg:8, lifesteal:true, rarity:'rare', desc:'8 ดาเมจ + ฟื้น 70% ของดาเมจที่ดีล'},
  drain:    {id:'drain',   name:'Life Drain', cost:1, type:'magic',   dmg:5, lifesteal:true, rarity:'uncommon', desc:'5 ดมจ + ฟื้น 70% ของดาเมจ'},

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
  timebomb: {id:'timebomb',name:'ระเบิดเวลา',  cost:1, type:'magic', bomb:14, bombTurns:2, rarity:'uncommon', desc:'ครบ 2 เทิร์น ระเบิด 14 ดมจ (+โบนัสเวท)'},

  // --- Legendary (หายาก เปลี่ยนเกม — สลายหลังใช้ กันสแปมผลถาวร) ---
  dragonheart:{id:'dragonheart',name:'หัวใจมังกร',cost:0,type:'skill', manaMax:1, draw:1, exhaust:true, rarity:'legendary', desc:'มานาสูงสุด +1 ทั้งศึก + จั่ว 1 · ใช้ได้ครั้งเดียว/ศึก'},
  thornking:{id:'thornking',name:'ราชันย์หนาม', cost:2, type:'defense', block:8, thorns:6, thornsPersist:true, exhaust:true, rarity:'legendary', desc:'+8 บล็อก + หนาม 6 ถาวรทั้งศึก · ใช้ได้ครั้งเดียว/ศึก'},
};

const CARD_RARITY={common:1,uncommon:2,rare:3,legendary:4};

// ไอคอนการ์ด — pixel art จาก Dungeon Crawl Stone Soup tiles (CC0) เข้าชุดกับมอนสเตอร์/ฉาก
Object.keys(PVP_CARDS).forEach(id=>{ PVP_CARDS[id].ico='assets/cardpx/'+id+'.png'; });
// ชื่อภาษาอังกฤษสั้นสำหรับหน้าการ์ด (ฟอนต์ pixel แสดงไทยไม่ได้ + สั้นกว่า ไม่ทับ cost)
const CARD_EN = {
  strike:'Strike', heavy:'Heavy', slash:'Slash', guard:'Guard', ironwall:'Iron Wall',
  potion:'Potion', quickdraw:'Draw', fireball:'Fireball', daze:'Daze', jab:'Jab',
  flurry:'Flurry', adrenaline:'Rush', echo:'Echo', thorns:'Thorns', bulwark:'Bulwark',
  bash:'Bash', poisondart:'Dart', ignite:'Ignite', vampire:'Vampire', drain:'Drain',
  allin:'All In', reckless:'Reckless', grudge:'Grudge', finisher:'Finisher', snakefang:'Fang',
  coinflip:'Coin', execute:'Execute', venomburst:'Venom', timebomb:'Bomb',
  dragonheart:'Dragon', thornking:'Thorns',
};
Object.keys(PVP_CARDS).forEach(id=>{
  const c=PVP_CARDS[id];
  c.en = CARD_EN[c.upgradedFrom||id] || c.name;
  if(c.upgradedFrom) c.en += '+';   // การ์ดอัปเกรดต่อท้าย +
});

/* ---------- Card upgrade variants (ลับดาบที่จุดพัก) ---------- */
// สร้างเวอร์ชัน "+" อัตโนมัติจากการ์ดพื้นฐาน (เว้นคำสาป/การ์ดตำนานที่สลายทิ้ง)
const UPGRADE_OF = {};
(function(){
  Object.keys(PVP_CARDS).forEach(id=>{
    const b = PVP_CARDS[id];
    if(b.curse || b.exhaust) return;   // คำสาป/ตำนาน ไม่ให้อัปเกรด
    const u = Object.assign({}, b);
    u.id = id+'_p'; u.name = b.name+'+'; u.en = (b.en||b.name)+'+'; u.upgradedFrom = id; u.ico = b.ico;
    if(b.dmg)      u.dmg      = b.dmg + Math.max(2, Math.round(b.dmg*0.4));
    if(b.comboDmg) u.comboDmg = b.comboDmg + 1;
    if(b.block)    u.block    = b.block + Math.max(2, Math.round(b.block*0.4));
    if(b.heal)     u.heal     = b.heal + 3;
    if(b.burn)     u.burn     = b.burn + 2;
    if(b.poison)   u.poison   = b.poison + 2;
    if(b.thorns)   u.thorns   = b.thorns + 2;
    if(b.draw)     u.draw     = b.draw + 1;
    u.desc = (b.desc||'') + ' ⬆';
    PVP_CARDS[u.id] = u;
    UPGRADE_OF[id] = u.id;
  });
})();

/* ---------- Relics (พร — passive ติดตัวทั้งเกม) ---------- */
const PVP_RELICS = [
  {id:'executioner', ic:'🗡️', name:'ดาบพิฆาต',   desc:'ทุกการ์ดโจมตีใบที่ 3 ดีล 2 เท่า'},
  {id:'bloodthirst', ic:'🩸', name:'กระหายเลือด', desc:'ชนะศึก ฟื้น 12 HP'},
  {id:'powerCore',   ic:'💎', name:'แกนพลัง',     desc:'เทิร์นแรกของทุกศึก มานา +1'},
  {id:'stoneScale',  ic:'🛡️', name:'เกล็ดหิน',    desc:'เริ่มทุกเทิร์นมีบล็อก +4'},
  {id:'poisonLock',  ic:'☠️', name:'พิษเรื้อรัง',  desc:'พิษบนศัตรูไม่จางเอง'},
  {id:'sharpEye',    ic:'🃏', name:'ตาไว',        desc:'เทิร์นแรกของทุกศึก จั่วเพิ่ม 1 ใบ'},
  {id:'collector',   ic:'💰', name:'นักสะสม',      desc:'ชนะศึกได้เครดิตเพิ่ม +6'},
];
const PVP_RELIC_BY_ID = {};
PVP_RELICS.forEach(r=>PVP_RELIC_BY_ID[r.id]=r);

/* ---------- Boons (พร — รวม stat + relic เป็นระบบเดียว จั่วสุ่มจาก seed) ---------- */
// tier: common ◆ / uncommon ◆◆ / rare ★  ·  cat (สี): atk/int/def/tempo/sustain
const PVP_BOONS = [
  // ◆ common
  {id:'might',     tier:'common', cat:'atk',     ic:'⚔️', name:'Might',      desc:'การ์ดโจมตีกาย +3 ดาเมจ'},
  {id:'insight',   tier:'common', cat:'int',     ic:'🔮', name:'Insight',    desc:'เวท/ไฟ/พิษ +3'},
  {id:'vigor',     tier:'common', cat:'sustain', ic:'❤️', name:'Vigor',      desc:'เลือดสูงสุด +20 (ฟื้น 20)'},
  {id:'ward',      tier:'common', cat:'def',     ic:'🛡️', name:'Ward',       desc:'เริ่มเทิร์นมีบล็อก +4'},
  {id:'haste',     tier:'common', cat:'tempo',   ic:'🌀', name:'Haste',      desc:'จั่วเพิ่ม +1 ใบทุกเทิร์น'},
  {id:'overflow',  tier:'common', cat:'tempo',   ic:'💎', name:'Overflow',   desc:'มานาสูงสุด +1'},
  {id:'quickstart',tier:'common', cat:'tempo',   ic:'🪶', name:'Quickstart', desc:'เทิร์นแรกทุกศึก จั่ว +2'},
  {id:'merchant',  tier:'common', cat:'tempo',   ic:'💰', name:'Merchant',   desc:'ชนะศึกได้เครดิต +5'},
  {id:'regrowth',  tier:'common', cat:'sustain', ic:'🩹', name:'Regrowth',   desc:'เริ่มทุกศึก ฟื้น 8 HP'},
  {id:'venomtip',  tier:'common', cat:'int',     ic:'☠️', name:'Venomtip',   desc:'ไฟ/พิษที่ใส่ +2'},
  // ◆◆ uncommon
  {id:'berserker', tier:'uncommon', cat:'atk',     ic:'🐺', name:'Berserker',  desc:'โจมตีกาย +5 · แต่เลือดสูงสุด −12'},
  {id:'spellblade',tier:'uncommon', cat:'int',     ic:'🧙', name:'Spellblade', desc:'เวทใบแรกแต่ละศึก ค่าร่าย 0'},
  {id:'ironhide',  tier:'uncommon', cat:'def',     ic:'🪖', name:'Ironhide',   desc:'เริ่มเทิร์นมีบล็อก +7'},
  {id:'overcharge',tier:'uncommon', cat:'tempo',   ic:'⚡', name:'Overcharge', desc:'มานาสูงสุด +1 · เทิร์นแรกมานา +1'},
  {id:'sanguine',  tier:'uncommon', cat:'sustain', ic:'🩸', name:'Sanguine',   desc:'ดูดเลือด ฟื้นเต็ม 100%'},
  {id:'sharpshooter',tier:'uncommon',cat:'atk',    ic:'🎯', name:'Sharpshooter',desc:'โจมตีใบแรกของเทิร์น +5 ดาเมจ'},
  {id:'pyromancer',tier:'uncommon', cat:'int',     ic:'🔥', name:'Pyromancer', desc:'ไฟที่ใส่ทั้งหมด +3'},
  {id:'thornaura', tier:'uncommon', cat:'def',     ic:'🌵', name:'Thornaura',  desc:'เริ่มทุกเทิร์นมีหนาม 3'},
  {id:'momentum',  tier:'uncommon', cat:'def',     ic:'💨', name:'Momentum',   desc:'เล่นการ์ด ≥4 ใบ/เทิร์น → บล็อก +6'},
  {id:'cardmaster',tier:'uncommon', cat:'tempo',   ic:'🃏', name:'Cardmaster', desc:'จั่ว +1/เทิร์น · มือแรกจั่ว +1'},
  // ★ rare (บอสการันตี)
  {id:'executioner',tier:'rare', cat:'atk',     ic:'🗡️', name:'Executioner',desc:'การ์ดโจมตีใบที่ 3 ดีล ×2'},
  {id:'echoheart',  tier:'rare', cat:'atk',     ic:'🔁', name:'Echoheart',  desc:'โจมตีใบแรกของทุกเทิร์น ดีล ×2'},
  {id:'deadeye',    tier:'rare', cat:'atk',     ic:'💥', name:'Deadeye',    desc:'โจมตีกายมีโอกาส 25% คริ ×2'},
  {id:'plaguelord', tier:'rare', cat:'int',     ic:'☣️', name:'Plaguelord', desc:'พิษบนศัตรูไม่จางเอง'},
  {id:'detonator',  tier:'rare', cat:'int',     ic:'💣', name:'Detonator',  desc:'ใส่พิษทีไร จุดระเบิดพิษที่มีทันที'},
  {id:'bloodthirst',tier:'rare', cat:'sustain', ic:'🩸', name:'Bloodthirst',desc:'ชนะศึก ฟื้น 12 HP'},
  {id:'archmage',   tier:'rare', cat:'tempo',   ic:'💠', name:'Archmage',   desc:'มานาสูงสุด +2'},
  {id:'dragonsoul', tier:'rare', cat:'tempo',   ic:'🐲', name:'Dragonsoul', desc:'เทิร์นแรกทุกศึก มานา +2 · จั่ว +1'},
];
const PVP_BOON_BY_ID = {};
PVP_BOONS.forEach(b=>PVP_BOON_BY_ID[b.id]=b);
// ใส่ผลพรลง battle (เรียกใน applyLoadout) — ผลนอกศึก (maxHp/gold/heal-on-win) จัดการฝั่ง UI
function applyBoons(B, boons){
  if(!boons || !boons.length) return;
  B._boons = boons.slice();
  const H = id=>boons.includes(id);
  // ◆ ตัวเลขพื้น
  if(H('might'))      B.atkBonus=(B.atkBonus||0)+3;
  if(H('insight'))    B.intBonus=(B.intBonus||0)+3;
  if(H('ward'))       B.startBlock=(B.startBlock||0)+4;
  if(H('haste'))      B._extraDraw=(B._extraDraw||0)+1;
  if(H('overflow'))   B.maxMana+=1;
  if(H('quickstart')) B._relicDrawT1=(B._relicDrawT1||0)+2;
  if(H('venomtip'))   B._dotBonus=(B._dotBonus||0)+2;
  // ◆◆ กลาง
  if(H('berserker'))  B.atkBonus=(B.atkBonus||0)+5;   // (maxHp −12 จัดการฝั่ง UI)
  if(H('spellblade')) B._spellblade=true;
  if(H('ironhide'))   B.startBlock=(B.startBlock||0)+7;
  if(H('overcharge')){B.maxMana+=1; B._relicManaT1=(B._relicManaT1||0)+1;}
  if(H('sanguine'))   B._lifestealFull=true;
  if(H('sharpshooter'))B._sharpshooter=true;
  if(H('pyromancer')) B._burnBonus=(B._burnBonus||0)+3;
  if(H('thornaura'))  B._thornStart=(B._thornStart||0)+3;
  if(H('momentum'))   B._momentum=true;
  if(H('cardmaster')){B._extraDraw=(B._extraDraw||0)+1; B._relicDrawT1=(B._relicDrawT1||0)+1;}
  // ★ หายาก
  if(H('executioner'))B._blade3=true;
  if(H('echoheart'))  B._echoHeart=true;
  if(H('deadeye'))    B._deadeye=true;
  if(H('plaguelord')) B._poisonLock=true;
  if(H('detonator'))  B._detonator=true;
  if(H('archmage'))   B.maxMana+=2;
  if(H('dragonsoul')){B._relicManaT1=(B._relicManaT1||0)+2; B._relicDrawT1=(B._relicDrawT1||0)+1;}
  // regrowth: ฟื้นตอนเริ่มศึก (php ถูกตั้งก่อน applyLoadout แล้ว)
  if(H('regrowth') && B.php!=null) B.php=Math.min(B.pmaxHp, B.php+8);
}

/* ---------- Enemy templates ---------- */
// สไปรต์จาก Dungeon Crawl Stone Soup tiles (CC0) — spr(emoji) เป็น fallback ถ้ารูปโหลดไม่ขึ้น
// prof = น้ำหนักการสุ่มท่า (แต่ละสายพันธุ์นิสัยต่างกัน) — ท่าถูกสุ่มด้วย RNG แยกของศัตรู
//   จึง mirror ตรงกันทุกเครื่อง แต่ไม่ใช่ loop ตายตัวให้จำได้
// ท่า: atk=โจมตีปกติ · heavy=ชาร์จตีแรง · multi=ตีรัว2ครั้ง · def=ตั้งรับ · heal=ฟื้น · buff=สะสมพลัง(+atk) · rage=ยิ่งโดนยิ่งแรง
const PVP_ENEMIES = [
  // --- early (ชั้น 1-7) ---
  {tier:'early', name:'Slime',    spr:'🟢', img:'assets/enemies/slime.png',    hp:38, atk:8,  prof:{atk:3,def:2}},
  {tier:'early', name:'Bat',      spr:'🦇', img:'assets/enemies/bat.png',      hp:30, atk:9,  prof:{atk:2,multi:2}},
  {tier:'early', name:'Wolf',     spr:'🐺', img:'assets/enemies/wolf.png',     hp:34, atk:10, prof:{atk:3,multi:1}},
  {tier:'early', name:'Imp',      spr:'👺', img:'assets/enemies/imp.png',      hp:26, atk:8,  prof:{multi:3,atk:1}},
  {tier:'early', name:'Cactus',   spr:'🌵', img:'assets/enemies/cactus.png',   hp:46, atk:7,  thorns:5, prof:{def:3,atk:2}, desc:'หนาม (ตีโดนเจ็บเอง)'},
  {tier:'early', name:'Harpy',    spr:'🦅', img:'assets/enemies/harpy.png',    hp:32, atk:10, prof:{atk:2,multi:2}},
  // --- mid (ชั้น 8-14) ---
  {tier:'mid', name:'Golem',    spr:'🗿', img:'assets/enemies/golem.png',    hp:58, atk:8,  armor:4, prof:{def:3,atk:2,heavy:1}, desc:'เกราะหนา (ลดดาเมจ)'},
  {tier:'mid', name:'Wraith',   spr:'👻', img:'assets/enemies/wraith.png',   hp:44, atk:11, prof:{atk:2,heavy:1,def:1}},
  {tier:'mid', name:'Troll',    spr:'🧌', img:'assets/enemies/troll.png',    hp:54, atk:9,  regen:7, prof:{atk:2,heal:2,def:1}, desc:'ฟื้นเลือดตัวเอง'},
  {tier:'mid', name:'Shaman',   spr:'🧙', img:'assets/enemies/shaman.png',   hp:42, atk:9,  regen:6, prof:{heal:2,atk:2,def:1}, desc:'หมอผีฟื้นเลือด'},
  {tier:'mid', name:'Spider',   spr:'🕷️', img:'assets/enemies/spider.png',   hp:40, atk:8,  prof:{multi:3,atk:1,def:1}},
  {tier:'mid', name:'Ogre',     spr:'👹', img:'assets/enemies/ogre.png',     hp:62, atk:11, prof:{heavy:2,atk:2}, desc:'ชาร์จตีหนัก'},
  {tier:'mid', name:'Gargoyle', spr:'🗿', img:'assets/enemies/gargoyle.png', hp:56, atk:8,  armor:5, prof:{def:3,atk:2}, desc:'เกราะหิน'},
  // --- late (ชั้น 15+) ---
  {tier:'late', name:'Assassin',  spr:'🥷', img:'assets/enemies/assassin.png', hp:32, atk:16, prof:{atk:2,multi:2}, desc:'ตีแรงมาก HP น้อย'},
  {tier:'late', name:'Mimic',     spr:'🎁', img:'assets/enemies/mimic.png',    hp:52, atk:10, prof:{rage:2,def:1,atk:1}, desc:'ยิ่งโดนตียิ่งโกรธ'},
  {tier:'late', name:'Minotaur',  spr:'🐂', img:'assets/enemies/minotaur.png', hp:64, atk:13, prof:{heavy:2,atk:2,buff:1}, desc:'ชาร์จ + สะสมพลัง'},
  {tier:'late', name:'Manticore', spr:'🦁', img:'assets/enemies/manticore.png',hp:54, atk:12, prof:{multi:2,atk:1,heavy:1}},
  {tier:'late', name:'DeathKnight',spr:'⚔️',img:'assets/enemies/deathknight.png',hp:60, atk:13, prof:{atk:2,heavy:1,buff:1}, desc:'อัศวินมรณะ'},
  {tier:'late', name:'Lich',      spr:'💀', img:'assets/enemies/lich.png',     hp:50, atk:11, prof:{buff:2,atk:1,def:1}, desc:'ยิ่งนานยิ่งแรง'},
];
// บอสวนทุก 10 ชั้น (21, 31, 41...) — โหดขึ้นเรื่อยๆ
const PVP_BOSSES = [
  {name:'Tower Lord',  spr:'👹', img:'assets/enemies/boss.png',  hp:150, atk:13, armor:3, prof:{atk:2,heavy:1,rage:1,def:1,buff:1}, desc:'เจ้าหอคอย'},
  {name:'Abyss Warden',spr:'😈', img:'assets/enemies/boss2.png', hp:180, atk:15, armor:4, prof:{heavy:2,atk:2,buff:1,def:1}, desc:'ผู้เฝ้าเหวลึก'},
  {name:'Void Fiend',  spr:'👿', img:'assets/enemies/boss3.png', hp:210, atk:16, prof:{multi:2,atk:2,rage:1,buff:1}, desc:'ปีศาจแห่งความว่างเปล่า'},
];
const PVP_BOSS = PVP_BOSSES[0];   // เผื่อโค้ดเก่าอ้างถึง
function tierPool(t){ return PVP_ENEMIES.filter(e=>e.tier===t); }
// affix เพิ่มความหลากหลายในเหวลึก (endless) — เติมพลังพิเศษสุ่มจาก seed
const PVP_AFFIXES = [
  {id:'armored', tag:'🛡️เกราะ', armor:4},
  {id:'undying', tag:'💚อมตะ',  regen:6},
  {id:'spiky',   tag:'🌵หนาม',  thorns:5},
];
// เลือกศัตรูประจำชั้น — deterministic จาก seed+floor (mirror ทุกเครื่อง) + ไม่ซ้ำชั้นก่อนหน้า
function pvpEnemyForFloor(seed, floor){
  let pool;
  if(floor<=7) pool = tierPool('early');
  else if(floor<=14) pool = tierPool('mid');
  else if(floor<=20) pool = tierPool('late');
  else pool = tierPool('late').concat(tierPool('mid'));   // เหวลึก: หลากหลายขึ้น
  const rng = mulberryFrom((seed||1)*769 + floor*613);
  let idx = Math.floor(rng()*pool.length);
  if(floor>1){
    const prev = pvpEnemyForFloor(seed, floor-1);
    if(pool[idx]===prev) idx=(idx+1)%pool.length;
  }
  return pool[idx];
}
// สุ่มท่าถัดไปจากนิสัยศัตรู (ลดน้ำหนักท่าที่เพิ่งใช้ กันซ้ำติดกัน)
function rollEnemyMove(e){
  const prof = e.prof || {atk:1};
  const entries = Object.keys(prof);
  let total=0; const w=entries.map(m=>{ let x=prof[m]; if(m===e._lastMove) x*=0.3; total+=x; return x; });
  let r=(e._mrng?e._mrng():Math.random())*total;
  for(let i=0;i<entries.length;i++){ r-=w[i]; if(r<=0) return entries[i]; }
  return entries[0];
}

/* ---------- Apply loadout to a battle ----------
   ระบบสเตตัสเก่า (แจก 10 แต้ม) ถูกแทนด้วยระบบพร (Boons) ทั้งหมดแล้ว
   atkBonus/intBonus ยังเป็น hook ในเอนจิน — ตอนนี้มาจากพร Might/Insight ฯลฯ เท่านั้น */
function applyLoadout(B, loadout){
  if(!loadout)return;
  applyBoons(B, loadout.boons);
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
  // บอสวนทุก 10 ชั้นเริ่มที่ 21 (21,31,41...) — เหวลึกไม่มีเพดาน
  const isBoss = floor>=21 && (floor-21)%10===0;
  let tmpl;
  if(isBoss) tmpl = PVP_BOSSES[Math.floor((floor-21)/10) % PVP_BOSSES.length];
  else tmpl = pvpEnemyForFloor(seed, floor);
  // สเกล: ศัตรูปกติโตตามชั้น, บอสโตตามความลึกของเหว (จูนให้คนเก่งไปได้ลึกเห็นบอส/เหวลึก)
  let hpScale = isBoss ? (1 + Math.max(0,floor-21)*0.055) : (1 + floor*0.055);
  // SABOTAGE: น้ำยาคลุ้มคลั่ง — enemy HP +20%
  if(sabotage && sabotage.enemyHpBoost) hpScale *= (1 + sabotage.enemyHpBoost);
  const enemy = {
    name: tmpl.name, spr: tmpl.spr, img: tmpl.img||null,
    hp: Math.round(tmpl.hp * hpScale), maxHp: Math.round(tmpl.hp * hpScale),
    atk: tmpl.atk + Math.floor(floor*0.26),   // สเกล atk นุ่มลง
    prof: tmpl.prof, block: 0, burn: 0,
    // RNG ของศัตรูแยกจากการ์ดผู้เล่น → ท่าสุ่มแต่ mirror ตรงกันทุกเครื่อง
    _mrng: mulberryFrom((seed||1)*7331 + floor*613 + 17),
    armor: tmpl.armor||0, regen: tmpl.regen||0, thorns: tmpl.thorns||0,
    isBoss,
  };
  // affix: เหวลึก (ชั้น >21 ที่ไม่ใช่บอส) มีโอกาสได้พลังพิเศษ เพิ่มความหลากหลาย
  if(floor>21 && !isBoss && rng()<0.4){
    const af = PVP_AFFIXES[Math.floor(rng()*PVP_AFFIXES.length)];
    enemy.name = af.tag+' '+enemy.name;
    if(af.armor) enemy.armor += af.armor;
    if(af.regen){ enemy.regen += af.regen; enemy.prof=Object.assign({heal:2},enemy.prof); }
    if(af.thorns) enemy.thorns += af.thorns;
  }
  enemy._lastMove = null;
  enemy.nextMove = rollEnemyMove(enemy);   // pre-roll ท่าแรก เพื่อ telegraph
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
    _webT1: !!(sabotage && sabotage.web),         // ใยเหนียว: เทิร์นแรกจั่วลด 2
    _freezeT1: !!(sabotage && sabotage.freeze),   // เยือกแข็ง: เทิร์นแรกมานา −1
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
  if(B.turn===1 && B._relicManaT1) B.mana += B._relicManaT1;   // boon มานาเทิร์นแรก
  if(B.turn===1 && B._freezeT1) B.mana = Math.max(0, B.mana-1); // SABOTAGE เยือกแข็ง: เทิร์นแรกมานา −1
  if(!B._thornsPersist) B.thorns = 0;   // หนามหมดอายุทุกเทิร์น (เว้นราชันย์หนาม)
  if(B._thornStart) B.thorns = (B.thorns||0) + B._thornStart;  // boon Thornaura: หนามทุกเทิร์น
  B._firstAtkDone = false;              // boon Sharpshooter/Echoheart: รีเซ็ต "โจมตีใบแรกของเทิร์น"
  B._playedThisTurn = 0;                // นับการ์ดที่เล่นเทิร์นนี้ (ท่าไม้ตาย)
  const sb = B._noBlock ? 0 : (B.startBlock||0);   // SABOTAGE: ห้ามบล็อก = ไม่มี startBlock
  // bulwark: บล็อกค้างข้ามเทิร์น
  if(B._keepBlock && !B._noBlock){ B.block = (B.block||0) + sb; B._keepBlock=false; }
  else B.block = sb;
  let n = 5 + (B._extraDraw||0) + (B.turn===1?(B._relicDrawT1||0):0);   // SPD + boon จั่วเทิร์นแรก
  if(B.turn===1 && B._webT1) n = Math.max(1, n-2);   // SABOTAGE ใยเหนียว: เทิร์นแรกจั่วลด 2
  B_drawCard(B, n);
}
// ค่าร่ายจริง (การ์ดบางใบมีเงื่อนไขลดค่าร่าย เช่น เขี้ยวอสรพิษฟรีถ้าศัตรูติดพิษ)
function B_cardCost(B, card){
  if(card.freeIfPoison && (B.enemy.poison||0) > 0) return 0;
  if(B._spellblade && !B._spellbladeUsed && card.type==='magic') return 0;   // boon Spellblade: เวทใบแรกฟรี
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
  // exhaust: สลายหลังใช้ — ไม่ลงกองทิ้ง ไม่วนกลับมาในศึกนี้ (กันสแปมการ์ดผลถาวร)
  if(card.exhaust){ B.exhausted = (B.exhausted||[]); B.exhausted.push(cid); }
  else B.disc.push(cid);
  B._playedThisTurn = (B._playedThisTurn||0) + 1;
  if(B._spellblade && !B._spellbladeUsed && card.type==='magic') B._spellbladeUsed = true;   // boon Spellblade: ใช้ใบฟรีไปแล้ว

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
    const firstAtk = card.type==='attack' && !B._firstAtkDone;   // boon Sharpshooter/Echoheart
    let bonus = 0;
    if(card.type==='attack') bonus = (B.atkBonus||0);   // ATK
    else if(card.type==='magic') bonus = (B.intBonus||0); // INT
    if(B._weaken) bonus -= 3;                            // SABOTAGE: อ่อนแอ ตีเบาลง -3
    if(firstAtk && B._sharpshooter) bonus += 5;         // boon Sharpshooter: โจมตีใบแรก/เทิร์น +5
    let mult = 1;
    if(B._echo && (card.type==='attack'||card.type==='magic')){ mult = 2; B._echo = false; log.push('🔊 ×2!'); }
    if(firstAtk && B._echoHeart){ mult *= 2; log.push('🔁 Echoheart ×2!'); }   // boon Echoheart
    if(B._blade3 && card.type==='attack'){              // boon Executioner: ใบที่ 3 ×2
      B._atkCount = (B._atkCount||0) + 1;
      if(B._atkCount % 3 === 0){ mult *= 2; log.push('🗡️ Executioner ×2!'); }
    }
    if(card.type==='attack' && B._deadeye && B._rng() < 0.25){ mult *= 2; log.push('💥 คริ!'); }  // boon Deadeye
    if(card.type==='attack') B._firstAtkDone = true;
    // โบนัส ATK/INT กระจายต่อการ์ด (ไม่ใช่ต่อหมัด) — กันการ์ด multi-hit สแกลบวม
    const perHit = hits>1 ? (atkDmg + bonus/hits) : (atkDmg + bonus);
    let dealtTotal = 0;
    for(let h=0; h<hits; h++) dealtTotal += B_dealToEnemy(B, Math.max(1, Math.round(perHit*mult)), log);
    // lifesteal: ฟื้น 70% (boon Sanguine = 100%)
    if(card.lifesteal && B.php!=null){
      const healed = B._lifestealFull ? dealtTotal : Math.ceil(dealtTotal * 0.7);
      B.php = Math.min(B.pmaxHp, B.php + healed);
      log.push(`🩸 ฟื้น ${healed}`);
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
  if(card.exhaust) log.push('✨ สลายไป — ใช้ได้ครั้งเดียวต่อศึก');
  if(card.block){
    if(B._noBlock){ log.push('🔓 โล่ถูกทำลาย! บล็อกไม่ติด'); }   // SABOTAGE: ห้ามบล็อก
    else { B.block += card.block; log.push(`+${card.block} บล็อก`); }
  }
  if(card.thorns){ B.thorns = (B.thorns||0) + card.thorns; log.push(`🌵 หนาม ${card.thorns}`); }
  if(card.keepBlock){ B._keepBlock = true; }
  if(card.heal){ B.php = Math.min(B.pmaxHp, B.php + card.heal); log.push(`ฟื้น ${card.heal}`); }
  if(card.manaGain){ B.mana += card.manaGain; log.push(`มานา +${card.manaGain}`); }
  if(card.draw){ B_drawCard(B, card.draw); log.push(`หยิบ ${card.draw}`); }
  if(card.burn){ const b=card.burn+(B.intBonus||0)+(B._dotBonus||0)+(B._burnBonus||0); B.enemy.burn=(B.enemy.burn||0)+b; log.push(`ไฟ ${b}`); }   // +Venomtip/Pyromancer
  if(card.poison){
    // boon Detonator: ใส่พิษทีไร จุดระเบิดพิษที่มีอยู่เป็นดาเมจทันที
    if(B._detonator && (B.enemy.poison||0)>0){ B_dealToEnemy(B, B.enemy.poison, log); log.push('💣 จุดระเบิดพิษ!'); }
    const p=card.poison+(B.intBonus||0)+(B._dotBonus||0);
    B.enemy.poison=(B.enemy.poison||0)+p; log.push(`☠️ พิษ ${p}`);   // +Venomtip
  }
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
  // สะสมดาเมจที่ศัตรูรับ (ท่า rage ใช้คำนวณความโกรธ)
  B.enemy._dmgTaken = (B.enemy._dmgTaken||0) + dealt;
  if(log) log.push(`ดีล ${dealt}`);   // แสดงดาเมจจริงหลังหักเกราะ/บล็อก
  return dealt;   // คืนดาเมจจริงที่เข้า (สำหรับ lifesteal)
}
// เฟส 1 ของการจบเทิร์น: ทิ้งมือ + ดาเมจต่อเนื่อง (ไฟ/พิษ/ระเบิดเวลา)
// แยกออกมาให้ UI เว้นจังหวะระหว่างเฟสได้
function B_endTurnTicks(B){
  // boon Momentum: เล่นการ์ด ≥4 ใบเทิร์นนี้ → ได้บล็อกกันดาเมจศัตรูเทิร์นนี้
  if(B._momentum && (B._playedThisTurn||0)>=4 && !B._noBlock) B.block = (B.block||0) + 6;
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
    if(!B._poisonLock) B.enemy.poison = Math.max(0, B.enemy.poison - 1);   // relic พิษเรื้อรัง: ไม่จาง
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
// ดาเมจของแต่ละท่า (ให้ intent กับ act ตรงกัน)
function enemyMoveDamage(B, move){
  const e = B.enemy;
  if(move === 'heavy') return Math.round(e.atk * 1.8);
  if(move === 'rage')  return e.atk + Math.floor((e._dmgTaken||0)/8);
  return e.atk;
}
// ศัตรูตีผู้เล่น 1 ครั้ง (หักบล็อก + หนามสะท้อน + เช็คตาย)
function enemyHitPlayer(B, dmg, type, actions){
  if(B._weaken) dmg = Math.round(dmg * 1.5);   // SABOTAGE: อ่อนแอ โดนแรงขึ้น 50%
  if(B.block > 0){ const a=Math.min(B.block,dmg); B.block-=a; dmg-=a; }
  B.php = Math.max(0, B.php - dmg);
  actions.push({type:type||'atk', dmg});
  if(B.thorns > 0){                            // player thorns: สะท้อนกลับ
    B.enemy.hp = Math.max(0, B.enemy.hp - B.thorns);
    actions.push({type:'thorns', dmg:B.thorns});
    if(B.enemy.hp<=0){ B.over=true; B.won=true; }
  }
  if(B.php <= 0){ B.over=true; B.won=false; }
}
function B_enemyAct(B){
  const e = B.enemy;
  e.block = 0;
  const move = e.nextMove || 'atk';
  const actions = [];
  if(move==='atk' || move==='heavy' || move==='rage'){
    enemyHitPlayer(B, enemyMoveDamage(B,move), move, actions);
  } else if(move==='multi'){
    const per = Math.max(1, Math.ceil(e.atk*0.55));
    enemyHitPlayer(B, per, 'multi', actions);
    if(!B.over) enemyHitPlayer(B, per, 'multi', actions);
  } else if(move==='def'){
    const blk = 8 + Math.floor((B.floor||1)/2);
    e.block += blk; actions.push({type:'def', block:blk});
  } else if(move==='heal'){
    const amt = e.regen || 5;
    e.hp = Math.min(e.maxHp, e.hp + amt); actions.push({type:'heal', amt});
  } else if(move==='buff'){
    e.atk += 2; actions.push({type:'buff', amt:2});   // สะสมพลังถาวรในศึกนี้ = กดดันให้รีบจบ
  }
  e._lastMove = move;
  e.nextMove = rollEnemyMove(e);   // สุ่มท่าถัดไป (telegraph)
  return actions;
}
function B_enemyIntent(B){
  const e = B.enemy;
  const move = e.nextMove || 'atk';
  if(move==='atk')   return {icon:'⚔️', txt:`โจมตี ${enemyMoveDamage(B,'atk')}`};
  if(move==='heavy') return {icon:'💥', txt:`ชาร์จ! ตี ${enemyMoveDamage(B,'heavy')}`};
  if(move==='multi'){ const per=Math.max(1,Math.ceil(e.atk*0.55)); return {icon:'🌀', txt:`ตีรัว ${per}×2`}; }
  if(move==='rage')  return {icon:'😡', txt:`โกรธ! ตี ${enemyMoveDamage(B,'rage')}`};
  if(move==='def')   return {icon:'🛡️', txt:`ตั้งรับ +${8+Math.floor((B.floor||1)/2)}`};
  if(move==='heal')  return {icon:'💚', txt:`ฟื้น ${e.regen||5}`};
  if(move==='buff')  return {icon:'🔺', txt:`สะสมพลัง +2 ATK`};
  return {icon:'❓', txt:'?'};
}
