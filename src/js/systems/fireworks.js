import { FIREWORK_SPARKS, GRAVITY, PALETTE } from '../utils/constants.js';

/** 张掌时:把笔迹点变成烟花爆发(每个点爆一簇带重力的火花) */
export class FireworksSystem {
  constructor(pool) { this.pool = pool; }

  burstAt(vertices) {
    if (!vertices || vertices.length === 0) return;
    // 笔迹点可能很多,降采样避免一次爆太多
    const step = Math.max(1, Math.floor(vertices.length / 60));
    for (let i = 0; i < vertices.length; i += step) {
      const v = vertices[i];
      for (let k = 0; k < FIREWORK_SPARKS; k++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 320;
        this.pool.spawn({
          position: v,
          velocity: { x: Math.cos(a) * sp, y: Math.sin(a) * sp, z: 0 },
          color: PALETTE.spark[(Math.random() * PALETTE.spark.length) | 0],
          size: 4 + Math.random() * 5,
          life: 0.9 + Math.random() * 0.8,
          gravity: GRAVITY * 0.6,
        });
      }
    }
  }
}
