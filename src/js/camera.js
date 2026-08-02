export async function startCamera(videoEl) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('当前浏览器/协议不支持摄像头。请用 http://localhost 或 https 打开。');
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: false,
    });
  } catch (e) {
    throw new Error('无法访问摄像头:' + (e.message || e.name));
  }
  videoEl.srcObject = stream;
  videoEl.muted = true;
  videoEl.playsInline = true;
  await videoEl.play();
  return stream;
}
