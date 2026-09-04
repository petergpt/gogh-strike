import {FACTIONS} from './factions.js';
import {WEAPONS} from './weapon-catalog.js';
import {getArtistLoadout} from './artist-loadout.js';
import {getArtistTag,tagDataURI} from './art-tags.js';
import {getArtistTaunt} from './artist-taunts.js';
import {teamLogoSVG} from './team-logos.js';

const $=id=>document.getElementById(id);
const WEAPON_CLASS={rifle:'Assault rifle',smg:'SMG',shotgun:'Shotgun',sniper:'Sniper rifle',pistol:'Pistol'};
const PATHS={
 pistol:'M9 12h34v3H29v4l-6 1-5 13h-8l4-13H9Zm34 0h5v3h-5ZM17 9h20v3H17Z',
 smg:'M7 12h40v5H32v4h-5l-3 12h-6l2-13h-8v6H7ZM47 13h11v3H47ZM27 18h5l4 12h-7ZM18 8h14v4H18Z',
 rifle:'M3 15h9v-3h33v5H33v3h-5l-2 12h-6l1-13h-7l-6 7H3ZM45 13h15v3H45ZM31 20h6l2 11h-8ZM23 8h11v4H23Z',
 shotgun:'M3 17 10 12h36v3H18l-4 4-6 10H3ZM46 11h15v4H46ZM25 15h22v3H25ZM17 19h6l-3 9h-5Z',
 sniper:'M3 18 12 12h27v4H24l-5 5-7 7H3ZM39 12h24v3H39ZM22 6h17v4H22ZM28 10h4v3h-4ZM26 17h6l1 12h-6Z',
};
const ABILITIES=[
 {id:'smoke',key:'Q',name:'Smoke',path:'M7 18h11a4 4 0 0 0 .5-8 6 6 0 0 0-11.6-1.5A4.8 4.8 0 0 0 7 18Z'},
 {id:'frag',key:'G',name:'Paint',path:'m12 3 2.5 5 5.5-1.5-2 5.5 4 4-6 .5-2 5-3.5-4.5L5 19l1.5-5L2 11l6-2Z'},
 {id:'medkit',key:'H',name:'Heal',path:'M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z'},
];
const COMBAT_ICONS={
 frag:{label:'Paint canister',path:ABILITIES.find(a=>a.id==='frag').path},
 melee:{label:'Melee',path:'M5 10V5a2 2 0 0 1 4 0V4a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v2a2 2 0 0 1 4 0v8l-4 6H8l-5-7a2 2 0 0 1 2-3l3 3v-4Z'},
 unknown:{label:'Elimination',path:'m12 3 9 9-9 9-9-9Zm0 5-4 4 4 4 4-4Z'},
};
const clamp=(n,min=0,max=1)=>Math.min(max,Math.max(min,Number(n)||0));
const clock=n=>{n=Math.max(0,Math.ceil(Number(n)||0));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;};
function text(id,value){const el=$(id),next=String(value??'');if(el&&el.textContent!==next)el.textContent=next;}
function node(tag,classes='',content){const el=document.createElement(tag);el.className=classes;if(content!==undefined)el.textContent=content;return el;}
function crest(team){const el=node('i','team-crest');el.innerHTML=teamLogoSVG(team);el.setAttribute('aria-hidden','true');return el;}
function weaponSVG(id){return `<svg viewBox="0 0 66 38" aria-hidden="true"><path d="${PATHS[id]||PATHS.rifle}"/></svg>`;}
function combatSVG(id){return PATHS[id]?weaponSVG(id):`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${(COMBAT_ICONS[id]||COMBAT_ICONS.unknown).path}"/></svg>`;}
function weaponPreview(container,path,weapon){
 container.replaceChildren();container.classList.remove('has-image');const fallback=node('span','weapon-preview-fallback');fallback.innerHTML=weaponSVG(weapon.id);container.append(fallback);
 const image=document.createElement('img');image.src=`/${path.replace(/^\//,'')}`;image.alt=`${weapon.name} ${WEAPON_CLASS[weapon.id]||weapon.class}`;image.draggable=false;image.addEventListener('load',()=>container.classList.add('has-image'),{once:true});image.addEventListener('error',()=>image.remove(),{once:true});container.append(image);
}
function portrait(team,role,name='Artist',card=false){
 const el=node('span','portrait');const initial=node('span','portrait-initial',String(name).replace(/^The /,'').slice(0,1));el.append(initial);
 if(Number.isInteger(team)&&role){const image=document.createElement('img');image.src=`/assets/portraits/${card?'':'faces/'}${team}-${role}.png`;image.alt='';image.draggable=false;image.addEventListener('load',()=>el.classList.add('has-image'),{once:true});image.addEventListener('error',()=>image.remove(),{once:true});el.append(image);}
 return el;
}

/** One quick match, one artist choice, one readable layer of play information. */
export class GameUI{
 constructor(options={}){
  this.options=options;this.weapons=options.weapons?.length?options.weapons:WEAPONS;this.catalog=Object.fromEntries(this.weapons.map(w=>[w.id,w]));
  this.settings={volume:.65,sensitivity:1,graphics:'balanced',...options.settings};
  this.config={mode:'tdm',team:0,role:'vanguard',weapon:'rifle',attachments:{optic:'iron',barrel:'standard'},settings:{...this.settings}};
  this.state={};this.screen='menu';this.isReady=false;this.pointerLocked=false;this.dead=false;this.listeners=[];this.timers=new Map();this.killFeed=[];this.avatarSignature='';this.scoreboardSignature='';this.killerSignature='';
  this.bindEvents();this.renderAbilities();this.syncConfig();this.syncSettings();
 }
 listen(target,event,handler){target?.addEventListener(event,handler);this.listeners.push([target,event,handler]);}
 bindEvents(){
  this.listen($('faction-options'),'click',event=>{const button=event.target.closest('[data-team]');if(!button)return;this.config.team=Number(button.dataset.team);this.syncConfig();});
  this.listen($('artist-options'),'click',event=>{const button=event.target.closest('[data-role]');if(!button)return;this.config.role=button.dataset.role;this.options.onRoleSelect?.(this.config.role);this.syncConfig();});
  this.listen($('inspect-artist'),'click',()=>this.inspectArtist());
  this.listen($('deploy-button'),'click',()=>this.launch(false));this.listen($('rematch-button'),'click',()=>this.launch(true));this.listen($('pause-restart'),'click',()=>this.launch(true));
  this.listen($('resume-button'),'click',()=>this.options.onPauseChange?.(false));this.listen($('pointer-resume'),'click',()=>this.options.onPauseChange?.(false));
  for(const id of ['pause-menu','results-menu'])this.listen($(id),'click',()=>this.returnToMenu());
  this.listen($('brand-home'),'click',event=>{event.preventDefault();this.returnToMenu();});
  document.querySelectorAll('.settings-open').forEach(button=>this.listen(button,'click',event=>this.openSettings(event.currentTarget)));
  for(const id of ['close-settings','settings-done'])this.listen($(id),'click',()=>this.closeSettings());
  this.listen($('volume'),'input',event=>this.changeSettings({volume:Number(event.target.value)}));
  this.listen($('weapon-slots'),'click',event=>{const button=event.target.closest('[data-weapon]');if(button)this.options.onWeaponSelect?.(button.dataset.weapon);});
  this.listen($('sensitivity'),'input',event=>this.changeSettings({sensitivity:Number(event.target.value)}));
  document.querySelectorAll('[data-graphics]').forEach(button=>this.listen(button,'click',()=>this.changeSettings({graphics:button.dataset.graphics})));
  this.listen(window,'keydown',event=>{
   const escape=event.code==='Escape',tab=event.code==='Tab';
   // System shortcuts belong to the browser/OS; Shift+Tab still navigates dialogs.
   if((escape||tab)&&(event.metaKey||event.ctrlKey||event.altKey||(escape&&event.shiftKey)))return;
   // Holding Escape must not close Settings and then resume on a repeated keydown.
   if(escape&&event.repeat){event.preventDefault();event.stopImmediatePropagation();return;}
   if(event.code==='Escape'&&!$('settings-panel').hidden){event.preventDefault();event.stopImmediatePropagation();this.closeSettings();return;}
   if(event.code==='Escape'&&this.screen==='paused'){event.preventDefault();event.stopImmediatePropagation();this.options.onPauseChange?.(false);return;}
   if(event.code!=='Tab')return;
   const modal=['settings-panel','pause-panel','results-panel'].map($).find(panel=>!panel.hidden);if(!modal)return;
   const controls=[...modal.querySelectorAll('button:not(:disabled),input,summary')].filter(el=>el.getClientRects().length),first=controls[0],last=controls.at(-1);if(!first)return;
   if(!modal.contains(document.activeElement)){event.preventDefault();first.focus();}
   else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  this.listen(window,'blur',()=>this.showScoreboard(false));
 }
 async inspectArtist(){
  try{
   if(!this.artistInspector){const {createCharacterInspector}=await import('./character-inspector.js');this.artistInspector=createCharacterInspector({onClose:()=>$('inspect-artist')?.focus()});}
   await this.artistInspector.open({team:this.config.team,role:this.config.role});
  }catch(error){this.showError(error);}
 }
 artist(team=this.config.team,role=this.config.role){return FACTIONS[team]?.roster.find(a=>a.role===role)||FACTIONS[team]?.roster[0]||FACTIONS[0].roster[0];}
 identity(actor){return actor?.identity||this.artist(actor?.team??this.config.team,actor?.role??this.config.role);}
 syncConfig(){
  const team=this.config.team,artist=this.artist(),kit=getArtistLoadout(artist.role),weapon=kit.primary;
  this.config.mode='tdm';this.config.weapon=weapon.id;this.config.attachments={...kit.attachments};
  const factions=$('faction-options');factions.replaceChildren();
  FACTIONS.forEach((faction,index)=>{const button=node('button',`faction-card ${index===team?'selected':''}`);button.type='button';button.dataset.team=index;button.setAttribute('aria-pressed',String(index===team));button.append(crest(index),node('strong','',faction.name),node('span','faction-check',index===team?'✓':''));factions.append(button);});
  const roster=$('artist-options');roster.replaceChildren();
  FACTIONS[team].roster.forEach(member=>{
   const selected=member.role===this.config.role,w=getArtistLoadout(member.role).primary,button=node('button',`artist-card ${selected?'selected':''}`);button.type='button';button.dataset.role=member.role;button.setAttribute('aria-pressed',String(selected));button.setAttribute('aria-label',`${member.name}, ${w.name}, ${WEAPON_CLASS[w.id]||w.class}`);button.title=`${member.name}\n${member.artNote}`;
   const cardWeapon=node('span','artist-weapon');cardWeapon.innerHTML=weaponSVG(w.id);cardWeapon.append(node('span','',WEAPON_CLASS[w.id]||w.class));
   button.append(portrait(team,member.role,member.shortName,true),node('strong','',member.shortName),cardWeapon,node('i','artist-check',selected?'✓':''));roster.append(button);
  });
  text('selected-artist-name',artist.shortName);text('selected-weapon',weapon.name);text('selected-weapon-class',(WEAPON_CLASS[weapon.id]||weapon.class).toUpperCase());text('selected-magazine',`${weapon.magSize} rounds`);text('selected-fire-type',weapon.automatic?'Automatic':weapon.id==='sniper'?'Bolt action':weapon.id==='shotgun'?'Pump action':'Semi-auto');
  weaponPreview($('primary-preview'),kit.preview,weapon);weaponPreview($('secondary-preview'),kit.secondaryPreview,kit.secondary);text('selected-sidearm',kit.secondary.name);
  const tag=getArtistTag(artist);$('selected-art-tag').src=tagDataURI(artist);$('selected-art-tag').alt=`${artist.shortName} art tag: ${tag.name}`;text('selected-tag-name',tag.name);$('selected-tag-name').title=tag.name;
  const taunt=getArtistTaunt(artist);text('selected-taunt-name',taunt.name);$('selected-taunt-name').title=`J: ${taunt.name}`;
  text('enemy-faction-name',FACTIONS[1-team].name);const enemies=$('enemy-portraits');enemies.replaceChildren();FACTIONS[1-team].roster.forEach(member=>enemies.append(portrait(1-team,member.role,member.shortName)));
 }
 syncSettings(){
  $('volume').value=this.settings.volume;$('sensitivity').value=this.settings.sensitivity;text('volume-output',`${Math.round(this.settings.volume*100)}%`);text('sensitivity-output',`${Number(this.settings.sensitivity).toFixed(2)}×`);
  document.querySelectorAll('[data-graphics]').forEach(button=>{const selected=button.dataset.graphics===this.settings.graphics;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});
 }
 changeSettings(next){Object.assign(this.settings,next);this.config.settings={...this.settings};this.syncSettings();try{localStorage.setItem('vgs-settings',JSON.stringify(this.settings));}catch{}this.options.onSettings?.({...this.settings});}
 launch(restart=false){if(!this.isReady)return;this.config.settings={...this.settings};const callback=restart?(this.options.onRestart||this.options.onStart):this.options.onStart;try{const result=callback?.({...this.config,mode:'tdm',attachments:{...this.config.attachments},settings:{...this.settings}});result?.catch?.(error=>this.showError(error));}catch(error){this.showError(error);}}
 async ready(){
  const images=[...$('main-menu').querySelectorAll('img[src]')];
  await Promise.allSettled(images.map(image=>image.decode()));
  if(!$('fatal-error').hidden)return;
  this.isReady=true;document.body.classList.add('ready');$('deploy-button').disabled=false;
 }
 setLoading(message){text('loading-text',message);}
 beginIntro(config={}){
  this.endIntro();const team=Number.isInteger(config.team)?config.team:this.config.team;this.introMounted=true;this.introActive=true;this.introBeat=null;$('match-intro').hidden=false;$('match-intro').classList.remove('is-exiting');
  $('intro-yellow-crest').innerHTML=teamLogoSVG(0);$('intro-independent-crest').innerHTML=teamLogoSVG(1);$('intro-crews').dataset.playerTeam=team;$('intro-crews').setAttribute('aria-label',`${FACTIONS[0].name} against ${FACTIONS[1].name}`);$('scoreboard-panel').hidden=true;
  this.updateIntro({active:true,beat:3,progress:0});
 }
 updateIntro({active=true,beat=3,progress=0,exiting=false}={}){
  if(!this.introMounted)return;exiting=Boolean(exiting)||beat==='GO';if(!active&&!exiting){this.endIntro();return;}
  this.introActive=!exiting&&Boolean(active);document.body.classList.toggle('is-intro',this.introActive);$('match-intro').classList.toggle('is-exiting',exiting);$('match-intro').style.setProperty('--intro-progress',String(clamp(progress)));
  const next=exiting?'GO':String(Math.max(1,Math.min(3,Number(beat)||3)));if(this.introBeat!==next){this.introBeat=next;const numeral=node('span','intro-number',next);numeral.dataset.echo=next;$('intro-count').replaceChildren(numeral);$('match-intro').setAttribute('aria-label',exiting?'Go':`Match starts in ${next}`);}
  this.setPointerLocked(this.pointerLocked);
 }
 endIntro(){this.introMounted=false;this.introActive=false;this.introBeat=null;document.body.classList.remove('is-intro');$('match-intro').hidden=true;$('match-intro').classList.remove('is-exiting');this.setPointerLocked(this.pointerLocked);}
 setScreen(value){this.screen=value;document.body.dataset.screen=value;}
 setSettingsInert(active){for(const panel of [$('pause-panel'),$('main-menu'),document.querySelector('.menu-brand')])if(panel)panel.inert=active;}
 hidePanels(){for(const id of ['pause-panel','settings-panel','scoreboard-panel','results-panel'])$(id).hidden=true;this.setSettingsInert(false);}
 beginMatch(config={}){
  this.endIntro();this.clearElimination();
  this.config={...this.config,...config,mode:'tdm',settings:{...this.settings}};this.setScreen('playing');this.hidePanels();this.clearFeed();this.lastKillRecap=null;this.killerSignature='';this.avatarSignature='';this.scoreboardSignature='';this.setDead(false);this.setTaunting(false);
  for(const id of ['respawn-panel','hit-marker','hit-confirmation','damage-vignette','announcement','pointer-resume','interaction-hud','spawn-protection','scope-overlay'])$(id).classList.remove('show','active');
 }
 showMenu(){this.setScreen('menu');this.endIntro();this.clearElimination();this.hidePanels();this.clearFeed();this.setDead(false);this.setTaunting(false);$('pointer-resume').classList.remove('show');this.syncConfig();}
 returnToMenu(){if(this.options.onMenu)this.options.onMenu();else this.showMenu();}
 showPause(){if(this.screen==='menu'||this.screen==='results')return;this.setScreen('paused');$('scoreboard-panel').hidden=true;$('pause-panel').hidden=false;$('pointer-resume').classList.remove('show');$('resume-button').focus({preventScroll:true});}
 hidePause(){this.setScreen('playing');$('pause-panel').hidden=true;$('settings-panel').hidden=true;this.setSettingsInert(false);this.setPointerLocked(this.pointerLocked);}
 openSettings(trigger){if(this.screen==='playing')this.options.onPauseChange?.(true);this.settingsReturnFocus=trigger||document.activeElement;this.setSettingsInert(true);$('settings-panel').hidden=false;$('close-settings').focus({preventScroll:true});}
 closeSettings(){$('settings-panel').hidden=true;this.setSettingsInert(false);this.settingsReturnFocus?.focus?.({preventScroll:true});}
 setPointerLocked(value){this.pointerLocked=Boolean(value);document.body.classList.toggle('pointer-locked',this.pointerLocked);$('pointer-resume').classList.toggle('show',!this.pointerLocked&&!this.introActive&&this.screen==='playing');}
 setScoped(value){this.scoped=Boolean(value)&&!this.dead&&!this.taunting&&this.screen==='playing';$('scope-overlay').classList.toggle('show',this.scoped);$('crosshair').classList.toggle('hidden',this.scoped||this.dead||this.taunting);}
 setTaunting(value){this.taunting=Boolean(value)&&!this.dead;document.body.classList.toggle('is-taunting',this.taunting);if(this.taunting){this.scoped=false;$('scope-overlay').classList.remove('show');$('crosshair').classList.add('hidden');}else $('crosshair').classList.toggle('hidden',this.scoped||this.dead);}
 setDead(value){
  const wasDead=this.dead;this.dead=Boolean(value);document.body.classList.toggle('is-dead',this.dead);
  if(this.dead&&!wasDead)this.clearElimination();
  if(this.dead){this.setTaunting(false);for(const id of ['hit-marker','hit-confirmation','damage-vignette','announcement','pointer-resume','interaction-hud','spawn-protection','scope-overlay'])$(id).classList.remove('show','active');$('crosshair').classList.add('hidden');$('crosshair').classList.remove('aiming');$('reload-state').classList.remove('reloading');this.scoped=false;this.setPointerLocked(this.pointerLocked);}
  else if(wasDead)this.setPointerLocked(this.pointerLocked);
 }
 renderAbilities(){
  const parent=$('utility-hud');parent.replaceChildren();
  for(const ability of ABILITIES){const el=node('div','ability');el.dataset.ability=ability.id;el.setAttribute('role','img');el.innerHTML=`<kbd>${ability.key}</kbd><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ability.path}"/></svg><b class="ability-charge">1</b><span>${ability.name}</span><small class="ability-state"></small>`;parent.append(el);}
 }
 update(state={}){
  this.state=state;const p=state.player||{},team=Number.isInteger(p.team)?p.team:this.config.team,enemy=1-team,health=Math.max(0,Number(p.health)||0),maxHealth=Math.max(1,Number(p.maxHealth)||150),displayHealth=Math.ceil(clamp(health/maxHealth)*100),alive=p.alive!==false;
  this.setDead(!alive);
  const weapon=typeof p.weapon==='object'?p.weapon:{id:p.weapon||p.weaponId},w=this.catalog[weapon.id]||this.catalog[this.config.weapon]||{};
  text('friendly-team-name',FACTIONS[team].shortName);text('enemy-team-name',FACTIONS[enemy].shortName);text('friendly-score',state.scores?.[team]||0);text('enemy-score',state.scores?.[enemy]||0);text('match-timer',clock(state.timeRemaining));text('score-target',`FIRST TO ${state.scoreLimit||20}`);
  if(this.crestTeam!==team){this.crestTeam=team;$('friendly-team-crest').innerHTML=teamLogoSVG(team);$('enemy-team-crest').innerHTML=teamLogoSVG(enemy);}
  document.querySelector('.score-ribbon').classList.toggle('closing',Number(state.timeRemaining)<30);
  text('health-value',displayHealth);$('health-fill').style.width=`${clamp(health/maxHealth)*100}%`;const healthTrack=document.querySelector('.health-track');healthTrack.setAttribute('aria-valuenow',String(displayHealth));healthTrack.setAttribute('aria-valuemax','100');healthTrack.setAttribute('aria-valuetext',`${displayHealth} of 100 health`);document.querySelector('.health-panel').classList.toggle('low',health<=maxHealth*.3&&alive);
  $('armor-fill').style.width=`${clamp(p.armor||0,0,100)}%`;$('stamina-fill').style.width=`${clamp(p.stamina??100,0,100)}%`;
  const identity=this.identity({...p,team}),avatarKey=`${team}-${identity.role}`;
  if(this.avatarSignature!==avatarKey){this.avatarSignature=avatarKey;$('player-avatar').replaceChildren(portrait(team,identity.role,identity.shortName));text('player-name',identity.shortName);$('player-name').title=identity.name;$('spray-hud-image').src=tagDataURI(identity,'compact');}
  text('hud-weapon-name',weapon.name||w.name||'');if(this.weaponIcon!==weapon.id){this.weaponIcon=weapon.id;$('hud-weapon-icon').innerHTML=weaponSVG(weapon.id);}
  const ammo=Number(weapon.ammo??p.ammo??0);text('ammo-current',ammo);text('ammo-reserve',weapon.reserve??p.reserve??0);document.querySelector('.weapon-panel').classList.toggle('low-ammo',ammo<=Math.max(2,(w.magSize||28)*.2));
  const carried=p.carriedWeapons||[this.config.weapon,'pistol'],slotSignature=JSON.stringify([carried,weapon.id]);
  if(slotSignature!==this.slotSignature){this.slotSignature=slotSignature;const slots=$('weapon-slots');slots.replaceChildren();carried.forEach((id,index)=>{const button=node('button',`weapon-slot ${id===weapon.id?'active':''}`);button.type='button';button.dataset.weapon=id;button.setAttribute('aria-label',`${index+1}: ${this.catalog[id]?.name||id}`);button.setAttribute('aria-pressed',String(id===weapon.id));button.innerHTML=`<b>${index+1}</b>${weaponSVG(id)}`;slots.append(button);});}
  const reloading=Boolean(weapon.reloading)&&alive;$('reload-state').classList.toggle('reloading',reloading);text('reload-label',reloading?'Reloading…':'Reload');$('reload-fill').style.width=`${clamp(weapon.reloadProgress)*100}%`;
  this.setScoped(Boolean(state.scoped)&&alive);$('crosshair').classList.toggle('aiming',Boolean(state.ads));$('crosshair').style.setProperty('--spread',`${clamp(state.spread??(state.ads?3:6),1.5,24)}px`);$('crosshair').dataset.target=alive&&['friendly','enemy'].includes(state.aimTarget)?state.aimTarget:'';
  $('spawn-protection').classList.toggle('show',Boolean(state.protected??p.protected)&&alive);
  const utility=p.utility||{},cooldowns=p.utilityCooldowns||state.utilityCooldowns||{};
  for(const ability of ABILITIES){const el=document.querySelector(`[data-ability="${ability.id}"]`),count=Math.max(0,Number(utility[ability.id])||0),cooldown=Math.max(0,Number(cooldowns[ability.id])||0);el.classList.toggle('empty',count===0);el.classList.toggle('cooling',cooldown>0);el.querySelector('.ability-charge').textContent=String(count);el.querySelector('.ability-state').textContent=cooldown>0?`${Math.ceil(cooldown)}s`:count===0?'USED':'';el.setAttribute('aria-label',`${ability.key}: ${ability.name}, ${count} charge${count===1?'':'s'}${cooldown?`, ready in ${Math.ceil(cooldown)} seconds`:''}`);}
  const healing=alive&&Number.isFinite(state.healing);$('interaction-hud').classList.toggle('show',healing);if(healing){text('interaction-label','Healing — hold H');$('interaction-fill').style.width=`${clamp(state.healing)*100}%`;}
  const sprayReadyIn=Math.max(0,Number(state.spray?.readyIn)||0),canSpray=alive&&sprayReadyIn===0&&state.spray?.canPlace===true;text('spray-status',sprayReadyIn>0?`${Math.ceil(sprayReadyIn)}s`:'Spray');$('spray-hud').classList.toggle('cooling',sprayReadyIn>0);$('spray-hud').classList.toggle('can-place',canSpray);$('spray-hud').setAttribute('aria-label',sprayReadyIn>0?`Art tag ready in ${Math.ceil(sprayReadyIn)} seconds`:canSpray?'T: spray your art tag here':'T: aim at a nearby wall to spray your art tag');
  const taunt=state.taunt||{},tauntActive=alive&&Boolean(taunt.active),tauntReadyIn=Math.max(0,Number(taunt.readyIn)||0),tauntName=taunt.name||getArtistTaunt(identity).name;
  this.setTaunting(tauntActive);
  text('taunt-status',tauntActive?'Cancel':tauntReadyIn>0?`${Math.ceil(tauntReadyIn)}s`:'Taunt');$('taunt-hud').classList.toggle('active',tauntActive);$('taunt-hud').classList.toggle('unavailable',!tauntActive&&(!alive||taunt.available===false||tauntReadyIn>0));$('taunt-hud').setAttribute('aria-label',tauntActive?`J: cancel ${tauntName}`:tauntReadyIn>0?`${tauntName} ready in ${Math.ceil(tauntReadyIn)} seconds`:`J: ${tauntName}`);$('taunt-hud').title=tauntActive?`J: cancel ${tauntName}`:tauntName;
  $('respawn-panel').classList.toggle('show',!alive&&this.screen==='playing');
  if(!alive){text('respawn-timer',Math.max(1,Math.ceil((Number(state.respawnIn)||0)-1e-6)));const killer=(state.actors||[]).find(a=>a.id===p.lastAttacker);this.renderKiller(killer,this.lastKillRecap);}
  if(!$('scoreboard-panel').hidden)this.renderScoreboard();
 }
 findActor(name,team,id){const actors=this.state.actors||[];return actors.find(a=>(id!==undefined&&a.id===id)||(a.team===team&&(a.name===name||a.artistName===name||a.identity?.name===name||(name==='You'&&a.isPlayer))));}
 addKill(event={}){
  const own=this.state.player?.team??this.config.team,killerTeam=event.team??1-own,victimTeam=event.victimTeam??1-killerTeam,killer=this.findActor(event.killer,killerTeam,event.killerId),victim=this.findActor(event.victim,victimTeam,event.victimId);
  const ka=killer?this.identity(killer):event.killerRole?this.artist(killerTeam,event.killerRole):null,va=victim?this.identity(victim):event.victimRole?this.artist(victimTeam,event.victimRole):null,row=node('div',`kill-entry ${killer?.isPlayer?'your-kill':''}`);
  const left=node('span',killerTeam===own?'friendly':'enemy');left.append(portrait(killerTeam,ka?.role,ka?.shortName||event.killer),node('b','',ka?.shortName||event.killer||'Paint'));
  const right=node('span',victimTeam===own?'friendly':'enemy');right.append(portrait(victimTeam,va?.role,va?.shortName||event.victim),node('b','',va?.shortName||event.victim||'Artist'));
  const icon=node('i','kill-weapon'),source=event.weaponId??event.kind??event.weapon,weapon=this.weapons.find(w=>w.id===source||w.name===source),iconId=weapon?.id||({paint:'frag',canister:'frag'}[source])||source||'unknown',label=weapon?`${weapon.name} · ${WEAPON_CLASS[weapon.id]||weapon.class}`:(COMBAT_ICONS[iconId]||COMBAT_ICONS.unknown).label;
  icon.innerHTML=combatSVG(iconId);icon.dataset.weapon=iconId;icon.title=label;icon.setAttribute('role','img');icon.setAttribute('aria-label',label);row.append(left,icon,right);$('kill-feed').prepend(row);this.killFeed.unshift(row);while(this.killFeed.length>3)this.killFeed.pop().remove();
  const key=Symbol('feed');this.timed(key,4500,()=>{row.remove();this.killFeed=this.killFeed.filter(item=>item!==row);});
 }
 clearFeed(){this.killFeed=[];$('kill-feed').replaceChildren();}
 timed(key,duration,callback){clearTimeout(this.timers.get(key));this.timers.set(key,setTimeout(()=>{this.timers.delete(key);callback();},duration));}
 showHit({headshot=false,killed=false}={}){
  if(this.dead)return;
  $('hit-marker').classList.toggle('kill',killed);$('hit-marker').classList.add('active');this.timed('hit',killed?250:140,()=>$('hit-marker').classList.remove('active'));
  const cue=$('hit-confirmation');
  // Damage resolution already supplied the victim and medal; preserve it when
  // the weapon's hit-marker callback arrives immediately afterward.
  if(killed){if(!this.eliminationNotice||performance.now()-this.eliminationNotice.time>200)this.showElimination({headshot});return;}
  if(headshot&&!cue.classList.contains('frag-confirmation')){cue.replaceChildren(node('b','','◆'),node('span','','HEADSHOT'));cue.classList.add('active');this.timed('confirmation',450,()=>this.clearElimination());}
 }
 clearElimination(){
  clearTimeout(this.timers.get('confirmation'));this.timers.delete('confirmation');this.eliminationNotice=null;
  const cue=$('hit-confirmation');cue.classList.remove('active','frag-confirmation','is-multi','is-headshot');cue.replaceChildren();cue.removeAttribute('data-multi');
 }
 showElimination({victim='',portrait:portraitPath='',healthGain=0,healthMax=this.state.player?.maxHealth||150,streak=1,multi=1,headshot=false}={}){
  if(this.dead||this.screen!=='playing')return;
  this.eliminationNotice={victim,portrait:portraitPath,healthGain,healthMax,streak,multi,headshot,time:performance.now()};
  const cue=$('hit-confirmation'),count=Math.max(1,Math.floor(Number(multi)||1)),card=node('div','frag-card'),seal=node('div','frag-seal'),details=node('div','frag-details');
  cue.classList.add('active','frag-confirmation');cue.classList.toggle('is-multi',count>1);cue.classList.toggle('is-headshot',Boolean(headshot));cue.dataset.multi=String(Math.min(count,6));
  seal.innerHTML='<svg viewBox="0 0 80 80" aria-hidden="true"><path class="frag-paint" d="m40 3 7 10 13-6 1 15 15 2-8 13 9 11-14 5 1 15-15-3-8 12-9-11-14 6-2-15-15-3 9-12-8-11 14-5 1-15 13 4Z"/><path class="frag-rim" d="M23 18c16-11 36 1 38 17 4 17-9 29-23 28-14 0-26-12-24-27m5-8 2-4m44 18-2 7"/></svg>';
  seal.append(node('b','frag-point','+1'));
  if(headshot){const accent=node('i','frag-headshot');accent.title='Headshot';accent.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/></svg>';seal.append(accent);}
  const label=count>1?(count===2?'DOUBLE':count===3?'TRIPLE':`${count}× COMBO`):headshot?'HEADSHOT':'';
  if(label)details.append(node('span','frag-label',label));
  const identity=node('div','frag-identity');
  if(victim){const face=node('span','frag-face');face.append(node('span','frag-initial',String(victim).slice(0,1)));if(portraitPath){const image=document.createElement('img');image.src=String(portraitPath);image.alt='';image.draggable=false;image.addEventListener('load',()=>face.classList.add('has-image'),{once:true});image.addEventListener('error',()=>image.remove(),{once:true});face.append(image);}identity.append(face,node('b','frag-name',victim));}
  else identity.append(node('b','frag-name','NICE SHOT'));
  details.append(identity);
  const displayGain=Math.round(clamp(healthGain/Math.max(1,Number(healthMax)||150))*100);
  if(displayGain>0){const heal=node('small','frag-heal',`+${displayGain} HP`);details.append(heal);}
  card.append(seal,details);
  const flecks=node('div','frag-flecks');flecks.setAttribute('aria-hidden','true');
  // A fixed handful of paint marks, discarded with the one confirmation card.
  for(let i=0;i<8;i++){const fleck=node('i');fleck.style.setProperty('--i',i);flecks.append(fleck);}
  cue.replaceChildren(flecks,card);this.timed('confirmation',count>1?1680:1420,()=>this.clearElimination());
 }
 showDamage(direction=0){if(this.dead)return;$('damage-vignette').style.setProperty('--damage-angle',`${direction*180/Math.PI}deg`);$('damage-vignette').classList.add('active');this.timed('damage',200,()=>$('damage-vignette').classList.remove('active'));}
 announce(title,subtitle='',duration=1800){if(this.dead||this.state.player?.alive===false)return;text('announcement',title);$('announcement').classList.add('show');this.timed('announcement',Math.min(duration,2000),()=>$('announcement').classList.remove('show'));}
 showToast(message,duration=1700){text('toast',message);$('toast').classList.add('show');this.timed('toast',duration,()=>$('toast').classList.remove('show'));}
 showKillRecap(recap={}){this.setDead(true);this.lastKillRecap=recap;const killer=(this.state.actors||[]).find(a=>a.artistName===recap.killer||a.name===recap.killer);this.renderKiller(killer,recap);}
 showSprayFeedback(result){
  if(this.dead)return;const success=result===true||result?.success===true||result?.ok===true||Boolean(result?.id&&result?.svg);
  if(!success){const message=typeof result==='string'?result:result?.message;this.showToast(message||'Aim at a wall',900);return;}
  $('toast').classList.remove('show');const icon=$('spray-hud');icon.classList.add('sprayed');this.timed('spray-pulse',700,()=>icon.classList.remove('sprayed'));
 }
 renderKiller(killer,recap){const identity=killer?this.identity(killer):null,name=identity?.shortName||recap?.killer||'an opponent',signature=`${killer?.team}-${identity?.role}-${name}`;if(signature===this.killerSignature)return;this.killerSignature=signature;text('killer-name',name);$('killer-avatar').replaceChildren(portrait(killer?.team,identity?.role,name));}
 showScoreboard(show){$('scoreboard-panel').hidden=!(show&&!this.introActive&&this.screen==='playing');if(!$('scoreboard-panel').hidden)this.renderScoreboard();}
 renderScoreboard(){
  const actors=this.state.actors||[],own=this.state.player?.team??this.config.team,signature=JSON.stringify([own,this.state.scores,actors.map(a=>[a.id,a.role,a.kills,a.deaths,a.alive])]);if(signature===this.scoreboardSignature)return;this.scoreboardSignature=signature;
  const parent=$('scoreboard-teams');parent.replaceChildren();
  for(const team of [own,1-own]){const section=node('section',`scoreboard-team ${team===own?'friendly':'enemy'}`),header=node('header');header.append(crest(team),node('b','',`${team===own?'YOUR CREW':'ENEMY'} · ${FACTIONS[team].shortName}`),node('strong','',this.state.scores?.[team]||0));section.append(header);
   const table=node('table','score-table'),thead=node('thead'),tr=node('tr');for(const label of ['ARTIST','ELIMS','DEATHS'])tr.append(node('th','',label));thead.append(tr);table.append(thead);const tbody=node('tbody');
   actors.filter(a=>a.team===team).sort((a,b)=>(b.kills||0)-(a.kills||0)||(a.deaths||0)-(b.deaths||0)).forEach(actor=>{const identity=this.identity(actor),row=node('tr',`${actor.isPlayer?'you':''} ${actor.alive===false?'dead':''}`),name=node('td'),label=node('span','',identity.shortName);name.append(portrait(team,identity.role,identity.shortName),label);if(actor.isPlayer)label.append(node('small','','YOU'));row.append(name,node('td','tags',actor.kills||0),node('td','',actor.deaths||0));tbody.append(row);});table.append(tbody);section.append(table);parent.append(section);
  }
 }
 showResults(result={}){
  this.endIntro();this.clearElimination();
  this.setScreen('results');this.hidePanels();$('results-panel').hidden=false;const player=result.player||this.state.player||{},own=result.playerTeam??player.team??this.config.team,enemy=1-own,winner=result.winner,identity=this.identity({...player,team:own});
  text('result-title',winner===null||winner===undefined?'A perfect tie.':winner===own?'Your crew wins.':'Your crew loses.');document.querySelector('.results-card').classList.toggle('defeat',winner!==null&&winner!==undefined&&winner!==own);
  $('result-friendly-crest').innerHTML=teamLogoSVG(own);$('result-enemy-crest').innerHTML=teamLogoSVG(enemy);
  text('result-friendly-name',FACTIONS[own].shortName);text('result-enemy-name',FACTIONS[enemy].shortName);text('result-friendly-score',result.scores?.[own]??0);text('result-enemy-score',result.scores?.[enemy]??0);text('result-artist',identity.shortName);text('result-performance',`${player.kills||0} elimination${player.kills===1?'':'s'} · ${player.deaths||0} death${player.deaths===1?'':'s'}`);$('result-avatar').replaceChildren(portrait(own,identity.role,identity.shortName));$('pointer-resume').classList.remove('show');$('rematch-button').focus({preventScroll:true});
 }
 showError(error){document.body.classList.add('ready');$('fatal-error').hidden=false;text('fatal-error-message',error?.message||String(error));console.error(error);}
 // Retained for older gameplay call sites; Paint Clash has no staging or orders.
 showBuy(){} radio(){} renderRoundHistory(){} renderObjectives(){}
 destroy(){this.artistInspector?.dispose();this.endIntro();this.clearElimination();this.listeners.forEach(([target,event,handler])=>target?.removeEventListener(event,handler));this.timers.forEach(clearTimeout);this.listeners=[];this.timers.clear();}
}
