import { test } from 'node:test';
import * as assert from 'node:assert';
import { classifyGesture, fingerStates } from '../src/js/gestures.js';
import { makeHand } from './fixtures.js';

test('INDEX: 食指伸 + 中无名小指弯', () => {
  const lm = makeHand({ index: 'extended', middle: 'curled', ring: 'curled', pinky: 'curled' });
  assert.equal(classifyGesture(lm), 'INDEX');
});

test('PALM: 五指全伸', () => {
  const lm = makeHand({ thumb: 'extended', index: 'extended', middle: 'extended', ring: 'extended', pinky: 'extended' });
  assert.equal(classifyGesture(lm), 'PALM');
});

test('FIST: 四指全弯', () => {
  const lm = makeHand({ thumb: 'curled', index: 'curled', middle: 'curled', ring: 'curled', pinky: 'curled' });
  assert.equal(classifyGesture(lm), 'FIST');
});

test('HEART: 捏合 + 中无名小指伸', () => {
  const lm = makeHand({ pinch: true, index: 'curled', middle: 'extended', ring: 'extended', pinky: 'extended' });
  assert.equal(classifyGesture(lm), 'HEART');
});

test('IDLE: 仅中指伸(介于各手势之间)', () => {
  const lm = makeHand({ index: 'curled', middle: 'extended', ring: 'curled', pinky: 'curled' });
  assert.equal(classifyGesture(lm), 'IDLE');
});

test('fingerStates 返回 5 个布尔值', () => {
  const lm = makeHand({ index: 'extended', middle: 'curled', ring: 'curled', pinky: 'curled', thumb: 'extended' });
  const s = fingerStates(lm);
  assert.equal(s.length, 5);
  assert.equal(s[1], true);   // index
  assert.equal(s[2], false);  // middle
});
