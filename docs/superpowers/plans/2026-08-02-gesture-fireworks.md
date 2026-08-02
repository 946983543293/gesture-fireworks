# 手势烟花 / 火花写字 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一套摄像头手势驱动的金色火花交互(食指写字 / 握拳停笔 / 张掌烟花 / 🫰 3D 爱心彩蛋),桌面 60fps,最终打包成单个 `.bat` 离线运行。

**Architecture:** MediaPipe `HandLandmarker` 跑手部 21 关键点(~30fps,EMA 平滑+状态防抖),Three.js 独立 60fps 渲染循环(PerspectiveCamera + `THREE.Points` 加法粒子 + `UnrealBloomPass` 辉光);识别与渲染解耦,中间用插值。开发期 CDN(importmap),打包期 esbuild 打包 + 资源本地化,生成单文件 `.bat`(内嵌资源 + PowerShell HttpListener + 开浏览器)。

**Tech Stack:** Three.js 0.160.0, @mediapipe/tasks-vision 0.10.14(`hand_landmarker.task` full 模型),原生 ES Modules,Node `node:test` 做单测,esbuild 打包,Node 写打包脚本。

## Global Constraints

- 仅桌面端,目标 60fps;不做手机适配。
- 调色板(金 `#FFD24A` / 橙 `#FF8A1E` / 暖白 `#FFF3B0`),背景深夜黑 `#0a0a12`。
- 关键点 EMA 平滑 α = 0.5;手势防抖连续 3 帧;比心捏合阈值 `pinchThreshold = 0.06`(归一化坐标)。
- 粒子池上限 20000;食指写字笔迹持续留存,张掌才清空。
- 开发期 Three.js / MediaPipe 走 CDN(importmap);打包须**完全离线**。
- 交付物:单个 `dist/手势烟花.bat`,拷到任意无网 Windows 双击即可运行、摄像头可用。
- Node ≥ 18(本机 v22)。所有 commit 用项目 git(已 init)。

---

## File Structure

```
交互/
├── package.json                 type:module + 脚本 + esbuild devDep
├── .gitignore                   node_modules/ dist/
├── src/
│   ├── index.html               入口(importmap + 启动屏 + canvas + video)
│   ├── style.css
│   └── js/
│       ├── main.js              启动 + RAF 主循环 + 手势状态机
│       ├── camera.js            getUserMedia + 镜像 <video>
│       ├── handTracker.js       HandLandmarker 封装 + EMA 平滑
│       ├── gestures.js          classifyGesture 纯函数(可单测)
│       ├── systems/
│       │   ├── particlePool.js  GPU Points 加法粒子池
│       │   ├── trails.js        写字笔迹系统
│       │   ├── fireworks.js     张掌烟花
│       │   └── heart.js         🫰 3D 爱心彩蛋
│       ├── render/
│       │   └── scene.js         Three.js 场景/相机/bloom/背景视频
│       └── utils/
│           ├── constants.js     调色板/阈值/物理常量
│           ├── coords.js        关键点→世界坐标映射(镜像)
│           └── easing.js        easeOutBack 等
├── tests/
│   ├── gestures.test.js
│   ├── fixtures.js              makeHand 关键点 fixture 构造器
│   └── coords.test.js
├── tools/
│   └── build-bat.js             esbuild 打包 + 本地化 + 生成 .bat
└── dist/                        产出 .bat(打包后生成)
```

---

## Task 1: 项目脚手架 + 开发服务器 + 测试运行器

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `src/index.html`(最小占位)
- Create: `tests/sanity.test.js`

**Interfaces:**
- Produces: 可跑的 `node --test`、`npm run dev`(localhost 服务器)、空骨架页面。

- [ ] **Step 1: 写 `package.json`**

```json
{
  "name": "gesture-fireworks",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node tools/serve.js",
    "test": "node --test tests/",
    "build": "node tools/build-bat.js"
  },
  "dependencies": {
    "three": "^0.160.0",
    "@mediapipe/tasks-vision": "^0.10.14"
  },
  "devDependencies": {
    "esbuild": "^0.20.0"
  }
}
```

- [ ] **Step 2: 写 `.gitignore`**

```
node_modules/
dist/
*.log
```

- [ ] **Step 3: 写最小 `src/index.html`(占位,后续 task 替换)**

```html
<!doctype html>
<html lang="zh"><meta charset="utf-8"><title>手势烟花</title>
<style>body{margin:0;background:#0a0a12;color:#FFD24A;font:16px system-family}</style>
<h1 style="padding:1rem">脚手架就绪 ✓</h1>
```

- [ ] **Step 4: 写开发服务器 `tools/serve.js`(零依赖 Node http,服务 `src/` 于 localhost:8000)**

```js
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('../src/', import.meta.url);
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.mjs':'text/javascript', '.json':'application/json', '.wasm':'application/wasm' };
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let p = normalize(decodeURIComponent(url.pathname));
    if (p === '/' ) p = '/index.html';
    const file = await readFile(new URL('.' + p, ROOT));
    res.setHeader('Content-Type', MIME[extname(p)] ?? 'application/octet-stream');
    res.end(file);
  } catch (e) { res.statusCode = 404; res.end('404'); }
}).listen(8000, () => console.log('dev: http://localhost:8000/'));
```

- [ ] **Step 5: 写最小 `tests/sanity.test.js` 确认 node:test 跑得通**

```js
import { test } from 'node:test';
import * as assert from 'node:assert';
test('sanity', () => assert.equal(1 + 1, 2));
```

- [ ] **Step 6: 装 esbuild 并验证**

Run: `npm install`
Expected: 装好 esbuild + three + @mediapipe/tasks-vision,生成 node_modules(打包期 esbuild 需从 node_modules 解析 three/tasks-vision)。

- [ ] **Step 7: 跑测试**

Run: `npm test`
Expected: PASS(sanity 通过)。

- [ ] **Step 8: 验证 dev 服务器**

Run: `npm run dev`,浏览器开 `http://localhost:8000/`,看到"脚手架就绪 ✓"。
Expected: 页面正常显示。然后 Ctrl+C 停服务。

- [ ] **Step 9: Commit**

```bash
git add package.json .gitignore src tools tests
git commit -m "chore: 脚手架 + dev 服务器 + 测试运行器"
```

---

## Task 2: 摄像头模块(镜像 video + 启动按钮 + 错误处理)

**Files:**
- Create: `src/js/camera.js`
- Modify: `src/index.html`(替换为正式骨架:video + canvas + 启动屏)
- Create: `src/style.css`

**Interfaces:**
- Produces: `startCamera(videoEl: HTMLVideoElement): Promise<MediaStream>` —— 镜像、640x480、前置。失败抛 Error(带中文原因)。

- [ ] **Step 1: 写 `src/js/camera.js`**

```js
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
  videoEl.playsInline = true;       // iOS 防全屏(虽不做手机,留着无害)
  await videoEl.play();
  return stream;
}
```

- [ ] **Step 2: 写 `src/style.css`**

```css
* { margin:0; box-sizing:border-box; }
html,body { width:100%; height:100%; background:#0a0a12; overflow:hidden; font-family:system-ui,"Microsoft YaHei",sans-serif; }
#stage { position:fixed; inset:0; }
#scene-canvas { position:absolute; inset:0; width:100%; height:100%; display:block; }
#cam { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transform:scaleX(-1); opacity:0.18; }
#overlay { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#FFF3B0; text-align:center; pointer-events:none; }
#start { pointer-events:auto; padding:14px 28px; font-size:18px; border:none; border-radius:999px; background:linear-gradient(135deg,#FFD24A,#FF8A1E); color:#1a1205; cursor:pointer; box-shadow:0 0 24px #FF8A1E88; }
#status { margin-top:18px; font-size:14px; color:#FFD24A99; min-height:1em; }
.hint { position:absolute; left:16px; bottom:16px; font-size:12px; color:#FFD24A77; line-height:1.6; }
.error { color:#ff6b6b; }
```

- [ ] **Step 3: 写正式 `src/index.html`(importmap + 启动屏,JS 模块后续 task 填)**

```html
<!doctype html>
<html lang="zh">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>手势烟花</title>
  <link rel="stylesheet" href="style.css">
  <script type="importmap">
  { "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/",
    "@mediapipe/tasks-vision": "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs"
  }}
  </script>
</head>
<body>
  <div id="stage">
    <video id="cam" autoplay muted playsinline></video>
    <canvas id="scene-canvas"></canvas>
    <div id="overlay">
      <button id="start">✨ 开始(请允许摄像头)</button>
      <div id="status">点击开始</div>
    </div>
    <div class="hint">
      ☝ 食指 = 写字 &nbsp; ✊ 握拳 = 停笔 &nbsp; 🖐 张掌 = 烟花 &nbsp; 🫰 比心 = 爱心
    </div>
  </div>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: 写临时 `src/js/main.js`(只测摄像头)**

```js
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
```

- [ ] **Step 5: 手动验证(可视化测试)**

Run: `npm run dev`,开 `http://localhost:8000/`,点开始 → 允许摄像头。
Expected: 看到镜像(左右翻转)的低透明度摄像头画面(`transform:scaleX(-1)`)。拒绝权限或无摄像头时显示红字错误,不卡死。

- [ ] **Step 6: Commit**

```bash
git add src/js/camera.js src/index.html src/style.css src/js/main.js
git commit -m "feat(camera): 镜像摄像头 + 启动屏 + 错误处理"
```

---

## Task 3: 工具模块(常量 / 坐标映射 / 缓动)+ 单测

**Files:**
- Create: `src/js/utils/constants.js`
- Create: `src/js/utils/coords.js`
- Create: `src/js/utils/easing.js`
- Create: `tests/coords.test.js`

**Interfaces:**
- Produces:
  - `constants.js`: 命名导出 `PALETTE`、`PINCH_THRESHOLD=0.06`、`EMA_ALPHA=0.5`、`DEBOUNCE_FRAMES=3`、`PARTICLE_MAX=20000`、`GRAVITY`、各效果参数。
  - `coords.js`: `landmarkToWorld(pt, width, height): {x,y}` —— pt 是 `{x,y}` 归一化(0~1),返回镜像后的屏幕像素坐标(以画布左上为原点);`lerp(a,b,t)`。
  - `easing.js`: `easeOutBack(t)`、`easeOutCubic(t)`。

- [ ] **Step 1: 写 `src/js/utils/constants.js`**

```js
export const PALETTE = {
  gold: '#FFD24A', orange: '#FF8A1E', warmWhite: '#FFF3B0', bg: '#0a0a12',
  spark: ['#FFD24A', '#FF8A1E', '#FFF3B0', '#FFC233'],
};
export const PINCH_THRESHOLD = 0.06;
export const EMA_ALPHA = 0.5;
export const DEBOUNCE_FRAMES = 3;
export const PARTICLE_MAX = 20000;
export const GRAVITY = 900;            // px/s^2(烟花重力)
export const TRAIL_EMBERS_PER_FRAME = 4;
export const FIREWORK_SPARKS = 110;
export const HEART_HOLD_SEC = 1.0;
```

- [ ] **Step 2: 写 `src/js/utils/coords.js`**

```js
export function lerp(a, b, t) { return a + (b - a) * t; }

/** 归一化关键点(0~1)→ 镜像后的屏幕像素坐标 */
export function landmarkToWorld(pt, width, height) {
  return { x: (1 - pt.x) * width, y: pt.y * height };
}

/** 两点欧氏距离(2D) */
export function dist2D(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.hypot(dx, dy);
}
```

- [ ] **Step 3: 写 `src/js/utils/easing.js`**

```js
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
```

- [ ] **Step 4: 写失败测试 `tests/coords.test.js`**

```js
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
test('dist2D 3-4-5', () => assert.equal(dist2D({x:0,y:0},{x:3,y:4}), 5));
```

- [ ] **Step 5: 跑测试,确认通过**

Run: `npm test`
Expected: PASS(coords 四项 + sanity)。

- [ ] **Step 6: Commit**

```bash
git add src/js/utils tests/coords.test.js
git commit -m "feat(utils): 常量/坐标映射/缓动 + 单测"
```

---

## Task 4: 手势分类器(纯函数,TDD)

**Files:**
- Create: `src/js/gestures.js`
- Create: `tests/fixtures.js`
- Create: `tests/gestures.test.js`

**Interfaces:**
- Produces:
  - `gestures.js`: `classifyGesture(landmarks): GestureState`,返回 `'IDLE'|'INDEX'|'FIST'|'PALM'|'HEART'`;另导出 `fingerStates(landmarks)`(调试用)。`landmarks` 是 21 个 `{x,y,z}`(归一化)。
  - 优先级:HEART(拇指尖-食指尖捏合 + 中/无名/小指伸)> INDEX(食指伸 + 中/无名/小指弯)> PALM(五指全伸)> FIST(食/中/无名/小指全弯)> IDLE。
- Consumes: `PINCH_THRESHOLD`(constants.js)。

- [ ] **Step 1: 写关键点 fixture 构造器 `tests/fixtures.js`**

理想化右手:腕在 (0.5,0.9),手指沿 -y(向上)伸展。每根手指 4 关节(mcp/pip/dip/tip),`extended` 时 tip 远离腕,`curled` 时 tip 折回靠近掌心(mcp)。

```js
// 返回 21 个 {x,y,z},布局:wrist(0),拇指(1-4),食指(5-8),中指(9-12),无名指(13-16),小指(17-20)
export function makeHand({ thumb = 'extended', index = 'extended', middle = 'extended', ring = 'extended', pinky = 'extended', pinch = false } = {}) {
  const wrist = { x: 0.5, y: 0.9, z: 0 };
  const finger = (mcpX, ext, len = 0.28) => {
    const mcp = { x: mcpX, y: 0.78, z: 0 };
    const pip = { x: mcpX, y: 0.78 - len * 0.4, z: 0 };
    const dip = { x: mcpX, y: 0.78 - len * 0.7, z: 0 };
    const tip = ext
      ? { x: mcpX, y: 0.78 - len, z: 0 }              // 伸展:tip 最高(离腕最远)
      : { x: mcpX + 0.02, y: 0.74, z: 0 };            // 弯曲:tip 折回,靠近 mcp/掌心
    return [mcp, pip, dip, tip];
  };
  const idx = finger(0.50, index === 'extended');
  const mid = finger(0.60, middle === 'extended');
  const rng = finger(0.69, ring === 'extended');
  const pky = finger(0.78, pinky === 'extended');
  // 拇指:extended 时尖朝左外,pinch 时尖贴近食指尖
  const idxTip = idx[3];
  const thumbTip = pinch
    ? { x: idxTip.x + 0.03, y: idxTip.y, z: 0 }       // 捏到食指尖旁
    : (thumb === 'extended' ? { x: 0.40, y: 0.66, z: 0 } : { x: 0.46, y: 0.78, z: 0 });
  const thumb = [
    { x: 0.44, y: 0.86, z: 0 }, { x: 0.42, y: 0.80, z: 0 },
    { x: 0.41, y: 0.73, z: 0 }, thumbTip,
  ];
  return [wrist, ...thumb, ...idx, ...mid, ...rng, ...pky];
}
```

- [ ] **Step 2: 写失败测试 `tests/gestures.test.js`**

```js
import { test } from 'node:test';
import * as assert from 'node:assert';
import { classifyGesture, fingerStates } from '../src/js/gestures.js';
import { makeHand } from './fixtures.js';

test('INDEX: 食指伸 + 中无名小指弯', () => {
  const lm = makeHand({ index:'extended', middle:'curled', ring:'curled', pinky:'curled' });
  assert.equal(classifyGesture(lm), 'INDEX');
});
test('PALM: 五指全伸', () => {
  const lm = makeHand({ thumb:'extended', index:'extended', middle:'extended', ring:'extended', pinky:'extended' });
  assert.equal(classifyGesture(lm), 'PALM');
});
test('FIST: 四指全弯', () => {
  const lm = makeHand({ thumb:'curled', index:'curled', middle:'curled', ring:'curled', pinky:'curled' });
  assert.equal(classifyGesture(lm), 'FIST');
});
test('HEART: 捏合 + 中无名小指伸', () => {
  const lm = makeHand({ pinch:true, index:'curled', middle:'extended', ring:'extended', pinky:'extended' });
  assert.equal(classifyGesture(lm), 'HEART');
});
test('IDLE: 介于各种手势之间(如仅中指伸)', () => {
  const lm = makeHand({ index:'curled', middle:'extended', ring:'curled', pinky:'curled' });
  assert.equal(classifyGesture(lm), 'IDLE');
});
test('fingerStates 返回 5 个布尔', () => {
  const lm = makeHand({ index:'extended', middle:'curled', ring:'curled', pinky:'curled', thumb:'extended' });
  const s = fingerStates(lm);
  assert.equal(s.length, 5);
  assert.equal(s[1], true);  // index
  assert.equal(s[2], false); // middle
});
```

- [ ] **Step 3: 跑测试,确认全部 FAIL(函数未定义)**

Run: `npm test`
Expected: gestures 相关 6 项 FAIL(import 失败 / not a function)。

- [ ] **Step 4: 写 `src/js/gestures.js` 实现**

```js
import { PINCH_THRESHOLD } from './utils/constants.js';
import { dist2D } from './utils/coords.js';

// 关键点索引
const WRIST = 0;
const TIP = [4, 8, 12, 16, 20];          // 拇指/食/中/无名/小 tip
const PIP = [null, 6, 10, 14, 18];        // 食/中/无名/小 的 PIP(拇指无 PIP 判定)
const INDEX_MCP = 5;

/** 五指伸展状态(拇指特殊处理) */
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
  return states; // [thumb,index,middle,ring,pinky]
}

export function classifyGesture(lm) {
  if (!lm || lm.length < 21) return 'IDLE';
  const [thumb, index, middle, ring, pinky] = fingerStates(lm);
  const pinch = dist2D(lm[4], lm[8]) < PINCH_THRESHOLD;   // 拇指尖-食指尖
  // HEART:捏合 + 中/无名/小指伸
  if (pinch && middle && ring && pinky) return 'HEART';
  // INDEX:食指伸 + 中/无名/小指弯(拇指忽略)
  if (index && !middle && !ring && !pinky) return 'INDEX';
  // PALM:五指全伸
  if (thumb && index && middle && ring && pinky) return 'PALM';
  // FIST:食/中/无名/小指全弯
  if (!index && !middle && !ring && !pinky) return 'FIST';
  return 'IDLE';
}
```

- [ ] **Step 5: 跑测试,确认全部 PASS**

Run: `npm test`
Expected: 全部 PASS(含 coords + sanity)。

- [ ] **Step 6: Commit**

```bash
git add src/js/gestures.js tests/fixtures.js tests/gestures.test.js
git commit -m "feat(gestures): 4手势+比心分类纯函数(TDD)"
```

---

## Task 5: 手部追踪(HandLandmarker 封装 + EMA 平滑 + 调试点)

**Files:**
- Create: `src/js/handTracker.js`
- Modify: `src/js/main.js`(接入追踪,叠加 21 调试点验证)

**Interfaces:**
- Produces: `class HandTracker`:
  - `constructor(video: HTMLVideoElement)`
  - `async init(): Promise<void>`(加载模型)
  - `update(): HandData[]` —— 每帧调用,返回 `[{ landmarks: {x,y,z}[21], handedness: 'Left'|'Right' }]`(已 EMA 平滑);无手时返回 `[]`。
- Consumes: `@mediapipe/tasks-vision`、`EMA_ALPHA`。

- [ ] **Step 1: 写 `src/js/handTracker.js`**

```js
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { EMA_ALPHA } from './utils/constants.js';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export class HandTracker {
  constructor(video) { this.video = video; this.lm = null; this.smoothed = null; this.ts = -1; }
  async init() {
    const fs = await FilesetResolver.forVisionTasks(WASM);
    this.lm = await HandLandmarker.createFromOptions(fs, {
      baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO', numHands: 2,
    });
  }
  update() {
    if (!this.lm || this.video.readyState < 2) return [];
    const now = Math.trunc(performance.now());   // MediaPipe 要求单调递增整数毫秒
    if (now <= this.ts) return this._last || [];
    this.ts = now;
    const r = this.lm.detectForVideo(this.video, now);
    const out = [];
    for (let h = 0; h < (r.landmarks?.length || 0); h++) {
      const raw = r.landmarks[h];
      // EMA 平滑(首次直接用 raw)
      if (!this.smoothed) this.smoothed = new Map();
      let sm = this.smoothed.get(h);
      if (!sm) { sm = raw.map(p => ({ ...p })); this.smoothed.set(h, sm); }
      else for (let i = 0; i < 21; i++) {
        sm[i].x = sm[i].x + (raw[i].x - sm[i].x) * EMA_ALPHA;
        sm[i].y = sm[i].y + (raw[i].y - sm[i].y) * EMA_ALPHA;
        sm[i].z = sm[i].z + (raw[i].z - sm[i].z) * EMA_ALPHA;
      }
      out.push({ landmarks: sm, handedness: r.handednesses?.[h]?.[0]?.categoryName || 'Right' });
    }
    // 手消失时清缓存,避免索引错位
    if (out.length === 0) this.smoothed?.clear();
    this._last = out;
    return out;
  }
}
```

- [ ] **Step 2: 改 `src/js/main.js` 接入追踪 + 画 21 调试点**

```js
import { startCamera } from './camera.js';
import { HandTracker } from './handTracker.js';
import { landmarkToWorld } from './utils/coords.js';

const video = document.getElementById('cam');
const canvas = document.getElementById('scene-canvas');
const ctx = canvas.getContext('2d');
const btn = document.getElementById('start');
const status = document.getElementById('status');

function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

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
    status.classList.add('error'); status.textContent = e.message;
  }
});

function loop(tracker) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const hands = tracker.update();
  for (const { landmarks } of hands) {
    for (let i = 0; i < 21; i++) {
      const p = landmarkToWorld(landmarks[i], canvas.width, canvas.height);
      ctx.fillStyle = i === 8 ? '#FFD24A' : '#FF8A1E88';
      ctx.beginPath(); ctx.arc(p.x, p.y, i === 8 ? 6 : 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  requestAnimationFrame(() => loop(tracker));
}
```

- [ ] **Step 3: 手动验证(可视化测试)**

Run: `npm run dev`,点开始 → 等模型加载。
Expected: 画面上 21 个点贴合你的手并实时跟随;食指尖(点8)为金色亮点;手抖动时点较稳定(EMA);两只手同时出现各自有点。模型加载失败显示红字。

- [ ] **Step 4: Commit**

```bash
git add src/js/handTracker.js src/js/main.js
git commit -m "feat(tracker): HandLandmarker 封装 + EMA 平滑 + 调试叠加"
```

---

## Task 6: Three.js 场景(透视相机 + bloom + 镜像背景 + 测试发光球)

**Files:**
- Create: `src/js/render/scene.js`
- Modify: `src/js/main.js`(用 Three.js 渲染替换 2D 调试点;背景铺镜像 video)

**Interfaces:**
- Produces: `createScene(canvas, video)` 返回:
  - `{ scene, camera, composer, render(), setSize(w,h), getWorldZ(): number, add(obj), remove(obj) }`
  - `getWorldZ()` 返还"手所在固定 z 平面"的世界 z(用于把屏幕坐标映射进该平面)。
- Consumes: `three`、`three/addons/` 的 EffectComposer/RenderPass/UnrealBloomPass。

- [ ] **Step 1: 写 `src/js/render/scene.js`**

```js
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export function createScene(canvas, video) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a12);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 5000);
  // 把交互平面放在 z=0;相机退后以覆盖屏幕(用 setSize 时调整 camera.position.z)
  const INTERACT_Z = 0;
  camera.position.z = 600;

  // 背景由 CSS 提供:body(#0a0a12) + 镜像 <video>(opacity .18);canvas 透明叠加其上
  scene.background = null;
  renderer.setClearColor(0x000000, 0);

  // bloom 后处理
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.2, 0.6, 0.0);
  composer.addPass(bloom);

  function setSize(w, h) {
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    // 调整相机距离,使 z=INTERACT_Z 平面与屏幕像素 1:1 对应(便于用屏幕坐标)
    const fovRad = camera.fov * Math.PI / 180;
    camera.position.z = (h / 2) / Math.tan(fovRad / 2);
    camera.updateProjectionMatrix();
  }

  function render() { composer.render(); }
  // 把屏幕像素坐标(以画布中心为原点)→ z=INTERACT_Z 平面世界坐标
  function screenToWorld(sx, sy, w, h) {
    return new THREE.Vector3(sx - w / 2, h / 2 - sy, INTERACT_Z);
  }

  return { renderer, scene, camera, composer, render, setSize, add: (o)=>scene.add(o), remove:(o)=>scene.remove(o), screenToWorld };
}
```

- [ ] **Step 2: 改 `src/js/main.js` 用 Three.js 场景(放一个测试发光球验证 bloom)**

```js
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
    const resize = () => S.setSize(innerWidth, innerHeight);
    addEventListener('resize', resize); resize();

    // 测试:bloom 验证发光球
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(40, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xFFD24A })
    );
    S.add(ball);

    status.textContent = '✓ 可见发光金球即 bloom 正常';
    const t0 = performance.now();
    (function loop() {
      ball.position.set(Math.sin((performance.now()-t0)/600)*200, 0, 0);
      tracker.update();
      S.render();
      requestAnimationFrame(loop);
    })();
  } catch (e) { status.classList.add('error'); status.textContent = e.message; }
});
```

- [ ] **Step 3: 手动验证(可视化测试)**

Run: `npm run dev`,点开始。
Expected: 暗背景(body)+ 低透明度镜像摄像头画面(`#cam`);一个左右移动的金色球,带明显**辉光光晕**(bloom 生效)。窗口缩放时球大小/比例正常。

> 若背景发黑(透明合成异常):把 `scene.js` 里 `setClearColor(0x000000,0)` 改为 `(0x0a0a12,1)`,牺牲摄像头背景层,功能不受影响。

- [ ] **Step 4: Commit**

```bash
git add src/js/render/scene.js src/js/main.js
git commit -m "feat(render): Three.js 场景 + 透视相机 + bloom + 镜像背景"
```

---

## Task 7: GPU 粒子池(加法混合发光火星)

**Files:**
- Create: `src/js/systems/particlePool.js`
- Modify: `src/js/main.js`(点击画布撒一簇火星验证)

**Interfaces:**
- Produces: `class ParticlePool`:
  - `constructor(scene, maxCount = PARTICLE_MAX)`
  - `spawn({ position:THREE.Vector3, velocity:THREE.Vector3, color:THREE.Color|hex, size:number, life:number })`
  - `update(dt:number)` —— 推进位置/速度/生命,回收死亡粒子
  - 粒子贴图为软圆点,`AdditiveBlending`,发光靠 bloom。
- Consumes: `three`、`PARTICLE_MAX`、`GRAVITY`(可选,粒子可设 gravity 系数)。

- [ ] **Step 1: 写 `src/js/systems/particlePool.js`**

```js
import * as THREE from 'three';
import { PARTICLE_MAX } from '../utils/constants.js';

// 软圆点贴图(运行时生成)
function makeDotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class ParticlePool {
  constructor(scene, maxCount = PARTICLE_MAX) {
    this.max = maxCount; this.cursor = 0;
    this.pos = new Float32Array(maxCount * 3);
    this.col = new Float32Array(maxCount * 3);
    this.size = new Float32Array(maxCount);
    this.alpha = new Float32Array(maxCount);
    // 每粒子状态
    this.vel = new Array(maxCount).fill(0).map(() => new THREE.Vector3());
    this.life = new Float32Array(maxCount);
    this.maxLife = new Float32Array(maxCount);
    this.baseSize = new Float32Array(maxCount);
    this.gravity = new Float32Array(maxCount);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: makeDotTexture() }, uPixel: { value: 1 } },
      vertexShader: `
        attribute float aSize; attribute float aAlpha; varying vec3 vColor; varying float vAlpha;
        void main(){ vColor=color; vAlpha=aAlpha;
          vec4 mv=modelViewMatrix*vec4(position,1.0);
          gl_PointSize = aSize * (300.0 / -mv.z);
          gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `
        uniform sampler2D uTex; varying vec3 vColor; varying float vAlpha;
        void main(){ vec4 t=texture2D(uTex,gl_PointCoord); gl_FragColor=vec4(vColor,vAlpha)*t.a; }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.geo = geo;
  }
  setPixelRatio(pr) { /* 预留 */ }
  spawn(o) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
    const p = o.position;
    this.pos[i*3]=p.x; this.pos[i*3+1]=p.y; this.pos[i*3+2]=p.z;
    this.vel[i].copy(o.velocity || new THREE.Vector3());
    const c = new THREE.Color(o.color ?? 0xFFD24A);
    this.col[i*3]=c.r; this.col[i*3+1]=c.g; this.col[i*3+2]=c.b;
    this.baseSize[i] = o.size ?? 6; this.size[i] = this.baseSize[i];
    this.alpha[i] = 1;
    this.life[i] = this.maxLife[i] = o.life ?? 0.8;
    this.gravity[i] = o.gravity ?? 0;
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const v = this.vel[i];
      v.y -= this.gravity[i] * dt;
      this.pos[i*3]   += v.x * dt;
      this.pos[i*3+1] += v.y * dt;
      this.pos[i*3+2] += v.z * dt;
      const k = Math.max(this.life[i] / this.maxLife[i], 0);
      this.alpha[i] = k;
      this.size[i] = this.baseSize[i] * (0.4 + 0.6 * k);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }
}
```

- [ ] **Step 2: 改 `src/js/main.js` 接入粒子池(点击撒一簇火星验证发光)**

在 Task 6 的 main.js 基础上,移除测试球,加入粒子池;点击屏幕在点击处爆发 80 颗带重力的金色火星。关键改动:

```js
import { ParticlePool } from './systems/particlePool.js';
import { PALETTE, GRAVITY } from './utils/constants.js';
// ...在 createScene 之后:
const pool = new ParticlePool(S.scene);
S.scene.remove(ball); // 移除测试球
let last = performance.now();
addEventListener('click', (e) => {
  const w = S.screenToWorld ? null : null;
  const pos = S.screenToWorld(e.clientX, e.clientY, innerWidth, innerHeight);
  for (let i = 0; i < 80; i++) {
    const a = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 260;
    pool.spawn({
      position: pos.clone(),
      velocity: new THREE.Vector3(Math.cos(a)*sp, Math.sin(a)*sp + 120, 0),
      color: PALETTE.spark[i % PALETTE.spark.length],
      size: 6 + Math.random()*6, life: 0.8 + Math.random()*0.6, gravity: GRAVITY,
    });
  }
});
// 主循环里:
const loop = () => {
  const now = performance.now(); const dt = Math.min((now - last)/1000, 0.05); last = now;
  tracker.update(); pool.update(dt); S.render();
  requestAnimationFrame(loop);
}; loop();
```

- [ ] **Step 3: 手动验证(可视化测试)**

Run: `npm run dev`,点开始后**点击屏幕**。
Expected: 点击处爆出 ~80 颗金色/橙色火星,带重力下落、淡出;有发光辉光(bloom);帧率流畅(开发者工具 Performance 看 ~60fps)。

- [ ] **Step 4: Commit**

```bash
git add src/js/systems/particlePool.js src/js/main.js
git commit -m "feat(particles): GPU 加法粒子池 + 点击撒火星验证"
```

---

## Task 8: 写字笔迹系统(食指留火花,持续留存)

**Files:**
- Create: `src/js/systems/trails.js`
- Modify: `src/js/main.js`(接入手势状态机:INDEX 时画迹,FIST/IDLE 停笔,笔迹留存)

**Interfaces:**
- Produces: `class TrailSystem`:
  - `constructor(pool: ParticlePool)`
  - `addPoint(worldPos: THREE.Vector3, dt)` —— 写字时每帧调,内部按位移阈值断笔,撒火星
  - `vertices(): THREE.Vector3[]` —— 返回所有笔迹点(供烟花消费)
  - `clear()` —— 清空(张掌后)
- Consumes: `ParticlePool`、`PALETTE`、`TRAIL_EMBERS_PER_FRAME`、`classifyGesture`(在 main 里判状态)。

- [ ] **Step 1: 写 `src/js/systems/trails.js`**

```js
import * as THREE from 'three';
import { PALETTE, TRAIL_EMBERS_PER_FRAME } from '../utils/constants.js';

export class TrailSystem {
  constructor(pool) {
    this.pool = pool;
    this.points = [];          // THREE.Vector3 持久笔迹点
    this.lastTip = null;       // 上一帧指尖位置(断笔用)
    this.BREAK_DIST = 26;      // 帧间位移超过此值视为抬手,断笔
  }
  addPoint(pos, dt) {
    if (this.lastTip && pos.distanceTo(this.lastTip) > this.BREAK_DIST) {
      this.lastTip = pos.clone();   // 断笔,本帧不撒
      return;
    }
    this.points.push(pos.clone());
    // 沿指尖撒火星
    for (let i = 0; i < TRAIL_EMBERS_PER_FRAME; i++) {
      const jx = (Math.random()-0.5)*8, jy = (Math.random()-0.5)*8;
      this.pool.spawn({
        position: new THREE.Vector3(pos.x+jx, pos.y+jy, pos.z),
        velocity: new THREE.Vector3((Math.random()-0.5)*30, (Math.random()-0.5)*30, 0),
        color: PALETTE.spark[(Math.random()*PALETTE.spark.length)|0],
        size: 5 + Math.random()*4, life: 0.5 + Math.random()*0.4, gravity: 0,
      });
    }
    this.lastTip = pos.clone();
  }
  pause() { this.lastTip = null; }   // 握拳/停笔时清断笔参照
  vertices() { return this.points; }
  clear() { this.points = []; this.lastTip = null; }
}
```

- [ ] **Step 2: 改 `src/js/main.js` 接入手势状态机 + 笔迹**

在 Task 7 基础上,引入 `classifyGesture`、`TrailSystem`、防抖状态机。核心改动:

```js
import { classifyGesture } from './gestures.js';
import { TrailSystem } from './systems/trails.js';
import { DEBOUNCE_FRAMES } from './utils/constants.js';

const trails = new TrailSystem(pool);
// 手势防抖状态机
let curGesture = 'IDLE', pending = 'IDLE', pendCount = 0;
function observe(raw) {
  if (raw === pending) pendCount++; else { pending = raw; pendCount = 1; }
  if (pendCount >= DEBOUNCE_FRAMES && pending !== curGesture) { curGesture = pending; return true; }
  return false;
}
// 主循环里(替换之前):
const loop = () => {
  const now = performance.now(); const dt = Math.min((now-last)/1000, 0.05); last = now;
  const hands = tracker.update();
  let g = 'IDLE';
  if (hands.length) {
    const lm = hands[0].landmarks;            // 取主手
    g = classifyGesture(lm);
    const tip = landmarkToWorld(lm[8], innerWidth, innerHeight);
    const pos = S.screenToWorld(tip.x, tip.y, innerWidth, innerHeight);
    if (g === 'INDEX') trails.addPoint(pos, dt);
    else trails.pause();
  } else trails.pause();
  const changed = observe(g);
  // (rising-edge 动作在 Task 9/10 接入)
  pool.update(dt); S.render();
  status.textContent = `手势: ${curGesture}`;
  requestAnimationFrame(loop);
}; loop();
```
> 需要 `import { landmarkToWorld } from './utils/coords.js';`

- [ ] **Step 3: 手动验证(可视化测试)**

Run: `npm run dev`,点开始。
Expected: 伸出食指 → 指尖留金色火花笔迹,持续不消失;握拳移动 → 不留笔迹;再伸食指 → 继续画(断笔正常);状态文字显示当前手势。笔迹**不会自己消失**(直到 Task 9 张掌才清)。

- [ ] **Step 4: Commit**

```bash
git add src/js/systems/trails.js src/js/main.js
git commit -m "feat(trails): 食指火花笔迹系统 + 手势状态机"
```

---

## Task 9: 张掌烟花(笔迹炸开 + 清空)

**Files:**
- Create: `src/js/systems/fireworks.js`
- Modify: `src/js/main.js`(张掌 rising edge 触发烟花)

**Interfaces:**
- Produces: `class FireworksSystem`:
  - `constructor(pool: ParticlePool)`
  - `burstAt(vertices: THREE.Vector3[])` —— 每个笔迹点变火箭/爆花;调用方随后 `trails.clear()`。
- Consumes: `ParticlePool`、`FIREWORK_SPARKS`、`GRAVITY`、`PALETTE`。

- [ ] **Step 1: 写 `src/js/systems/fireworks.js`**

```js
import * as THREE from 'three';
import { FIREWORK_SPARKS, GRAVITY, PALETTE } from '../utils/constants.js';

export class FireworksSystem {
  constructor(pool) { this.pool = pool; }
  burstAt(vertices) {
    // 笔迹点可能很多,降采样避免一次爆太多
    const step = Math.max(1, Math.floor(vertices.length / 60));
    for (let i = 0; i < vertices.length; i += step) {
      const v = vertices[i];
      for (let k = 0; k < FIREWORK_SPARKS; k++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 320;
        this.pool.spawn({
          position: v.clone(),
          velocity: new THREE.Vector3(Math.cos(a)*sp, Math.sin(a)*sp, 0),
          color: PALETTE.spark[(Math.random()*PALETTE.spark.length)|0],
          size: 4 + Math.random()*5, life: 0.9 + Math.random()*0.8, gravity: GRAVITY*0.6,
        });
      }
    }
  }
}
```

- [ ] **Step 2: 改 `src/js/main.js` 接入烟花 rising-edge**

```js
import { FireworksSystem } from './systems/fireworks.js';
const fireworks = new FireworksSystem(pool);
let lastGesture = 'IDLE';
// 在主循环里,处理 changed / rising-edge:
const loop = () => {
  // ...(同 Task 8:tracker、classify、trails、observe)...
  // 张掌 rising edge
  if (curGesture === 'PALM' && lastGesture !== 'PALM') {
    fireworks.burstAt(trails.vertices());
    trails.clear();
  }
  lastGesture = curGesture;
  pool.update(dt); S.render();
  requestAnimationFrame(loop);
}; loop();
```

- [ ] **Step 3: 手动验证(可视化测试)**

Run: `npm run dev`。
Expected: 用食指画一些字 → 张开手掌 → 所有笔迹**同时炸成金色烟花**(带重力下落、辉光)→ 笔迹清空 → 可重新画。反复张掌不会无限叠炸(rising-edge)。无笔迹时张掌无异常。

- [ ] **Step 4: Commit**

```bash
git add src/js/systems/fireworks.js src/js/main.js
git commit -m "feat(fireworks): 张掌笔迹炸烟花 + 清空"
```

---

## Task 10: 🫰 3D 爱心彩蛋(弹出+旋转+炸成心形粒子)

**Files:**
- Create: `src/js/systems/heart.js`
- Modify: `src/js/main.js`(HEART rising edge 触发,带冷却)

**Interfaces:**
- Produces: `class HeartSystem`:
  - `constructor(scene, pool)`
  - `spawnAt(worldPos: THREE.Vector3)` —— 在捏合点生成 3D 心形,自动动画(弹出→旋转→保持→爆心形粒子),内部自管理生命周期。
  - `update(dt)` —— 每帧推进。
- Consumes: `three`(ExtrudeGeometry)、`ParticlePool`、`easeOutBack`、`HEART_HOLD_SEC`、`PALETTE`。

- [ ] **Step 1: 写心形 2D 曲线 + `src/js/systems/heart.js`**

```js
import * as THREE from 'three';
import { easeOutBack } from '../utils/easing.js';
import { HEART_HOLD_SEC, PALETTE } from '../utils/constants.js';

// 心形 2D Shape(饱满,用于挤出 + 倒角)
function heartShape() {
  const s = new THREE.Shape();
  const N = 12; // 缩放
  s.moveTo(0, -3*N);
  s.bezierCurveTo(0,-1*N, -2*N,1*N, -5*N,1*N);
  s.bezierCurveTo(-9*N,1*N, -9*N,-4*N, -9*N,-4*N);
  s.bezierCurveTo(-9*N,-7*N, -6*N,-9*N, 0,-6*N);  // 顶部中央下凹
  s.bezierCurveTo(6*N,-9*N, 9*N,-7*N, 9*N,-4*N);
  s.bezierCurveTo(9*N,-4*N, 9*N,1*N, 5*N,1*N);
  s.bezierCurveTo(2*N,1*N, 0,-1*N, 0,-3*N);
  return s;
}

export class HeartSystem {
  constructor(scene, pool) { this.scene = scene; this.pool = pool; this.active = []; }
  spawnAt(pos) {
    const geo = new THREE.ExtrudeGeometry(heartShape(), {
      depth: 28, bevelEnabled: true, bevelThickness: 8, bevelSize: 6, bevelSegments: 4, curveSegments: 24,
    });
    geo.center(); geo.rotateZ(Math.PI);          // 心尖朝下
    const mat = new THREE.MeshStandardMaterial({
      color: 0xFF8A1E, emissive: 0xFF5A1E, emissiveIntensity: 1.2,
      metalness: 0.3, roughness: 0.35,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.scale.setScalar(0.001);
    this.scene.add(mesh);
    // 需要灯光让 MeshStandardMaterial 可见
    if (!this._lit) {
      this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const dl = new THREE.DirectionalLight(0xfff0d0, 1.0); dl.position.set(0, 0, 1); this.scene.add(dl);
      this._lit = true;
    }
    this.active.push({ mesh, t: 0, phase: 'in' });
  }
  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const h = this.active[i]; h.t += dt;
      if (h.phase === 'in') {
        const k = Math.min(h.t / 0.35, 1);
        h.mesh.scale.setScalar(easeOutBack(k) * 1.0);
        h.mesh.rotation.y += dt * 4;
        if (k >= 1) { h.phase = 'hold'; h.t = 0; }
      } else if (h.phase === 'hold') {
        h.mesh.rotation.y += dt * 3;
        if (h.t >= HEART_HOLD_SEC) { h.phase = 'burst'; this._burst(h.mesh.position); this.scene.remove(h.mesh); h.mesh.geometry.dispose(); h.mesh.material.dispose(); this.active.splice(i,1); }
      }
    }
  }
  _burst(pos) {
    // 按心形轮廓排布粒子向外飞散
    const N = 120;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r = 1 + 0.3*Math.random();
      // 心形参数方向(简化):取圆形 + 上沿压心形
      const sp = 120 + Math.random()*180;
      this.pool.spawn({
        position: pos.clone(),
        velocity: new THREE.Vector3(Math.cos(a)*sp, Math.sin(a)*sp + 60, (Math.random()-0.5)*120),
        color: PALETTE.spark[(Math.random()*PALETTE.spark.length)|0],
        size: 5 + Math.random()*5, life: 0.9 + Math.random()*0.7, gravity: 200,
      });
    }
  }
}
```

- [ ] **Step 2: 改 `src/js/main.js` 接入 HEART rising-edge + 冷却**

```js
import { HeartSystem } from './systems/heart.js';
const heart = new HeartSystem(S.scene, pool);
let heartCooldown = 0;
// 主循环里:
heart.update(dt);
if (curGesture === 'HEART' && lastGesture !== 'HEART' && heartCooldown <= 0) {
  const lm = hands[0]?.landmarks;   // 复用本帧 tracker.update() 的 hands(在上层已取得)
  if (lm) {
    const p4 = landmarkToWorld(lm[4], innerWidth, innerHeight);
    const p8 = landmarkToWorld(lm[8], innerWidth, innerHeight);
    const cx = (p4.x+p8.x)/2, cy = (p4.y+p8.y)/2;
    heart.spawnAt(S.screenToWorld(cx, cy, innerWidth, innerHeight));
    heartCooldown = 2.5;   // 秒
  }
}
heartCooldown = Math.max(0, heartCooldown - dt);
lastGesture = curGesture;
```
> 说明:复用本帧主循环里 `const hands = tracker.update()` 的结果(已取得 lm),不要重复调用 `tracker.update()`。

- [ ] **Step 3: 手动验证(可视化测试)**

Run: `npm run dev`。
Expected: 比心 🫰 → 捏合点弹出**饱满的 3D 金色爱心**(带回弹),绕 Y 轴旋转 ~1 秒 → 炸成心形金色粒子飞散消散;bloom 使爱心通体发光;2.5 秒冷却内重复比心不重复触发;比心过程中不影响写字状态切换。

- [ ] **Step 4: Commit**

```bash
git add src/js/systems/heart.js src/js/main.js
git commit -m "feat(heart): 🫰 3D 爱心彩蛋(弹出+旋转+心形粒子)"
```

---

## Task 11: 收尾主循环(整合、UX、闲置提示、错误兜底)

**Files:**
- Modify: `src/js/main.js`(整合所有系统为最终版,加闲置提示)
- Modify: `src/index.html`(如需)
- Manual: 完整走查验收清单

**Interfaces:** 不新增导出;整合既有。

- [ ] **Step 1: 整合 `main.js` 为最终干净版本**

把 Task 6–10 的片段合并为单一连贯的主循环,关键要点:
1. 启动按钮 → startCamera → tracker.init → createScene → new ParticlePool / TrailSystem / FireworksSystem / HeartSystem。
2. RAF 循环:tracker.update → 取 hands → classifyGesture → trails/状态机 → rising-edge 烟花 & 爱心 → pool.update / heart.update → S.render。
3. 闲置提示:连续 4 秒 `hands.length===0` → status 显示"请把手伸进画面 ☝";检测到手清零。
4. `last` 时间戳初始化在循环外;dt clamp 0.05。

最终 `main.js` 主体(整合版,供实现者参照):

```js
import { startCamera } from './camera.js';
import { HandTracker } from './handTracker.js';
import { createScene } from './render/scene.js';
import { ParticlePool } from './systems/particlePool.js';
import { TrailSystem } from './systems/trails.js';
import { FireworksSystem } from './systems/fireworks.js';
import { HeartSystem } from './systems/heart.js';
import { classifyGesture } from './gestures.js';
import { landmarkToWorld } from './utils/coords.js';
import { DEBOUNCE_FRAMES } from './utils/constants.js';
import * as THREE from 'three';

const video = document.getElementById('cam');
const canvas = document.getElementById('scene-canvas');
const btn = document.getElementById('start');
const status = document.getElementById('status');

btn.addEventListener('click', async () => {
  btn.remove();
  try {
    status.textContent = '加载手部模型…';
    await startCamera(video);
    const tracker = new HandTracker(video);
    await tracker.init();
    const S = createScene(canvas, video);
    const onResize = () => S.setSize(innerWidth, innerHeight);
    addEventListener('resize', onResize); onResize();
    const pool = new ParticlePool(S.scene);
    const trails = new TrailSystem(pool);
    const fireworks = new FireworksSystem(pool);
    const heart = new HeartSystem(S.scene, pool);

    let cur='IDLE', pend='IDLE', pcnt=0, lastG='IDLE';
    let cool=0, idle=0, last=performance.now();
    status.textContent = '☝ 伸食指写字';
    (function loop(){
      const now=performance.now(); const dt=Math.min((now-last)/1000,0.05); last=now;
      const hands=tracker.update();
      let g='IDLE';
      if(hands.length){
        idle=0;
        const lm=hands[0].landmarks;
        g=classifyGesture(lm);
        const tip=landmarkToWorld(lm[8],innerWidth,innerHeight);
        const pos=S.screenToWorld(tip.x,tip.y,innerWidth,innerHeight);
        if(g==='INDEX') trails.addPoint(pos,dt); else trails.pause();
        // 比心
        if(g==='HEART'&&lastG!=='HEART'&&cool<=0){
          const p4=landmarkToWorld(lm[4],innerWidth,innerHeight),p8=landmarkToWorld(lm[8],innerWidth,innerHeight);
          heart.spawnAt(S.screenToWorld((p4.x+p8.x)/2,(p4.y+p8.y)/2,innerWidth,innerHeight));
          cool=2.5;
        }
      } else { trails.pause(); idle+=dt; }
      // 防抖
      if(g===pend) pcnt++; else {pend=g;pcnt=1;}
      if(pcnt>=DEBOUNCE_FRAMES&&pend!==cur) cur=pend;
      // 张掌 rising edge
      if(cur==='PALM'&&lastG!=='PALM'){ fireworks.burstAt(trails.vertices()); trails.clear(); }
      cool=Math.max(0,cool-dt);
      heart.update(dt); pool.update(dt);
      lastG=cur;
      status.textContent = (!hands.length&&idle>4) ? '请把手伸进画面 ☝' : '';
      S.render();
      requestAnimationFrame(loop);
    })();
  } catch(e){ status.classList.add('error'); status.textContent=e.message; console.error(e); }
});
```

- [ ] **Step 2: 完整手动验收(对照 spec 第 11 节清单)**

逐项验证:
- [ ] 食指画金色火花字迹,清晰、发光、持续留存
- [ ] 握拳移动不留笔迹
- [ ] 张掌 → 笔迹炸烟花 + 清空,可继续写
- [ ] 🫰 → 旋转饱满 3D 金心 → 炸心形粒子
- [ ] 桌面 60fps(bloom 好看)
- [ ] 无手 4 秒后出现"请把手伸进画面";模型加载失败/拒绝摄像头有红字提示
Expected: 全部通过。

- [ ] **Step 3: Commit**

```bash
git add src/js/main.js src/index.html
git commit -m "feat(main): 整合主循环 + 闲置提示 + 错误兜底"
```

---

## Task 12: 打包成单文件 `.bat`(离线、双击运行)

**Files:**
- Create: `tools/build-bat.js`
- Modify: `package.json`(`build` 脚本已存在)
- 产出: `dist/手势烟花.bat`

**目标:** 把 CDN 依赖全部本地化 + esbuild 打成单 JS,连同 MediaPipe wasm + 模型,base64 内嵌进一个 `.bat`;双击后 PowerShell 解压到临时目录 → 起 HttpListener → 开浏览器 → 关窗清理。

**关键接口:**
- `build-bat.js` 读取 `src/index.html` + `src/js/main.js`,用 esbuild bundle 生成 `app.js`(含 three/tasks-vision/我们的代码),下载 wasm + model 到 `dist/build/`,生成 `index.html`(引用 `./app.js`,MediaPipe wasm/model 指向 `./`),最后把 `dist/build/*` base64 嵌入 `dist/手势烟花.bat`。
- `handTracker.js` 的 `WASM`/`MODEL` 常量在打包版需改为相对路径 `./wasm` 与 `./hand_landmarker.task`。用环境变量 `import.meta.env` 或运行时判断:本脚本在打包时生成一个 `src/js/packaged.js` 设 `IS_PACKAGED=true`,main/handTracker 据此切换路径。

- [ ] **Step 1: 让 `handTracker.js` 支持本地化路径切换**

改 `handTracker.js` 顶部:

```js
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { EMA_ALPHA } from './utils/constants.js';

const IS_PACKAGED = (typeof __PACKAGED__ !== 'undefined') && __PACKAGED__;
const WASM = IS_PACKAGED ? './wasm'
  : 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL = IS_PACKAGED ? './hand_landmarker.task'
  : 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
// ...其余不变
```
> esbuild `define` 会把 `__PACKAGED__` 替换为字面量布尔(见 Step 3)。

- [ ] **Step 2: 写 `tools/build-bat.js`(打包 + 下载资源 + 生成 .bat)**

```js
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, rm, copyFile, readdir, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, sep } from 'node:path';
import https from 'node:https';
import { Buffer } from 'node:buffer';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = join(root, 'dist', 'build');
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const WASM_FILES = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm'];

function dl(url, dest) {
  return new Promise((res, rej) => {
    const get = (u) => https.get(u, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); return get(r.headers.location); }
      if (r.statusCode !== 200) return rej(new Error('下载失败 ' + u + ' ' + r.statusCode));
      const f = createWriteStream(dest);
      r.pipe(f); f.on('finish', () => f.close(res));
    }).on('error', rej);
    get(url);
  });
}

async function main() {
  await rm(join(root,'dist'), { recursive:true, force:true });
  await mkdir(join(buildDir,'wasm'), { recursive:true });

  // 1) esbuild 打包(__PACKAGED__=true)
  await build({
    entryPoints: [join(root,'src','js','main.js')],
    bundle: true, format: 'iife', platform: 'browser', target: ['es2020'],
    define: { '__PACKAGED__': 'true' },
    outfile: join(buildDir,'app.js'), minify: true, logLevel: 'info',
  });

  // 2) 下载 wasm + model
  for (const f of WASM_FILES) await dl(`${WASM_URL}/${f}`, join(buildDir,'wasm',f));
  await dl(MODEL_URL, join(buildDir,'hand_landmarker.task'));

  // 3) 拷贝 style.css,生成 index.html(引用 ./app.js)
  await copyFile(join(root,'src','style.css'), join(buildDir,'style.css'));
  await writeFile(join(buildDir,'index.html'),
`<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>手势烟花</title>
<link rel="stylesheet" href="style.css"></head>
<body><div id="stage">
<video id="cam" autoplay muted playsinline></video>
<canvas id="scene-canvas"></canvas>
<div id="overlay"><button id="start">✨ 开始(请允许摄像头)</button><div id="status">点击开始</div></div>
<div class="hint">☝ 食指=写字 &nbsp; ✊ 握拳=停笔 &nbsp; 🖐 张掌=烟花 &nbsp; 🫰 比心=爱心</div>
</div><script src="app.js"></script></body></html>`);

  // 4) 收集 build 目录所有文件 → base64 嵌入单个 .bat
  const abs = await readAllFiles(buildDir);
  const files = abs.map(p => ({
    rel: p.replace(buildDir + sep, '').replace(/\\/g, '/'),
    data: await readFile(p),
  }));
  await writeFile(join(root, 'dist', '手势烟花.bat'), makeBat(files), 'utf8');
  console.log('✓ 生成 dist/手势烟花.bat (' + files.length + ' 个文件)');
}

async function readAllFiles(dir, acc = []) {
  for (const e of await readdir(dir)) {
    const p = join(dir, e);
    if ((await stat(p)).isDirectory()) await readAllFiles(p, acc); else acc.push(p);
  }
  return acc;
}
```

- [ ] **Step 3: `makeBat(files)` —— 生成单文件 `.bat`(绕过命令行长度限制)**

> 关键:不能把多 MB 的 base64 经 `powershell -EncodedCommand` 传(cmd.exe 命令行上限 8191 字符)。改为:**.bat 头部用一句短命令让 PowerShell 读取"自身文件 `::PS::` 标记之后"的全部内容并执行**。PS 脚本本体(含多 MB 的 `$manifest` here-string)作为文件内容,不受命令行限制。

```js
function makeBat(files) {
  // 每行:相对路径|base64   (相对路径用正斜杠,如 wasm/vision_wasm_internal.wasm)
  const manifest = files.map(f => `${f.rel}|${Buffer.from(f.data).toString('base64')}`).join('\n');
  const ps = [
    "$ErrorActionPreference='Stop'",
    "$dir = Join-Path $env:TEMP 'gesture-fireworks'",
    "Remove-Item -Recurse -Force $dir -ErrorAction SilentlyContinue",
    "New-Item -ItemType Directory -Path $dir | Out-Null",
    "$manifest = @'",
    manifest,
    "'@",
    "foreach($line in $manifest -split [Environment]::NewLine){",
    "  if(-not $line.Trim()){ continue }",
    "  $i = $line.IndexOf('|')",
    "  $name = ($line.Substring(0,$i)) -replace '/','\\'",
    "  $bytes = [Convert]::FromBase64String($line.Substring($i+1))",
    "  $rel = Join-Path $dir $name",
    "  $parent = Split-Path $rel",
    "  if(-not (Test-Path $parent)){ New-Item -ItemType Directory -Force -Path $parent | Out-Null }",
    "  [IO.File]::WriteAllBytes($rel,$bytes)",
    "}",
    "$port = 8731",
    "$listener = New-Object System.Net.HttpListener",
    "$listener.Prefixes.Add(\"http://localhost:$port/\")",
    "$listener.Start()",
    "Write-Host 'Gesture Fireworks running - close this window to exit.'",
    "Start-Process \"http://localhost:$port/index.html\"",
    "$mime = @{ '.html'='text/html'; '.js'='text/javascript'; '.css'='text/css'; '.wasm'='application/wasm'; '.task'='application/octet-stream' }",
    "while($listener.IsListening){",
    "  $ctx = $listener.GetContext()",
    "  $rel = ($ctx.Request.Url.AbsolutePath.Trim('/')) -replace '/','\\'",
    "  if($rel -eq ''){ $rel = 'index.html' }",
    "  $f = Join-Path $dir $rel",
    "  if(Test-Path $f -PathType Leaf){",
    "    $ctx.Response.ContentType = $mime[[IO.Path]::GetExtension($f)]",
    "    $bytes = [IO.File]::ReadAllBytes($f)",
    "    $ctx.Response.OutputStream.Write($bytes,0,$bytes.Length)",
    "  } else { $ctx.Response.StatusCode = 404 }",
    "  $ctx.Response.Close()",
    "}",
  ].join('\n');
  // .bat:cmd 头(命令行很短)→ PowerShell 读自身 ::PS:: 之后内容并 iex
  const header =
    "@echo off\r\nchcp 65001 >nul\r\n" +
    "powershell -NoProfile -ExecutionPolicy Bypass -Command \"$s=Get-Content -LiteralPath '%~f0' -Raw; iex $s.Substring($s.IndexOf('::PS::')+6)\"\r\n" +
    "exit /b\r\n";
  return header + "::PS::\r\n" + ps + "\r\n";
}
```
> 说明:`::PS::` 含冒号,base64 字母表无冒号,故不会与内嵌的 base64 manifest 冲突;`%~f0` 是 .bat 自身绝对路径(含空格/中文路径也安全,因外层单引号);`Get-Content -Raw` 把整个 .bat(数 MB)读进内存后取尾部执行。

- [ ] **Step 4: 确认前置改动齐全**

- `handTracker.js` 顶部已按 Step 1 切换 `__PACKAGED__` 路径(wasm → `./wasm`、model → `./hand_landmarker.task`)。
- `tools/build-bat.js` 顶部 `import` 全部就位(含 `createWriteStream`/`readdir`/`stat`/`sep`/`Buffer`),**无 `require`、无函数体内 `import`**。
- 打包用的 `INDEX_HTML`(引用 `./app.js`)由 build-bat.js 内联字符串生成,不依赖 `src/index.html`。

- [ ] **Step 5: 跑打包**

Run: `npm run build`
Expected: 生成 `dist/手势烟花.bat`(约 5~9MB);`dist/build/` 含 app.js、index.html、style.css、wasm\\*、hand_landmarker.task。控制台打印 `✓ 生成 dist/手势烟花.bat`。

- [ ] **Step 6: 终极验证 —— 离线跨机运行**

1. 断网(或 hosts 屏蔽 CDN 验证离线)。
2. 双击 `dist/手势烟花.bat` → 自动开浏览器到 `http://localhost:8731/index.html` → 点开始 → 摄像头可用 → 四个交互 + 彩蛋全部正常。
3. 把 `.bat` 拷到另一台 Windows(无 Node/Python/联网)重复验证。
Expected: 全部正常;关闭控制台窗口后临时目录 `%TEMP%\\gesture-fireworks` 被清理。

- [ ] **Step 7: Commit**

```bash
git add tools/build-bat.js src/js/handTracker.js
git commit -m "feat(packaging): 单文件 .bat 打包(esbuild + 本地化 + PowerShell 自启)"
```

---

## 验收总清单(交付前过一遍)

- [ ] `npm test` 全绿(gestures + coords + sanity)
- [ ] `npm run dev` 四个交互 + 🫰 彩蛋全部正常,桌面 60fps,bloom 好看
- [ ] `dist/手势烟花.bat` 在**另一台离线 Windows** 双击即可运行,摄像头可用
- [ ] 摄像头被拒 / 无手 / 模型失败 → 友好提示,不黑屏
