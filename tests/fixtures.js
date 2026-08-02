// 返回 21 个 {x,y,z},布局:wrist(0),拇指(1-4),食指(5-8),中指(9-12),无名指(13-16),小指(17-20)
export function makeHand({
  thumb = 'extended', index = 'extended', middle = 'extended',
  ring = 'extended', pinky = 'extended', pinch = false,
} = {}) {
  const wrist = { x: 0.5, y: 0.9, z: 0 };

  const finger = (mcpX, ext, len = 0.28) => {
    const mcp = { x: mcpX, y: 0.78, z: 0 };
    const pip = { x: mcpX, y: 0.78 - len * 0.4, z: 0 };
    const dip = { x: mcpX, y: 0.78 - len * 0.7, z: 0 };
    const tip = ext
      ? { x: mcpX, y: 0.78 - len, z: 0 }     // 伸展:tip 最高(离腕最远)
      : { x: mcpX + 0.02, y: 0.74, z: 0 };    // 弯曲:tip 折回,靠近掌心
    return [mcp, pip, dip, tip];
  };

  const idx = finger(0.50, index === 'extended');
  const mid = finger(0.60, middle === 'extended');
  const rng = finger(0.69, ring === 'extended');
  const pky = finger(0.78, pinky === 'extended');

  // 拇指:extended 时尖朝左外,pinch 时尖贴近食指尖
  const idxTip = idx[3];
  const thumbTip = pinch
    ? { x: idxTip.x + 0.03, y: idxTip.y, z: 0 }                       // 捏到食指尖旁(< PINCH_THRESHOLD)
    : (thumb === 'extended' ? { x: 0.40, y: 0.66, z: 0 } : { x: 0.46, y: 0.78, z: 0 });
  const thumbLM = [
    { x: 0.44, y: 0.86, z: 0 }, { x: 0.42, y: 0.80, z: 0 },
    { x: 0.41, y: 0.73, z: 0 }, thumbTip,
  ];

  return [wrist, ...thumbLM, ...idx, ...mid, ...rng, ...pky];
}
