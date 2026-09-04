/** Invented competitive emotes, not claims about historical movements.
 * Canonical articulated offsets are dimensionless and never change physics.
 */
const TAU=Math.PI*2,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=v=>{const t=clamp(v);return t*t*(3-2*t);};
export const ARTIST_TAUNTS=Object.freeze([
 ['Vincent van Gogh','sunflower_spin','Sunflower spin',1.60],
 ['Paul Gauguin','crimson_swagger','Crimson swagger',1.58],
 ['Paul Cézanne','mountain_measure','Mountain measure',1.66],
 ['Georges Seurat','dotted_shuffle','Dotted shuffle',1.56],
 ['Paul Signac','sailor_flourish','Sailor’s flourish',1.62],
 ['Henri de Toulouse-Lautrec','poster_bow','Poster bow',1.62],
 ['Claude Monet','bridge_sway','Bridge sway',1.68],
 ['Pierre-Auguste Renoir','paris_two_step','Paris two-step',1.60],
 ['Edgar Degas','curtain_call','Curtain call',1.64],
 ['Berthe Morisot','butterfly_turn','Butterfly turn',1.58],
 ['Camille Pissarro','orchard_welcome','Orchard welcome',1.66],
 ['Mary Cassatt','opera_encore','Opera encore',1.60],
// Give the full gesture time to read, preserving each artist's choreography.
].map(([artist,id,name,duration])=>Object.freeze({artist,id,name,duration:duration*1.75,cooldown:6})));
const byId=Object.fromEntries(ARTIST_TAUNTS.map(t=>[t.id,t]));
const byArtist=Object.fromEntries(ARTIST_TAUNTS.map(t=>[t.artist,t]));
export function getArtistTaunt(artist){
 if(artist&&typeof artist==='object'&&byId[artist.id])return byId[artist.id];
 const key=typeof artist==='string'?artist:artist?.artistName||artist?.identity?.name||artist?.name||artist?.id;
 return byArtist[key]||byId[key]||ARTIST_TAUNTS[0];
}
const neutral=()=>({active:false,weight:0,body:[0,0,0],torso:[0,0,0],head:[0,0,0],shift:[0,0,0],leftHand:[0,0,0],rightHand:[0,0,0],
 legs:[{hip:[0,0,0],knee:0,stance:0},{hip:[0,0,0],knee:0,stance:0}]});

/** Pure full-body pose sample. All offsets, including absolute canonical hand
 * targets, are multiplied by weight. Renderer blends baseline hands by
 * (1-weight), then adds these scaled targets. Zero endpoints restore neutral.
 */
export function sampleTaunt(taunt,elapsed){
 const definition=byId[typeof taunt==='string'?taunt:taunt?.id]||getArtistTaunt(taunt);
 if(!Number.isFinite(elapsed)||elapsed<=0||elapsed>=definition.duration)return neutral();
 const p=elapsed/definition.duration,t=p*TAU,w=smooth(p/.14)*smooth((1-p)/.18),s=Math.sin,c=Math.cos;
 const out=neutral();out.active=true;out.weight=w;
 const steps=(cycles,amount=.24)=>{
  const beat=s(t*cycles),l=Math.max(0,beat),r=Math.max(0,-beat);
  // One foot carries the weight while the other lifts into a clear step.
  const stride=amount*1.65;
  out.legs[0].hip[0]=l*stride;out.legs[1].hip[0]=r*stride;
  out.legs[0].knee=-l*stride*2;out.legs[1].knee=-r*stride*2;
  out.shift[0]=beat*.035;return beat;
 };
 switch(definition.id){
  case 'sunflower_spin':{
   const beat=steps(2,.26);out.body=[0,.38*s(t),.075*beat];out.torso=[-.08,.17*s(t+.5),.12*s(t)];
   out.leftHand=[-.29-.14*c(t),.67+.22*s(t),-.20];out.rightHand=[.29+.14*c(t),.67-.22*s(t),-.20];
   out.head=[-.06,.20*s(t),0];break;
  }
  case 'crimson_swagger':{
   const beat=steps(2.5,.21);out.body=[.03,.30*s(t),-.105*beat];out.torso=[-.10,-.20*s(t),-.06];
   out.leftHand=[-.47,.48+.07*s(t*2),-.10];out.rightHand=[.10+.045*s(t*3),.81,-.13];
   out.head=[-.10,-.25*s(t),-.10];out.legs[0].stance=-.035;out.legs[1].stance=.035;break;
  }
  case 'mountain_measure':{
   const beat=steps(1,.16),peak=smooth((p-.17)/.18)*(1-smooth((p-.62)/.15));
   out.torso=[.13*s(t*2),0,0];out.body=[0,.07*beat,0];
   out.leftHand=[-.39+.30*peak,.49+.39*peak,-.24];out.rightHand=[.39-.30*peak,.49+.39*peak,-.24];
   out.legs.forEach(leg=>{leg.hip[0]+=.14*Math.max(0,s(t*2));leg.knee-=.28*Math.max(0,s(t*2));});out.head=[.12*s(t*2),0,0];break;
  }
  case 'dotted_shuffle':{
   const beat=steps(3,.17);out.body=[0,.09*beat,.025*s(t*3)];out.torso=[.02,0,.035*s(t*6)];
   out.leftHand=[-.27+.065*s(t*6),.58+.075*c(t*6),-.35];out.rightHand=[.27+.065*c(t*6),.58+.075*s(t*6),-.35];
   out.head=[.045*c(t*3),.10*s(t*3),0];break;
  }
  case 'sailor_flourish':{
   const beat=steps(1.5,.31),pull=.5+.5*s(t);
   out.body=[0,.20*s(t),.10*beat];out.torso=[.10*s(t),-.10*s(t),-.10*s(t)];
   out.leftHand=[-.28,.49+.36*pull,-.21-.11*pull];out.rightHand=[.27,.80-.30*pull,-.35+.12*pull];
   out.legs[0].stance=-.045;out.legs[1].stance=.045;out.head=[-.03,.17*s(t),0];break;
  }
  case 'poster_bow':{
   const bow=smooth((p-.38)/.20)*(1-smooth((p-.75)/.13));steps(2,.15);
   out.torso=[-.43*bow,.13*s(t),0];out.body=[0,-.19*s(t),-.035*s(t*2)];
   out.leftHand=[-.45,.45-.12*bow,-.12];out.rightHand=[.06,.81-.38*bow,-.13-.14*bow];
   out.head=[-.13*bow,0,-.05];out.legs[0].hip[0]+=.12*bow;out.legs[1].knee-=.10*bow;break;
  }
  case 'bridge_sway':{
   const beat=steps(1,.18),arch=.5+.5*s(t-.6);
   out.body=[0,.10*s(t),.075*beat];out.torso=[-.025,.10*s(t),.08*s(t)];
   out.leftHand=[-.43+.27*arch,.55+.30*arch,-.17];out.rightHand=[.43-.27*arch,.55+.30*arch,-.17];
   out.head=[-.07*arch,.09*s(t),0];out.shift[0]=.028*s(t);break;
  }
  case 'paris_two_step':{
   const beat=steps(2,.29),clap=Math.pow(Math.max(0,c(t*2)),6);
   out.body=[0,.24*s(t),.06*beat];out.torso=[-.045,0,-.07*beat];
   out.leftHand=[-.40+.355*clap,.55+.05*clap,-.32];out.rightHand=[.40-.355*clap,.55+.05*clap,-.32];
   out.head=[-.04,.14*s(t),.04*beat];out.legs[0].stance=-.020*beat;out.legs[1].stance=-.020*beat;break;
  }
  case 'curtain_call':{
   const bow=smooth((p-.34)/.18)*(1-smooth((p-.72)/.16));steps(1,.16);
   out.body=[0,.25*s(t),0];out.torso=[-.36*bow,-.13*s(t),.03];
   out.leftHand=[-.40,.70-.23*bow,-.13];out.rightHand=[.07+.18*(1-bow),.45,-.31];
   out.head=[-.16*bow,0,0];out.legs[0].hip[1]=.22;out.legs[0].hip[0]-=.14*bow;out.legs[1].knee-=.11*bow;break;
  }
  case 'butterfly_turn':{
   const beat=steps(2,.20),flutter=s(t*4);
   out.body=[0,-.30*s(t),.07*beat];out.torso=[-.06,.18*s(t),-.06*beat];
   out.leftHand=[-.35-.08*flutter,.69+.11*c(t*2),-.19];out.rightHand=[.35+.08*flutter,.69-.11*c(t*2),-.19];
   out.head=[-.05,.17*s(t),.05*s(t*2)];out.legs[1].hip[1]=-.17*s(t);break;
  }
  case 'orchard_welcome':{
   const beat=steps(1.5,.18),present=smooth((p-.18)/.26);
   out.body=[0,.075*s(t),.04*beat];out.torso=[.06,-.10*s(t),0];
   out.leftHand=[-.19-.29*present,.39+.16*present,-.27+.08*present];out.rightHand=[.19+.29*present,.39+.16*present,-.27+.08*present];
   out.head=[.09*s(t*1.5),.12*s(t),0];out.legs[0].stance=-.025;out.legs[1].stance=.025;break;
  }
  case 'opera_encore':{
   const look=smooth((p-.13)/.14)*(1-smooth((p-.49)/.16)),beat=steps(2,.22);
   out.body=[0,.23*s(t),.055*beat];out.torso=[-.04,.10*s(t),0];
   out.leftHand=[-.39+.28*look,.56+.21*look,-.22];out.rightHand=[.39-.28*look,.64+.13*look+.10*s(t*2)*(1-look),-.22];
   out.head=[-.06,.20*s(t*1.5),.035*s(t)];out.legs[0].hip[1]=.12*s(t);break;
  }
 }
 for(const key of ['body','torso','head','shift','leftHand','rightHand'])out[key]=out[key].map(v=>v*w);
 for(const leg of out.legs){leg.hip=leg.hip.map(v=>v*w);leg.knee*=w;leg.stance*=w;}
 return out;
}
