import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export function createScene(canvas, video) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a12);   // 不透明暗背景(让加法混合的火花可见)

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 5000);
  const INTERACT_Z = 0;
  camera.position.z = 600;

  // 镜像、低透明度的摄像头背景(场景内平面,放在 z 负方向,不抢戏)
  const bgTex = new THREE.VideoTexture(video);
  bgTex.colorSpace = THREE.SRGBColorSpace;
  bgTex.wrapS = THREE.RepeatWrapping;
  bgTex.repeat.x = -1; bgTex.offset.x = 1;
  const bgPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: bgTex, transparent: true, opacity: 0.2, depthWrite: false })
  );
  bgPlane.position.z = -1;
  bgPlane.renderOrder = -1;
  scene.add(bgPlane);

  // bloom 后处理(threshold 0.2:亮火花辉光,暗的摄像头背景不爆)
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.2, 0.6, 0.2);
  composer.addPass(bloom);

  function setSize(w, h) {
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    const fovRad = (camera.fov * Math.PI) / 180;
    camera.position.z = (h / 2) / Math.tan(fovRad / 2);
    camera.updateProjectionMatrix();
    // 背景平面铺满(按它到相机的距离计算可见尺寸)
    const planeDist = camera.position.z - bgPlane.position.z;
    const visH = 2 * planeDist * Math.tan(fovRad / 2);
    bgPlane.scale.set(visH * camera.aspect, visH, 1);
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
