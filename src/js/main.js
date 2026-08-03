import { startCamera } from './camera.js';
import { HandTracker } from './handTracker.js';
import { createScene } from './render/scene.js';
import { ParticlePool } from './systems/particlePool.js';
import { TrailSystem } from './systems/trails.js';
import { FireworksSystem } from './systems/fireworks.js';
import { classifyGesture } from './gestures.js';
import { landmarkToWorld } from './utils/coords.js';
import { DEBOUNCE_FRAMES } from './utils/constants.js';

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
    const pool = new ParticlePool(S.scene, S.camera);
    const trails = new TrailSystem(pool, S.scene);
    const fireworks = new FireworksSystem(pool);

    const onResize = () => S.setSize(innerWidth, innerHeight);
    addEventListener('resize', onResize);
    onResize();

    let curGesture = 'IDLE', pend = 'IDLE', pendCount = 0;
    let lastGesture = 'IDLE';
    let last = performance.now();
    status.textContent = '☝ 伸食指写字';

    (function loop() {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const hands = tracker.update();
      let raw = 'IDLE';
      let pos = null;
      if (hands.length) {
        const lm = hands[0].landmarks;
        raw = classifyGesture(lm);
        const tip = landmarkToWorld(lm[8], innerWidth, innerHeight);
        pos = S.screenToWorld(tip.x, tip.y, innerWidth, innerHeight);
      }

      // 防抖(用于烟花/爱心等触发)
      if (raw === pend) pendCount++;
      else { pend = raw; pendCount = 1; }
      if (pendCount >= DEBOUNCE_FRAMES && pend !== curGesture) curGesture = pend;

      // 写字用原始手势(响应快,trails 内部抗抖动)
      if (raw === 'INDEX' && pos) trails.addPoint(pos, dt);
      else trails.pause();

      // 张掌 rising edge:笔迹炸成烟花 + 清空
      if (curGesture === 'PALM' && lastGesture !== 'PALM') {
        fireworks.burstAt(trails.vertices());
        trails.clear();
      }
      lastGesture = curGesture;

      pool.update(dt);
      S.render();
      status.textContent = raw === 'IDLE' ? '' : `手势: ${raw}`;
      requestAnimationFrame(loop);
    })();
  } catch (e) {
    status.classList.add('error');
    status.textContent = e.message;
    console.error(e);
  }
});
