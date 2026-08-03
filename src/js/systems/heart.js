import { Group, Points, BufferGeometry, BufferAttribute, PointsMaterial, CanvasTexture, Mesh, ExtrudeGeometry, MeshStandardMaterial, AmbientLight, DirectionalLight, Color, Shape, Vector3, AdditiveBlending } from 'three';
import { easeOutBack } from '../utils/easing.js';
import { HEART_HOLD_SEC } from '../utils/constants.js';

// 经典心形参数曲线(点在下、双叶在上)
function heartShape() {
  const s = new Shape();
  const scale = 5;
  const N = 80;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    if (i === 0) s.moveTo(x * scale, y * scale);
    else s.lineTo(x * scale, y * scale);
  }
  s.closePath();
  return s;
}

function heartGeo(detail = 48) {
  const geo = new ExtrudeGeometry(heartShape(), {
    depth: 34, bevelEnabled: true, bevelThickness: 11, bevelSize: 9, bevelSegments: 5, curveSegments: detail,
  });
  geo.center();
  geo.computeBoundingBox();
  return geo;
}

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

// 在网格三角形表面随机采样点(重心坐标)→ 心形粒子云(含正面/背面/倒角,自带 3D 深度)
function sampleSurface(geo, count) {
  const pos = geo.attributes.position;
  const idx = geo.index;
  const triCount = idx ? (idx.count / 3) : (pos.count / 3);
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const t = Math.floor(Math.random() * triCount);
    const ia = idx ? idx.getX(t * 3) : t * 3;
    const ib = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const ic = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    let r1 = Math.random(), r2 = Math.random();
    if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
    const r3 = 1 - r1 - r2;
    out[i * 3]     = r1 * pos.getX(ia) + r2 * pos.getX(ib) + r3 * pos.getX(ic);
    out[i * 3 + 1] = r1 * pos.getY(ia) + r2 * pos.getY(ib) + r3 * pos.getY(ic);
    out[i * 3 + 2] = r1 * pos.getZ(ia) + r2 * pos.getZ(ib) + r3 * pos.getZ(ic);
  }
  return out;
}

const PINK = ['#FF7EB6', '#FF9ECF', '#FFC2E2', '#FF4FA0', '#FFFFFF'].map(h => new Color(h));

// 心形轮廓(扁平 [x,y,x,y,...]),用于内部填充
function heartOutline() {
  const scale = 5, N = 96;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push(x * scale, y * scale);
  }
  return pts;
}

// 在心形多边形内部拒绝采样(带随机 z 深度)→ 填充中部
function sampleFill(outline, depth, count) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < outline.length; i += 2) {
    const x = outline[i], y = outline[i + 1];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const out = new Float32Array(count * 3);
  let i = 0, guard = 0;
  while (i < count && guard < count * 40) {
    guard++;
    const x = minX + Math.random() * (maxX - minX);
    const y = minY + Math.random() * (maxY - minY);
    let inside = false;
    for (let a = 0, b = outline.length - 2; a < outline.length; b = a, a += 2) {
      const ax = outline[a], ay = outline[a + 1], bx = outline[b], by = outline[b + 1];
      if (((ay > y) !== (by > y)) && (x < (bx - ax) * (y - ay) / (by - ay) + ax)) inside = !inside;
    }
    if (inside) {
      out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = (Math.random() - 0.5) * depth;
      i++;
    }
  }
  return out;
}
const randPink = () => PINK[(Math.random() * PINK.length) | 0];

/** 彩蛋全屏特效:粒子组成的居中大爱心(放大占屏)+ 周围小爱心闪动 → 炸成粉色粒子雨 */
export class HeartSystem {
  constructor(scene, pool) {
    this.scene = scene;
    this.pool = pool;
    this.active = [];
    this.little = [];
    this._lit = false;
    this._tex = makeDotTexture();
    this.screenW = innerWidth;
    this.screenH = innerHeight;
    const b = heartGeo(16);
    this.natH = b.boundingBox.max.y - b.boundingBox.min.y;
    b.dispose();
  }

  setScreen(w, h) { this.screenW = w; this.screenH = h; }

  _lights() {
    if (this._lit) return;
    this.scene.add(new AmbientLight(0xffffff, 0.7));
    const dl = new DirectionalLight(0xffe0f0, 1.1);
    dl.position.set(0, 0, 1);
    this.scene.add(dl);
    this._lit = true;
  }

  spawnAt(pos) {
    this._lights();

    // 主爱心:粒子云 = 表面壳(边缘+3D)+ 内部填充(中部粒子)
    const COUNT_S = 900, COUNT_F = 1500, COUNT = COUNT_S + COUNT_F;
    const geo = heartGeo(48);
    const surfPos = sampleSurface(geo, COUNT_S);
    geo.dispose();
    const fillPos = sampleFill(heartOutline(), 44, COUNT_F);
    const basePos = new Float32Array(COUNT * 3);
    basePos.set(surfPos, 0);
    basePos.set(fillPos, COUNT_S * 3);
    const col = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const c = randPink();
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(basePos, 3));
    g.setAttribute('color', new BufferAttribute(col, 3));
    const mat = new PointsMaterial({
      size: 11, sizeAttenuation: true, map: this._tex, vertexColors: true,
      transparent: true, depthWrite: false, blending: AdditiveBlending,
    });
    const points = new Points(g, mat);
    points.frustumCulled = false;
    const pivot = new Group();
    pivot.add(points);
    pivot.scale.setScalar(0.001);
    this.scene.add(pivot);
    const target = (this.screenH * 0.8) / this.natH;
    this.active.push({ pivot, basePos, g, mat, t: 0, phase: 'in', target });

    // 氛围小爱心(网格,闪动)
    const count = 20;
    for (let i = 0; i < count; i++) {
      const lg = heartGeo(16);
      const lm = new MeshStandardMaterial({
        color: 0xFF9ECF, emissive: 0xFF4FA0, emissiveIntensity: 1.0,
        metalness: 0.2, roughness: 0.4, transparent: true, opacity: 0,
      });
      const m = new Mesh(lg, lm);
      m.position.set(
        (Math.random() - 0.5) * this.screenW * 0.85,
        (Math.random() - 0.5) * this.screenH * 0.8,
        (Math.random() - 0.5) * 120,
      );
      m.rotation.z = (Math.random() - 0.5) * 0.6;
      m.scale.setScalar(0.001);
      this.scene.add(m);
      const base = (this.screenH * (0.05 + Math.random() * 0.06)) / this.natH;
      this.little.push({
        mesh: m, t: 0, life: 1.4 + Math.random() * 1.0,
        base, twk: Math.random() * Math.PI * 2, delay: Math.random() * 0.5,
      });
    }
  }

  update(dt) {
    // 主爱心
    for (let i = this.active.length - 1; i >= 0; i--) {
      const h = this.active[i];
      h.t += dt;
      if (h.phase === 'in') {
        const k = Math.min(h.t / 0.4, 1);
        h.pivot.scale.setScalar(easeOutBack(k) * h.target);
        h.pivot.rotation.y += dt * 3;
        if (k >= 1) { h.phase = 'hold'; h.t = 0; }
      } else if (h.phase === 'hold') {
        h.pivot.rotation.y += dt * 2.5;
        if (h.t >= HEART_HOLD_SEC) {
          this._burst(h);
          this.scene.remove(h.pivot);
          h.g.dispose();
          h.mat.dispose();
          this.active.splice(i, 1);
        }
      }
    }

    // 小爱心
    for (let i = this.little.length - 1; i >= 0; i--) {
      const h = this.little[i];
      h.t += dt;
      if (h.t < h.delay) continue;
      const tt = (h.t - h.delay) / h.life;
      if (tt >= 1) {
        this.scene.remove(h.mesh);
        h.mesh.geometry.dispose();
        h.mesh.material.dispose();
        this.little.splice(i, 1);
        continue;
      }
      const env = Math.sin(Math.PI * tt);
      const pulse = 0.8 + 0.2 * Math.sin(h.t * 8 + h.twk);
      h.mesh.scale.setScalar(h.base * env * pulse);
      h.mesh.material.opacity = env;
      h.mesh.rotation.y += dt * 2;
    }
  }

  _burst(h) {
    h.pivot.updateMatrixWorld(true);
    const v = new Vector3();
    const N = h.basePos.length / 3;
    for (let i = 0; i < N; i++) {
      v.set(h.basePos[i * 3], h.basePos[i * 3 + 1], h.basePos[i * 3 + 2]);
      v.applyMatrix4(h.pivot.matrixWorld);     // 旋转+缩放后的世界位置
      const len = v.length() || 1;
      const sp = 200 + Math.random() * 320;
      this.pool.spawn({
        position: { x: v.x, y: v.y, z: v.z },
        velocity: { x: (v.x / len) * sp, y: (v.y / len) * sp + 30, z: (v.z / len) * sp },
        color: randPink(),
        size: 6 + Math.random() * 7,
        life: 1.0 + Math.random() * 0.9,
        gravity: 180,
      });
    }
  }
}
