# 手势烟花 · Gesture Fireworks ✨

用摄像头做手部追踪的金色火花手势交互。伸出食指在空中写字,握拳停笔,张开手掌让满屏笔迹炸成烟花,做个 OK 手势弹出全屏粉色粒子爱心。

桌面端运行,60fps + bloom 辉光。最终可打包成**单个 `.bat` 文件**,拷到任意 Windows 电脑双击即玩,**完全离线**。

> Built by 聆风语

---

## 效果一览

| 手势 | 效果 |
|---|---|
| ☝ 只伸食指 | 指尖画出**持续发光的金色笔画**(不断触,直到张掌才清) |
| ✊ 握拳 | 抬笔,移动不留笔迹 |
| 🖐 张开整掌 | 所有已写笔迹**炸成金色烟花** + 清空,可继续重写 |
| 👌 OK 手势(彩蛋) | **全屏特效**:粒子组成的粉色大爱心放大旋转 + 周围小爱心氛围 → 炸成粉色粒子雨 |

视觉风格:金色火花 / 仙女棒感(金 `#FFD24A` · 橙 `#FF8A1E` · 暖白 `#FFF3B0`),深夜黑背景,UnrealBloom 辉光。

---

## 技术栈

- **Three.js 0.160** — WebGL 渲染、`THREE.Points` 加法粒子、`EffectComposer` + `UnrealBloomPass` 辉光、`ExtrudeGeometry` 心形
- **@mediapipe/tasks-vision 0.10.14** — `HandLandmarker` 手部 21 关键点识别(WASM + GPU,full 模型)
- **原生 ES Modules** — 零运行时框架
- **Node `node:test`** — 手势分类纯函数单元测试
- **esbuild** — 打包期 bundle(把 three/mediapipe 内联成单 JS)
- **Node + PowerShell** — 打包成单文件 `.bat`(自解压 + 本地服务)

---

## 项目结构

```
交互/
├── README.md                        ← 本文件
├── package.json                     scripts: dev / test / build
├── .gitignore
│
├── src/                             ← 源码(开发期走 CDN importmap)
│   ├── index.html                   入口 + 启动屏 + importmap + 署名
│   ├── style.css                    启动屏 / 提示 / 署名样式
│   └── js/
│       ├── main.js                  ★ 主循环:摄像头→识别→手势状态机→各系统→渲染
│       ├── camera.js                getUserMedia + 镜像 <video> + 错误处理
│       ├── handTracker.js           HandLandmarker 封装 + EMA 平滑(打包期切本地路径)
│       ├── gestures.js              ★ 4 手势分类纯函数(可单测)
│       ├── render/
│       │   └── scene.js             Three.js 场景/透视相机/bloom/镜像摄像头背景平面
│       ├── systems/
│       │   ├── particlePool.js      GPU 加法粒子池(加法混合,颜色×生命做淡出)
│       │   ├── trails.js            持续发光笔迹(独立加法点云 + 距离插值成连续丝带)
│       │   ├── fireworks.js         张掌:笔迹点 → 烟花爆发
│       │   └── heart.js             彩蛋:粒子心形(表面+内部填充)+ 小爱心氛围 + 粒子雨
│       └── utils/
│           ├── constants.js         调色板 / 阈值 / 物理常量
│           ├── coords.js            关键点→屏幕坐标映射(镜像)+ 距离
│           └── easing.js            easeOutBack / easeOutCubic
│
├── tests/                           ← 单元测试(node:test)
│   ├── sanity.test.js
│   ├── coords.test.js               坐标映射
│   ├── fixtures.js                  造手部关键点 fixture
│   └── gestures.test.js             4 手势分类
│
├── tools/
│   ├── serve.js                     零依赖开发服务器(localhost:8000,no-store)
│   └── build-bat.js                 ★ 打包脚本(esbuild + 本地化 wasm/模型 → 单文件 .bat)
│
├── dist/                            ← 产出(gitignore)
│   ├── build/                       app.js / index.html / style.css / wasm/ / hand_landmarker.task
│   └── 手势烟花.bat                  ★ 最终交付:单文件,双击即玩(约 54MB)
│
└── docs/superpowers/
    ├── specs/2026-08-02-gesture-fireworks-design.md   设计 spec
    └── plans/2026-08-02-gesture-fireworks.md          实现计划(12 个任务)
```

### 数据流(每帧)

```
摄像头 → <video> → MediaPipe HandLandmarker(21 关键点, EMA 平滑)
        │
        ▼
   gestures.classifyGesture()  ──→  IDLE / INDEX / FIST / PALM / HEART
        │
        ▼ (防抖后用于触发;原始手势用于写字)
   ┌────────────────────────────────────────────┐
   │ INDEX → trails.addPoint()  (持续发光笔画)  │
   │ PALM  → fireworks.burstAt() + trails.clear │  ← rising edge
   │ HEART → heart.spawnAt()    (全屏粒子爱心)  │  ← rising edge + 冷却
   └────────────────────────────────────────────┘
        │
        ▼
   particlePool.update(dt)  →  Three.js (bloom)  →  画面
```

---

## 快速开始

### 环境
- Node ≥ 18(本机用 v22)
- 一个带摄像头的桌面环境、支持 WebGL2 的浏览器(Chrome / Edge)

### 开发模式
```bash
npm install        # 装 three / @mediapipe/tasks-vision / esbuild
npm run dev        # 起 http://localhost:8000
```
浏览器开 `http://localhost:8000` → 点"开始" → 允许摄像头。
(localhost 是安全上下文,摄像头可用;改代码后直接刷新,**no-store 已开**。)

### 跑测试
```bash
npm test           # node --test,覆盖坐标 + 4 手势分类
```

### 打包成单文件 `.bat`
```bash
npm run build      # 产出 dist/手势烟花.bat(约 54MB)
```
打包流程:`build-bat.js` 用 esbuild 把 JS 全部 bundle(定义 `__PACKAGED__=true` 让 handTracker 切到本地 wasm/模型),从 node_modules 复制 MediaPipe wasm、下载手部模型,连同 index.html / style.css 全部 base64 内嵌进一个 `.bat`。

---

## 分发:发给别人

把 **`dist/手势烟花.bat` 这一个文件**拷给对方(微信/U盘均可),对方:

1. 双击 `手势烟花.bat`
2. 弹出黑色控制台(显示"手势烟花运行中")+ 浏览器自动打开
3. 点"开始" → 允许摄像头 → 玩

**完全离线**(three.js、手部 wasm、模型全部内嵌),对方无需装 Node / Python / 联网。
关闭黑色控制台窗口即停止。

> ⚠️ 不能直接双击 `.html` 用:Edge/Chrome 只在 `https://` 或 `http://localhost` 下允许开摄像头。`.bat` 内置的本地服务就是为了绕过这个限制。

---

## 手势说明

| 手势 | 怎么做 |
|---|---|
| ☝ 食指 | 食指伸直,中指/无名指/小指收起,像指人 |
| ✊ 握拳 | 五指收拢 |
| 🖐 张掌 | 五指张开 |
| 👌 OK | 拇指尖与食指尖捏成圈,中指/无名指/小指伸直 |

> **关于比心 🫰**:程序同时认 🫰 和 👌(两者手部关键点特征相同:拇指食指捏合 + 三指伸)。实际中由于摄像头朝向差异,🫰 在部分手部姿态下识别不稳,**👌 更稳定**,故界面提示用 OK 触发。可调 `PINCH_THRESHOLD` 放宽捏合判定。

---

## 可调参数

| 文件 | 参数 | 作用 |
|---|---|---|
| `utils/constants.js` | `PALETTE` | 火花/烟花颜色 |
| `utils/constants.js` | `PINCH_THRESHOLD` (0.08) | 比心/OK 捏合距离阈值,调大更易触发 |
| `utils/constants.js` | `EMA_ALPHA` (0.5) / `DEBOUNCE_FRAMES` (3) | 关键点平滑 / 手势防抖 |
| `utils/constants.js` | `PARTICLE_MAX` (20000) / `FIREWORK_SPARKS` (110) | 粒子上限 / 烟花密度 |
| `systems/trails.js` | `DOT_STEP` (5) | 笔画粒子密度(越小越密) |
| `systems/heart.js` | `scale`(heartShape)/ `COUNT_S`·`COUNT_F` | 爱心大小 / 表面+内部粒子数 |
| `render/scene.js` | `UnrealBloomPass(...,strength,radius,threshold)` | 辉光强度 |

---

## 关键技术决策(踩过的坑)

1. **加法混合(发光)必须在不透明背景上** —— 透明画布上 additive blending 会"加到透明里"看不见。`scene.js` 用不透明暗背景 + 场景内的低透明度镜像摄像头平面。
2. **笔迹连续性靠距离插值,不是逐帧** —— 慢速写字时按帧采样会断;`trails.js` 沿 `lastDot→pos` 每 5px 插一个发光点,慢/快都连续成丝带。
3. **打包 `.bat` 不能把大文件走命令行** —— cmd.exe 命令行上限 8191 字符。`build-bat.js` 把 PowerShell 引导逻辑用 `-EncodedCommand`(UTF-16LE base64)传,大体积资源放 `::DATA::` 段由脚本自读,绕过限制。
4. **MediaPipe 时间戳要单调递增整数** —— `handTracker.js` 用 `Math.trunc(performance.now())`。

---

## 已知限制 / 不在范围

- **仅桌面端**:手机端能跑(部署到 HTTPS 网页即可),但 bloom、大粒子数、full 模型在手机上吃力,需要专门做移动端优化(换 lite 模型、砍粒子、降 bloom、处理竖屏)。
- **双手大爱心 🫶** 未做,只做单手 🫰/👌。
- **🫰 识别受手部朝向影响**,不稳时用 👌。

---

## 致谢

手势识别由 [Google MediaPipe](https://developers.google.com/mediapipe) 提供,3D 渲染由 [three.js](https://threejs.org/) 提供。

Built by **聆风语**。
