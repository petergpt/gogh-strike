import {WEAPONS,WEAPON_BY_ID} from './weapon-catalog.js';

export const GEAR = Object.freeze([
  {id:'armor',name:'Protective vest',description:'Restore armor to 100. Reduces bullet damage; precision rounds penetrate more.',cost:650,kind:'armor'},
  {id:'smoke',name:'Pigment smoke',description:'A 14-second screen that breaks enemy sight lines.',cost:300,kind:'utility',max:2},
  {id:'frag',name:'Fragment canister',description:'A timed area threat. Stone walls stop the blast.',cost:350,kind:'utility',max:1},
  {id:'medkit',name:'Field dressing',description:'Hold H while still for 2.6 seconds to restore up to 45 health.',cost:300,kind:'utility',max:1},
]);
export const ATTACHMENTS = Object.freeze({iron:0,reflex:250,scope:650,standard:0,suppressor:500});
export const magazineFor=id=>({ammo:WEAPON_BY_ID[id].magSize,reserve:WEAPON_BY_ID[id].reserveAmmo});
export function initEquipment(actor,{mode='tdm',weapon='rifle',firstRound=true,survived=false,attachments={}}={}){
 actor.utility ||= {smoke:0,frag:0,medkit:0};actor.attachments ||= {};actor.weapons ||= {};
 actor.credits=Number.isFinite(actor.credits)?actor.credits:3800;
 if(mode==='clash'){
  actor.carriedWeapons=weapon==='pistol'?['pistol']:[weapon,'pistol'];actor.weapons=Object.fromEntries(actor.carriedWeapons.map(id=>[id,magazineFor(id)]));actor.primaryId=weapon==='pistol'?null:weapon;actor.armor=50;actor.utility={smoke:1,frag:1,medkit:1};actor.attachments={[weapon]:{...WEAPON_BY_ID[weapon].defaultAttachments,...attachments}};
 }else if(mode!=='tactical'){
  actor.weapons=Object.fromEntries(WEAPONS.map(w=>[w.id,magazineFor(w.id)]));
  actor.carriedWeapons=WEAPONS.map(w=>w.id);actor.primaryId=weapon;actor.armor=75;
  actor.utility={smoke:1,frag:1,medkit:1};
 }else if(firstRound||!survived){
  actor.attachments={};
  actor.weapons={pistol:magazineFor('pistol')};actor.carriedWeapons=['pistol'];actor.primaryId=null;actor.armor=0;actor.utility={smoke:0,frag:0,medkit:0};
  if(firstRound&&weapon!=='pistol'&&actor.credits>=(WEAPON_BY_ID[weapon]?.cost||0)){
   actor.credits-=WEAPON_BY_ID[weapon].cost;actor.primaryId=weapon;actor.carriedWeapons=[weapon,'pistol'];actor.weapons[weapon]=magazineFor(weapon);
  }
 }else{
  // Survivors retain their purchased equipment. Supply at the base refills ammunition.
  for(const id of actor.carriedWeapons)actor.weapons[id]=magazineFor(id);
 }
 actor.weaponId=actor.primaryId||'pistol';
 if(mode!=='tactical')actor.weaponId=weapon;
 actor.attachments[actor.weaponId] ||= {...(WEAPON_BY_ID[actor.weaponId].defaultAttachments||{optic:'iron',barrel:'standard'})};
 if(firstRound&&mode!=='tactical')Object.assign(actor.attachments[actor.weaponId],attachments);
 Object.assign(actor,actor.weapons[actor.weaponId]);actor.fireMode=WEAPON_BY_ID[actor.weaponId].fireModes?.[0]|| (WEAPON_BY_ID[actor.weaponId].automatic?'auto':'semi');
 actor.bloom=0;actor.recoilIndex=0;actor.burstRemaining=0;
}
export function stashMagazine(actor){if(actor.weaponId)actor.weapons[actor.weaponId]={ammo:actor.ammo,reserve:actor.reserve,fireMode:actor.fireMode};}
export function equip(actor,id){
 if(!actor.carriedWeapons?.includes(id)||!WEAPON_BY_ID[id])return false;
 stashMagazine(actor);actor.weaponId=id;Object.assign(actor,actor.weapons[id]);
 actor.attachments[id] ||= {...(WEAPON_BY_ID[id].defaultAttachments||{optic:'iron',barrel:'standard'})};
 const modes=WEAPON_BY_ID[id].fireModes||['semi'],savedMode=actor.weapons[id].fireMode;
 actor.fireMode=modes.includes(savedMode)?savedMode:modes[0];actor.bloom=0;actor.recoilIndex=0;actor.burstRemaining=0;return true;
}
export function shopFor(actor,rules){
 const active=rules?.phase==='staging'&&actor?.alive;
 return [...WEAPONS.filter(w=>w.id!=='pistol').map(w=>({id:w.id,name:w.name,description:w.description,cost:w.cost,kind:'weapon',owned:actor?.primaryId===w.id})),...GEAR.map(g=>({...g,owned:g.kind==='armor'?(actor?.armor||0)>=100:(actor?.utility?.[g.id]||0)>=g.max}))].map(item=>({...item,available:active&&!item.owned&&(actor.credits||0)>=item.cost}));
}
export function buy(actor,itemId,rules){
 const item=shopFor(actor,rules).find(i=>i.id===itemId);if(!item?.available)return {ok:false,message:rules?.phase!=='staging'?'Requisition is available between rounds.':'Already equipped or insufficient credits.'};
 if(!rules.spendCredits(actor,item.cost))return {ok:false,message:'Insufficient credits.'};
 if(item.kind==='weapon'){
  stashMagazine(actor);if(actor.primaryId){delete actor.weapons[actor.primaryId];delete actor.attachments[actor.primaryId];}
  actor.primaryId=item.id;actor.carriedWeapons=[item.id,'pistol'];actor.weapons[item.id]=magazineFor(item.id);equip(actor,item.id);
 }else if(item.kind==='armor')actor.armor=100;
 else actor.utility[item.id]=(actor.utility[item.id]||0)+1;
 return {ok:true,message:`${item.name} equipped.`};
}
export function changeAttachments(actor,next,rules,mode){
 const w=WEAPON_BY_ID[actor.weaponId],current=actor.attachments[actor.weaponId]||{optic:'iron',barrel:'standard'};
 const result={...current};let cost=0;
 for(const key of ['optic','barrel'])if(next[key]!==undefined&&next[key]!==current[key]){
  const allowed=w.attachmentOptions?.[key]|| (key==='optic'?['iron','reflex','scope']:['standard','suppressor']);
  if(!allowed.includes(next[key]))return {ok:false,message:'This weapon does not support that attachment.'};
  result[key]=next[key];cost+=ATTACHMENTS[next[key]]||0;
 }
 if(mode==='tactical'&&(rules.phase!=='staging'||!rules.spendCredits(actor,cost)))return {ok:false,message:'Attachments require credits during staging.'};
 actor.attachments[actor.weaponId]=result;return {ok:true,message:'Weapon configuration updated.'};
}
export function absorbDamage(actor,damage,penetration=.6,{headshot=false,bypassArmor=false}={}){
 const armor=Math.max(0,actor.armor||0),mitigation=bypassArmor?0:Math.min(armor,damage*(1-penetration)*(headshot?.5:.72));
 actor.armor=Math.max(0,armor-mitigation);return {healthDamage:Math.max(0,damage-mitigation),armorDamage:mitigation};
}
