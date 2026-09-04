import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { BotDirector } from '../src/bots.js';
import { TacticalRules } from '../src/tactical.js';

function actor(id, team, x = 0, z = 0, isPlayer = false) {
  return {
    id, team, isPlayer, position: new Vector3(x, 0, z), velocity: new Vector3(),
    health: 100, alive: true, weaponId: 'rifle', ammo: 28, reserve: 140,
    reloadUntil: 0, nextShotAt: 0, yaw: 0, pitch: 0, grounded: true,
  };
}

function fixture(actors, mode = 'tdm') {
  const facts = { clear: true, shots: [], paths: [], movement: 0, immobile: false };
  const physics = {
    nearestWalkable: point => point.clone().setY(0),
    lineOfSight: () => facts.clear,
    findPath: (start, end) => { facts.paths.push([start.clone(), end.clone()]); return [end.clone()]; },
    move: (bot, velocity, dt) => {
      facts.movement++;
      if (!facts.immobile) bot.position.addScaledVector(velocity, dt);
    },
  };
  const game = {
    actors, mode, time: 0, objectives: [],
    botWaypoints: [new Vector3(0, 0, -20), new Vector3(20, 0, 0)],
    requestFire(bot, direction) {
      assert.equal(facts.clear, true, 'a shot requires a fresh unobstructed sightline');
      facts.shots.push({ time: game.time, id: bot.id, direction: direction.clone() });
      bot.ammo--; bot.nextShotAt = game.time + 0.118;
      return true;
    },
    requestReload(bot) { if (bot.reloadUntil <= game.time) bot.reloadUntil = game.time + 2.2; },
  };
  const director = new BotDirector(physics);
  function advance(seconds) {
    for (let t = 0; t < seconds - 0.001; t += 0.05) {
      game.time += 0.05;
      director.update(0.05, game);
    }
  }
  return { facts, game, director, advance };
}

test('perception has reaction delay and every shot checks current wall occlusion', () => {
  const f = fixture([actor('blue-1', 0), actor('human', 1, 0, -14, true)]);
  f.advance(0.2);
  assert.equal(f.facts.shots.length, 0, 'newly spotted targets are not shot instantly');
  f.advance(1.8);
  assert.ok(f.facts.shots.length > 0, 'a clearly visible opponent is engaged');
  const shotsBeforeWall = f.facts.shots.length;
  f.facts.clear = false;
  f.advance(1.5);
  assert.equal(f.facts.shots.length, shotsBeforeWall, 'no cached-visibility shots penetrate cover');
  assert.equal(f.game.actors[0].botState.intent, 'search last sighting');
});

test('control-point bots navigate toward objectives through the shared movement API', () => {
  const f = fixture([actor('blue-1', 0, -10, 5), actor('blue-2', 0, -12, 5)], 'control');
  f.facts.clear = false;
  f.game.objectives = [
    { id: 'cafe', position: new Vector3(3, 0, 0), owner: null, radius: 5 },
    { id: 'rhone', position: new Vector3(17, 0, 0), owner: null, radius: 5 },
  ];
  const before = f.game.actors.map(bot => bot.position.clone());
  f.advance(2);
  assert.ok(f.facts.paths.length >= 2);
  assert.equal(f.facts.movement, 80, 'both living bots move each simulation frame');
  for (let i = 0; i < f.game.actors.length; i++) {
    const bot = f.game.actors[i];
    assert.ok(bot.position.distanceTo(before[i]) > 4, 'bot advances toward its assigned zone');
    assert.ok(['cafe', 'rhone'].includes(bot.botState.objectiveId));
  }
});

test('blocked bots retry navigation without teleporting through obstacles', () => {
  const bot = actor('blue-1', 0);
  const f = fixture([bot]);
  f.facts.clear = false;
  f.facts.immobile = true;
  const start = bot.position.clone();
  f.advance(6);
  assert.ok(bot.botState.recoveries >= 1, 'prolonged lack of progress triggers recovery');
  assert.ok(f.facts.paths.length >= 3, 'recovery reuses navigation');
  assert.deepEqual(bot.position, start, 'AI does not bypass physics by relocating the actor');
});

test('death and respawn clear prior targets and apply a new reaction delay', () => {
  const bot = actor('blue-1', 0);
  const f = fixture([bot, actor('human', 1, 0, -12, true)]);
  f.advance(1.5);
  bot.alive = false; bot.health = 0;
  const shotsBeforeDeath = f.facts.shots.length;
  f.advance(1);
  assert.equal(bot.botState.intent, 'eliminated');
  assert.equal(f.facts.shots.length, shotsBeforeDeath);
  bot.position.set(0, 0, 0); bot.alive = true; bot.health = 100;
  f.advance(0.2);
  assert.equal(f.facts.shots.length, shotsBeforeDeath, 'respawns do not retain a settled aim');
});

test('short-range weapons close distance without wasting ammunition beyond reach', () => {
  const bot = actor('blue-1', 0);
  bot.weaponId = 'shotgun'; bot.ammo = 6;
  const f = fixture([bot, actor('human', 1, 0, -45, true)]);
  f.advance(2);
  assert.equal(f.facts.shots.length, 0);
  assert.equal(bot.ammo, 6);
  assert.ok(bot.position.z < -2, 'the bot keeps advancing toward useful shotgun range');
});

test('game LOS owns smoke occlusion, including a smoke bloom between perception ticks', () => {
  const bot=actor(0,0),enemy=actor(6,1,0,-15,true);
  const f=fixture([bot,enemy]);let smoke=false;
  f.game.getLOS=()=>!smoke;
  f.advance(1.5);assert.ok(f.facts.shots.length>0);
  const count=f.facts.shots.length;smoke=true;
  f.advance(.05);
  assert.equal(f.facts.shots.length,count,'a live smoke check overrides cached visibility');
  f.advance(2);assert.equal(f.facts.shots.length,count);
  smoke=false;f.advance(2);assert.ok(f.facts.shots.length>count);
});

test('six persistent roles receive separate town sectors, with only two contact responders', () => {
  const roles=['vanguard','flanker','anchor','marksman','support','scout'];
  const crew=roles.map((role,i)=>Object.assign(actor(i,0,-8+i,10),{role}));
  const f=fixture(crew);f.facts.clear=false;f.advance(.5);
  assert.equal(new Set(crew.map(a=>a.botState.role)).size,6);
  assert.equal(new Set(crew.map(a=>a.botState.sector)).size,6);
  f.director.intel.set(0,{position:new Vector3(-8,0,-8),at:f.game.time,targetId:99});
  f.advance(1.5);
  assert.equal(f.director.teams.get(0).responders.size,2);
  assert.ok(crew.filter(a=>a.botState.responding).length<=2);
  f.advance(6);
  assert.equal(f.director.teams.get(0).responders.size,0,'sightings expire without fresh observation');
  assert.deepEqual(crew.map(a=>a.botState.role),roles);
  f.director.reset({preserveRoles:true});f.advance(.4);
  assert.deepEqual(crew.map(a=>a.botState.role),roles,'round resets retain authored roles');
});

test('occluded enemies do not update last seen positions or create omniscient goals', () => {
  const bot=actor(0,0),enemy=actor(6,1,0,-14,true),f=fixture([bot,enemy]);
  f.advance(1);const remembered=f.director.states.get(bot.id).lastSeen.clone();
  f.facts.clear=false;enemy.position.set(83,0,16);f.advance(1);
  assert.deepEqual(f.director.states.get(bot.id).lastSeen,remembered);
  assert.ok(!f.facts.paths.some(([,end])=>end.distanceTo(enemy.position)<3),'hidden relocation is not a navigation destination');
});

test('staging holds the crew without perception, gunfire or navigation', () => {
  const bot=Object.assign(actor(0,0),{role:'vanguard'}),f=fixture([bot,actor(6,1,0,-5,true)],'tactical');
  const before=bot.position.clone();f.game.tactical={stage:'staging',attackingTeam:0,sites:[],carrierId:0};
  f.advance(3);
  assert.equal(f.facts.shots.length,0);assert.equal(f.facts.paths.length,0);
  assert.deepEqual(bot.position,before);assert.equal(bot.botState.intent,'prepare exhibition');
});

function tacticalFixture({remove=false,smoke=false}={}) {
  const attacker=Object.assign(actor(0,0,0,0,remove),{role:'vanguard'});
  const defender=Object.assign(actor(6,1,remove?7:80,0,!remove),{role:'support'});
  const f=fixture([attacker,defender],'tactical'),sites=[{id:'A',name:'Test site',position:new Vector3(),radius:3.5},{id:'B',name:'Other site',position:new Vector3(35,0,0),radius:3.5}];
  const rules=new TacticalRules({carrierId:0});rules.update(0,f.game.actors,sites);rules.ready();rules.update(0,f.game.actors,sites);
  if(remove){rules.interact(attacker,4,{active:true,nearSite:'A'});assert.equal(rules.beaconState,'planted');}
  const positions=[],interactions=[];f.game.getLOS=(a,b)=>!smoke&&a.distanceTo(b)<5;
  Object.defineProperty(f.game,'tactical',{get:()=>({stage:rules.phase,attackingTeam:rules.attackingTeam,sites,site:sites.find(s=>s.id===rules.plantedSiteId)||sites[0],planted:rules.beaconState==='planted',carrierId:rules.carrierId,devicePosition:rules.devicePosition,beaconState:rules.beaconState})});
  f.game.requestInteract=(a,dt)=>{interactions.push({id:a.id,position:a.position.clone(),velocity:a.velocity.clone()});const site=sites.find(s=>a.position.distanceTo(s.position)<s.radius);return rules.interact(a,dt,{active:true,nearSite:site?.id});};
  const advance=seconds=>{for(let i=0;i<seconds/.05;i++){f.game.time+=.05;f.director.update(.05,f.game);rules.update(.05,f.game.actors,sites);positions.push((remove?defender:attacker).position.clone());if(rules.phase==='roundEnd'||rules.phase==='ended')break;}};
  return{...f,attacker,defender,rules,positions,interactions,advance};
}

test('carrier completes a real four-second plant while remaining stationary', () => {
  const f=tacticalFixture();f.advance(4.5);
  assert.equal(f.rules.beaconState,'planted');assert.ok(f.interactions.length>=80);
  assert.ok(f.interactions.every(s=>s.position.distanceTo(f.interactions[0].position)<.01));
  assert.ok(f.interactions.every(s=>Math.hypot(s.velocity.x,s.velocity.z)<.2));
});

test('one defender approaches and completes a real six-second removal', () => {
  const f=tacticalFixture({remove:true});f.advance(12);
  assert.equal(f.rules.beaconState,'removed');assert.equal(f.rules.roundReason,'beacon-removed');
  assert.deepEqual([...new Set(f.interactions.map(i=>i.id))],[6]);
  assert.ok(f.interactions.every(s=>s.position.distanceTo(f.interactions[0].position)<.01),'remover does not strafe during hold');
});

test('an obstructed site cannot be planted by proximity alone', () => {
  const f=tacticalFixture({smoke:true});f.advance(5);
  assert.equal(f.rules.beaconState,'carried');assert.equal(f.interactions.length,0);
});

test('dropped beacon has a single designated recoverer instead of a crew pile-up', () => {
  const roles=['vanguard','flanker','anchor','marksman','support','scout'];
  const crew=roles.map((role,i)=>Object.assign(actor(i,0,i*4,0),{role}));
  const f=fixture(crew,'tactical');f.facts.clear=false;
  const site={id:'A',position:new Vector3(20,0,-20),radius:4};
  f.game.tactical={stage:'playing',attackingTeam:0,site,sites:[site],planted:false,carrierId:null,devicePosition:{x:2,y:0,z:0},beaconState:'dropped'};
  f.advance(.5);
  assert.equal(crew.filter(a=>a.botState.intent==='recover beacon').length,1);
  assert.equal(f.director.teams.get(0).recovererId,0);
});

test('tactical squad commands preserve spaced individual positions', () => {
  const crew=['vanguard','flanker','anchor','marksman','support','scout'].map((role,i)=>Object.assign(actor(i,0,i*4,0),{role}));
  const f=fixture(crew,'tactical');f.facts.clear=false;
  const site={id:'A',position:new Vector3(20,0,-20),radius:4};
  f.game.tactical={stage:'playing',attackingTeam:1,site,sites:[site],planted:false,carrierId:7,beaconState:'carried'};
  f.game.squadOrder={id:'regroup',team:0,position:new Vector3(25,0,25),expiresAt:20};f.advance(.5);
  const goals=crew.map(a=>f.director.states.get(a.id).goal);
  assert.ok(crew.every(a=>a.botState.intent==='regroup in formation'));
  assert.equal(new Set(goals.map(p=>`${p.x.toFixed(1)}:${p.z.toFixed(1)}`)).size,6);
  assert.ok(goals.every(p=>p.distanceTo(f.game.squadOrder.position)>=3.9));
});

test('a carrier follows a marked alternative site instead of the original assignment', () => {
  const carrier=Object.assign(actor(0,0),{role:'vanguard'}),f=fixture([carrier],'tactical');f.facts.clear=false;
  const sites=[{id:'A',position:new Vector3(8,0,0),radius:4},{id:'B',position:new Vector3(30,0,0),radius:4}];
  f.game.tactical={stage:'playing',attackingTeam:0,site:sites[0],sites,carrierId:0,beaconState:'carried'};
  f.advance(.5);assert.equal(carrier.botState.objectiveId,'A');
  f.game.squadOrder={id:'attack',team:0,position:sites[1].position.clone(),expiresAt:20};f.advance(.5);
  assert.equal(carrier.botState.objectiveId,'B');
  assert.ok(f.director.states.get(0).goal.distanceTo(sites[1].position)<2);
});

test('friendly bodies block bot firing and trigger a different firing angle', () => {
  const shooter=Object.assign(actor(0,0),{role:'marksman'}),friend=actor(1,0,0,-5,true),enemy=actor(6,1,0,-15,true);
  const f=fixture([shooter,friend,enemy]);f.facts.immobile=true;
  f.advance(2);assert.equal(f.facts.shots.length,0);
  assert.ok(f.director.states.get(0).friendBlockedUntil>f.game.time);
  friend.position.x=5;f.advance(1);assert.ok(f.facts.shots.length>0);
});

test('protected spawns are not pre-aimed and receive a full reaction after protection', () => {
  const bot=actor(0,0),enemy=actor(6,1,0,-8,true),f=fixture([bot,enemy]);
  f.facts.immobile=true;enemy.protectedUntil=2;
  f.advance(1.9);assert.equal(f.director.states.get(0).target,null);assert.equal(f.facts.shots.length,0);
  bot.yaw=0;f.advance(.3);assert.equal(f.facts.shots.length,0,'protection expiry does not permit a settled-aim shot');
  f.advance(1);assert.ok(f.facts.shots.length>0,'the opponent remains engageable after acquiring them normally');
});

test('a target reappearing after a wall break needs a fresh reaction', () => {
  const bot=actor(0,0),f=fixture([bot,actor(6,1,0,-14,true)]);f.facts.immobile=true;
  f.advance(1.5);assert.ok(f.facts.shots.length>0);
  f.facts.clear=false;f.advance(1);const before=f.facts.shots.length;
  bot.yaw=0;f.facts.clear=true;f.advance(.2);
  assert.equal(f.facts.shots.length,before,'retaining the same target ID does not retain firing readiness');
  f.advance(1);assert.ok(f.facts.shots.length>before);
});

test('a modestly nearer contact does not cause an immediate target snap', () => {
  const bot=actor(0,0),first=actor(6,1,0,-14,true),second=actor(7,1,0,-100,true),f=fixture([bot,first,second]);
  f.facts.immobile=true;f.advance(.5);assert.equal(f.director.states.get(0).target,first);
  second.position.z=-8;f.advance(.2);assert.equal(f.director.states.get(0).target,first);
  f.advance(1.5);assert.equal(f.director.states.get(0).target,second,'a better target may be selected after the committed engagement');
});

test('low stamina produces a recovery interval instead of frame-by-frame sprint toggling', () => {
  const bot=Object.assign(actor(0,0,-40,30),{role:'scout',stamina:23}),f=fixture([bot]);
  f.facts.clear=false;let previous=false,changes=0;
  for(let i=0;i<60;i++){f.advance(.05);if(bot.sprinting!==previous){changes++;previous=bot.sprinting;}}
  assert.ok(changes<=1,`expected at most one deliberate sprint transition, received ${changes}`);
  assert.ok(bot.stamina>25,'the bot recovers before resuming sprint');
});

test('taking further damage does not repeatedly replace a committed cover route', () => {
  const bot=actor(0,0),f=fixture([bot,actor(6,1,0,-14,true)]);let selections=0;
  f.director.findCover=()=>{selections++;return new Vector3(5,0,0);};bot.health=40;
  for(let i=0;i<24;i++){bot.health-=.1;f.advance(.05);}
  assert.equal(selections,1,'a single retreat is allowed to reach cover');
  assert.ok(f.director.states.get(0).cover);
});

test('sidestep cadence is individual and turning has a finite angular speed', () => {
  const f=fixture([actor(0,0),actor(1,0,5,0)]);f.advance(.05);
  const a=f.director.states.get(0),b=f.director.states.get(1);
  assert.notEqual(a.nextStrafe,b.nextStrafe);
  const bot=f.game.actors[0];bot.yaw=0;bot.pitch=0;
  f.director.face(bot,new Vector3(0,.5,1).normalize(),.05,7.5);
  assert.ok(Math.abs(bot.yaw)<=7.5*.7*.05+.0001,'an instant 180 degree snap is not permitted');
  assert.ok(bot.pitch>0&&bot.pitch<Math.atan(.5),'pitch follows the same smooth tracking principle');
});
