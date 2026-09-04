import test from 'node:test';
import assert from 'node:assert/strict';
import {initEquipment,equip,buy,changeAttachments,absorbDamage,shopFor} from '../src/loadout.js';
import {TacticalRules} from '../src/tactical.js';
import {WEAPON_BY_ID} from '../src/weapon-catalog.js';
const actor=()=>({alive:true,team:0,id:0,credits:3800,utility:{},attachments:{},weapons:{},health:100});
test('tactical starting primary is paid, sidearm retained, survivors keep armor and utility',()=>{
 const a=actor();initEquipment(a,{mode:'tactical',weapon:'rifle'});assert.equal(a.credits,3800-WEAPON_BY_ID.rifle.cost);assert.deepEqual(a.carriedWeapons,['rifle','pistol']);a.armor=73;a.utility.smoke=1;a.ammo=3;initEquipment(a,{mode:'tactical',firstRound:false,survived:true});assert.equal(a.armor,73);assert.equal(a.utility.smoke,1);assert.equal(a.ammo,28);
});
test('weapon switching preserves separate magazines and does not grant unowned weapons',()=>{
 const a=actor();initEquipment(a,{mode:'tactical',weapon:'rifle'});a.ammo=9;assert.ok(equip(a,'pistol'));assert.equal(a.ammo,12);a.ammo=4;assert.ok(equip(a,'rifle'));assert.equal(a.ammo,9);assert.equal(equip(a,'sniper'),false);
});
test('fire selector stays with its weapon and fresh respawns restore the default',()=>{
 const a=actor();initEquipment(a,{mode:'clash',weapon:'rifle'});a.fireMode='semi';a.ammo=9;
 assert.ok(equip(a,'pistol'));assert.equal(a.fireMode,'semi');a.ammo=4;
 assert.ok(equip(a,'rifle'));assert.equal(a.fireMode,'semi');assert.equal(a.ammo,9);
 a.fireMode='burst';equip(a,'pistol');equip(a,'rifle');assert.equal(a.fireMode,'burst');
 a.weapons.pistol.fireMode='auto';equip(a,'pistol');assert.equal(a.fireMode,'semi','unsupported saved modes never turn a pistol automatic');assert.equal(a.ammo,4);
 initEquipment(a,{mode:'clash',weapon:'rifle',firstRound:false});assert.equal(a.fireMode,'auto');assert.equal(a.ammo,28);
});
test('real requisition spends credits only once and is denied during live rounds',()=>{
 const a=actor(),r=new TacticalRules();initEquipment(a,{mode:'tactical',weapon:'rifle'});const before=a.credits;assert.ok(buy(a,'armor',r).ok);assert.equal(a.credits,before-650);assert.equal(a.armor,100);assert.equal(buy(a,'armor',r).ok,false);r.phase='playing';assert.equal(buy(a,'smoke',r).ok,false);
});
test('attachment cost, compatibility and phase are enforced',()=>{
 const a=actor(),r=new TacticalRules();initEquipment(a,{mode:'tactical',weapon:'smg'});const before=a.credits;assert.ok(changeAttachments(a,{optic:'reflex'},r,'tactical').ok);assert.equal(a.credits,before-250);assert.equal(changeAttachments(a,{optic:'scope'},r,'tactical').ok,false);r.phase='playing';assert.equal(changeAttachments(a,{barrel:'suppressor'},r,'tactical').ok,false);
});
test('penetrating rounds reduce armor mitigation without negative armor or hidden healing',()=>{
 const light={armor:100},heavy={armor:100};const a=absorbDamage(light,80,.3),b=absorbDamage(heavy,80,.85);assert.ok(b.healthDamage>a.healthDamage);assert.equal(a.healthDamage+a.armorDamage,80);const depleted={armor:2};assert.equal(absorbDamage(depleted,50,.2).armorDamage,2);assert.equal(depleted.armor,0);assert.equal(absorbDamage(depleted,50,.2).healthDamage,50);
});
test('death loses paid attachments and replacing a primary does not bank its attachments',()=>{
 const a=actor(),r=new TacticalRules();a.credits=10000;initEquipment(a,{mode:'tactical',weapon:'rifle'});assert.ok(changeAttachments(a,{optic:'scope',barrel:'suppressor'},r,'tactical').ok);initEquipment(a,{mode:'tactical',firstRound:false,survived:false});assert.equal(a.attachments.rifle,undefined);assert.ok(buy(a,'rifle',r).ok);assert.deepEqual(a.attachments.rifle,{optic:'iron',barrel:'standard'});assert.ok(changeAttachments(a,{optic:'reflex'},r,'tactical').ok);assert.ok(buy(a,'smg',r).ok);assert.equal(a.attachments.rifle,undefined);
});
