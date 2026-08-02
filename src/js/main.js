import { startCamera } from './camera.js';
import { HandTracker } from './handTracker.js';
import { createScene } from './render/scene.js';
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

    // 测试:bloom 验证发光球
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(40, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xFFD24A })
    );
    S.add(ball);

    status.textContent = '✓ 可见发光金球即 bloom 正常';
    const t0 = performance.now();
    (function loop() {
      ball.position.set(Math.sin((performance.now() - t0) / 600) * 200, 0, 0);
      tracker.update();
      S.render();
      requestAnimationFrame(loop);
    })();
  } catch (e) {
    status.classList.add('error');
    status.textContent = e.message;
    console.error(e);
  }
});
