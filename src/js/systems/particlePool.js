import * as THREE from 'three';
import { PARTICLE_MAX } from '../utils/constants.js';

// 软圆点贴图(运行时生成,带高斯衰减)
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
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class ParticlePool {
  constructor(scene, camera, maxCount = PARTICLE_MAX) {
    this.camera = camera;
    this.max = maxCount;
    this.cursor = 0;

    this.pos = new Float32Array(maxCount * 3);
    this.col = new Float32Array(maxCount * 3);
    this.baseR = new Float32Array(maxCount);
    this.baseG = new Float32Array(maxCount);
    this.baseB = new Float32Array(maxCount);
    this.vel = Array.from({ length: maxCount }, () => new THREE.Vector3());
    this.life = new Float32Array(maxCount);
    this.maxLife = new Float32Array(maxCount);
    this.gravity = new Float32Array(maxCount);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));

    // 加法混合:颜色趋黑 = 不可见(用它做淡出,避开透明度在合成器里失效的问题)
    const mat = new THREE.PointsMaterial({
      size: 12,
      sizeAttenuation: true,
      map: makeDotTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.geo = geo;
    this.mat = mat;
  }

  spawn(o) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    const i3 = i * 3;
    const p = o.position;
    this.pos[i3] = p.x; this.pos[i3 + 1] = p.y; this.pos[i3 + 2] = p.z;
    this.vel[i].copy(o.velocity || new THREE.Vector3());
    const c = new THREE.Color(o.color ?? 0xFFD24A);
    this.baseR[i] = c.r; this.baseG[i] = c.g; this.baseB[i] = c.b;
    this.col[i3] = c.r; this.col[i3 + 1] = c.g; this.col[i3 + 2] = c.b;
    this.life[i] = this.maxLife[i] = o.life ?? 0.8;
    this.gravity[i] = o.gravity ?? 0;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      const i3 = i * 3;
      if (this.life[i] <= 0) {
        // 已死:颜色清零(加法混合下不可见)
        if (this.col[i3] || this.col[i3 + 1] || this.col[i3 + 2]) {
          this.col[i3] = this.col[i3 + 1] = this.col[i3 + 2] = 0;
        }
        continue;
      }
      this.life[i] -= dt;
      const v = this.vel[i];
      v.y -= this.gravity[i] * dt;
      this.pos[i3] += v.x * dt;
      this.pos[i3 + 1] += v.y * dt;
      this.pos[i3 + 2] += v.z * dt;
      const k = Math.max(this.life[i] / this.maxLife[i], 0);
      this.col[i3] = this.baseR[i] * k;
      this.col[i3 + 1] = this.baseG[i] * k;
      this.col[i3 + 2] = this.baseB[i] * k;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}
