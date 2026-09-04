import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {downloadModel, validateModelBuffer} from '../src/model-download.js';

const data=readFileSync(new URL('../assets/characters/van-gogh-head.glb',import.meta.url));
const full=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
const truncated=full.slice(0,131072);

test('complete shipped GLB passes unchanged; a short BIN is rejected before parsing',()=>{
 assert.equal(validateModelBuffer(full),full);
 assert.throws(()=>validateModelBuffer(truncated),/131072 of \d+ bytes/);
 const malformed=full.slice(0);new DataView(malformed).setUint32(12,full.byteLength,true);
 assert.throws(()=>validateModelBuffer(malformed),/incomplete data chunk/);
});

test('a partial successful HTTP response retries uncached and returns only the complete model',async()=>{
 const requests=[],notices=[];
 const result=await downloadModel('/assets/characters/van-gogh-head.glb?v=2',{
  onRetry:error=>notices.push(error.message),
  fetchImpl:async(url,options)=>{requests.push({url,cache:options.cache});return {ok:true,arrayBuffer:async()=>requests.length===1?truncated:full};},
 });
 assert.equal(result,full);assert.equal(requests.length,2);assert.equal(notices.length,1);
 assert.equal(requests[0].cache,'no-cache');assert.equal(requests[1].cache,'no-store');
 assert.match(requests[1].url,/\.glb\?v=2&retry=\d+$/);
});

test('persistent partial downloads fail after one retry with a named, actionable error',async()=>{
 let attempts=0;
 await assert.rejects(downloadModel('/head.glb',{name:'Van Gogh',fetchImpl:async()=>{
  attempts++;return {ok:true,arrayBuffer:async()=>truncated};
 }}),error=>error.message==='Couldn’t finish downloading Van Gogh. Please try again.'&&/incomplete/.test(error.cause.message));
 assert.equal(attempts,2);
});

test('an interrupted request retries, while an HTTP error body never reaches the parser',async()=>{
 let attempts=0;
 const result=await downloadModel('/head.glb',{fetchImpl:async()=>{
  if(++attempts===1)throw new TypeError('Failed to fetch');
  return {ok:true,arrayBuffer:async()=>full};
 }});
 assert.equal(result,full);
 let bodyReads=0;
 await assert.rejects(downloadModel('/missing.glb',{fetchImpl:async()=>({ok:false,status:404,arrayBuffer:async()=>{bodyReads++;return full;}})}),/Please try again/);
 assert.equal(bodyReads,0);
});
