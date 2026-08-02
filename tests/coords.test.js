import { test } from 'node:test';
import * as assert from 'node:assert';
import { landmarkToWorld, lerp, dist2D } from '../src/js/utils/coords.js';

test('镜像:X=0 映射到右边缘', () => {
  assert.deepEqual(landmarkToWorld({ x: 0, y: 0.5 }, 1000, 500), { x: 1000, y: 250 });
});
test('镜像:X=1 映射到左边缘', () => {
  assert.deepEqual(landmarkToWorld({ x: 1, y: 0 }, 1000, 500), { x: 0, y: 0 });
});
test('lerp 中点', () => assert.equal(lerp(0, 10, 0.5), 5));
test('dist2D 3-4-5', () => assert.equal(dist2D({ x: 0, y: 0 }, { x: 3, y: 4 }), 5));
