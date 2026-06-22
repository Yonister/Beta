/* ============================================================
   pvp-battle.js — Minimal self-contained battle engine for PvP
   ตัด dependency ของ solo (map/relic/skill/ultimate) ออก
   เหลือแก่น: เด็ค + มือ + มานา + เล่นการ์ด + ศัตรู + เทิร์น
   ออกแบบให้ state อยู่ใน object เดียว (BATTLE) เพื่อ sync ง่าย
   ============================================================ */

/* ---------- Card database (แก่น) ---------- */
const PVP_CARDS = {
  strike:   {id:'strike',  name:'Strike',     cost:1, type:'attack',  dmg:6,  desc:'6 ดาเมจ'},
  heavy:    {id:'heavy',   name:'Heavy Blow', cost:2, type:'attack',  dmg:14, desc:'14 ดาเมจ'},
  slash:    {id:'slash',   name:'Slash',      cost:1, type:'attack',  dmg:4, hits:2, desc:'4 ดาเมจ ×2'},
  guard:    {id:'guard',   name:'Guard',      cost:1, type:'defense', block:6,  desc:'+6 บล็อก'},
  ironwall: {id:'ironwall',name:'Iron Wall',  cost:2, type:'defense', block:14, desc:'+14 บล็อก'},
  potion:   {id:'potion',  name:'Potion',     cost:1, type:'skill',   heal:8,  desc:'ฟื้น 8 HP'},
  quickdraw:{id:'quickdraw',name:'Quick Draw',cost:1, type:'skill',   draw:2,  desc:'หยิบ 2 ใบ'},
  fireball: {id:'fireball',name:'Fireball',   cost:2, type:'magic',   dmg:10, burn:3, desc:'10 ดมจ + ไฟ 3'},
};

/* ---------- Enemy templates ---------- */
const PVP_ENEMIES = [
  {name:'Slime',   spr:'🟢', hp:30, atk:6,  pat:['atk','atk','def']},
  {name:'Bat',     spr:'🦇', hp:24, atk:8,  pat:['atk','atk','atk']},
  {name:'Golem',   spr:'🗿', hp:46, atk:5,  pat:['def','atk','atk']},
  {name:'Wraith',  spr:'👻', hp:34, atk:7,  pat:['atk','def','atk']},
];

/* ---------- Starter deck ---------- */
function pvpStarterDeck(){
  const d=[];
  for(let i=0;i<4;i++)d.push('strike');
  for(let i=0;i<3;i++)d.push('guard');
  d.push('slash','heavy','potion','fireball','quickdraw');
  return d;
}

/* ---------- Battle state factory ---------- */
function createBattle(seed, floor){
  // deterministic enemy pick from shared seed + floor (mirror!)
  const rng = mulberryFrom((seed||1) * 131 + floor * 977);
  const tmpl = PVP_ENEMIES[Math.floor(rng() * PVP_ENEMIES.length)];
  // scale enemy by floor
  const hpScale = 1 + floor * 0.12;
  const enemy = {
    name: tmpl.name, spr: tmpl.spr,
    hp: Math.round(tmpl.hp * hpScale), maxHp: Math.round(tmpl.hp * hpScale),
    atk: tmpl.atk + Math.floor(floor/3), pat: tmpl.pat, patIdx: 0,
    block: 0, burn: 0,
  };
  const deck = shuffleSeeded(pvpStarterDeck(), rng);
  return {
    floor, enemy,
    maxMana: 3, mana: 3,
    php: null, pmaxHp: null,   // set by caller (carry HP across floors)
    block: 0, burn: 0,
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
  B.block = 0;
  B_drawCard(B, 5);
}
function B_playCard(B, handIdx){
  const cid = B.hand[handIdx];
  const card = PVP_CARDS[cid];
  if(!card) return {ok:false};
  if(card.cost > B.mana) return {ok:false, reason:'mana'};
  B.mana -= card.cost;
  B.hand.splice(handIdx, 1);
  B.disc.push(cid);

  const log = [];
  // damage
  if(card.dmg){
    const hits = card.hits || 1;
    for(let h=0; h<hits; h++) B_dealToEnemy(B, card.dmg, log);
  }
  if(card.block){ B.block += card.block; log.push(`+${card.block} บล็อก`); }
  if(card.heal){ B.php = Math.min(B.pmaxHp, B.php + card.heal); log.push(`ฟื้น ${card.heal}`); }
  if(card.draw){ B_drawCard(B, card.draw); log.push(`หยิบ ${card.draw}`); }
  if(card.burn){ B.enemy.burn = (B.enemy.burn||0) + card.burn; log.push(`ไฟ ${card.burn}`); }

  // enemy dead?
  if(B.enemy.hp <= 0){ B.over = true; B.won = true; }
  return {ok:true, log, cid};
}
function B_dealToEnemy(B, amt, log){
  let dmg = amt;
  if(B.enemy.block > 0){
    const absorbed = Math.min(B.enemy.block, dmg);
    B.enemy.block -= absorbed; dmg -= absorbed;
  }
  B.enemy.hp = Math.max(0, B.enemy.hp - dmg);
  if(log) log.push(`ดีล ${amt}`);
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
  if(move === 'atk'){
    let dmg = e.atk;
    if(B.block > 0){
      const absorbed = Math.min(B.block, dmg);
      B.block -= absorbed; dmg -= absorbed;
    }
    B.php = Math.max(0, B.php - dmg);
    actions.push({type:'atk', dmg});
    if(B.php <= 0){ B.over = true; B.won = false; }
  } else if(move === 'def'){
    e.block += 8;
    actions.push({type:'def', block:8});
  }
  return actions;
}
function B_enemyIntent(B){
  const e = B.enemy;
  const move = e.pat[e.patIdx % e.pat.length];
  if(move === 'atk') return {icon:'⚔️', txt:`โจมตี ${e.atk}`};
  if(move === 'def') return {icon:'🛡️', txt:`ตั้งรับ +8`};
  return {icon:'❓', txt:'?'};
}
