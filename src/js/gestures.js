import { PINCH_THRESHOLD } from './utils/constants.js';
import { dist2D } from './utils/coords.js';

// 关键点索引(MediaPipe Hands)
const WRIST = 0;
const TIP = [4, 8, 12, 16, 20];          // 拇指/食/中/无名/小 tip
const PIP = [null, 6, 10, 14, 18];        // 食/中/无名/小 PIP(拇指无 PIP 判定)
const INDEX_MCP = 5;

/** 五指伸展状态(拇指特殊处理) → [thumb, index, middle, ring, pinky] */
export function fingerStates(lm) {
  const wrist = lm[WRIST];
  const states = [];
  // 拇指:拇指尖离食指 MCP 远 = 伸
  states.push(dist2D(lm[TIP[0]], lm[INDEX_MCP]) > 0.10);
  // 其余四指:tip 离腕 > pip 离腕 => 伸
  for (let i = 1; i <= 4; i++) {
    const tipD = dist2D(lm[TIP[i]], wrist);
    const pipD = dist2D(lm[PIP[i]], wrist);
    states.push(tipD > pipD * 1.05);
  }
  return states;
}

/**
 * 手势分类(优先级:HEART > INDEX > PALM > FIST > IDLE)
 * @param {Array<{x,y,z}>} landmarks  21 个归一化关键点
 * @returns {'IDLE'|'INDEX'|'FIST'|'PALM'|'HEART'}
 */
export function classifyGesture(lm) {
  if (!lm || lm.length < 21) return 'IDLE';
  const [, index, middle, ring, pinky] = fingerStates(lm);
  const pinch = dist2D(lm[4], lm[8]) < PINCH_THRESHOLD;   // 拇指尖-食指尖

  if (pinch && middle && ring && pinky) return 'HEART';   // 🫰 捏合 + 三指伸
  if (index && !middle && !ring && !pinky) return 'INDEX';// ☝ 食指
  if (index && middle && ring && pinky) return 'PALM';    // 🖐 张掌(五指含拇指)
  if (!index && !middle && !ring && !pinky) return 'FIST';// ✊ 握拳
  return 'IDLE';
}
