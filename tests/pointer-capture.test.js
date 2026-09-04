import test from 'node:test';
import assert from 'node:assert/strict';
import {PointerCapture} from '../src/pointer-capture.js';

function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function fixture({legacy=false}={}){
 const requests=[],changes=[];let allowed=true,lost=0,exits=0;
 const document={pointerLockElement:null,exitPointerLock(){exits++;this.pointerLockElement=null;}};
 const element={focus(){},requestPointerLock(){const request=deferred();requests.push(request);return legacy?undefined:request.promise;}};
 const capture=new PointerCapture({element,document,canCapture:()=>allowed,onChange:(locked,pending)=>changes.push([locked,pending]),onLost:()=>lost++});
 return{capture,element,document,requests,changes,set allowed(value){allowed=value;},get lost(){return lost;},get exits(){return exits;},arrive(){document.pointerLockElement=element;capture.handleChange();}};
}
const flush=()=>Promise.resolve();

test('capture publishes pending then locked, and repeat requests reuse capture',async()=>{
 const f=fixture();assert.equal(f.capture.request(),true);f.capture.request();assert.equal(f.requests.length,1);
 assert.deepEqual(f.changes,[[false,true]]);f.arrive();f.requests[0].resolve();await flush();f.capture.request();
 assert.equal(f.requests.length,1);assert.deepEqual(f.changes,[[false,true],[true,false]]);
 assert.equal(f.capture.wanted,true);assert.equal(f.lost,0);
});

test('late capture after pause or menu release is exited without a loss callback',async()=>{
 for(const release of [false,true]){
  const f=fixture();f.capture.request();f.allowed=false;if(release)f.capture.release();f.arrive();f.requests[0].resolve();await flush();
  assert.equal(f.document.pointerLockElement,null);assert.equal(f.capture.locked,false);assert.equal(f.capture.pending,false);
  assert.equal(f.capture.wanted,false);assert.equal(f.exits,1);assert.equal(f.lost,0);
  f.capture.handleChange();assert.equal(f.lost,0); // Browser's resulting unlock event.
 }
});

test('a rejected old request and its unlabelled error event cannot cancel a newer attempt',async()=>{
 const f=fixture();f.capture.request();f.capture.release();f.capture.request();
 f.requests[0].reject(new Error('old request cancelled'));f.capture.handleError();await flush();
 assert.equal(f.capture.pending,true);assert.equal(f.capture.wanted,true);assert.equal(f.lost,0);
 f.arrive();f.requests[1].resolve();await flush();assert.equal(f.capture.locked,true);assert.equal(f.capture.pending,false);
});

test('a resolved old request cannot complete a newer attempt',async()=>{
 const f=fixture();f.capture.request();f.capture.release();f.capture.request();f.requests[0].resolve();await flush();
 assert.equal(f.capture.pending,true);assert.equal(f.capture.locked,false);
 f.arrive();f.requests[1].resolve();await flush();assert.equal(f.capture.locked,true);
});

test('release and a queued unlock preserve a fresh request until capture arrives',async()=>{
 const f=fixture();f.capture.request();f.arrive();f.requests[0].resolve();await flush();
 f.capture.release();f.capture.request();f.capture.handleChange();
 assert.equal(f.capture.pending,true);assert.equal(f.capture.wanted,true);assert.equal(f.lost,0);
 f.arrive();f.requests[1].resolve();await flush();assert.equal(f.capture.locked,true);assert.equal(f.exits,1);
});

test('unexpected active capture loss reports once, while explicit release never does',async()=>{
 const f=fixture();f.capture.request();f.arrive();f.requests[0].resolve();await flush();
 f.document.pointerLockElement=null;f.capture.handleChange();f.capture.handleChange();
 assert.equal(f.lost,1);assert.equal(f.capture.wanted,false);assert.equal(f.capture.pending,false);
 f.capture.request();f.arrive();f.capture.release();f.capture.handleChange();assert.equal(f.lost,1);
});

test('legacy undefined-return requests settle through capture or error events',()=>{
 const f=fixture({legacy:true});f.capture.request();assert.equal(f.capture.pending,true);f.arrive();assert.equal(f.capture.locked,true);
 f.capture.handleError();assert.equal(f.capture.locked,true); // Late error cannot undo successful capture.
 f.capture.release();f.capture.request();f.capture.handleError();
 assert.equal(f.capture.locked,false);assert.equal(f.capture.pending,false);assert.equal(f.capture.wanted,false);assert.equal(f.lost,0);
});

test('a current rejection ends pending and clears intent so late capture is rejected',async()=>{
 const f=fixture();f.capture.request();f.requests[0].reject(new Error('denied'));await flush();
 assert.equal(f.capture.pending,false);assert.equal(f.capture.wanted,false);assert.deepEqual(f.changes,[[false,true],[false,false]]);
 f.arrive();assert.equal(f.document.pointerLockElement,null);assert.equal(f.lost,0);
});

test('missing API, synchronous failure and forbidden requests do not leave capture pending',()=>{
 for(const mode of ['missing','throw','forbidden']){
  const f=fixture();if(mode==='missing')delete f.element.requestPointerLock;
  if(mode==='throw')f.element.requestPointerLock=()=>{throw new Error('denied');};if(mode==='forbidden')f.allowed=false;
  assert.equal(f.capture.request(),false);assert.equal(f.capture.pending,false);assert.equal(f.capture.wanted,false);assert.equal(f.capture.locked,false);
 }
});

test('capture lost while app cannot capture is cleared without another pause callback',async()=>{
 const f=fixture();f.capture.request();f.arrive();f.requests[0].resolve();await flush();f.allowed=false;
 f.document.pointerLockElement=null;f.capture.handleChange();assert.equal(f.lost,0);assert.equal(f.capture.locked,false);assert.equal(f.capture.wanted,false);
 const other={};f.document.pointerLockElement=other;f.capture.release();assert.equal(f.document.pointerLockElement,other);
});

test('an explicit request focuses the canvas before checking document eligibility',()=>{
 const f=fixture();f.allowed=false;f.element.focus=()=>{f.allowed=true;};
 assert.equal(f.capture.request(),true);assert.equal(f.requests.length,1);assert.equal(f.capture.pending,true);assert.equal(f.capture.lastError,null);
});

test('capture diagnostics keep bounded causes and never expose rejection messages',async()=>{
 const f=fixture();f.capture.request();f.requests[0].reject({name:'NotAllowedError',message:'sensitive browser details'});await flush();
 assert.equal(f.capture.lastError,'NotAllowedError');f.capture.release();assert.equal(f.capture.lastError,'NotAllowedError');
 f.capture.request();assert.equal(f.capture.lastError,null);f.requests[1].reject({name:'unexpected error with private details',message:'other details'});await flush();
 assert.equal(f.capture.lastError,'capture-failed');
 delete f.element.requestPointerLock;assert.equal(f.capture.request(),false);assert.equal(f.capture.lastError,'unsupported');
 f.allowed=false;f.document.hasFocus=()=>false;assert.equal(f.capture.request(),false);assert.equal(f.capture.lastError,'not-focused');
});
