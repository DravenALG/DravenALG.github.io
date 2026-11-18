import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/loaders/GLTFLoader.js';
import { MotionPlayer } from './motion-player.js?v=20261119-inline';
import { createPandaRig } from './panda-rig.js';
import { createWorkbench, roundedPrism } from './workbench.js';

const MODEL_URL = new URL('../franka/panda.glb', import.meta.url);
const MOTION_URL = new URL('../franka/motion.json', import.meta.url);

export async function createRobotScene(host, { reducedMotion, onFailure }) {
  const viewport = host.querySelector('.robot-viewport');
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0xffffff, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('role', 'group');
  renderer.domElement.setAttribute('aria-label', 'Interactive Franka Panda. Enter to reset. Use arrow keys to choose a block, Enter or Space to pick, and Escape to reset.');

  let model, data;
  try {
    [model, data] = await Promise.all([
      new GLTFLoader().loadAsync(MODEL_URL.href),
      fetch(MOTION_URL).then(response => {
        if (!response.ok) throw new Error(`Motion data: HTTP ${response.status}`);
        return response.json();
      })
    ]);
  } catch (error) {
    renderer.dispose();
    throw error;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-.65, .65, .65, -.65, .01, 15);
  camera.up.set(0, 0, 1);
  camera.position.set(1.35, -1.65, 1.30);
  camera.lookAt(.25, .015, .31);
  scene.add(new THREE.HemisphereLight(0xf5faff, 0x8a9fb5, 2.1));
  const key = new THREE.DirectionalLight(0xfffaf4, 2.8);
  key.position.set(-.4, -1.4, 2.8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -1.2, right: 1.2, top: 1.2, bottom: -1.2, near: .1, far: 6 });
  key.shadow.bias = -.00015;
  key.shadow.normalBias = .008;
  key.target.position.set(.25, 0, 0);
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xb9dfff, 1.4);
  fill.position.set(1.5, 1, 2);
  scene.add(fill);
  const rimLight = new THREE.DirectionalLight(0x81caff, 1.7);
  rimLight.position.set(-.8, 1.6, 1.8);
  scene.add(rimLight);
  createWorkbench(scene, data.objects);

  const rig = createPandaRig(model.scene, data);
  scene.add(rig.root);
  rig.root.traverse(object => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach(material => {
      const lightShell = material.color.r + material.color.g + material.color.b > 1.2;
      material.roughness = lightShell ? .28 : .38;
      material.metalness = lightShell ? .16 : .32;
    });
  });

  const blockGeometry = roundedPrism(data.size, data.size, data.size, .004, .0025);
  const ringGeometry = new THREE.RingGeometry(.043, .046, 48);
  const blocks = new Map();
  const markers = new Map();
  data.objects.forEach(object => {
    const block = new THREE.Mesh(blockGeometry, new THREE.MeshStandardMaterial({
      color: object.color, roughness: .3, metalness: .12, transparent: true
    }));
    block.position.fromArray(object.pick);
    block.castShadow = true;
    block.receiveShadow = true;
    block.userData.objectId = object.id;
    scene.add(block);
    blocks.set(object.id, block);
    const marker = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({
      color: object.color, transparent: true, opacity: .38, depthWrite: false
    }));
    marker.position.set(object.pick[0], object.pick[1], .001);
    marker.userData.decoration = true;
    scene.add(marker);
    markers.set(object.id, marker);
  });

  let visible = false;
  let disposed = false;
  let frame = 0;
  let lastTime = null;
  let hovered = null;
  let interactionActive = false;
  let pointerInside = false;
  let motionReduced = reducedMotion;
  const player = new MotionPlayer(data, changed);
  const canvas = renderer.domElement;
  const events = new AbortController();
  viewport.append(canvas);

  function applyPose() {
    rig.setPose(player.q, player.grip);
    scene.updateMatrixWorld(true);
  }

  function changed(type, id) {
    if (type === 'attach') {
      applyPose();
      rig.tcp.attach(blocks.get(id));
    } else if (type === 'release') {
      const block = blocks.get(id);
      scene.attach(block);
      block.position.fromArray(data.objects.find(object => object.id === id).place);
      block.rotation.set(0, 0, 0);
    } else if (type === 'reset') {
      hovered = null;
      data.objects.forEach(object => {
        const block = blocks.get(object.id);
        scene.add(block);
        block.position.fromArray(object.pick);
        block.rotation.set(0, 0, 0);
      });
      applyPose();
    }
    wake();
  }

  function enterInteraction() {
    if (interactionActive) return;
    interactionActive = true;
    player.reset();
  }

  function leaveInteraction() {
    interactionActive = false;
    hovered = null;
    canvas.style.cursor = 'default';
    if (!motionReduced) player.resume();
    wake();
  }

  function resize() {
    const { width, height } = viewport.getBoundingClientRect();
    if (!width || !height || disposed) return;
    const span = Math.max(1.4, 1.4 * height / width);
    camera.left = -span * width / height / 2;
    camera.right = -camera.left;
    camera.top = span / 2;
    camera.bottom = -span / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    wake();
  }

  function wake() {
    if (!visible || disposed || frame) return;
    lastTime = null;
    frame = requestAnimationFrame(draw);
  }

  function draw(time) {
    frame = 0;
    if (!visible || disposed) return;
    if (lastTime !== null && time - lastTime < 1000 / 30) {
      frame = requestAnimationFrame(draw);
      return;
    }
    const dt = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, .08);
    lastTime = time;
    player.update(dt);
    applyPose();
    data.objects.forEach(object => {
      const block = blocks.get(object.id);
      const highlight = (hovered === object.id && player.states[object.id] === 'available') || player.queued === object.id;
      block.material.emissive.set(highlight ? object.color : 0x000000);
      block.material.emissiveIntensity = highlight ? .35 : 0;
      block.material.opacity = player.resetOpacity;
      const marker = markers.get(object.id);
      marker.visible = player.states[object.id] === 'available';
      marker.material.color.set(highlight ? 0x38bdf8 : object.color);
      marker.scale.setScalar(highlight ? 1.12 : 1);
      marker.material.opacity = (highlight ? .95 : .4) * player.resetOpacity;
    });
    renderer.render(scene, camera);
    if (player.running && !frame) frame = requestAnimationFrame(draw);
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1,
      -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    // Raycast the complete scene so an occluded block cannot be clicked through the arm.
    const hit = raycaster.intersectObjects(scene.children, true)
      .find(intersection => intersection.object.isMesh && !intersection.object.userData.decoration);
    const id = hit?.object.userData.objectId;
    return player.states[id] === 'available' && player.resetTime === null ? id : null;
  }
  canvas.addEventListener('pointerenter', () => {
    pointerInside = true;
    interactionActive = true;
    player.reset();
  }, { signal: events.signal });
  canvas.addEventListener('pointermove', event => {
    const id = pick(event);
    if (id !== hovered) {
      hovered = id;
      canvas.style.cursor = id ? 'pointer' : 'default';
      wake();
    }
  }, { signal: events.signal });
  canvas.addEventListener('pointerleave', () => {
    pointerInside = false;
    leaveInteraction();
  }, { signal: events.signal });
  canvas.addEventListener('click', event => {
    const id = pick(event);
    if (id) player.select(id);
  }, { signal: events.signal });
  canvas.addEventListener('focus', () => {
    if (!pointerInside && canvas.matches(':focus-visible')) enterInteraction();
  }, { signal: events.signal });
  canvas.addEventListener('blur', () => {
    if (!pointerInside) leaveInteraction();
  }, { signal: events.signal });
  canvas.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' ', 'Escape'].includes(event.key)) return;
    event.preventDefault();
    enterInteraction();
    if (event.key === 'Escape') {
      player.reset();
    } else if (event.key.startsWith('Arrow')) {
      const choices = data.objects.filter(object => player.states[object.id] === 'available');
      if (!choices.length) return;
      const index = choices.findIndex(object => object.id === hovered);
      const direction = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
      hovered = choices[index < 0 ? (direction > 0 ? 0 : choices.length - 1) : (index + direction + choices.length) % choices.length].id;
      wake();
    } else if (hovered) {
      player.select(hovered);
    }
  }, { signal: events.signal });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    onFailure(new Error('WebGL context lost'));
  }, { signal: events.signal });
  const observer = new ResizeObserver(resize);
  observer.observe(viewport);
  if (reducedMotion) player.pause();
  applyPose();

  return {
    setVisible(value) {
      visible = value;
      if (value) {
        resize();
        wake();
      } else {
        cancelAnimationFrame(frame);
        frame = 0;
        lastTime = null;
      }
    },
    setReducedMotion(value) {
      motionReduced = value;
      if (value) player.pause();
      else if (!interactionActive) player.resume();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      events.abort();
      observer.disconnect();
      const geometries = new Set();
      const materials = new Set();
      scene.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      renderer.dispose();
      canvas.remove();
    }
  };
}
