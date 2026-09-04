import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWeaponView} from '../src/weapon-view.js';
import {createSprayCan} from '../src/spray-prop.js';

const makeView = () => createWeaponView(new THREE.PerspectiveCamera(74, 16 / 9, .05, 300));
const settle = (view, seconds = .6, step = 1 / 60, state = {}) => {
  for (let i = 0; i < Math.round(seconds / step); i++) view.update(step, state);
};

test('grenade and melee gestures recover quickly and aiming can cancel them', () => {
  const view = makeView();
  settle(view);
  assert.equal(view.action('throw'), true);
  settle(view, .1);
  assert.equal(view.handling.action, 'throw');
  assert.equal(view.handling.inspecting, false);
  assert.equal(view.group.visible, true);
  settle(view, .02, .01, {ads: true});
  assert.equal(view.handling.action, null);
  assert.ok(view.ads > 0);
  view.action('melee');
  settle(view, .4);
  assert.equal(view.handling.action, null);
  assert.equal(view.handling.inspecting, false);
  view.reload(1);
  assert.equal(view.action('throw'), false, 'gestures must not hide an active reload');
  view.cancelActions();
  assert.equal(view.handling.reloading, false);
  view.destroy();
});

test('sprint input eases into the weapon posture instead of teleporting it', () => {
  const view = makeView();
  settle(view);
  const position = view.group.position.clone(), rotation = view.group.quaternion.clone();
  view.update(0, {sprint: true});
  assert.ok(view.group.position.distanceTo(position) < 1e-12);
  assert.ok(view.group.quaternion.angleTo(rotation) < 1e-7);
  view.update(1 / 60, {sprint: true});
  assert.ok(view.handling.sprintAmount > 0 && view.handling.sprintAmount < .4);
  settle(view, .2, 1 / 60, {sprint: true});
  assert.ok(view.handling.sprintAmount > .95);
  const prior = view.handling.sprintAmount;
  view.update(1 / 60, {sprint: false});
  assert.ok(view.handling.sprintAmount > 0 && view.handling.sprintAmount < prior);
  view.destroy();
});

test('weapon kick recovers consistently at 30 and 120 frames per second', () => {
  const slow = makeView(), fast = makeView();
  settle(slow); settle(fast);
  slow.fire(); fast.fire();
  settle(slow, .4, 1 / 30); settle(fast, .4, 1 / 120);
  assert.ok(slow.group.position.distanceTo(fast.group.position) < 1e-9);
  assert.ok(slow.group.quaternion.angleTo(fast.group.quaternion) < 1e-7);
  slow.destroy(); fast.destroy();
});

test('reload timing follows simulated time through slow frames and a frozen interval', () => {
  for (const step of [.1, 1 / 30, 1 / 120]) {
    const view = makeView();
    settle(view);
    view.reload(1, {empty: true});
    settle(view, .5, step);
    assert.equal(view.handling.reloading, true);
    assert.ok(Math.abs(view.handling.reloadProgress - .5) < 1e-9,
      `half a simulated second must be half a reload at ${1 / step} fps`);
    const position = view.group.position.clone(), rotation = view.group.quaternion.clone();
    for (let i = 0; i < 90; i++) view.update(0);
    assert.ok(Math.abs(view.handling.reloadProgress - .5) < 1e-9,
      'waiting for capture cannot consume reload time');
    assert.ok(view.group.position.distanceTo(position) < 1e-12);
    assert.ok(view.group.quaternion.angleTo(rotation) < 1e-7);
    settle(view, .5, step);
    assert.equal(view.handling.reloading, false,
      `the reload must finish at its deadline at ${1 / step} fps`);
    view.destroy();
  }
});

test('aiming interrupts inspection immediately but preserves a reload', () => {
  const view = makeView();
  settle(view);
  assert.equal(view.inspect(), true);
  settle(view, .5);
  assert.equal(view.handling.inspecting, true);
  view.update(1 / 60, {ads: true});
  assert.equal(view.handling.inspecting, false);
  assert.ok(view.ads > 0, 'aiming begins on the first frame after right-click');
  settle(view, .5, 1 / 60, {ads: true});
  assert.ok(view.ads > .99);
  view.reload(1);
  assert.equal(view.inspect(), false, 'inspection cannot replace a reload');
  settle(view, .5, 1 / 60, {ads: true});
  assert.equal(view.handling.reloading, true);
  assert.ok(view.ads < .01, 'a reload keeps the weapon out of aim');
  view.destroy();
});

test('a spray holds a visible can, then cancels immediately for combat actions', () => {
  const view = makeView();
  view.setArtist('Berthe Morisot');
  for (const cancel of [() => view.fire(), () => view.reload(), () => view.equip('pistol'),
    () => view.update(0, {ads: true}), () => view.cancelActions(), () => view.cancelSpray(), () => view.setVisible(false)]) {
    view.setVisible(true); view.equip('rifle'); settle(view);
    assert.equal(view.action('spray'), true);
    settle(view, .16, .01);
    assert.equal(view.handling.sprayVisible, true);
    assert.equal(view.handling.spraying, true);
    assert.equal(view.group.visible, true, 'the gun must remain available during a spray');
    assert.equal(view.handling.inspecting, false);
    cancel();
    assert.equal(view.handling.sprayVisible, false);
    assert.equal(view.handling.spraying, false, 'cancellation cannot leave a floating mist jet');
    assert.equal(view.handling.action, null);
  }
  view.setVisible(true); view.equip('rifle'); settle(view); view.action('spray');
  settle(view, .6);
  assert.equal(view.handling.action, null);
  assert.equal(view.handling.sprayVisible, false);
  view.reload(1); view.cancelSpray();
  assert.equal(view.handling.reloading, true, 'taking damage while reloading must not reset its visual animation');
  view.destroy();
});

test('spray prop resources are isolated, reusable, and disposed exactly once', () => {
  const first = createSprayCan({palette: ['#e1b2b0', '#7aa58b', '#d8cf92']}), second = createSprayCan();
  const resources = new Set();
  first.group.traverse(o => {if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});
  const disposed = new Map();
  for (const resource of resources) resource.addEventListener('dispose', () => disposed.set(resource, (disposed.get(resource) || 0) + 1));
  first.update(.1, {spraying: true});
  assert.equal(first.jet.visible, true);
  first.update(0, {spraying: false});
  assert.equal(first.jet.visible, false);
  first.setPalette(['#8faebf', '#ddb98a', '#ba7c87']);
  assert.equal(first.group.children[0].material.color.getHexString(), '8faebf');
  first.dispose(); first.dispose();
  assert.equal(disposed.size, resources.size);
  assert.ok([...disposed.values()].every(count => count === 1));
  assert.equal(first.update(.1, {spraying: true}), false);
  assert.equal(first.setPalette(['#ffffff']), false);
  assert.equal(second.update(.1, {spraying: true}), true, 'disposing one actor must not affect another actor’s can');
  assert.equal(second.jet.visible, true);
  second.dispose();
});
