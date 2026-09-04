import test from 'node:test';
import assert from 'node:assert/strict';
import {GameInputState, isShortcutEvent, isGameWheel} from '../src/input-state.js';

const key = (code, extra = {}) => ({code, metaKey:false, altKey:false, ctrlKey:false, repeat:false, ...extra});

test('an interrupted movement key requires a fresh press instead of a stale repeat', () => {
  const input = new GameInputState();
  assert.equal(input.keyDown(key('KeyW')),true);
  assert.equal(input.keyDown(key('KeyW',{repeat:true})),true);
  input.clear();
  assert.equal(input.keyDown(key('KeyW',{repeat:true})),false);
  assert.equal(input.keys.size,0);
  input.keyUp(key('KeyW'));
  assert.equal(input.keyDown(key('KeyW')),true);
  input.keyUp(key('KeyW'));
  assert.equal(input.keys.size,0);
});

test('Command shortcuts cannot leave movement stuck when macOS omits its keyup', () => {
  const input = new GameInputState();
  input.keyDown(key('KeyW'));
  assert.equal(input.keyDown(key('MetaLeft',{metaKey:true})),false);
  assert.equal(input.suspended,true);
  assert.equal(input.keys.size,0);
  for (const code of ['KeyR','KeyQ','KeyG','KeyH','KeyB','KeyI','KeyW']) {
    assert.equal(input.keyDown(key(code,{metaKey:true})),false,code);
  }
  input.keyUp(key('MetaLeft'));
  assert.equal(input.suspended,false);
  assert.equal(input.keyDown(key('KeyW',{repeat:true})),false,'lost W keyup must not restore old movement');
  assert.equal(input.keyDown(key('KeyW')),true);
});

test('both Command keys remain suspended until the last physical key is released', () => {
  const input = new GameInputState();
  input.keyDown(key('MetaLeft',{metaKey:true}));
  input.keyDown(key('MetaRight',{metaKey:true}));
  input.keyUp(key('MetaLeft',{metaKey:true}));
  assert.deepEqual([...input.shortcutModifiers],['MetaRight']);
  assert.equal(input.keyDown(key('KeyW',{metaKey:true})),false);
  input.keyUp(key('MetaRight'));
  assert.equal(input.suspended,false);
  assert.equal(input.keyDown(key('KeyW')),true);
});

test('aggregate flags recover missed modifier keydown and keyup events', () => {
  const input = new GameInputState();
  assert.equal(input.keyDown(key('KeyQ',{metaKey:true})),false);
  assert.equal(input.suspended,true);
  input.keyUp(key('KeyQ',{metaKey:true}));
  assert.equal(input.suspended,true);
  input.keyUp(key('KeyW'));
  assert.equal(input.suspended,false,'any keyup with metaKey false releases stale Command state');
  input.keyDown(key('MetaLeft',{metaKey:true}));
  input.keyUp(key('MetaLeft',{metaKey:true}));
  assert.equal(input.suspended,true,'a still-held but unobserved second Command key remains suspended');
  input.keyUp(key('MetaRight'));
  assert.equal(input.suspended,false);
});

test('Alt and Command are independent and shortcut detection also recognizes their physical codes', () => {
  const input = new GameInputState();
  input.keyDown(key('MetaLeft',{metaKey:true}));
  input.keyDown(key('AltLeft',{metaKey:true,altKey:true}));
  input.keyDown(key('AltRight',{metaKey:true,altKey:true}));
  input.keyUp(key('MetaLeft',{altKey:true}));
  input.keyUp(key('AltLeft',{altKey:true}));
  assert.deepEqual([...input.shortcutModifiers],['AltRight']);
  assert.equal(input.keyDown(key('KeyG',{altKey:true})),false);
  input.keyUp(key('AltRight'));
  assert.equal(input.suspended,false);
  for (const code of ['MetaLeft','MetaRight','AltLeft','AltRight']) assert.equal(isShortcutEvent(key(code)),true);
  assert.equal(isShortcutEvent(key('KeyR',{metaKey:true})),true);
  assert.equal(isShortcutEvent(key('KeyG',{altKey:true})),true);
});

test('Control and Shift remain gameplay controls for crouch and sprint combinations', () => {
  const input = new GameInputState();
  for (const code of ['ControlLeft','ControlRight','ShiftLeft','ShiftRight','KeyW','KeyC']) {
    const event=key(code,{ctrlKey:true,shiftKey:true});
    assert.equal(isShortcutEvent(event),false,code);
    assert.equal(input.keyDown(event),true,code);
  }
  assert.equal(input.suspended,false);
  assert.equal(input.keys.has('ControlLeft'),true);
  assert.equal(input.keys.has('KeyW'),true);
});

test('ordinary clears retain held shortcuts while blur and match reset can clear all state', () => {
  const input = new GameInputState();
  input.keyDown(key('KeyW'));
  input.keyDown(key('MetaLeft',{metaKey:true}));
  input.clear();
  assert.equal(input.keys.size,0);
  assert.equal(input.suspended,true);
  assert.equal(input.keyDown(key('KeyW')),false,'a held shortcut stays suspended even with a missing flag');
  input.clear({shortcuts:true});
  assert.equal(input.suspended,false);
  assert.equal(input.shortcutModifiers.size,0);
  assert.equal(input.keyDown(key('KeyW',{repeat:true})),false);
  assert.equal(input.keyDown(key('KeyW')),true);
});

test('only vertical unmodified wheel input changes weapons; trackpad pinch and horizontal scroll do not', () => {
  assert.equal(isGameWheel({deltaY:1}),true);
  assert.equal(isGameWheel({deltaY:-0.25}),true);
  for (const event of [{deltaY:0,deltaX:20},{deltaY:0},{deltaY:NaN},{deltaY:Infinity},{},
    {deltaY:1,ctrlKey:true},{deltaY:-1,metaKey:true},{deltaY:1,altKey:true}]) {
    assert.equal(isGameWheel(event),false,JSON.stringify(event));
  }
});
