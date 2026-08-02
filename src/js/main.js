import { startCamera } from './camera.js';

const video = document.getElementById('cam');
const btn = document.getElementById('start');
const status = document.getElementById('status');

btn.addEventListener('click', async () => {
  btn.remove();
  try {
    status.textContent = '正在打开摄像头…';
    await startCamera(video);
    status.textContent = '✓ 摄像头就绪';
    setTimeout(() => (status.style.display = 'none'), 1000);
  } catch (e) {
    status.classList.add('error');
    status.textContent = e.message;
  }
});
