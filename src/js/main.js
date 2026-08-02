import { startCamera } from './camera.js';
import { HandTracker } from './handTracker.js';
import { landmarkToWorld } from './utils/coords.js';

const video = document.getElementById('cam');
const canvas = document.getElementById('scene-canvas');
const ctx = canvas.getContext('2d');
const btn = document.getElementById('start');
const status = document.getElementById('status');

function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize);
resize();

btn.addEventListener('click', async () => {
  btn.remove();
  try {
    status.textContent = '加载手部模型…';
    await startCamera(video);
    const tracker = new HandTracker(video);
    await tracker.init();
    status.textContent = '✓ 伸出食指试试';
    loop(tracker);
  } catch (e) {
    status.classList.add('error');
    status.textContent = e.message;
    console.error(e);
  }
});

function loop(tracker) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const hands = tracker.update();
  for (const { landmarks } of hands) {
    for (let i = 0; i < 21; i++) {
      const p = landmarkToWorld(landmarks[i], canvas.width, canvas.height);
      ctx.fillStyle = i === 8 ? '#FFD24A' : 'rgba(255,138,30,0.55)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, i === 8 ? 6 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  requestAnimationFrame(() => loop(tracker));
}
