import { startCamera } from './camera.js';
import { HandTracker } from './handTracker.js';
import { createScene } from './render/scene.js';
import { ParticlePool } from './systems/particlePool.js';
import { PALETTE, GRAVITY } from './utils/constants.js';
import * as THREE from 'three';

const video = document.getElementById('cam');
const canvas = document.getElementById('scene-canvas');
const btn = document.getElementById('start');
const status = document.getElementById('status');

btn.addEventListener('click', async () => {
  btn.remove();
  try {
    status.textContent = '加载中…';
    await startCamera(video);
    const tracker = new HandTracker(video);
    await tracker.init();

    const S = createScene(canvas, video);
    const onResize = () => S.setSize(innerWidth, innerHeight);
    addEventListener('resize', onResize);
    onResize();

    const pool = new ParticlePool(S.scene, S.camera);

    // 点击屏幕:在点击处爆一簇带重力的金色火星(验证粒子+bloom)
    addEventListener('click', (e) => {
      const pos = S.screenToWorld(e.clientX, e.clientY, innerWidth, innerHeight);
      for (let i = 0; i < 80; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 80 + Math.random() * 260;
        pool.spawn({
          position: pos.clone(),
          velocity: new THREE.Vector3(Math.cos(a) * sp, Math.sin(a) * sp + 120, 0),
          color: PALETTE.spark[i % PALETTE.spark.length],
          size: 6 + Math.random() * 6,
          life: 0.8 + Math.random() * 0.6,
          gravity: GRAVITY,
        });
      }
    });

    status.textContent = '✓ 点击屏幕撒火星';
    let last = performance.now();
    (function loop() {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      tracker.update();
      pool.update(dt);
      S.render();
      requestAnimationFrame(loop);
    })();
  } catch (e) {
    status.classList.add('error');
    status.textContent = e.message;
    console.error(e);
  }
});
