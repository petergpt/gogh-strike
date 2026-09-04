export const INTRO_TIMING=Object.freeze({beat:.8,countdown:2.4,exit:.32});

/** Driven by the visible game loop, never by timeouts. Pausing the loop also
 * pauses this clock; replacing or leaving a match cannot leave a late callback. */
export class MatchIntro{
 constructor(){this.cancel();}
 start(){this.elapsed=0;this.running=true;return this.state;}
 cancel(){this.elapsed=0;this.running=false;return this.state;}
 advance(dt){
  if(this.running&&Number.isFinite(dt)&&dt>0){
   this.elapsed=Math.min(INTRO_TIMING.countdown+INTRO_TIMING.exit,this.elapsed+dt);
   if(this.elapsed+1e-8>=INTRO_TIMING.countdown+INTRO_TIMING.exit)this.running=false;
  }
  return this.state;
 }
 get active(){return this.running&&this.elapsed+1e-8<INTRO_TIMING.countdown;}
 get state(){return{active:this.active,exiting:this.running&&!this.active,running:this.running,
  beat:this.active?3-Math.min(2,Math.floor((this.elapsed+1e-8)/INTRO_TIMING.beat)):'GO',
  progress:Math.min(1,this.elapsed/INTRO_TIMING.countdown),elapsed:this.elapsed};}
}
