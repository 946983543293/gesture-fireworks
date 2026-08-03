import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { EMA_ALPHA } from './utils/constants.js';

// 打包版(esbuild define __PACKAGED__=true)用本地 wasm/模型;开发版走 CDN
const IS_PACKAGED = typeof __PACKAGED__ !== 'undefined' && __PACKAGED__;
const WASM = IS_PACKAGED ? './wasm'
  : 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL = IS_PACKAGED ? './hand_landmarker.task'
  : 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export class HandTracker {
  constructor(video) {
    this.video = video;
    this.lm = null;
    this.smoothed = null;   // Map: 手索引 -> 21 个平滑后的点
    this.ts = -1;
    this._last = [];
  }

  async init() {
    const fs = await FilesetResolver.forVisionTasks(WASM);
    this.lm = await HandLandmarker.createFromOptions(fs, {
      baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 2,
    });
  }

  /** 每帧调用,返回平滑后的手部数据;无手时返回 [] */
  update() {
    if (!this.lm || this.video.readyState < 2) return [];
    const now = Math.trunc(performance.now());   // MediaPipe 要求单调递增整数毫秒
    if (now <= this.ts) return this._last;
    this.ts = now;

    const r = this.lm.detectForVideo(this.video, now);
    const out = [];
    const n = r.landmarks?.length || 0;
    for (let h = 0; h < n; h++) {
      const raw = r.landmarks[h];
      if (!this.smoothed) this.smoothed = new Map();
      let sm = this.smoothed.get(h);
      if (!sm) { sm = raw.map(p => ({ ...p })); this.smoothed.set(h, sm); }
      else for (let i = 0; i < 21; i++) {
        sm[i].x += (raw[i].x - sm[i].x) * EMA_ALPHA;
        sm[i].y += (raw[i].y - sm[i].y) * EMA_ALPHA;
        sm[i].z += (raw[i].z - sm[i].z) * EMA_ALPHA;
      }
      out.push({ landmarks: sm, handedness: r.handednesses?.[h]?.[0]?.categoryName || 'Right' });
    }
    if (n === 0) this.smoothed?.clear();   // 手消失时清缓存,避免索引错位
    this._last = out;
    return out;
  }
}
