
import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.159.0/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://unpkg.com/three@0.159.0/examples/jsm/controls/OrbitControls.js';

const canvas = document.getElementById('appCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#ffe3f2');

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
camera.position.set(0, 1.5, 3);
scene.add(camera);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lights
const hemi = new THREE.HemisphereLight(0xffffff, 0x444466, 0.6);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(5, 5, 5);
dir.castShadow = true;
scene.add(dir);

let modelRoot = new THREE.Group();
scene.add(modelRoot);
let skeleton, skinnedMesh;
let jointSpheres = []; // pickable joints

const loader = new GLTFLoader();

// Fallback mannequin if no GLB is available
function buildFallbackMannequin() {
  modelRoot.clear();
  const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.8, metalness: 0.0 });
  function sphere(r=0.05) { return new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16), mat); }
  function capsule(h=0.3, r=0.03) {
    const g = new THREE.CapsuleGeometry(r, h, 4, 8);
    return new THREE.Mesh(g, mat);
  }
  const root = new THREE.Group();
  root.name = 'Hips';
  modelRoot.add(root);
  root.position.set(0, 1, 0);

  // Simple hierarchy
  const spine = capsule(0.5); spine.position.y = 0.35; spine.name = 'Spine'; root.add(spine);
  const head = sphere(0.12); head.position.y = 0.7; head.name = 'Head'; root.add(head);
  const lUpperArm = capsule(0.35); lUpperArm.position.set(-0.25, 0.55, 0); lUpperArm.rotation.z = Math.PI/2; lUpperArm.name = 'LeftArm'; root.add(lUpperArm);
  const rUpperArm = capsule(0.35); rUpperArm.position.set(0.25, 0.55, 0); rUpperArm.rotation.z = Math.PI/2; rUpperArm.name = 'RightArm'; root.add(rUpperArm);
  const lThigh = capsule(0.5); lThigh.position.set(-0.12, 0.3, 0); lThigh.rotation.x = Math.PI/2; lThigh.name = 'LeftThigh'; root.add(lThigh);
  const rThigh = capsule(0.5); rThigh.position.set(0.12, 0.3, 0); rThigh.rotation.x = Math.PI/2; rThigh.name = 'RightThigh'; root.add(rThigh);

  // clickable joint spheres
  const joints = ['Hips','Head','LeftArm','RightArm','LeftThigh','RightThigh'];
  jointSpheres = joints.map((name, i) => {
    const s = sphere(0.06);
    s.name = name + '_Joint';
    const target = root.children.find(c => c.name === name) || root;
    s.position.copy(target.position);
    modelRoot.add(s);
    return s;
  });
}

function addSkeletonHelpers(object) {
  skeleton = null;
  skinnedMesh = null;
  object.traverse((n) => {
    if (n.isSkinnedMesh) {
      skinnedMesh = n;
      skeleton = n.skeleton;
    }
  });
  if (skeleton) {
    const helper = new THREE.SkeletonHelper(skinnedMesh);
    helper.visible = true;
    scene.add(helper);
    jointSpheres = [];
    skeleton.bones.forEach(b => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 10), new THREE.MeshBasicMaterial({ color: 0xff45a1 }));
      s.position.copy(b.getWorldPosition(new THREE.Vector3()));
      s.userData.bone = b;
      jointSpheres.push(s);
      scene.add(s);
    });
  }
}

async function loadGLB(fileOrUrl) {
  return new Promise((resolve, reject) => {
    const onLoaded = (gltf) => resolve(gltf.scene || gltf.scenes?.[0]);
    if (typeof fileOrUrl === 'string') {
      loader.load(fileOrUrl, onLoaded, undefined, reject);
    } else {
      const url = URL.createObjectURL(fileOrUrl);
      loader.load(url, (gltf) => {
        URL.revokeObjectURL(url);
        onLoaded(gltf);
      }, undefined, reject);
    }
  });
}

async function init() {
  // try to load bundled model if exists
  try {
    const sceneGLB = await loadGLB('assets/models/human.glb');
    modelRoot.add(sceneGLB);
    addSkeletonHelpers(sceneGLB);
  } catch (e) {
    buildFallbackMannequin();
  }
  addFloor();
  animate();
}

// Interaction: pick joint spheres and rotate bones by dragging
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let dragging = false;
let activeJoint = null;
let lastPos = new THREE.Vector2();

function setPointerFromEvent(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ( (e.clientX - rect.left) / rect.width ) * 2 - 1;
  const y = - ( (e.clientY - rect.top) / rect.height ) * 2 + 1;
  pointer.set(x, y);
}

function onPointerDown(e) {
  setPointerFromEvent(e);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(jointSpheres, false);
  if (hits.length) {
    dragging = true;
    activeJoint = hits[0].object;
    lastPos.set(e.clientX, e.clientY);
    renderer.domElement.setPointerCapture(e.pointerId);
  }
}
function onPointerMove(e) {
  if (!dragging || !activeJoint) return;
  const dx = e.clientX - lastPos.x;
  const dy = e.clientY - lastPos.y;
  lastPos.set(e.clientX, e.clientY);
  const rotSpeed = 0.005 * (e.pressure ? (0.6 + 0.8 * e.pressure) : 1.0); // Apple Pencil: pressure
  if (activeJoint.userData.bone) {
    activeJoint.userData.bone.rotateX(-dy * rotSpeed);
    activeJoint.userData.bone.rotateY(dx * rotSpeed);
  } else {
    // Fallback mannequin: rotate the nearest part
    const target = modelRoot.children.find(c => c.name && activeJoint.name.startsWith(c.name));
    if (target) {
      target.rotateX(-dy * rotSpeed);
      target.rotateY(dx * rotSpeed);
    }
  }
}
function onPointerUp(e) {
  dragging = false;
  activeJoint = null;
}
renderer.domElement.addEventListener('pointerdown', onPointerDown);
renderer.domElement.addEventListener('pointermove', onPointerMove);
renderer.domElement.addEventListener('pointerup', onPointerUp);
renderer.domElement.addEventListener('pointerleave', onPointerUp);

// Apple Pencil specific UX
renderer.domElement.addEventListener('pointerover', (e) => {
  if (e.pointerType === 'pen') {
    document.getElementById('overlayHint').textContent = '🖊️ Pencilでドラッグ：圧力で回転速度が変化します';
  }
});

function addFloor() {
  const size = 10;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }));
  floor.rotation.x = -Math.PI/2; floor.position.y = 0; floor.receiveShadow = true;
  floor.name = 'Floor';
  scene.add(floor);
}

function addCubeProp() {
  const cube = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: 0x77c2ff }));
  cube.position.set(0.5, 0.15, 0);
  cube.castShadow = true;
  cube.name = 'CubeProp';
  scene.add(cube);
}

function focusModel() {
  const box = new THREE.Box3().setFromObject(modelRoot);
  const size = box.getSize(new THREE.Vector3()).length();
  const center = box.getCenter(new THREE.Vector3());
  controls.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(0, size*0.2, size*0.7));
}

function topDownView() {
  const box = new THREE.Box3().setFromObject(modelRoot);
  const center = box.getCenter(new THREE.Vector3());
  controls.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(0, 3, 0.1));
}

function resetPose() {
  modelRoot.traverse(o => { o.rotation.set(0,0,0); });
}

function mirrorPose() {
  modelRoot.traverse(o => { o.rotation.y *= -1; });
}

function setHeadsRatio(value) {
  // Simple scaling: scale Y relative to head sphere reference; for rigged model, uniformly scale
  const scale = value / 8.0; // 8頭身を基準
  modelRoot.scale.set(scale, scale, scale);
}

function setRealism(value) {
  // Adjust light & tone for "リアル寄り"
  hemi.intensity = 0.5 + 0.4 * value;
  dir.intensity = 0.6 + 0.6 * value;
}

function setFov(value) { camera.fov = value; camera.updateProjectionMatrix(); }
function setBackground(hex) { scene.background = new THREE.Color(hex); }

function screenshot() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  renderer.render(scene, camera);
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'posecraft.png'; a.click();
  }, 'image/png');
}

function exportPoseJson() {
  const data = [];
  modelRoot.traverse(o => {
    if (o.name) {
      data.push({ name: o.name, rotation: { x: o.rotation.x, y: o.rotation.y, z: o.rotation.z } });
    }
  });
  const json = JSON.stringify({ pose: data }, null, 2);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = 'pose.json'; a.click();
}

async function loadModelFile(file) {
  try {
    const glbScene = await loadGLB(file);
    modelRoot.clear();
    modelRoot.add(glbScene);
    addSkeletonHelpers(glbScene);
  } catch (e) {
    alert('読み込みに失敗しました: ' + e.message);
  }
}

async function loadPropFile(file) {
  try {
    const glbScene = await loadGLB(file);
    scene.add(glbScene);
  } catch (e) {
    alert('小物の読み込みに失敗しました: ' + e.message);
  }
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  // keep joint spheres synced with bones
  if (skeleton && jointSpheres.length) {
    jointSpheres.forEach(s => {
      const b = s.userData.bone;
      if (b) s.position.copy(b.getWorldPosition(new THREE.Vector3()));
    });
  }
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  camera.aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}

init();

export const app = {
  resetPose, mirrorPose, setHeadsRatio, setRealism, setFov, setBackground,
  focusModel, topDownView, addFloor, addCubeProp, screenshot, exportPoseJson,
  loadModelFile, loadPropFile
};
