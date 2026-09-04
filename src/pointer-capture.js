/** Keep asynchronous browser capture requests separate from the match's intent.
 * The caller owns document events and decides whether losing capture pauses play. */
export class PointerCapture{
 constructor({element,document,canCapture=()=>true,onChange=()=>{},onLost=()=>{}}){
  this.element=element;this.document=document;this.canCapture=canCapture;this.onChange=onChange;this.onLost=onLost;
  this.locked=false;this.pending=false;this.wanted=false;this.epoch=0;this.promiseEpoch=null;this.lastError=null;
 }
 publish(locked,pending){
  const changed=this.locked!==locked||this.pending!==pending;
  this.locked=locked;this.pending=pending;
  if(changed)this.onChange(locked,pending);
 }
 request(){
  this.lastError=null;
  // A user-triggered request can restore focus to the game canvas. Check the
  // resulting document focus, rather than rejecting before trying to focus it.
  try{this.element.focus?.({preventScroll:true});}catch{this.lastError='focus-failed';this.release();return false;}
  if(!this.canCapture()){
   this.lastError=this.document.hidden||this.document.hasFocus?.()===false?'not-focused':'not-allowed';
   this.release();return false;
  }
  if(this.document.pointerLockElement===this.element){this.wanted=true;this.publish(true,false);return true;}
  if(this.wanted&&this.pending)return true;
  const epoch=++this.epoch;this.wanted=true;this.promiseEpoch=null;this.publish(false,true);
  try{
   if(typeof this.element.requestPointerLock!=='function'){this.fail(epoch,'unsupported');return false;}
   const result=this.element.requestPointerLock();
   if(result&&typeof result.then==='function'){
    this.promiseEpoch=epoch;
    Promise.resolve(result).then(()=>{
     if(epoch!==this.epoch||!this.wanted||!this.pending)return;
     if(!this.canCapture()){this.release();return;}
     if(this.document.pointerLockElement===this.element)this.handleChange();else this.fail(epoch,'capture-not-acquired');
    },error=>this.fail(epoch,error));
   }
   return this.wanted;
  }catch(error){this.fail(epoch,error);return false;}
 }
 fail(epoch,error='capture-failed'){
  if(epoch!==this.epoch||!this.wanted||!this.pending)return;
  // Only expose short codes or exception names, never browser error messages.
  const code=typeof error==='string'?error:error?.name;
  this.lastError=typeof code==='string'&&/^[A-Za-z][A-Za-z0-9-]{0,47}$/.test(code)?code:'capture-failed';
  this.wanted=false;this.promiseEpoch=null;this.publish(false,false);
 }
 release(){
  ++this.epoch;this.wanted=false;this.promiseEpoch=null;
  // Never release capture owned by another surface, such as the artist inspector.
  if(this.document.pointerLockElement===this.element)this.document.exitPointerLock?.();
  this.publish(false,false);
 }
 handleChange(){
  if(this.document.pointerLockElement===this.element){
   if(!this.wanted||!this.canCapture()){this.release();return;}
   this.publish(true,false);return;
  }
  if(!this.canCapture()){this.release();return;}
  if(!this.locked)return; // A queued old unlock must not cancel a new pending request.
  const lost=this.wanted;
  ++this.epoch;this.wanted=false;this.promiseEpoch=null;this.publish(false,false);
  if(lost)this.onLost();
 }
 handleError(){
  // Modern error events carry no request identity; only their matching Promise
  // can safely reject an attempt. Legacy browsers instead report through events.
  if(this.document.pointerLockElement===this.element||this.promiseEpoch===this.epoch)return;
  this.fail(this.epoch,'pointerlockerror');
 }
}
