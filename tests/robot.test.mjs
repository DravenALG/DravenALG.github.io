import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import vm from 'node:vm';
import { MotionPlayer } from '../assets/robot/motion-player.js';

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'three') return { url: new URL('../assets/vendor/three/three.module.min.js', import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const THREE = await import('../assets/vendor/three/three.module.min.js');
const { GLTFLoader } = await import('../assets/vendor/three/loaders/GLTFLoader.js');
const { createPandaRig } = await import('../assets/robot/panda-rig.js');
const data = JSON.parse(await readFile(new URL('../assets/franka/motion.json', import.meta.url)));
const bytes = await readFile(new URL('../assets/franka/panda.glb', import.meta.url));
const model = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const rig = createPandaRig(model.scene, data);

function advance(player, seconds) {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) player.update(1 / 60);
}

function until(player, predicate, limit = 20) {
  for (let i = 0; i < limit * 60 && !predicate(); i++) player.update(1 / 60);
  assert.ok(predicate(), 'Expected state was not reached');
}

test('autoplay grasps and releases all four blocks once, then resets', () => {
  const events = [];
  const player = new MotionPlayer(data, (event, id) => events.push([event, id]));
  until(player, () => events.some(([event]) => event === 'reset'), 80);
  assert.deepEqual(events.filter(([event]) => event === 'attach').map(([, id]) => id), data.objects.map(object => object.id));
  assert.deepEqual(events.filter(([event]) => event === 'release').map(([, id]) => id), data.objects.map(object => object.id));
  assert.ok(Object.values(player.states).every(state => state === 'available'));
  assert.equal(player.held, null);
  assert.deepEqual(player.q, data.home);
});

test('last valid click takes priority after the current grasp finishes', () => {
  const player = new MotionPlayer(data);
  player.select('blue');
  advance(player, 1);
  const q = [...player.q];
  player.select('coral');
  player.select('sage');
  assert.equal(player.active.id, 'blue');
  assert.deepEqual(player.q, q);
  assert.equal(player.queued, 'sage');
  assert.equal(player.select('unknown'), false);
  assert.equal(player.select('blue'), false);
  until(player, () => player.active?.id === 'sage');
  assert.equal(player.states.blue, 'placed');
  assert.equal(player.states.coral, 'available');
});

test('pause freezes a held block; a manual selection runs without enabling autoplay', () => {
  const player = new MotionPlayer(data);
  player.pause();
  advance(player, 10);
  assert.equal(player.active, null);
  player.select('gold');
  until(player, () => player.held === 'gold');
  player.pause();
  const q = [...player.q];
  advance(player, 20);
  assert.deepEqual(player.q, q);
  assert.equal(player.held, 'gold');
  player.resume();
  until(player, () => !player.active);
  assert.equal(player.select('gold'), false);
  const manual = new MotionPlayer(data);
  manual.pause();
  manual.select('coral');
  advance(manual, 30);
  assert.equal(manual.states.coral, 'placed');
  assert.equal(manual.active, null);
  assert.equal(manual.autoplay, false);
  assert.equal(manual.running, false);
});

test('entering the scene resets a held block and pending target, then waits for a click', () => {
  const events = [];
  const player = new MotionPlayer(data, (event, id) => events.push([event, id]));
  player.select('blue');
  until(player, () => player.held === 'blue');
  player.select('coral');
  player.reset();
  assert.deepEqual(player.q, data.home);
  assert.equal(player.grip, .04);
  assert.equal(player.held, null);
  assert.equal(player.queued, null);
  assert.equal(player.active, null);
  assert.equal(player.resetOpacity, 1);
  assert.equal(player.running, false);
  assert.deepEqual(events.at(-1), ['reset', undefined]);
  advance(player, 20);
  assert.ok(Object.values(player.states).every(state => state === 'available'));
  assert.equal(player.active, null);
  player.select('gold');
  until(player, () => player.states.gold === 'placed');
  until(player, () => player.active === null);
  advance(player, 20);
  assert.equal(player.states.blue, 'available');
  assert.equal(player.autoplay, false);
  player.resume();
  until(player, () => player.active?.id === 'blue');
});

test('entering during the round-reset fade restores opacity and cancels the fade', () => {
  const player = new MotionPlayer(data);
  until(player, () => player.resetTime !== null && player.resetTime > 1.4, 80);
  assert.ok(player.resetOpacity < 1);
  player.reset();
  assert.equal(player.resetTime, null);
  assert.equal(player.resetOpacity, 1);
  player.select('sage');
  assert.equal(player.active.id, 'sage');
  assert.equal(player.autoplay, false);
});

test('the actual GLB rig reaches every pick/place within 0.1 mm with downward fingers', () => {
  const target = new THREE.Vector3();
  const direction = new THREE.Vector3();
  for (const object of data.objects) {
    for (const [segmentIndex, position] of [[1, object.pick], [5, object.place]]) {
      const segment = object.segments[segmentIndex];
      rig.setPose(segment.samples.at(-1), data.size / 2);
      rig.tcp.getWorldPosition(target);
      assert.ok(target.distanceTo(new THREE.Vector3(...position)) < .0001, `${object.id} endpoint`);
      rig.tcp.getWorldDirection(direction);
      assert.ok(direction.distanceTo(new THREE.Vector3(0, 0, -1)) < .001);
    }
  }
});

test('all paths stay within joint limits, remain continuous and clear the tabletop', () => {
  const meshes = [];
  rig.root.traverse(object => { if (object.isMesh) meshes.push(object); });
  const vertex = new THREE.Vector3();
  let minimum = Infinity;
  for (const object of data.objects) {
    let previous = data.home;
    for (const segment of object.segments.filter(segment => segment.kind === 'move')) {
      assert.ok(segment.samples[0].every((q, i) => Math.abs(q - previous[i]) < .000001));
      for (const q of segment.samples) {
        assert.ok(q.every((angle, i) => Number.isFinite(angle) && angle >= data.limits.lower[i] && angle <= data.limits.upper[i]));
        rig.setPose(q, .04);
        for (const mesh of meshes) {
          const positions = mesh.geometry.attributes.position;
          for (let i = 0; i < positions.count; i++) {
            vertex.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
            minimum = Math.min(minimum, vertex.z);
          }
        }
      }
      previous = segment.samples.at(-1);
    }
    assert.deepEqual(previous, data.home);
  }
  assert.ok(minimum >= -.001, `Robot penetrates tabletop: ${minimum} m`);
});

test('attached blocks preserve their world pose at grasp and follow the gripper', () => {
  const scene = new THREE.Scene();
  scene.add(rig.root);
  const object = data.objects[0];
  const block = new THREE.Object3D();
  block.position.fromArray(object.pick);
  scene.add(block);
  rig.setPose(object.segments[1].samples.at(-1), data.size / 2);
  scene.updateMatrixWorld(true);
  rig.tcp.attach(block);
  assert.ok(block.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(...object.pick)) < .000001);
  const graspOffset = block.position.clone();
  rig.setPose(object.segments[4].samples.at(-1), data.size / 2);
  assert.ok(block.position.distanceTo(graspOffset) < .000001);
  assert.ok(block.getWorldPosition(new THREE.Vector3()).z > .27);
  block.removeFromParent();
});

test('camera framing contains all trajectories in the inline profile scene', () => {
  const width = 264, height = 228;
  const span = Math.max(1.4, 1.4 * height / width);
  const camera = new THREE.OrthographicCamera(-span * width / height / 2, span * width / height / 2, span / 2, -span / 2, .01, 15);
  camera.up.set(0, 0, 1);
  camera.position.set(1.35, -1.65, 1.30);
  camera.lookAt(.25, .015, .31);
  camera.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  for (const object of data.objects) {
    for (const segment of object.segments.filter(segment => segment.kind === 'move')) {
      for (const q of segment.samples) {
        rig.setPose(q, .04);
        bounds.setFromObject(rig.root);
        for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
          const projected = new THREE.Vector3(x, y, z).project(camera);
          assert.ok(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1, `${object.id} is outside canvas`);
        }
      }
    }
  }
});

const bootstrap = await readFile(new URL('../robot-background.js', import.meta.url), 'utf8');
for (const condition of ['narrow', 'hidden', 'offscreen']) {
  test(`${condition} pages do not import the 3D dependency graph`, () => {
    let imports = 0;
    const width = condition === 'narrow' ? 959 : 1280;
    const IntersectionObserver = class {
      constructor(callback) { this.callback = callback; }
      observe() { this.callback([{ isIntersecting: condition !== 'offscreen' }]); }
    };
    const sandbox = {
      window: {
        matchMedia: query => ({
          matches: query.includes('min-width')
            ? width >= Number(query.match(/min-width:\s*(\d+)/)[1])
            : false,
          addEventListener() {}
        }),
        addEventListener() {}, requestIdleCallback: fn => fn(), IntersectionObserver
      },
      IntersectionObserver,
      document: { hidden: condition === 'hidden', getElementById: () => ({ hidden: true, closest: () => ({}) }), addEventListener() {} },
      console
    };
    new vm.Script(bootstrap, { importModuleDynamically() { imports++; throw new Error('Unexpected import'); } }).runInNewContext(sandbox);
    assert.equal(imports, 0);
  });
}
