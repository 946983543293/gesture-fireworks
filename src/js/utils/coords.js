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
