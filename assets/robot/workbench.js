import * as THREE from 'three';

// Bevels stay inside the requested dimensions, preserving the grasp geometry.
export function roundedPrism(width, depth, height, radius, bevel = .002) {
  const x = width / 2 - bevel;
  const y = depth / 2 - bevel;
  const r = Math.min(radius, x, y);
  const shape = new THREE.Shape();
  shape.moveTo(-x + r, -y);
  shape.lineTo(x - r, -y);
  shape.quadraticCurveTo(x, -y, x, -y + r);
  shape.lineTo(x, y - r);
  shape.quadraticCurveTo(x, y, x - r, y);
  shape.lineTo(-x + r, y);
  shape.quadraticCurveTo(-x, y, -x, y - r);
  shape.lineTo(-x, -y + r);
  shape.quadraticCurveTo(-x, -y, -x + r, -y);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height - 2 * bevel,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 3,
    steps: 1,
    curveSegments: 5
  });
  geometry.translate(0, 0, -height / 2 + bevel);
  return geometry;
}

export function createWorkbench(scene, objects) {
  function surface(size, position, material, radius = .025, bevel = .002) {
    const mesh = new THREE.Mesh(roundedPrism(...size, radius, bevel), new THREE.MeshStandardMaterial(material));
    mesh.position.fromArray(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  // A silver ceramic top, fine blue seam and dark chamfered underside.
  surface([.94, .84, .012], [.25, .035, -.032], {
    color: 0x536b82, metalness: .45, roughness: .36
  });
  surface([.938, .838, .004], [.25, .035, -.024], {
    color: 0x7ac8ef, emissive: 0x4db9f4, emissiveIntensity: .45,
    metalness: .15, roughness: .3
  }, .025, .0008);
  surface([.94, .84, .024], [.25, .035, -.012], {
    color: 0xe7f0f6, metalness: .18, roughness: .48
  });

  function lines(points, color, opacity) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    const mesh = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
      color, transparent: true, opacity, depthWrite: false
    }));
    mesh.userData.decoration = true;
    scene.add(mesh);
  }

  const grid = [];
  for (let i = 0; i <= 12; i++) {
    const x = -.17 + i * .07;
    grid.push(x, -.315, .0007, x, .385, .0007);
  }
  for (let i = 0; i <= 10; i++) {
    const y = -.315 + i * .07;
    grid.push(-.17, y, .0007, .67, y, .0007);
  }
  lines(grid, 0x9ebed3, .32);

  const corners = [];
  for (const x of [-.185, .685]) for (const y of [-.34, .41]) {
    const dx = x < .25 ? .04 : -.04;
    const dy = y < .035 ? .04 : -.04;
    corners.push(x + dx, y, .001, x, y, .001, x, y, .001, x, y + dy, .001);
  }
  lines(corners, 0x4eaddd, .8);

  surface([.29, .29, .012], [.465, .235, .006], {
    color: 0xd4e5ee, metalness: .28, roughness: .38
  }, .014);
  const rim = { color: 0x8caabd, metalness: .48, roughness: .3 };
  for (const x of [.315, .615]) surface([.008, .308, .022], [x, .235, .011], rim, .002, .001);
  for (const y of [.085, .385]) surface([.308, .008, .022], [.465, y, .011], rim, .002, .001);

  const slots = [];
  for (const object of objects) {
    const [x, y] = object.place;
    const d = .038;
    slots.push(x - d, y - d, .0126, x + d, y - d, .0126,
      x + d, y - d, .0126, x + d, y + d, .0126,
      x + d, y + d, .0126, x - d, y + d, .0126,
      x - d, y + d, .0126, x - d, y - d, .0126);
  }
  lines(slots, 0x6b9cba, .45);

  const baseRing = new THREE.Mesh(new THREE.RingGeometry(.113, .117, 64),
    new THREE.MeshBasicMaterial({ color: 0x6cc8ee, transparent: true, opacity: .52, depthWrite: false }));
  baseRing.position.set(-.04, 0, .001);
  baseRing.userData.decoration = true;
  scene.add(baseRing);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShadowMaterial({ opacity: .13 }));
  shadow.position.set(.25, .035, -.039);
  shadow.receiveShadow = true;
  shadow.userData.decoration = true;
  scene.add(shadow);
}
