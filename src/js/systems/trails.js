import { AdditiveBlending, BufferGeometry, BufferAttribute, Points, PointsMaterial, CanvasTexture, Color } from 'three';
import { PALETTE } from '../utils/constants.js';

const MAX_DOTS = 60000;
const DOT_STEP = 5;   // 沿轨迹每 5px 撒一个发光点 → 连续丝带

// 软圆点贴图
function makeDotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c);
  t.colorSpace = 'srgb';
  return t;
}

const SPARK_RGB = PALETTE.spark.map(h => { const c = new Color(h); return [c.r, c.g, c.b]; });
const randGold = () => SPARK_RGB[(Math.random() * SPARK_RGB.length) | 0];

/** 持续发光笔画:独立的加法粒子点云,沿指尖轨迹密集插值 → 连续丝带,持久到 clear()。 */
export class TrailSystem {
  constructor(pool, scene) {
    this.pool = pool;
    this.scene = scene;

    this.path = [];            // 指尖采样(Vector3,供烟花)
    this.lastDot = null;       // 上一个发光点(插值/断笔用)

    this.pos = new Float32Array(MAX_DOTS * 3);
    this.col = new Float32Array(MAX_DOTS * 3);
    this.count = 0;

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new BufferAttribute(this.col, 3));
    geo.setDrawRange(0, 0);

    const mat = new PointsMaterial({
      size: 9,
      sizeAttenuation: true,
      map: makeDotTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    this.cloud = new Points(geo, mat);
    this.cloud.frustumCulled = false;
    scene.add(this.cloud);
    this.geo = geo;
  }

  addDot(p, rgb) {
    if (this.count >= MAX_DOTS) return;
    const i = this.count * 3;
    this.pos[i] = p.x; this.pos[i + 1] = p.y; this.pos[i + 2] = p.z;
    this.col[i] = rgb[0]; this.col[i + 1] = rgb[1]; this.col[i + 2] = rgb[2];
    this.count++;
  }

  /** 写字状态:每帧调,沿 lastDot→pos 密集插值撒发光点(连续丝带) */
  addPoint(pos, dt) {
    this.path.push(pos.clone());

    if (this.lastDot) {
      const seg = pos.clone().sub(this.lastDot);
      const dist = seg.length();
      const n = Math.max(1, Math.min(200, Math.ceil(dist / DOT_STEP)));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const p = this.lastDot.clone().add(seg.clone().multiplyScalar(t));
        this.addDot(p, randGold());
      }
    } else {
      this.addDot(pos, randGold());
    }
    this.lastDot = pos.clone();

    // 指尖实时火星点缀(短暂,走效果池)
    for (let i = 0; i < 3; i++) {
      this.pool.spawn({
        position: { x: pos.x + (Math.random() - 0.5) * 10, y: pos.y + (Math.random() - 0.5) * 10, z: pos.z },
        velocity: { x: (Math.random() - 0.5) * 40, y: (Math.random() - 0.5) * 40, z: 0 },
        color: PALETTE.spark[(Math.random() * PALETTE.spark.length) | 0],
        life: 0.4 + Math.random() * 0.3,
        gravity: 0,
      });
    }

    this.geo.setDrawRange(0, this.count);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }

  /** 抬笔:断开插值(下次不连到旧点)→ 自然形成间隙 */
  pause() { this.lastDot = null; }

  /** 所有指尖采样点(张掌时供烟花消费) */
  vertices() { return this.path; }

  clear() {
    this.count = 0;
    this.geo.setDrawRange(0, 0);
    this.path = [];
    this.lastDot = null;
  }
}
