import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export function createScene(canvas, video) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  // 背景由 CSS 提供:body(#0a0a12) + 镜像 <video>(opacity .18);canvas 透明叠加其上
  scene.background = null;
  renderer.setClearColor(0x000000, 0);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 5000);
  const INTERACT_Z = 0;
  camera.position.z = 600;

  // bloom 后处理(对发光粒子/3D 物体生效,透明区域保持透明)
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.2, 0.6, 0.0);
  composer.addPass(bloom);

  function setSize(w, h) {
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    // 调整相机距离,使 z=INTERACT_Z 平面与屏幕像素近似 1:1(便于用屏幕坐标)
    const fovRad = (camera.fov * Math.PI) / 180;
    camera.position.z = (h / 2) / Math.tan(fovRad / 2);
    camera.updateProjectionMatrix();
  }

  function render() { composer.render(); }

  /** 屏幕像素坐标(画布左上为原点)→ z=INTERACT_Z 平面世界坐标(画布中心为原点,y 向上) */
  function screenToWorld(sx, sy, w, h) {
    return new THREE.Vector3(sx - w / 2, h / 2 - sy, INTERACT_Z);
  }

  return {
    renderer, scene, camera, composer,
    setSize, render, screenToWorld,
    add: (o) => scene.add(o),
    remove: (o) => scene.remove(o),
  };
}
