# 手势烟花 / 火花写字 — 设计 Spec

> 日期:2026-08-02
> 状态:已与用户对齐,待写实现计划

## 1. 目标

用摄像头做手部追踪,实现一套手势驱动的金色火花视觉交互。桌面端运行,**效果优先**(60fps、bloom 发光、真 3D 爱心)。最终打包成**单个 `.bat` 文件**,发给任意 Windows 电脑双击即可离线运行。

### 核心交互(4 + 1 彩蛋)

| 手势 | 行为 |
|---|---|
| 只伸食指 ☝ | 指尖画**金色火花**轨迹,字迹**持续留存**不消失 |
| 握拳 ✊ | 移动但**不写字** |
| 张开整掌 🖐 | 所有已写笔迹**炸成烟花** + 清空,可继续重写 |
| 单手比心 🫰(彩蛋) | 捏合点弹出**旋转的饱满 3D 金心** → 炸成心形粒子云 |

## 2. 已锁定的设计决策

1. **比心手势 = 单手 🫰**:拇指尖 + 食指尖捏合(距离 < 阈值),中/无名/小指伸展。MediaPipe 单手即可识别,爆发点明确。
2. **视觉风格 = 金色火花(仙女棒感)**:金 `#FFD24A` / 橙 `#FF8A1E` / 暖白 `#FFF3B0`,深夜黑背景 `#0a0a12`,发光圆点 + 拖尾。
3. **技术方案 = B:MediaPipe + Three.js (WebGL)**。真 3D 心形网格 + GPU 粒子 + UnrealBloom 后处理。
4. **笔迹行为 = 一直留着,张掌炸开才清**(写字/表白场景)。
5. **打包 = 单文件 `.bat` 自启动**(内嵌完整离线 HTML + PowerShell 起 localhost 服务 + 开浏览器)。

## 3. 架构

### 每帧流水线

```
摄像头 → <video>(镜像) → MediaPipe HandLandmarker(每只手21关键点,~30fps)
        → 手势分类器(纯函数) → 手势状态: 空闲 / 写字 / 握拳 / 张掌 / 比心
        → 驱动渲染系统(笔迹 / 烟花 / 爱心)
Three.js 独立渲染循环(60fps) → 粒子 + 3D爱心 + bloom → 画面
```

**识别与渲染解耦**:识别在视频帧跑(~30fps),渲染跑满 60fps,指尖位置做插值,手看起来顺滑。**双手都识别**(MediaPipe 原生支持),左右手通用。

### 坐标系

- MediaPipe 输出归一化 `[0,1]` 坐标(x 横、y 纵、z 深度)。
- X 轴**镜像**(自拍视图,手往右移 → 画面上往右)。
- 映射到 Three.js 世界坐标,笔迹/烟花/爱心坐标都用映射后的值。
- **MediaPipe 模型**:用 `hand_landmarker.task` **full 版**(桌面端优先精度;若帧率不足再降级 lite)。

## 4. 手势识别(纯函数,可单测)

MediaPipe Hands 关键点索引:`0`腕,`4`拇指尖,`8`食指尖,`12/16/20`中/无名/小指尖;`6/10/14/18`对应 PIP 关节;`5/9/13/17` MCP。

**手指伸展判定**:对每根手指,指尖到掌心(腕 `0`)的距离 > 对应 PIP 到掌心距离 → 该指"伸"。拇指单独用"拇指尖到食指 MCP 的距离"判定。

| 函数 | 判定逻辑 | 输出状态 |
|---|---|---|
| `isIndexOnly` | 食指伸 ∧ 中/无名/小指弯(拇指忽略) | 写字 |
| `isFist` | 食/中/无名/小指尖全弯 ∧ 拇指尖贴近掌心/食指MCP | 握拳 |
| `isPalmOpen` | 五指全伸 | 张掌 |
| `isFingerHeart` | `dist(4,8) < pinchThreshold` ∧ 中/无名/小指伸 | 比心 |

**两个稳定性处理(决定体验)**:
- **关键点平滑**:每个关键点位置做 EMA 滤波(α≈0.5),消抖。
- **状态防抖**:连续 N≈3 帧确认同一手势才切换;烟花、爱心用**上升沿触发**(进入手势瞬间触发一次,配合冷却时间,避免每帧重复炸)。

这四个函数为**纯函数**(输入 landmarks 数组,输出 bool),用造好的手势 fixture 写**单元测试**,保证识别逻辑可靠。

## 5. 渲染系统(Three.js)

### 场景与后处理
- 透视/正交相机覆盖全屏,背景 `#0a0a12`。
- **相机**:**透视相机(perspective)**覆盖全屏——为保证旋转的 3D 爱心有真实透视立体感;手部坐标统一映射到相机前方一个固定 z 平面。
- **背景层**:低透明度镜像摄像头画面(`<video>` 作为 `VideoTexture` 贴在背景平面),让用户看得见自己的手。
- **bloom**:`EffectComposer` + `UnrealBloomPass`(strength≈1.2,radius≈0.6,threshold≈0)——金色火花"亮起来"靠这层。

### 粒子(共享 GPU 粒子池 `particlePool.js`)
- `THREE.Points` + 自定义 `ShaderMaterial`,**加法混合(AdditiveBlending)** + 软圆点贴图 = 发光火星。
- 颜色在金/橙/暖白间随机,带尺寸衰减与生命周期。
- 属性(位置、速度、生命、颜色)放在 `BufferAttribute`,CPU 更新(OOM 风险低,几千~几万粒子桌面无压力)。

### 笔迹系统 `trails.js`
- 写字状态:每帧把食指尖(点 `8`)映射坐标采样入当前笔画。
- 帧间位移过大(抬手/重定位)→ 断开当前笔画,开新段。
- 沿轨迹撒火星粒子,组成发光笔画;笔画列表**持久保留**,直到张掌才清。

### 烟花系统 `fireworks.js`
- 张掌**上升沿**:遍历每个笔迹顶点 → 生成一枚火箭 → 短暂外飞 → 爆成 50~150 颗带重力、衰减的火花(径向初速度 + 重力 + 淡出)。
- 生成完毕后**清空笔迹列表**,可继续重写。

### 爱心彩蛋 `heart.js`
- 比心**上升沿**:爆发点 = 拇指尖 `4` 与食指尖 `8` 的中点。
- **真 3D 心形网格**:心形参数曲线 → `ExtrudeGeometry` + 倒角(bevel)= "饱满"立体感;金色自发光 `MeshStandardMaterial`(emissive)。
- 动画:`scale 0→1` 用 ease-out-back(回弹 pop)→ 持续绕 Y 轴旋转 → 约 1 秒后**炸成心形粒子云**(粒子按心形轮廓排布,向外飞散 + 淡出)。
- bloom 使其通体发光。

## 6. 项目结构

```
交互/
├── src/
│   ├── index.html              入口 + 启动按钮(开摄像头需用户点击)+ 操作说明
│   ├── style.css               启动屏 / 提示 UI
│   └── js/
│       ├── main.js             启动 + 主循环(RAF)
│       ├── camera.js           getUserMedia + 镜像 <video>
│       ├── handTracker.js      MediaPipe 封装 + 关键点 EMA 平滑
│       ├── gestures.js         4 个手势纯函数(可单测)
│       ├── systems/
│       │   ├── trails.js       写字 / 笔迹留存
│       │   ├── fireworks.js    张掌烟花
│       │   ├── heart.js        🫰 3D 爱心彩蛋
│       │   └── particlePool.js 共享 GPU 粒子池
│       ├── render/
│       │   └── scene.js        Three.js 场景 / 相机 / bloom 合成器
│       └── utils/              缓动、坐标映射、常量
├── tests/
│   └── gestures.test.js        手势纯函数单测(+ 手势 fixtures)
├── tools/
│   └── build-bat.js            打包脚本:内联依赖 → 生成单文件 .bat
├── dist/                       产出(打包后的 .bat / 内联版 html)
└── docs/superpowers/specs/     本 spec
```

**开发期** Three.js + MediaPipe 走 CDN(importmap),改得快。**打包期** `tools/build-bat.js` 把依赖全部本地化内联(见第 7 节)。

## 7. 打包:单文件 `.bat` 自启动

### 为何不能直接发 .html
Edge/Chrome 只在安全上下文(`https://` / `http://localhost`)允许开摄像头;双击打开的 `file://` 会被拒。因此用 `.bat` 在本机起一个 localhost 服务再开浏览器,绕过限制。**全程离线**(所有依赖已内联,不联网)。

### `.bat` 运行流程(收件人侧)
1. 双击 `手势烟花.bat`。
2. 脚本把内嵌的资源(HTML + Three.js + MediaPipe JS/WASM + `hand_landmarker.task` 模型)解压到 `%TEMP%\gesture-fireworks\`。
3. 用 Windows **自带的 PowerShell** 起一个 `HttpListener`,在 `http://localhost:<port>/` 服务该目录。
4. 用默认浏览器(Edge)打开 `http://localhost:<port>/index.html`。
5. 关闭控制台窗口 → 停服务、清理临时文件。

### 打包脚本 `tools/build-bat.js` 要做的
1. 下载并本地化 Three.js(r3 + `examples/jsm` 的 EffectComposer/UnrealBloomPass)。
2. 下载并本地化 `@mediapipe/tasks-vision`(JS + `vision_wasm_internal.wasm`),配置 `FilesetResolver` 指向本地 wasm 路径;下载 `hand_landmarker.task` 模型。
3. 把 `src/index.html` 改写为**全本地引用**(去掉 CDN/importmap,改 `<script>`),资源相对路径指向解压目录。
4. 把所有文件 base64 编码,生成单个 `dist/手势烟花.bat`,内含:PowerShell 自解压 + HttpListener + 浏览器启动 + 清理逻辑。

**验收**:把 `dist/手势烟花.bat` 拷到另一台无网络、无 Node/Python 的 Windows 机器,双击 → 浏览器自动开 → 摄像头可用 → 四个交互 + 彩蛋全部正常。

## 8. 开发期运行

```bash
# 在 交互/ 目录
python -m http.server 8000   # 或 npx serve
# 浏览器开 http://localhost:8000/src/index.html
```
(localhost 是安全上下文,摄像头可用。)

## 9. 错误处理
- 摄像头权限被拒 / 无摄像头 → 友好提示 + "重试"按钮。
- MediaPipe 模型加载失败 → 提示 + 重试。
- 长时间无手 → 闲置提示("请把手伸进画面")。
- 任何异常都不黑屏卡死,保留启动屏可重试。

## 10. 测试策略
- **单元测试**:`gestures.js` 四个纯函数,用造好的 landmarks fixtures(食指/握拳/张掌/比心各一组)验证。
- **手动验收**:按第 11 节清单逐项过。
- 视觉/粒子/3D 类无自动化测试,以手动验收 + 帧率观察为准。

## 11. 验收清单
- [ ] 食指画金色火花字迹,清晰、发光、持续留存
- [ ] 握拳移动不留笔迹
- [ ] 张掌 → 现有笔迹全部炸成烟花 + 清空,可继续写
- [ ] 🫰 → 捏合点弹出旋转饱满的 3D 金心 → 炸成心形粒子
- [ ] 桌面 60fps 流畅,bloom 发光好看
- [ ] 手势分类函数单元测试通过
- [ ] `dist/手势烟花.bat` 拷到另一台离线 Windows 双击即可运行,摄像头可用,四个交互 + 彩蛋正常

## 12. 不在范围内(Out of Scope)
- 手机端运行(用户明确放弃,只做桌面)。
- 双手大爱心 🫶(v1 只做单手 🫰)。
- 真正的联网/多人/分享功能。
- 自动化截图回归测试。
