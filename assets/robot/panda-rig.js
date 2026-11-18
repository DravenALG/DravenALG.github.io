import * as THREE from 'three';

// URDF coordinates are retained in metres, with Z up. Each joint has an
// immutable origin frame followed by its local Z-axis rotation.
export function createPandaRig(source, data) {
  const root = new THREE.Group();
  const parts = Object.fromEntries([...Array(8)].map((_, index) =>
    [`link${index}`, source.getObjectByName(`link${index}`)]));
  const handMesh = source.getObjectByName('hand');
  const fingerMesh = source.getObjectByName('finger');
  if (!handMesh || !fingerMesh || Object.values(parts).some(part => !part)) {
    throw new Error('Incomplete Panda model');
  }
  root.add(parts.link0);
  const joints = [];
  let parent = root;
  data.origins.forEach((origin, index) => {
    const frame = new THREE.Group();
    frame.position.set(origin.x, origin.y, origin.z);
    frame.rotation.set(origin.roll, origin.pitch, origin.yaw, 'ZYX');
    parent.add(frame);
    const joint = new THREE.Group();
    frame.add(joint);
    joint.add(parts[`link${index + 1}`]);
    joints.push(joint);
    parent = joint;
  });
  parts.link7.rotation.z = Math.PI / 4;
  const hand = new THREE.Group();
  hand.position.z = .107;
  hand.rotation.z = -Math.PI / 4;
  parent.add(hand);
  hand.add(handMesh);
  const fingers = [fingerMesh, fingerMesh.clone(true)];
  fingers.forEach((finger, index) => {
    finger.position.z = .0584;
    finger.rotation.z = index * Math.PI;
    hand.add(finger);
  });
  const tcp = new THREE.Group();
  tcp.position.z = .1034;
  hand.add(tcp);
  root.traverse(object => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return {
    root, tcp, joints, fingers,
    setPose(q, grip) {
      joints.forEach((joint, index) => { joint.rotation.z = q[index]; });
      fingers[0].position.y = grip;
      fingers[1].position.y = -grip;
      root.updateMatrixWorld(true);
    }
  };
}
