import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';

const JOINTS = [
  'LeftToe', 'RightToe', 'LeftHeel', 'RightHeel',
  'LeftAnkle', 'RightAnkle', 'LeftKnee', 'RightKnee',
  'LeftHip', 'RightHip', 'LeftShoulder', 'RightShoulder',
  'LeftElbow', 'RightElbow', 'LeftWrist', 'RightWrist',
  'LeftHand', 'RightHand', 'LeftFingers', 'RightFingers',
  'Core', 'Neck', 'Head'
];

const EDGES = [
  ['Core', 'Neck'], ['Neck', 'Head'], ['Neck', 'LeftShoulder'], ['Neck', 'RightShoulder'],
  ['LeftShoulder', 'LeftElbow'], ['LeftElbow', 'LeftWrist'], ['LeftWrist', 'LeftHand'], ['LeftHand', 'LeftFingers'],
  ['RightShoulder', 'RightElbow'], ['RightElbow', 'RightWrist'], ['RightWrist', 'RightHand'], ['RightHand', 'RightFingers'],
  ['Core', 'LeftHip'], ['LeftHip', 'LeftKnee'], ['LeftKnee', 'LeftAnkle'], ['LeftAnkle', 'LeftToe'], ['LeftAnkle', 'LeftHeel'],
  ['Core', 'RightHip'], ['RightHip', 'RightKnee'], ['RightKnee', 'RightAnkle'], ['RightAnkle', 'RightToe'], ['RightAnkle', 'RightHeel']
];

const ARM_JOINTS = new Set([
  'LeftShoulder', 'RightShoulder',
  'LeftElbow', 'RightElbow',
  'LeftWrist', 'RightWrist',
  'LeftHand', 'RightHand',
  'LeftFingers', 'RightFingers'
]);

const ARM_EDGE_KEYS = new Set([
  'Neck|LeftShoulder', 'LeftShoulder|LeftElbow', 'LeftElbow|LeftWrist', 'LeftWrist|LeftHand', 'LeftHand|LeftFingers',
  'Neck|RightShoulder', 'RightShoulder|RightElbow', 'RightElbow|RightWrist', 'RightWrist|RightHand', 'RightHand|RightFingers'
]);

const TORSO_EDGE_KEYS = new Set([
  'Core|Neck',
  'Core|LeftHip',
  'Core|RightHip'
]);

function edgeKey(a, b) {
  return `${a}|${b}`;
}

function isArmEdge(a, b) {
  return ARM_EDGE_KEYS.has(edgeKey(a, b)) || ARM_EDGE_KEYS.has(edgeKey(b, a));
}

const ROT_CHILD = {
  LeftElbow: 'LeftWrist',
  RightElbow: 'RightWrist',
  LeftKnee: 'LeftAnkle',
  RightKnee: 'RightAnkle',
  LeftHand: 'LeftFingers',
  RightHand: 'RightFingers',
  Neck: 'Head'
};

const statusEl = document.getElementById('status');
const networkEl = document.getElementById('network');
const calibrateBtn = document.getElementById('calibrateBtn');
const resetBtn = document.getElementById('resetBtn');
const canvas = document.getElementById('c');
const DEBUG_VIS = true;
const CALIB_STORAGE_KEY = 'pvpkickboxer_calib_v2';
const GAZE_CALIB_DWELL_MS = 1000;
const GAZE_CALIB_COOLDOWN_MS = 800;
const GAZE_CALIB_ANGLE_DEG = 8;
const CALIB_MARKER_LOW_ABOVE_OPP_HEAD_Y = 0.16;
const CALIB_MARKER_HIGH_DELTA_Y = 0.34;
const ESTIMATED_EYE_HEIGHT_M = 1.65;
const CALIB_POSE_HOLD_HEAD_EPS = 0.02;
const CALIB_POSE_HOLD_CTRL_EPS = 0.03;
const CALIB_PREVIEW_DISTANCE = 1.05;
const AVATAR_SCALE = 0.92;
const BASE_BONE_RADIUS = 0.019;
const TORSO_RADIUS_MULT = 5;
const FLOOR_SIZE_M = 3.048; // 10 feet

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.xr.enabled = true;

function installXRSessionButton() {
  const arInit = {
    requiredFeatures: ['local-floor'],
    optionalFeatures: ['hand-tracking', 'bounded-floor', 'passthrough', 'dom-overlay'],
    domOverlay: { root: document.body }
  };
  const vrInit = {
    requiredFeatures: ['local-floor', 'hand-tracking'],
    optionalFeatures: ['bounded-floor', 'passthrough']
  };

  if (!navigator.xr || !navigator.xr.isSessionSupported) {
    document.body.appendChild(VRButton.createButton(renderer, vrInit));
    return;
  }

  navigator.xr.isSessionSupported('immersive-ar')
    .then((supported) => {
      if (supported) document.body.appendChild(ARButton.createButton(renderer, arInit));
      else document.body.appendChild(VRButton.createButton(renderer, vrInit));
    })
    .catch(() => {
      document.body.appendChild(VRButton.createButton(renderer, vrInit));
    });
}

installXRSessionButton();

const scene = new THREE.Scene();
scene.fog = null;
const world = new THREE.Group();
scene.add(world);
let pendingFloorAlign = false;

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.01, 100);
camera.position.set(2.4, 1.7, 2.4);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.9, 0);
controls.enableDamping = true;

world.add(new THREE.HemisphereLight(0xffffff, 0x203443, 0.9));
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(3, 5, 2);
world.add(dir);
const grid = new THREE.GridHelper(10, 20, 0x2c4556, 0x1a2a36);
world.add(grid);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_SIZE_M, FLOOR_SIZE_M), new THREE.MeshStandardMaterial({ color: 0x0b1117, roughness: 1 }));
floor.rotation.x = -Math.PI / 2;
world.add(floor);

function alignWorldFloorForSession(session) {
  if (!session) return;
  const xrCam = renderer.xr.getCamera(camera);
  const headWorld = new THREE.Vector3();
  xrCam.getWorldPosition(headWorld);

  if (session.mode === 'immersive-ar') {
    const enabled = session.enabledFeatures ? Array.from(session.enabledFeatures) : [];
    const hasLocalFloor = enabled.includes('local-floor');
    if (hasLocalFloor) {
      world.position.y = 0;
    } else {
      // Fallback: approximate floor from eye height when local-floor isn't available.
      world.position.y = headWorld.y - ESTIMATED_EYE_HEIGHT_M;
    }
  } else {
    world.position.y = 0;
  }
}

const controllerFloorCalib = {
  minY: Infinity
};

function updateFloorFromControllerLow(leftPos, rightPos) {
  let lowPos = null;
  if (leftPos && rightPos) lowPos = leftPos.y <= rightPos.y ? leftPos : rightPos;
  else if (leftPos) lowPos = leftPos;
  else if (rightPos) lowPos = rightPos;
  if (!lowPos) return false;

  const currentMin = lowPos.y;
  if (!Number.isFinite(currentMin)) return false;

  if (!Number.isFinite(controllerFloorCalib.minY)) {
    world.position.y += currentMin;
    controllerFloorCalib.minY = 0;
    return true;
  }

  if (currentMin < controllerFloorCalib.minY) {
    // Shift whole XR world so lowest controller is floor-level (y=0).
    world.position.y += currentMin;
    controllerFloorCalib.minY = 0;
    return true;
  }

  return false;
}

const gazeCalib = {
  activeSince: 0,
  lastTriggerAt: 0,
  progress: 0,
  marker: null,
  fillMesh: null,
  coreMesh: null,
  basePos: new THREE.Vector3(),
  hasBasePos: false
};

function buildGazeCalibratorMarker() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 20, 16),
    new THREE.MeshStandardMaterial({ color: 0x2ee6a8, emissive: 0x0a3324, emissiveIntensity: 0.7 })
  );
  const ringBase = new THREE.Mesh(
    new THREE.RingGeometry(0.075, 0.095, 36),
    new THREE.MeshBasicMaterial({ color: 0x244a3d, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
  );
  const fill = new THREE.Mesh(
    new THREE.RingGeometry(0.075, 0.095, 36, 1, Math.PI / 2, 0.001),
    new THREE.MeshBasicMaterial({ color: 0x6fffd3, transparent: true, opacity: 0.95, side: THREE.DoubleSide })
  );
  g.add(core);
  g.add(ringBase);
  g.add(fill);
  g.visible = false;
  world.add(g);
  gazeCalib.marker = g;
  gazeCalib.fillMesh = fill;
  gazeCalib.coreMesh = core;
}

const debugHud = document.createElement('pre');
debugHud.style.position = 'fixed';
debugHud.style.left = '10px';
debugHud.style.bottom = '10px';
debugHud.style.margin = '0';
debugHud.style.padding = '8px 10px';
debugHud.style.background = 'rgba(0,0,0,0.65)';
debugHud.style.color = '#9df5d2';
debugHud.style.font = '12px/1.3 monospace';
debugHud.style.whiteSpace = 'pre-wrap';
debugHud.style.pointerEvents = 'none';
debugHud.style.zIndex = '99';
debugHud.textContent = 'debug: waiting...';
if (DEBUG_VIS) document.body.appendChild(debugHud);

const debugArrows = {
  waistToHmd: new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 0.01, 0x66ffcc),
  leftHipDir: new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 0.01, 0xff6666),
  leftKneeDir: new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 0.01, 0xffaa66),
  rightHipDir: new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 0.01, 0x6666ff),
  rightKneeDir: new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 0.01, 0x66aaff)
};
if (DEBUG_VIS) {
  world.add(debugArrows.waistToHmd);
  world.add(debugArrows.leftHipDir);
  world.add(debugArrows.leftKneeDir);
  world.add(debugArrows.rightHipDir);
  world.add(debugArrows.rightKneeDir);
}
buildGazeCalibratorMarker();

function vsub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function vadd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function vscale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function vdot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function vlen(a) { return Math.sqrt(vdot(a, a)); }
function vdist(a, b) { return vlen(vsub(a, b)); }
function vlerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

function sourceLabel(nodeOrSource) {
  const s = nodeOrSource?.userData?.inputSource || nodeOrSource;
  if (!s) return 'none';
  const hand = s.handedness || 'none';
  const profile = (s.profiles || [])[0] || 'unknown';
  return `${hand}:${profile}`;
}

function updateArrow(helper, origin, target) {
  if (!DEBUG_VIS || !origin || !target) {
    helper.visible = false;
    return;
  }
  const dir = target.clone().sub(origin);
  const len = dir.length();
  if (len < 1e-5) {
    helper.visible = false;
    return;
  }
  helper.visible = true;
  helper.position.copy(origin);
  helper.setDirection(dir.normalize());
  helper.setLength(len);
}

function scaleCharacter(ch, scale) {
  const core = ch.joints.Core;
  if (!core) return;
  for (const j of JOINTS) {
    const p = ch.joints[j];
    p[0] = core[0] + (p[0] - core[0]) * scale;
    p[1] = core[1] + (p[1] - core[1]) * scale;
    p[2] = core[2] + (p[2] - core[2]) * scale;
  }
  ch.recomputeLens();
  ch.initRotFromPose();
  ch.applyMeshes();
}

function getAvatarForwardXZ(ch) {
  const c = ch.joints.Core;
  const n = ch.joints.Neck;
  if (c && n) {
    const f = new THREE.Vector3(n[0] - c[0], 0, n[2] - c[2]);
    if (f.lengthSq() > 1e-6) return f.normalize();
  }
  const lh = ch.joints.LeftHip;
  const rh = ch.joints.RightHip;
  if (lh && rh) {
    const right = new THREE.Vector3(rh[0] - lh[0], 0, rh[2] - lh[2]).normalize();
    const f = new THREE.Vector3().crossVectors(right, new THREE.Vector3(0, 1, 0));
    if (f.lengthSq() > 1e-6) return f.normalize();
  }
  return new THREE.Vector3(0, 0, 1);
}

function placeAvatarInFrontForCalibration(head, forwardXZ) {
  const coreNow = getJointVec('Core');
  const desiredCore = head.clone().add(forwardXZ.clone().multiplyScalar(CALIB_PREVIEW_DISTANCE));
  desiredCore.y = coreNow.y;

  const currentForward = getAvatarForwardXZ(avatarLocal);
  const q = new THREE.Quaternion().setFromUnitVectors(currentForward, forwardXZ);
  for (const j of JOINTS) {
    const p = getJointVec(j).sub(coreNow).applyQuaternion(q).add(desiredCore);
    avatarLocal.joints[j] = [p.x, p.y, p.z];
  }
}

function resetCalibratorBasePosFromOpponentHead() {
  const remoteHead = new THREE.Vector3().fromArray(avatarRemote.joints.Head);
  gazeCalib.basePos.set(remoteHead.x, remoteHead.y + CALIB_MARKER_LOW_ABOVE_OPP_HEAD_Y, remoteHead.z);
  gazeCalib.hasBasePos = true;
}

function getCalibrationFacingDirectionXZ(headForwardXZ, headPos, leftHandCtrl) {
  const facing = headForwardXZ.clone();
  const leftCtrlPos = getControllerLocalPos(leftHandCtrl);
  if (!leftCtrlPos) return facing;

  const leftDir = leftCtrlPos.sub(headPos);
  leftDir.y = 0;
  if (leftDir.lengthSq() < 1e-6) return facing;
  leftDir.normalize();

  facing.add(leftDir);
  if (facing.lengthSq() < 1e-6) return headForwardXZ.clone();
  return facing.normalize();
}

function getGazeCalibratorTargetPos() {
  if (!gazeCalib.hasBasePos) resetCalibratorBasePosFromOpponentHead();
  const target = gazeCalib.basePos.clone();
  if (calibr.valid) target.y += CALIB_MARKER_HIGH_DELTA_Y;
  return target;
}

function hmdLocalForward() {
  const xrCam = renderer.xr.getCamera(camera);
  const dirW = new THREE.Vector3();
  xrCam.getWorldDirection(dirW);
  const worldQuat = new THREE.Quaternion();
  world.getWorldQuaternion(worldQuat).invert();
  return dirW.applyQuaternion(worldQuat).normalize();
}

function setGazeProgress(progress01) {
  const p = clamp(progress01, 0, 1);
  gazeCalib.progress = p;
  if (!gazeCalib.fillMesh) return;
  gazeCalib.fillMesh.geometry.dispose();
  gazeCalib.fillMesh.geometry = new THREE.RingGeometry(0.075, 0.095, 36, 1, Math.PI / 2, (Math.PI * 2) * p);
}

class StickCharacter {
  constructor(color, name) {
    this.name = name;
    this.group = new THREE.Group();
    this.group.name = name;
    this.joints = {};
    this.prevJoints = {};
    this.rot = {};
    this.edgeLens = new Array(EDGES.length).fill(0);
    this.jointMeshes = new Map();
    this.bones = [];

    const jGeo = new THREE.SphereGeometry(0.034, 12, 10);
    const jMat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0 });
    const hMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissive: 0x111111, emissiveIntensity: 0.6 });

    for (const j of JOINTS) {
      const isMain = j.includes('Wrist') || j.includes('Knee') || j === 'Head';
      const m = new THREE.Mesh(jGeo, isMain ? hMat : jMat);
      if (j === 'Head') m.scale.setScalar(1.4);
      if (j === 'Core') m.scale.setScalar(1.8);
      if (ARM_JOINTS.has(j)) m.visible = false;
      this.group.add(m);
      this.jointMeshes.set(j, m);
      this.joints[j] = [0, 0, 0];
      this.prevJoints[j] = [0, 0, 0];
    }

    for (const [a, b] of EDGES) {
      const isTorso = TORSO_EDGE_KEYS.has(edgeKey(a, b));
      const radius = isTorso ? BASE_BONE_RADIUS * TORSO_RADIUS_MULT : BASE_BONE_RADIUS;
      const bGeo = new THREE.CylinderGeometry(radius, radius, 1, 8);
      const bMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
      const mesh = new THREE.Mesh(bGeo, bMat);
      if (ARM_EDGE_KEYS.has(edgeKey(a, b))) mesh.visible = false;
      this.group.add(mesh);
      this.bones.push({ a, b, mesh, radius });
    }

    for (const k of Object.keys(ROT_CHILD)) this.rot[k] = new THREE.Quaternion();
  }

  setPose(jointObj) {
    for (const j of JOINTS) {
      const v = jointObj[j];
      this.joints[j] = [v[0], v[1], v[2]];
      this.prevJoints[j] = [v[0], v[1], v[2]];
    }
    this.recomputeLens();
    this.initRotFromPose();
    this.applyMeshes();
  }

  recomputeLens() {
    for (let i = 0; i < EDGES.length; i++) {
      const [a, b] = EDGES[i];
      this.edgeLens[i] = vdist(this.joints[a], this.joints[b]);
    }
  }

  initRotFromPose() {
    const up = new THREE.Vector3(0, 1, 0);
    for (const jointName of Object.keys(ROT_CHILD)) {
      const c = ROT_CHILD[jointName];
      const a = this.joints[jointName];
      const b = this.joints[c];
      const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      if (dir.lengthSq() < 1e-8) this.rot[jointName].identity();
      else this.rot[jointName].setFromUnitVectors(up, dir.normalize());
    }
  }

  edgeLenByJoints(a, b) {
    for (let i = 0; i < EDGES.length; i++) {
      const e = EDGES[i];
      if ((e[0] === a && e[1] === b) || (e[1] === a && e[0] === b)) return this.edgeLens[i];
    }
    return vdist(this.joints[a], this.joints[b]);
  }

  snapshot() {
    return structuredClone(this.joints);
  }

  restore(s) {
    for (const j of JOINTS) this.joints[j] = [s[j][0], s[j][1], s[j][2]];
    this.applyMeshes();
  }

  copyCurrentToPrev() {
    for (const j of JOINTS) {
      const v = this.joints[j];
      this.prevJoints[j][0] = v[0];
      this.prevJoints[j][1] = v[1];
      this.prevJoints[j][2] = v[2];
    }
  }

  applyMeshes() {
    for (const j of JOINTS) {
      const m = this.jointMeshes.get(j);
      const v = this.joints[j];
      m.position.set(v[0], v[1], v[2]);
    }
    const yAxis = new THREE.Vector3(0, 1, 0);
    for (const b of this.bones) {
      const a = this.joints[b.a];
      const c = this.joints[b.b];
      const dx = c[0] - a[0];
      const dy = c[1] - a[1];
      const dz = c[2] - a[2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-9;
      b.mesh.position.set((a[0] + c[0]) * 0.5, (a[1] + c[1]) * 0.5, (a[2] + c[2]) * 0.5);
      b.mesh.quaternion.setFromUnitVectors(yAxis, new THREE.Vector3(dx / len, dy / len, dz / len));
      b.mesh.scale.set(1, len, 1);
    }
  }
}

const avatarLocal = new StickCharacter(0xff5757, 'local');
const avatarRemote = new StickCharacter(0x5ca6ff, 'remote');
world.add(avatarLocal.group);
world.add(avatarRemote.group);

let startPose = null;
let remoteStartPose = null;

const calibr = {
  valid: false,
  waistOffset: new THREE.Vector3(),
  leftKneeOffset: new THREE.Vector3(),
  rightKneeOffset: new THREE.Vector3(),
  leftKneeRotRef: new THREE.Quaternion(),
  rightKneeRotRef: new THREE.Quaternion(),
  leftAnkleDirRef: new THREE.Quaternion(),
  rightAnkleDirRef: new THREE.Quaternion(),
  leftToeLocal: new THREE.Vector3(),
  leftHeelLocal: new THREE.Vector3(),
  rightToeLocal: new THREE.Vector3(),
  rightHeelLocal: new THREE.Vector3(),
  leftThighRef: new THREE.Vector3(),
  rightThighRef: new THREE.Vector3(),
  leftKneeAxisRef: new THREE.Vector3(),
  rightKneeAxisRef: new THREE.Vector3()
};
const calibrationPoseHold = {
  active: false,
  pose: null,
  headRef: new THREE.Vector3(),
  leftCtrlRef: null,
  rightCtrlRef: null
};
let holdLocalPoseThisFrame = false;
const kneeHingeState = {
  Left: { frozen: false, lastValidBend: 0, lastValidRot: new THREE.Quaternion(), hasValidRot: false },
  Right: { frozen: false, lastValidBend: 0, lastValidRot: new THREE.Quaternion(), hasValidRot: false }
};

function resetKneeHingeState() {
  kneeHingeState.Left.frozen = false;
  kneeHingeState.Right.frozen = false;
  kneeHingeState.Left.lastValidBend = 0;
  kneeHingeState.Right.lastValidBend = 0;
  kneeHingeState.Left.lastValidRot.identity();
  kneeHingeState.Right.lastValidRot.identity();
  kneeHingeState.Left.hasValidRot = false;
  kneeHingeState.Right.hasValidRot = false;
}

function clearCalibrationPoseHold() {
  calibrationPoseHold.active = false;
  calibrationPoseHold.pose = null;
  calibrationPoseHold.leftCtrlRef = null;
  calibrationPoseHold.rightCtrlRef = null;
}

function armCalibrationPoseHold(headPos, leftCtrlPos, rightCtrlPos) {
  calibrationPoseHold.active = true;
  calibrationPoseHold.pose = avatarLocal.snapshot();
  calibrationPoseHold.headRef.copy(headPos);
  calibrationPoseHold.leftCtrlRef = leftCtrlPos ? leftCtrlPos.clone() : null;
  calibrationPoseHold.rightCtrlRef = rightCtrlPos ? rightCtrlPos.clone() : null;
}

function shouldHoldCalibratedPose(headPos, leftCtrlPos, rightCtrlPos) {
  if (!calibrationPoseHold.active || !calibrationPoseHold.pose) return false;

  if (headPos.distanceToSquared(calibrationPoseHold.headRef) > CALIB_POSE_HOLD_HEAD_EPS * CALIB_POSE_HOLD_HEAD_EPS) {
    clearCalibrationPoseHold();
    return false;
  }

  const movedCtrl = (ref, cur) => {
    if (!ref && !cur) return false;
    if (!ref || !cur) return true;
    return ref.distanceToSquared(cur) > CALIB_POSE_HOLD_CTRL_EPS * CALIB_POSE_HOLD_CTRL_EPS;
  };

  if (movedCtrl(calibrationPoseHold.leftCtrlRef, leftCtrlPos) || movedCtrl(calibrationPoseHold.rightCtrlRef, rightCtrlPos)) {
    clearCalibrationPoseHold();
    return false;
  }

  return true;
}

function pinCalibrationPoseSnapshot() {
  if (!calibrationPoseHold.pose) return;
  for (const j of JOINTS) {
    const p = calibrationPoseHold.pose[j];
    setPinned(j, new THREE.Vector3(p[0], p[1], p[2]), 1);
  }
}

function saveCalibration() {
  localStorage.setItem(CALIB_STORAGE_KEY, JSON.stringify({
    valid: calibr.valid,
    waistOffset: calibr.waistOffset.toArray(),
    leftKneeOffset: calibr.leftKneeOffset.toArray(),
    rightKneeOffset: calibr.rightKneeOffset.toArray(),
    leftKneeRotRef: calibr.leftKneeRotRef.toArray(),
    rightKneeRotRef: calibr.rightKneeRotRef.toArray(),
    leftAnkleDirRef: calibr.leftAnkleDirRef.toArray(),
    rightAnkleDirRef: calibr.rightAnkleDirRef.toArray(),
    leftToeLocal: calibr.leftToeLocal.toArray(),
    leftHeelLocal: calibr.leftHeelLocal.toArray(),
    rightToeLocal: calibr.rightToeLocal.toArray(),
    rightHeelLocal: calibr.rightHeelLocal.toArray(),
    leftThighRef: calibr.leftThighRef.toArray(),
    rightThighRef: calibr.rightThighRef.toArray(),
    leftKneeAxisRef: calibr.leftKneeAxisRef.toArray(),
    rightKneeAxisRef: calibr.rightKneeAxisRef.toArray()
  }));
}

function loadCalibration() {
  const raw = localStorage.getItem(CALIB_STORAGE_KEY);
  if (!raw) return;
  try {
    const d = JSON.parse(raw);
    calibr.valid = !!d.valid;
    calibr.waistOffset.fromArray(d.waistOffset || [0, 0, 0]);
    calibr.leftKneeOffset.fromArray(d.leftKneeOffset || [0, 0, 0]);
    calibr.rightKneeOffset.fromArray(d.rightKneeOffset || [0, 0, 0]);
    calibr.leftKneeRotRef.fromArray(d.leftKneeRotRef || [0, 0, 0, 1]);
    calibr.rightKneeRotRef.fromArray(d.rightKneeRotRef || [0, 0, 0, 1]);
    calibr.leftAnkleDirRef.fromArray(d.leftAnkleDirRef || [0, 0, 0, 1]);
    calibr.rightAnkleDirRef.fromArray(d.rightAnkleDirRef || [0, 0, 0, 1]);
    calibr.leftToeLocal.fromArray(d.leftToeLocal || [0, 0, 0]);
    calibr.leftHeelLocal.fromArray(d.leftHeelLocal || [0, 0, 0]);
    calibr.rightToeLocal.fromArray(d.rightToeLocal || [0, 0, 0]);
    calibr.rightHeelLocal.fromArray(d.rightHeelLocal || [0, 0, 0]);
    calibr.leftThighRef.fromArray(d.leftThighRef || [0, 0, 0]);
    calibr.rightThighRef.fromArray(d.rightThighRef || [0, 0, 0]);
    calibr.leftKneeAxisRef.fromArray(d.leftKneeAxisRef || [0, 0, 0]);
    calibr.rightKneeAxisRef.fromArray(d.rightKneeAxisRef || [0, 0, 0]);
  } catch (_) {
    calibr.valid = false;
  }
}
calibr.valid = false;

const xrState = {
  controllers: [],
  deviceBySource: new Map(),
  leftController: null,
  rightController: null,
  leftHandObj: null,
  rightHandObj: null,
  handBySource: new Map(),
  lockedLeftKneeSource: null,
  lockedRightKneeSource: null,
  lockedLeftKneeNode: null,
  lockedRightKneeNode: null
};

function refreshXRControllerList() {
  xrState.controllers = Array.from(xrState.deviceBySource.values()).map((entry) => entry.node);
}

function registerXRNode(node, source, kind) {
  if (!source || source.hand) return;
  node.userData.inputSource = source;
  const existing = xrState.deviceBySource.get(source);
  if (!existing) {
    xrState.deviceBySource.set(source, { node, kind });
    refreshXRControllerList();
    return;
  }
  // Prefer grip node when both are available for the same physical source.
  if (existing.kind === 'targetRay' && kind === 'grip') {
    xrState.deviceBySource.set(source, { node, kind });
    refreshXRControllerList();
  }
}

function unregisterXRNode(node) {
  let changed = false;
  for (const [source, entry] of xrState.deviceBySource.entries()) {
    if (entry.node === node) {
      xrState.deviceBySource.delete(source);
      changed = true;
    }
  }
  if (changed) refreshXRControllerList();
}

function refreshXRHands() {
  xrState.leftHandObj = null;
  xrState.rightHandObj = null;
  for (const entry of xrState.handBySource.values()) {
    if (entry.handedness === 'left' && !xrState.leftHandObj) xrState.leftHandObj = entry.node;
    if (entry.handedness === 'right' && !xrState.rightHandObj) xrState.rightHandObj = entry.node;
  }
}

function registerXRHandNode(node, source) {
  if (!source || !source.hand) return;
  node.userData.inputSource = source;
  xrState.handBySource.set(source, { node, handedness: source.handedness || 'none' });
  refreshXRHands();
}

function unregisterXRHandNode(node) {
  let changed = false;
  for (const [source, entry] of xrState.handBySource.entries()) {
    if (entry.node === node) {
      xrState.handBySource.delete(source);
      changed = true;
    }
  }
  if (changed) refreshXRHands();
}

const ctrlFactory = new XRControllerModelFactory();
const handFactory = new XRHandModelFactory();
for (let i = 0; i < 12; i++) {
  const c = renderer.xr.getController(i);
  c.addEventListener('connected', (e) => {
    registerXRNode(c, e.data, 'targetRay');
  });
  c.addEventListener('disconnected', () => {
    unregisterXRNode(c);
    if (xrState.leftController === c) xrState.leftController = null;
    if (xrState.rightController === c) xrState.rightController = null;
  });
  scene.add(c);

  const g = renderer.xr.getControllerGrip(i);
  g.addEventListener('connected', (e) => {
    registerXRNode(g, e.data, 'grip');
  });
  g.addEventListener('disconnected', () => {
    unregisterXRNode(g);
  });
  g.add(ctrlFactory.createControllerModel(g));
  scene.add(g);

  const h = renderer.xr.getHand(i);
  h.addEventListener('connected', (e) => {
    registerXRHandNode(h, e.data);
  });
  h.addEventListener('disconnected', () => {
    unregisterXRHandNode(h);
  });
  h.add(handFactory.createHandModel(h, 'boxes'));
  scene.add(h);
}

function localFromWorldPos(v) {
  return world.worldToLocal(v.clone());
}

function hmdLocalPos() {
  const p = new THREE.Vector3();
  renderer.xr.getCamera(camera).getWorldPosition(p);
  return localFromWorldPos(p);
}

function isTrackerInputSource(source) {
  if (!source) return false;
  const profiles = source.profiles || [];
  const profileStr = profiles.join(' ').toLowerCase();
  if (profileStr.includes('tracker')) return true;
  if (profileStr.includes('tundra')) return true;
  if (profileStr.includes('lhr-')) return true;
  if (profileStr.includes('vive') && profileStr.includes('waist')) return true;
  if (profileStr.includes('vive') && profileStr.includes('foot')) return true;
  return false;
}

function classifyControllersByBody(forceTrackers = false) {
  const hmd = renderer.xr.getCamera(camera);
  const hmdInv = new THREE.Matrix4().copy(hmd.matrixWorld).invert();
  const list = xrState.controllers.map((c) => {
    const p = new THREE.Vector3();
    c.getWorldPosition(p);
    const ph = p.clone().applyMatrix4(hmdInv);
    const source = c.userData.inputSource;
    return {
      c,
      ph,
      source,
      handedness: source?.handedness || 'none',
      isTracker: isTrackerInputSource(source),
      profile: (source?.profiles || []).join('|') || 'unknown'
    };
  });

  // SteamVR/OpenXR tracker sources (including Tundra) are often handedness=none.
  // Treat those as tracker candidates even when profile strings are generic.
  const trackerCandidates = list.filter((x) => x.isTracker || x.handedness === 'none');
  const controllers = list.filter((x) => x.handedness === 'left' || x.handedness === 'right');

  const byHanded = {
    left: controllers.find((x) => x.handedness === 'left') || null,
    right: controllers.find((x) => x.handedness === 'right') || null
  };
  const bySide = {
    left: controllers.filter((x) => x.ph.x < 0).sort((a, b) => b.ph.y - a.ph.y),
    right: controllers.filter((x) => x.ph.x >= 0).sort((a, b) => b.ph.y - a.ph.y)
  };

  const leftHandCtrl = byHanded.left?.c || bySide.left[0]?.c || null;
  const rightHandCtrl = byHanded.right?.c || bySide.right[0]?.c || null;

  let leftKneeCtrl = null;
  let rightKneeCtrl = null;
  let usingTrackersForKnees = false;

  let kneePool = trackerCandidates;
  if (forceTrackers && trackerCandidates.length < 2) {
    kneePool = list.filter((x) => x.handedness !== 'left' && x.handedness !== 'right');
  }

  if (kneePool.length >= 2) {
    const sortedByHeight = kneePool.slice().sort((a, b) => a.ph.y - b.ph.y);
    const lowestTwo = sortedByHeight.slice(0, 2);
    lowestTwo.sort((a, b) => a.ph.x - b.ph.x);
    leftKneeCtrl = lowestTwo[0]?.c || null;
    rightKneeCtrl = lowestTwo[1]?.c || null;
    usingTrackersForKnees = !!leftKneeCtrl && !!rightKneeCtrl;
  }

  if (!usingTrackersForKnees) {
    const leftAll = list.filter((x) => x.ph.x < 0).sort((a, b) => b.ph.y - a.ph.y);
    const rightAll = list.filter((x) => x.ph.x >= 0).sort((a, b) => b.ph.y - a.ph.y);
    leftKneeCtrl = leftAll[leftAll.length - 1]?.c || null;
    rightKneeCtrl = rightAll[rightAll.length - 1]?.c || null;
  }

  if (xrState.lockedLeftKneeSource || xrState.lockedRightKneeSource) {
    const lockedLeft = list.find((x) => x.source === xrState.lockedLeftKneeSource)?.c || null;
    const lockedRight = list.find((x) => x.source === xrState.lockedRightKneeSource)?.c || null;
    if (lockedLeft) leftKneeCtrl = lockedLeft;
    if (lockedRight) rightKneeCtrl = lockedRight;
  }
  if (xrState.lockedLeftKneeNode && list.some((x) => x.c === xrState.lockedLeftKneeNode)) {
    leftKneeCtrl = xrState.lockedLeftKneeNode;
  }
  if (xrState.lockedRightKneeNode && list.some((x) => x.c === xrState.lockedRightKneeNode)) {
    rightKneeCtrl = xrState.lockedRightKneeNode;
  }

  xrState.leftController = leftHandCtrl;
  xrState.rightController = rightHandCtrl;

  return {
    leftKneeCtrl,
    rightKneeCtrl,
    leftHandCtrl,
    rightHandCtrl,
    usingTrackersForKnees,
    debug: {
      totalInputs: list.length,
      trackerCandidates: trackerCandidates.length,
      controllers: controllers.length,
      kneePool: kneePool.length,
      forceTrackers,
      profiles: list.map((x) => x.profile).slice(0, 4).join(', ')
    }
  };
}

function getHandJointLocal(handObj, key) {
  const joint = handObj?.joints?.[key];
  if (!joint) return null;
  if (!joint.visible) return null;
  const p = new THREE.Vector3();
  joint.getWorldPosition(p);
  return localFromWorldPos(p);
}

function getControllerLocalPos(c) {
  if (!c) return null;
  const p = new THREE.Vector3();
  c.getWorldPosition(p);
  return localFromWorldPos(p);
}

function getControllerLocalQuat(c) {
  if (!c) return null;
  const qW = new THREE.Quaternion();
  c.getWorldQuaternion(qW);
  const qLocal = new THREE.Quaternion();
  world.getWorldQuaternion(qLocal).invert();
  return qLocal.multiply(qW);
}

function getControllerEntriesLocal() {
  const out = [];
  for (const c of xrState.controllers) {
    const source = c?.userData?.inputSource;
    if (!source) continue;
    const p = getControllerLocalPos(c);
    if (!p) continue;
    out.push({ c, source, pos: p });
  }
  return out;
}

function chooseKneeControllersForCalibration() {
  const entries = getControllerEntriesLocal();
  if (entries.length === 0) return { left: null, right: null };

  const leftKnee = new THREE.Vector3().fromArray(avatarLocal.joints.LeftKnee);
  const rightKnee = new THREE.Vector3().fromArray(avatarLocal.joints.RightKnee);

  let best = null;
  for (let i = 0; i < entries.length; i++) {
    for (let j = 0; j < entries.length; j++) {
      if (i === j) continue;
      const l = entries[i];
      const r = entries[j];
      const score = l.pos.distanceToSquared(leftKnee) + r.pos.distanceToSquared(rightKnee);
      if (!best || score < best.score) best = { left: l, right: r, score };
    }
  }

  if (best) return { left: best.left.c, right: best.right.c };

  // Only one controller available: assign to nearest knee.
  const only = entries[0];
  const dl = only.pos.distanceToSquared(leftKnee);
  const dr = only.pos.distanceToSquared(rightKnee);
  return dl <= dr ? { left: only.c, right: null } : { left: null, right: only.c };
}

function getSpineDistance() {
  const d = avatarLocal.edgeLenByJoints('Core', 'Neck');
  return Number.isFinite(d) && d > 0.05 ? d : 0.28;
}

function translateLocalAvatar(delta) {
  if (delta.lengthSq() < 1e-12) return;
  for (const j of JOINTS) {
    const p = avatarLocal.joints[j];
    p[0] += delta.x;
    p[1] += delta.y;
    p[2] += delta.z;
  }
}

function getJointVec(name) {
  return new THREE.Vector3().fromArray(avatarLocal.joints[name]);
}

function captureAnkleDirectionReference() {
  const up = new THREE.Vector3(0, 1, 0);
  const lk = getJointVec('LeftKnee');
  const la = getJointVec('LeftAnkle');
  const rk = getJointVec('RightKnee');
  const ra = getJointVec('RightAnkle');
  const lDir = la.sub(lk);
  const rDir = ra.sub(rk);
  if (lDir.lengthSq() > 1e-8) calibr.leftAnkleDirRef.setFromUnitVectors(up, lDir.normalize());
  else calibr.leftAnkleDirRef.identity();
  if (rDir.lengthSq() > 1e-8) calibr.rightAnkleDirRef.setFromUnitVectors(up, rDir.normalize());
  else calibr.rightAnkleDirRef.identity();
}

function captureRigidFootReference() {
  const la = getJointVec('LeftAnkle');
  const ra = getJointVec('RightAnkle');
  calibr.leftToeLocal.copy(getJointVec('LeftToe').sub(la).applyQuaternion(calibr.leftAnkleDirRef.clone().invert()));
  calibr.leftHeelLocal.copy(getJointVec('LeftHeel').sub(la).applyQuaternion(calibr.leftAnkleDirRef.clone().invert()));
  calibr.rightToeLocal.copy(getJointVec('RightToe').sub(ra).applyQuaternion(calibr.rightAnkleDirRef.clone().invert()));
  calibr.rightHeelLocal.copy(getJointVec('RightHeel').sub(ra).applyQuaternion(calibr.rightAnkleDirRef.clone().invert()));
}

function signedAngleAroundAxis(fromDir, toDir, axis) {
  const cross = new THREE.Vector3().crossVectors(fromDir, toDir);
  return Math.atan2(axis.dot(cross), fromDir.dot(toDir));
}

function captureKneeHyperextensionReferences() {
  const maxBend = THREE.MathUtils.degToRad(180 - KNEE_MIN_INTERIOR_DEG);
  const up = new THREE.Vector3(0, 1, 0);
  const captureSide = (side) => {
    const hip = getJointVec(`${side}Hip`);
    const knee = getJointVec(`${side}Knee`);
    const ankle = getJointVec(`${side}Ankle`);
    const toe = getJointVec(`${side}Toe`);
    const heel = getJointVec(`${side}Heel`);

    const thigh = hip.sub(knee);
    if (thigh.lengthSq() < 1e-8) thigh.set(0, 1, 0);
    thigh.normalize();

    const shin = ankle.sub(getJointVec(`${side}Knee`));
    if (shin.lengthSq() < 1e-8) shin.copy(thigh).multiplyScalar(-1);
    shin.normalize();

    const toeDir = toe.sub(heel);
    if (toeDir.lengthSq() < 1e-8) toeDir.copy(shin);
    toeDir.normalize();

    const extDir = thigh.clone().multiplyScalar(-1);
    let axis = new THREE.Vector3().crossVectors(toeDir, thigh);
    if (axis.lengthSq() < 1e-8) axis = new THREE.Vector3().crossVectors(extDir, shin);
    if (axis.lengthSq() < 1e-8) axis.set(side === 'Left' ? -1 : 1, 0, 0);
    axis.normalize();

    const signed = signedAngleAroundAxis(extDir, shin, axis);
    if (signed < 0) axis.multiplyScalar(-1);
    const bend = Math.max(0, Math.min(maxBend, signedAngleAroundAxis(extDir, shin, axis)));
    const kneeRotRef = new THREE.Quaternion().setFromUnitVectors(up, shin);

    if (side === 'Left') {
      calibr.leftThighRef.copy(thigh);
      calibr.leftKneeAxisRef.copy(axis);
      kneeHingeState.Left.lastValidBend = bend;
      kneeHingeState.Left.frozen = false;
      kneeHingeState.Left.lastValidRot.copy(kneeRotRef);
      kneeHingeState.Left.hasValidRot = true;
    } else {
      calibr.rightThighRef.copy(thigh);
      calibr.rightKneeAxisRef.copy(axis);
      kneeHingeState.Right.lastValidBend = bend;
      kneeHingeState.Right.frozen = false;
      kneeHingeState.Right.lastValidRot.copy(kneeRotRef);
      kneeHingeState.Right.hasValidRot = true;
    }
  };

  captureSide('Left');
  captureSide('Right');
}

function clampFreeShinHyperextension(side, kneeRot) {
  const thighRef = side === 'Left' ? calibr.leftThighRef : calibr.rightThighRef;
  const axisRef = side === 'Left' ? calibr.leftKneeAxisRef : calibr.rightKneeAxisRef;
  if (thighRef.lengthSq() < 1e-8 || axisRef.lengthSq() < 1e-8) return kneeRot;

  const hip = getJointVec(`${side}Hip`);
  const knee = getJointVec(`${side}Knee`);
  const thigh = hip.sub(knee);
  if (thigh.lengthSq() < 1e-8) return kneeRot;
  thigh.normalize();

  const qAlign = new THREE.Quaternion().setFromUnitVectors(thighRef.clone().normalize(), thigh);
  const axisNow = axisRef.clone().normalize().applyQuaternion(qAlign).normalize();
  const extDir = thigh.clone().multiplyScalar(-1);
  const shinDir = new THREE.Vector3(0, 1, 0).applyQuaternion(kneeRot).normalize();

  // Signed hinge bend where 0 = straight; negative = hyperextension.
  const bend = signedAngleAroundAxis(extDir, shinDir, axisNow);
  const maxBend = THREE.MathUtils.degToRad(180 - KNEE_MIN_INTERIOR_DEG);
  const state = kneeHingeState[side];
  const valid = bend >= 0 && bend <= maxBend;
  if (valid) {
    state.lastValidBend = bend;
    state.lastValidRot.copy(kneeRot);
    state.hasValidRot = true;
    state.frozen = false;
    return kneeRot;
  }

  state.frozen = true;
  if (state.hasValidRot) return state.lastValidRot.clone();
  return kneeRot;
}

function calibrateNow() {
  if (!renderer.xr.isPresenting) {
    statusEl.textContent = 'Calibration requires active VR session';
    return;
  }
  const head = hmdLocalPos();
  const chosen = chooseKneeControllersForCalibration();
  const leftCtrl = chosen.left;
  const rightCtrl = chosen.right;
  const leftKneeCtrlPos = getControllerLocalPos(leftCtrl);
  const rightKneeCtrlPos = getControllerLocalPos(rightCtrl);
  const leftKneeNow = new THREE.Vector3().fromArray(avatarLocal.joints.LeftKnee);
  const rightKneeNow = new THREE.Vector3().fromArray(avatarLocal.joints.RightKnee);
  if (!leftKneeCtrlPos || !rightKneeCtrlPos) {
    calibr.valid = false;
    xrState.lockedLeftKneeSource = null;
    xrState.lockedRightKneeSource = null;
    xrState.lockedLeftKneeNode = null;
    xrState.lockedRightKneeNode = null;
    statusEl.textContent = 'Calibration failed: need both controllers visible.';
    return;
  }

  const coreNow = new THREE.Vector3().fromArray(avatarLocal.joints.Core);
  calibr.waistOffset.copy(coreNow.sub(head));
  calibr.leftKneeOffset.copy(leftKneeNow.clone().sub(leftKneeCtrlPos));
  calibr.rightKneeOffset.copy(rightKneeNow.clone().sub(rightKneeCtrlPos));
  calibr.leftKneeRotRef.copy(getControllerLocalQuat(leftCtrl) || new THREE.Quaternion());
  calibr.rightKneeRotRef.copy(getControllerLocalQuat(rightCtrl) || new THREE.Quaternion());
  xrState.lockedLeftKneeSource = leftCtrl?.userData?.inputSource || null;
  xrState.lockedRightKneeSource = rightCtrl?.userData?.inputSource || null;
  xrState.lockedLeftKneeNode = leftCtrl || null;
  xrState.lockedRightKneeNode = rightCtrl || null;
  calibr.valid = true;
  armCalibrationPoseHold(head, leftKneeCtrlPos, rightKneeCtrlPos);
  captureAnkleDirectionReference();
  captureRigidFootReference();
  captureKneeHyperextensionReferences();
  saveCalibration();
  statusEl.textContent = 'Calibrated: waist offset + knee controllers locked.';
}

function clearCalibrationOnly() {
  if (startPose) avatarLocal.restore(startPose);
  if (remoteStartPose) avatarRemote.restore(remoteStartPose);
  resetCalibratorBasePosFromOpponentHead();
  clearCalibrationPoseHold();
  resetKneeHingeState();
  const coreNow = new THREE.Vector3().fromArray(avatarLocal.joints.Core);
  calibr.waistOffset.copy(coreNow.sub(hmdLocalPos()));
  calibr.valid = false;
  calibr.leftKneeOffset.set(0, 0, 0);
  calibr.rightKneeOffset.set(0, 0, 0);
  calibr.leftKneeRotRef.identity();
  calibr.rightKneeRotRef.identity();
  calibr.leftAnkleDirRef.identity();
  calibr.rightAnkleDirRef.identity();
  calibr.leftToeLocal.set(0, 0, 0);
  calibr.leftHeelLocal.set(0, 0, 0);
  calibr.rightToeLocal.set(0, 0, 0);
  calibr.rightHeelLocal.set(0, 0, 0);
  calibr.leftThighRef.set(0, 0, 0);
  calibr.rightThighRef.set(0, 0, 0);
  calibr.leftKneeAxisRef.set(0, 0, 0);
  calibr.rightKneeAxisRef.set(0, 0, 0);
  legPlant.Left.locked = false;
  legPlant.Right.locked = false;
  coreGroundConstraint.active = false;
  xrState.lockedLeftKneeSource = null;
  xrState.lockedRightKneeSource = null;
  xrState.lockedLeftKneeNode = null;
  xrState.lockedRightKneeNode = null;
  saveCalibration();
  statusEl.textContent = 'Calibration cleared.';
}

function updateGazeCalibrator() {
  if (!renderer.xr.isPresenting || !gazeCalib.marker) {
    if (gazeCalib.marker) gazeCalib.marker.visible = false;
    gazeCalib.activeSince = 0;
    setGazeProgress(0);
    return;
  }

  const head = hmdLocalPos();
  const forward = hmdLocalForward();
  const targetPos = getGazeCalibratorTargetPos();
  gazeCalib.marker.visible = true;
  gazeCalib.marker.position.copy(targetPos);
  gazeCalib.marker.lookAt(head);
  gazeCalib.coreMesh.material.color.setHex(calibr.valid ? 0xff7a7a : 0x2ee6a8);

  const hmdToMarker = targetPos.clone().sub(head);
  const dot = hmdToMarker.normalize().dot(forward);
  const lookThreshold = Math.cos(THREE.MathUtils.degToRad(GAZE_CALIB_ANGLE_DEG));
  const looking = dot >= lookThreshold;
  const now = performance.now();

  if (!looking) {
    gazeCalib.activeSince = 0;
    setGazeProgress(0);
    return;
  }

  if (!gazeCalib.activeSince) gazeCalib.activeSince = now;
  const elapsed = now - gazeCalib.activeSince;
  setGazeProgress(elapsed / GAZE_CALIB_DWELL_MS);

  if (elapsed < GAZE_CALIB_DWELL_MS) return;
  if (now - gazeCalib.lastTriggerAt < GAZE_CALIB_COOLDOWN_MS) return;

  gazeCalib.lastTriggerAt = now;
  gazeCalib.activeSince = 0;
  setGazeProgress(0);
  if (calibr.valid) clearCalibrationOnly();
  else calibrateNow();
}

calibrateBtn.addEventListener('click', calibrateNow);

let pinnedTargets = new Map();
const lookUpCalib = {
  thresholdY: 0.8,
  holdMs: 350,
  cooldownMs: 2500,
  lookingSince: 0,
  lastTriggerAt: 0
};

function setPinned(name, v, smooth = 0.5) {
  const prev = pinnedTargets.get(name);
  if (!prev) pinnedTargets.set(name, { p: [v.x, v.y, v.z], t: [v.x, v.y, v.z], s: smooth });
  else {
    prev.t = [v.x, v.y, v.z];
    prev.s = smooth;
  }
}

function applyPinned() {
  for (const [jointName, st] of pinnedTargets) {
    st.p = vlerp(st.p, st.t, st.s);
    avatarLocal.joints[jointName] = st.p.slice();
  }
}

function applyTrackingToLocalAvatar() {
  holdLocalPoseThisFrame = false;
  pinnedTargets.clear();
  if (!renderer.xr.isPresenting) return;

  const dev = classifyControllersByBody(forceTrackers);
  if (!calibr.valid) {
    const leftPreCalibCtrl = getControllerLocalPos(dev.leftKneeCtrl);
    const rightPreCalibCtrl = getControllerLocalPos(dev.rightKneeCtrl);
    if (updateFloorFromControllerLow(leftPreCalibCtrl, rightPreCalibCtrl)) {
      // World moved; sample once more in the new local frame.
      updateFloorFromControllerLow(getControllerLocalPos(dev.leftKneeCtrl), getControllerLocalPos(dev.rightKneeCtrl));
    }
  }
  const head = hmdLocalPos();
  const forwardXZ = hmdLocalForward();
  forwardXZ.y = 0;
  if (forwardXZ.lengthSq() < 1e-6) forwardXZ.set(0, 0, 1);
  forwardXZ.normalize();
  const calibrationFacingXZ = getCalibrationFacingDirectionXZ(forwardXZ, head, dev.leftHandCtrl);
  let coreTarget = head.clone().add(calibr.waistOffset);
  const headFromCore = head.clone().sub(coreTarget);
  if (headFromCore.lengthSq() < 1e-8) headFromCore.set(0, 1, 0);
  let neckTarget = coreTarget.clone().addScaledVector(headFromCore.normalize(), getSpineDistance());
  let leftHipTarget = null;
  let leftKneeTarget = null;
  let rightHipTarget = null;
  let rightKneeTarget = null;

  if (!calibr.valid) {
    coreGroundConstraint.active = false;
    placeAvatarInFrontForCalibration(head, calibrationFacingXZ);
    if (DEBUG_VIS) {
      debugHud.textContent =
`mode=pre-calibration
lockedL=${sourceLabel(xrState.lockedLeftKneeSource)}
lockedR=${sourceLabel(xrState.lockedRightKneeSource)}
liveL=${sourceLabel(dev.leftKneeCtrl)}
liveR=${sourceLabel(dev.rightKneeCtrl)}
waist=(${coreTarget.x.toFixed(2)}, ${coreTarget.y.toFixed(2)}, ${coreTarget.z.toFixed(2)})
neck =(${neckTarget.x.toFixed(2)}, ${neckTarget.y.toFixed(2)}, ${neckTarget.z.toFixed(2)})`;
      updateArrow(debugArrows.waistToHmd, coreTarget, head);
      updateArrow(debugArrows.leftHipDir, null, null);
      updateArrow(debugArrows.leftKneeDir, null, null);
      updateArrow(debugArrows.rightHipDir, null, null);
      updateArrow(debugArrows.rightKneeDir, null, null);
    }
    statusEl.textContent = `Pre-calibration: match stance, then look up to calibrate (inputs=${dev.debug.totalInputs} trackers=${dev.debug.trackerCandidates} pool=${dev.debug.kneePool})`;
    return;
  }

  const activeLeftKneeCtrl = calibr.valid ? (xrState.lockedLeftKneeNode || dev.leftKneeCtrl) : dev.leftKneeCtrl;
  const activeRightKneeCtrl = calibr.valid ? (xrState.lockedRightKneeNode || dev.rightKneeCtrl) : dev.rightKneeCtrl;
  const leftKneeCtrlPos = getControllerLocalPos(activeLeftKneeCtrl);
  const rightKneeCtrlPos = getControllerLocalPos(activeRightKneeCtrl);
  if (shouldHoldCalibratedPose(head, leftKneeCtrlPos, rightKneeCtrlPos)) {
    pinCalibrationPoseSnapshot();
    holdLocalPoseThisFrame = true;
    statusEl.textContent = 'Calibrated: pose held until movement.';
    return;
  }
  const leftCtrlAdjusted = leftKneeCtrlPos ? leftKneeCtrlPos.clone().add(calibr.leftKneeOffset) : null;
  const rightCtrlAdjusted = rightKneeCtrlPos ? rightKneeCtrlPos.clone().add(calibr.rightKneeOffset) : null;
  const qL = getControllerLocalQuat(activeLeftKneeCtrl);
  const qR = getControllerLocalQuat(activeRightKneeCtrl);
  let leftGrounded = false;
  let rightGrounded = false;
  let supportSide = null;
  if (leftCtrlAdjusted && rightCtrlAdjusted) {
    supportSide = leftCtrlAdjusted.y <= rightCtrlAdjusted.y ? 'Left' : 'Right';
  } else if (leftCtrlAdjusted) {
    supportSide = 'Left';
  } else if (rightCtrlAdjusted) {
    supportSide = 'Right';
  }

  let bodyDrop = 0;
  if (supportSide) {
    const supportFootY = getLegMinFootY(supportSide);
    if (Number.isFinite(supportFootY) && supportFootY > LOCK_FOOT_CONTACT_Y) {
      bodyDrop = supportFootY - LOCK_FOOT_CONTACT_Y;
    }
  }
  if (bodyDrop > 0) {
    const delta = new THREE.Vector3(0, -bodyDrop, 0);
    translateLocalAvatar(delta);
    coreTarget.add(delta);
    neckTarget.add(delta);
  }

  if (supportSide === 'Left') {
    if (isFootDownForLock('Left')) {
      if (!legPlant.Left.locked) lockLegAtCurrentPose('Left');
      legPlant.Right.locked = false;
      leftGrounded = true;
    } else {
      legPlant.Left.locked = false;
      leftGrounded = false;
    }
  } else if (supportSide === 'Right') {
    if (isFootDownForLock('Right')) {
      if (!legPlant.Right.locked) lockLegAtCurrentPose('Right');
      legPlant.Left.locked = false;
      rightGrounded = true;
    } else {
      legPlant.Right.locked = false;
      rightGrounded = false;
    }
  } else {
    legPlant.Left.locked = false;
    legPlant.Right.locked = false;
  }
  setPinned('Core', coreTarget, 1);
  coreGroundConstraint.active = false;

  if (leftGrounded && legPlant.Left.locked) {
    const foot = solveLockedFootFromToe('Left', legPlant.Left.toe, qL);
    avatarLocal.rot.LeftKnee.copy(foot.footRot);
    const solved = solveGroundedLegFromCore('Left', coreTarget, foot.ankle, leftCtrlAdjusted);
    leftHipTarget = solved.hipTarget;
    leftKneeTarget = solved.kneeTarget;
    setPinned('LeftAnkle', foot.ankle, 1);
    setPinned('LeftToe', foot.toe, 1);
    setPinned('LeftHeel', foot.heel, 1);
    setPinned('LeftHip', leftHipTarget, HIP_KNEE_PIN_SMOOTH);
    setPinned('LeftKnee', leftKneeTarget, HIP_KNEE_PIN_SMOOTH);
  } else if (leftKneeCtrlPos) {
      const solved = solveFreeLegRigidStickFromCore('Left', coreTarget, leftCtrlAdjusted);
      leftHipTarget = solved.hipTarget;
      leftKneeTarget = solved.kneeTarget;
      setPinned('LeftHip', leftHipTarget, HIP_KNEE_PIN_SMOOTH);
      setPinned('LeftKnee', leftKneeTarget, HIP_KNEE_PIN_SMOOTH);
  }
  if (rightGrounded && legPlant.Right.locked) {
    const foot = solveLockedFootFromToe('Right', legPlant.Right.toe, qR);
    avatarLocal.rot.RightKnee.copy(foot.footRot);
    const solved = solveGroundedLegFromCore('Right', coreTarget, foot.ankle, rightCtrlAdjusted);
    rightHipTarget = solved.hipTarget;
    rightKneeTarget = solved.kneeTarget;
    setPinned('RightAnkle', foot.ankle, 1);
    setPinned('RightToe', foot.toe, 1);
    setPinned('RightHeel', foot.heel, 1);
    setPinned('RightHip', rightHipTarget, HIP_KNEE_PIN_SMOOTH);
    setPinned('RightKnee', rightKneeTarget, HIP_KNEE_PIN_SMOOTH);
  } else if (rightKneeCtrlPos) {
      const solved = solveFreeLegRigidStickFromCore('Right', coreTarget, rightCtrlAdjusted);
      rightHipTarget = solved.hipTarget;
      rightKneeTarget = solved.kneeTarget;
      setPinned('RightHip', rightHipTarget, HIP_KNEE_PIN_SMOOTH);
      setPinned('RightKnee', rightKneeTarget, HIP_KNEE_PIN_SMOOTH);
  }

  if (qL && !legPlant.Left.locked) {
    const delta = qL.clone().multiply(calibr.leftKneeRotRef.clone().invert()).normalize();
    const rawRot = delta.multiply(calibr.leftAnkleDirRef.clone());
    avatarLocal.rot.LeftKnee.copy(clampFreeShinHyperextension('Left', rawRot));
  }
  if (qR && !legPlant.Right.locked) {
    const delta = qR.clone().multiply(calibr.rightKneeRotRef.clone().invert()).normalize();
    const rawRot = delta.multiply(calibr.rightAnkleDirRef.clone());
    avatarLocal.rot.RightKnee.copy(clampFreeShinHyperextension('Right', rawRot));
  }
  if (DEBUG_VIS) {
    const lCtrl = leftKneeCtrlPos ? leftKneeCtrlPos.clone().add(calibr.leftKneeOffset) : null;
    const rCtrl = rightKneeCtrlPos ? rightKneeCtrlPos.clone().add(calibr.rightKneeOffset) : null;
    const lRot = qL ? `${Math.round(new THREE.Euler().setFromQuaternion(qL, 'YXZ').y * 57.3)}deg` : 'none';
    const rRot = qR ? `${Math.round(new THREE.Euler().setFromQuaternion(qR, 'YXZ').y * 57.3)}deg` : 'none';
      debugHud.textContent =
`mode=calibrated
lockedL=${sourceLabel(xrState.lockedLeftKneeSource)}
lockedR=${sourceLabel(xrState.lockedRightKneeSource)}
liveL=${sourceLabel(activeLeftKneeCtrl)}
liveR=${sourceLabel(activeRightKneeCtrl)}
qL=${lRot} qR=${rRot}
lockL=${legPlant.Left.locked ? '1' : '0'} lockR=${legPlant.Right.locked ? '1' : '0'}
waist=(${coreTarget.x.toFixed(2)}, ${coreTarget.y.toFixed(2)}, ${coreTarget.z.toFixed(2)})
neck =(${neckTarget.x.toFixed(2)}, ${neckTarget.y.toFixed(2)}, ${neckTarget.z.toFixed(2)})`;
    updateArrow(debugArrows.waistToHmd, coreTarget, head);
    updateArrow(debugArrows.leftHipDir, coreTarget, leftHipTarget);
    updateArrow(debugArrows.leftKneeDir, leftHipTarget, leftKneeTarget);
    updateArrow(debugArrows.rightHipDir, coreTarget, rightHipTarget);
    updateArrow(debugArrows.rightKneeDir, rightHipTarget, rightKneeTarget);
  }
  if (dev.usingTrackersForKnees) {
    statusEl.textContent = `Tracking: PCVR mode (trackers=knees) inputs=${dev.debug.totalInputs} trackers=${dev.debug.trackerCandidates} pool=${dev.debug.kneePool}`;
  } else {
    statusEl.textContent = `Tracking: fallback mode inputs=${dev.debug.totalInputs} controllers=${dev.debug.controllers} trackers=${dev.debug.trackerCandidates} force=${dev.debug.forceTrackers ? 'on' : 'off'} profiles=${dev.debug.profiles}`;
  }
}

function isLegGroundContact(side) {
  return getLegMinFootY(side) <= FLOOR_CONTACT_EPS;
}

function getLegMinFootY(side) {
  const ankle = avatarLocal.joints[`${side}Ankle`];
  const toe = avatarLocal.joints[`${side}Toe`];
  const heel = avatarLocal.joints[`${side}Heel`];
  if (!ankle || !toe || !heel) return Infinity;
  return Math.min(ankle[1], toe[1], heel[1]);
}

function updateLegPlantLock(side, controllerTargetPos = null) {
  const state = legPlant[side];
  const grounded = isLegGroundContact(side);
  if (state.locked) {
    if (controllerTargetPos && controllerTargetPos.y > LEG_RELEASE_Y) {
      state.locked = false;
      return false;
    }
    // Stay locked until explicit release condition is met.
    return true;
  }
  if (grounded && !state.locked) {
    state.ankle.fromArray(avatarLocal.joints[`${side}Ankle`]);
    state.toe.fromArray(avatarLocal.joints[`${side}Toe`]);
    state.heel.fromArray(avatarLocal.joints[`${side}Heel`]);
    state.locked = true;
  }
  return state.locked;
}

function lockLegAtCurrentPose(side) {
  const state = legPlant[side];
  state.ankle.fromArray(avatarLocal.joints[`${side}Ankle`]);
  state.toe.fromArray(avatarLocal.joints[`${side}Toe`]);
  state.heel.fromArray(avatarLocal.joints[`${side}Heel`]);
  state.locked = true;
}

function wrappedDeg(d) {
  let a = ((d % 360) + 360) % 360;
  if (a > 180) a -= 360;
  return a;
}

function shouldReleasePlantedLeg(side, controllerTargetPos = null, controllerQuat = null) {
  if (!legPlant[side]?.locked) return false;
  if (controllerTargetPos && controllerTargetPos.y > LEG_RELEASE_Y) return true;

  if (controllerTargetPos) {
    const ctrlToLockedAnkle = controllerTargetPos.distanceTo(legPlant[side].ankle);
    if (ctrlToLockedAnkle > PLANTED_RELEASE_CTRL_DIST) return true;
  }

  if (controllerQuat && calibr.valid) {
    const ref = side === 'Left' ? calibr.leftKneeRotRef : calibr.rightKneeRotRef;
    const delta = controllerQuat.clone().multiply(ref.clone().invert()).normalize();
    const e = new THREE.Euler().setFromQuaternion(delta, 'YXZ');
    const pitchDeg = Math.abs(wrappedDeg(THREE.MathUtils.radToDeg(e.x)));
    const rollDeg = Math.abs(wrappedDeg(THREE.MathUtils.radToDeg(e.z)));
    if (pitchDeg > PLANTED_RELEASE_ROT_DEG || rollDeg > PLANTED_RELEASE_ROT_DEG) return true;
  }

  return false;
}

function canSwitchSupportTo(side) {
  const y = getLegMinFootY(side);
  return Number.isFinite(y) && y <= SWITCH_TARGET_MAX_FOOT_Y;
}

function isFootDownForLock(side) {
  const y = getLegMinFootY(side);
  return Number.isFinite(y) && y <= LOCK_FOOT_CONTACT_Y;
}

function solveLockedFootFromToe(side, toeAnchor, controllerQuat = null) {
  let footRot = avatarLocal.rot[`${side}Knee`].clone();
  if (controllerQuat && calibr.valid) {
    if (side === 'Left') {
      const delta = controllerQuat.clone().multiply(calibr.leftKneeRotRef.clone().invert()).normalize();
      footRot = delta.multiply(calibr.leftAnkleDirRef.clone()).normalize();
    } else {
      const delta = controllerQuat.clone().multiply(calibr.rightKneeRotRef.clone().invert()).normalize();
      footRot = delta.multiply(calibr.rightAnkleDirRef.clone()).normalize();
    }
  }

  const toeLocal = side === 'Left' ? calibr.leftToeLocal : calibr.rightToeLocal;
  const heelLocal = side === 'Left' ? calibr.leftHeelLocal : calibr.rightHeelLocal;
  const toeFromAnkle = toeLocal.clone().applyQuaternion(footRot);
  const heelFromAnkle = heelLocal.clone().applyQuaternion(footRot);
  const ankle = toeAnchor.clone().sub(toeFromAnkle);
  const heel = ankle.clone().add(heelFromAnkle);

  return { ankle, toe: toeAnchor.clone(), heel, footRot };
}

function solveKneeFromHipAnkle(side, hipTarget, ankleTarget, controllerPos = null, opts = {}) {
  const outwardPole = opts.outwardPole || null;
  const outwardBias = clamp(opts.outwardBias ?? 0, 0, 1);
  const thigh = avatarLocal.edgeLenByJoints(`${side}Hip`, `${side}Knee`);
  const shin = avatarLocal.edgeLenByJoints(`${side}Knee`, `${side}Ankle`);
  const h = hipTarget.clone();
  const a = ankleTarget.clone();
  const v = a.clone().sub(h);
  const dRaw = v.length();
  const d = clamp(dRaw, 1e-4, thigh + shin - 1e-4);
  const dir = dRaw > 1e-6 ? v.multiplyScalar(1 / dRaw) : new THREE.Vector3(0, -1, 0);

  const mid = h.clone().addScaledVector(dir, (d * d + thigh * thigh - shin * shin) / (2 * d));
  const hOff = Math.sqrt(Math.max(0, thigh * thigh - h.distanceToSquared(mid)));

  const prevKnee = getJointVec(`${side}Knee`);
  let pole = (controllerPos ? controllerPos.clone() : prevKnee).sub(mid);
  pole.addScaledVector(dir, -pole.dot(dir));
  if (pole.lengthSq() < 1e-8) {
    pole.set(side === 'Left' ? -1 : 1, 0, 0);
  }
  if (outwardPole && outwardBias > 0) {
    let outward = outwardPole.clone();
    outward.addScaledVector(dir, -outward.dot(dir));
    if (outward.lengthSq() > 1e-8) {
      outward.normalize();
      pole.lerp(outward, outwardBias);
    }
  }
  pole.normalize();

  let knee = mid.clone().addScaledVector(pole, hOff);
  if (outwardPole) {
    let outward = outwardPole.clone();
    outward.addScaledVector(dir, -outward.dot(dir));
    if (outward.lengthSq() > 1e-8) {
      outward.normalize();
      const midToKnee = knee.clone().sub(mid);
      if (midToKnee.dot(outward) < 0) {
        knee = mid.clone().addScaledVector(outward, hOff);
      }
    }
  }
  if (side === 'Left') knee.x = Math.min(knee.x, h.x - 0.005);
  else knee.x = Math.max(knee.x, h.x + 0.005);
  return knee;
}

function solveGroundedLegFromCore(side, coreTarget, ankleTarget, controllerPos = null) {
  const coreToHipLen = avatarLocal.edgeLenByJoints('Core', `${side}Hip`);
  const thighLen = avatarLocal.edgeLenByJoints(`${side}Hip`, `${side}Knee`);
  const shinLen = avatarLocal.edgeLenByJoints(`${side}Knee`, `${side}Ankle`);
  const minHA = Math.abs(thighLen - shinLen) + 1e-4;
  const maxHA = thighLen + shinLen - 1e-4;

  let desiredDir = (controllerPos ? controllerPos.clone() : ankleTarget.clone()).sub(coreTarget);
  if (desiredDir.lengthSq() < 1e-8) desiredDir.copy(getJointVec(`${side}Hip`).sub(coreTarget));
  if (desiredDir.lengthSq() < 1e-8) desiredDir.set(side === 'Left' ? -1 : 1, -0.2, 0);
  desiredDir.normalize();

  const ca = ankleTarget.clone().sub(coreTarget);
  const caLen = ca.length();
  let hipTarget = coreTarget.clone().addScaledVector(desiredDir, coreToHipLen);

  if (caLen > 1e-6) {
    const caDir = ca.clone().multiplyScalar(1 / caLen);
    const feasibleMin = Math.max(Math.abs(coreToHipLen - caLen), minHA);
    const feasibleMax = Math.min(coreToHipLen + caLen, maxHA);
    if (feasibleMin <= feasibleMax) {
      const currentHA = hipTarget.distanceTo(ankleTarget);
      const targetHA = clamp(currentHA, feasibleMin, feasibleMax);
      const x = clamp(
        (coreToHipLen * coreToHipLen + caLen * caLen - targetHA * targetHA) / (2 * caLen),
        -coreToHipLen,
        coreToHipLen
      );
      const r = Math.sqrt(Math.max(0, coreToHipLen * coreToHipLen - x * x));
      let perp = desiredDir.clone().addScaledVector(caDir, -desiredDir.dot(caDir));
      if (perp.lengthSq() < 1e-8) perp = getJointVec(`${side}Hip`).sub(coreTarget).addScaledVector(caDir, -getJointVec(`${side}Hip`).sub(coreTarget).dot(caDir));
      if (perp.lengthSq() < 1e-8) perp.set(side === 'Left' ? -1 : 1, 0, 0).addScaledVector(caDir, -caDir.x * (side === 'Left' ? -1 : 1));
      perp.normalize();
      hipTarget = coreTarget.clone().addScaledVector(caDir, x).addScaledVector(perp, r);
    }
  }

  let outwardPole = hipTarget.clone().sub(coreTarget);
  if (outwardPole.lengthSq() < 1e-8) outwardPole.set(side === 'Left' ? -1 : 1, 0, 0);
  const kneeTarget = solveKneeFromHipAnkle(side, hipTarget, ankleTarget, controllerPos, {
    outwardPole,
    outwardBias: 0.75
  });
  return { hipTarget, kneeTarget };
}

function solveFreeLegRigidStickFromCore(side, coreTarget, controllerPos = null) {
  const coreToHipLen = avatarLocal.edgeLenByJoints('Core', `${side}Hip`);
  const hipToKneeLen = avatarLocal.edgeLenByJoints(`${side}Hip`, `${side}Knee`);

  let desiredDir = (controllerPos ? controllerPos.clone() : getJointVec(`${side}Knee`)).sub(coreTarget);
  if (desiredDir.lengthSq() < 1e-8) desiredDir.copy(getJointVec(`${side}Hip`).sub(coreTarget));
  if (desiredDir.lengthSq() < 1e-8) desiredDir.set(side === 'Left' ? -1 : 1, -0.2, 0);
  desiredDir.normalize();

  let currentDir = getJointVec(`${side}Knee`).sub(coreTarget);
  if (currentDir.lengthSq() < 1e-8) currentDir = desiredDir.clone();
  else currentDir.normalize();

  const solvedDir = currentDir.lerp(desiredDir, FREE_LEG_DIR_BLEND).normalize();
  const hipTarget = coreTarget.clone().addScaledVector(solvedDir, coreToHipLen);
  const kneeTarget = coreTarget.clone().addScaledVector(solvedDir, coreToHipLen + hipToKneeLen);
  return { hipTarget, kneeTarget };
}

function snapLocalAvatarFeetToGround() {
  const leftFoot = ['LeftToe', 'LeftHeel', 'LeftAnkle'];
  const rightFoot = ['RightToe', 'RightHeel', 'RightAnkle'];
  const leftChain = ['LeftHip', 'LeftKnee', 'LeftAnkle', 'LeftToe', 'LeftHeel'];
  const rightChain = ['RightHip', 'RightKnee', 'RightAnkle', 'RightToe', 'RightHeel'];

  let leftMinY = getLegMinFootY('Left');
  let rightMinY = getLegMinFootY('Right');

  // If both feet are above the floor, shift the whole avatar down to first contact.
  const anyGroundContact = (leftMinY <= FLOOR_CONTACT_EPS) || (rightMinY <= FLOOR_CONTACT_EPS);
  if (!anyGroundContact) {
    const minFootY = Math.min(leftMinY, rightMinY);
    if (Number.isFinite(minFootY) && minFootY > FLOOR_CONTACT_EPS) {
      for (const j of JOINTS) avatarLocal.joints[j][1] -= minFootY;
      leftMinY -= minFootY;
      rightMinY -= minFootY;
    }
  }

  // Correct below-floor penetration per leg when not planted.
  if (!legPlant.Left.locked && Number.isFinite(leftMinY) && leftMinY < 0) {
    for (const j of leftChain) avatarLocal.joints[j][1] -= leftMinY;
  }
  if (!legPlant.Right.locked && Number.isFinite(rightMinY) && rightMinY < 0) {
    for (const j of rightChain) avatarLocal.joints[j][1] -= rightMinY;
  }

  // Allow lock to engage immediately after contact.
  updateLegPlantLock('Left');
  updateLegPlantLock('Right');
}

function enforceRigidFeetFromAnkles() {
  if (!calibr.valid) return;
  if (!legPlant.Left.locked) {
    const leftAnkle = getJointVec('LeftAnkle');
    const leftToe = leftAnkle.clone().add(calibr.leftToeLocal.clone().applyQuaternion(avatarLocal.rot.LeftKnee));
    const leftHeel = leftAnkle.clone().add(calibr.leftHeelLocal.clone().applyQuaternion(avatarLocal.rot.LeftKnee));
    avatarLocal.joints.LeftToe = [leftToe.x, leftToe.y, leftToe.z];
    avatarLocal.joints.LeftHeel = [leftHeel.x, leftHeel.y, leftHeel.z];
  }
  if (!legPlant.Right.locked) {
    const rightAnkle = getJointVec('RightAnkle');
    const rightToe = rightAnkle.clone().add(calibr.rightToeLocal.clone().applyQuaternion(avatarLocal.rot.RightKnee));
    const rightHeel = rightAnkle.clone().add(calibr.rightHeelLocal.clone().applyQuaternion(avatarLocal.rot.RightKnee));
    avatarLocal.joints.RightToe = [rightToe.x, rightToe.y, rightToe.z];
    avatarLocal.joints.RightHeel = [rightHeel.x, rightHeel.y, rightHeel.z];
  }
}

function captureJointTargets(ch) {
  const out = {};
  for (const j of JOINTS) {
    const p = ch.joints[j];
    out[j] = [p[0], p[1], p[2]];
  }
  return out;
}

function blendFromPrevToTarget(ch, targets, t) {
  for (const j of JOINTS) {
    const p0 = ch.prevJoints[j];
    const pt = targets[j];
    const p = ch.joints[j];
    p[0] = p0[0] + (pt[0] - p0[0]) * t;
    p[1] = p0[1] + (pt[1] - p0[1]) * t;
    p[2] = p0[2] + (pt[2] - p0[2]) * t;
  }
}

function capJointSpeed(ch, dt, maxSpeed) {
  if (dt <= 1e-5) return;
  const maxStep = maxSpeed * dt;
  const maxStepSq = maxStep * maxStep;
  for (const j of JOINTS) {
    const prev = ch.prevJoints[j];
    const curr = ch.joints[j];
    const dx = curr[0] - prev[0];
    const dy = curr[1] - prev[1];
    const dz = curr[2] - prev[2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 <= maxStepSq) continue;
    const inv = maxStep / (Math.sqrt(d2) + 1e-9);
    curr[0] = prev[0] + dx * inv;
    curr[1] = prev[1] + dy * inv;
    curr[2] = prev[2] + dz * inv;
  }
}

function estimateMaxTravel(ch) {
  let maxD = 0;
  for (const j of JOINTS) {
    const prev = ch.prevJoints[j];
    const curr = ch.joints[j];
    const dx = curr[0] - prev[0];
    const dy = curr[1] - prev[1];
    const dz = curr[2] - prev[2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > maxD) maxD = d;
  }
  return maxD;
}

function maybeAutoCalibrateFromLookUp() {
  // Disabled in favor of explicit gaze calibrator marker.
}

function applyRotationChildTargets(ch, stiff) {
  const up = new THREE.Vector3(0, 1, 0);
  for (const j of Object.keys(ROT_CHILD)) {
    const child = ROT_CHILD[j];
    const q = ch.rot[j];
    if (!q) continue;
    if (pinnedTargets.has(child) && ch === avatarLocal) continue;
    const p = ch.joints[j];
    const len = ch.edgeLenByJoints(j, child);
    const dir = up.clone().applyQuaternion(q).normalize();
    const target = [p[0] + dir.x * len, p[1] + dir.y * len, p[2] + dir.z * len];
    ch.joints[child] = vlerp(ch.joints[child], target, stiff);
  }
}

function segSegClosest(p1, q1, p2, q2) {
  const d1 = vsub(q1, p1);
  const d2 = vsub(q2, p2);
  const r = vsub(p1, p2);
  const a = vdot(d1, d1);
  const e = vdot(d2, d2);
  const f = vdot(d2, r);
  let s = 0;
  let t = 0;
  if (a <= 1e-9 && e <= 1e-9) return { s: 0, t: 0, c1: p1, c2: p2, diff: vsub(p1, p2), dist: vdist(p1, p2) };
  if (a <= 1e-9) {
    s = 0;
    t = clamp(f / (e || 1), 0, 1);
  } else {
    const c = vdot(d1, r);
    if (e <= 1e-9) {
      t = 0;
      s = clamp(-c / a, 0, 1);
    } else {
      const b = vdot(d1, d2);
      const denom = a * e - b * b;
      s = Math.abs(denom) > 1e-9 ? clamp((b * f - c * e) / denom, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = clamp((b - c) / a, 0, 1);
      }
    }
  }
  const c1 = vadd(p1, vscale(d1, s));
  const c2 = vadd(p2, vscale(d2, t));
  const diff = vsub(c1, c2);
  return { s, t, c1, c2, diff, dist: vlen(diff) };
}

const SOLVE_ITERS = 20;
const DIST_STIFF = 0.72;
const COLL_STIFF = 0.9;
const MIN_SEP = 0.085;
const EXACT_BONE_PASSES = 6;
const NECK_SPRING = 0.16;
const NECK_MAX_XZ = 0.1;
const MAX_LOCAL_JOINT_SPEED = 2.1;
const MAX_REMOTE_JOINT_SPEED = 2.1;
const MAX_SUBSTEP_TRAVEL = 0.03;
const MAX_SOLVER_SUBSTEPS = 5;
const IMPACT_COOLDOWN_MS = 70;
let lastImpactAt = 0;
const IMPACT_REARM_SEP = MIN_SEP + 0.02;
const IMPACT_MIN_CLOSING_SPEED = 0.9;
const activeImpactContacts = new Set();
const LEG_RELEASE_Y = 0.07;
const FLOOR_CONTACT_EPS = 0.001;
const LOCK_FOOT_CONTACT_Y = 0.015;
const HIP_KNEE_PIN_SMOOTH = 0.32;
const FREE_LEG_DIR_BLEND = 0.55;
const KNEE_MIN_INTERIOR_DEG = 10;
const PLANTED_RELEASE_ROT_DEG = 22;
const PLANTED_RELEASE_CTRL_DIST = 0.22;
const SWITCH_TARGET_MAX_FOOT_Y = 0.08;
const legPlant = {
  Left: { locked: false, ankle: new THREE.Vector3(), toe: new THREE.Vector3(), heel: new THREE.Vector3() },
  Right: { locked: false, ankle: new THREE.Vector3(), toe: new THREE.Vector3(), heel: new THREE.Vector3() }
};
const coreGroundConstraint = {
  active: false,
  pos: new THREE.Vector3()
};

function invMass(ch, jointName, forCollision = false) {
  if (ch === avatarLocal && pinnedTargets.has(jointName)) {
    return 0;
  }
  return 1;
}

function solveDistance(ch, stiffness = DIST_STIFF) {
  for (let i = 0; i < EDGES.length; i++) {
    const [a, b] = EDGES[i];
    const pa = ch.joints[a];
    const pb = ch.joints[b];
    const wA = invMass(ch, a);
    const wB = invMass(ch, b);
    const wSum = wA + wB;
    if (wSum <= 0) continue;
    const dx = pb[0] - pa[0];
    const dy = pb[1] - pa[1];
    const dz = pb[2] - pa[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-9;
    const diff = (dist - ch.edgeLens[i]) / dist;
    const cx = dx * diff * stiffness;
    const cy = dy * diff * stiffness;
    const cz = dz * diff * stiffness;
    if (wA > 0) {
      const k = wA / wSum;
      pa[0] += cx * k;
      pa[1] += cy * k;
      pa[2] += cz * k;
    }
    if (wB > 0) {
      const k = wB / wSum;
      pb[0] -= cx * k;
      pb[1] -= cy * k;
      pb[2] -= cz * k;
    }
  }
}

function stabilizeLocalNeckSpring() {
  const core = avatarLocal.joints.Core;
  const neck = avatarLocal.joints.Neck;
  if (!core || !neck) return;
  const spineLen = avatarLocal.edgeLenByJoints('Core', 'Neck');
  const target = [core[0], core[1] + spineLen, core[2]];
  neck[0] += (target[0] - neck[0]) * NECK_SPRING;
  neck[1] += (target[1] - neck[1]) * NECK_SPRING;
  neck[2] += (target[2] - neck[2]) * NECK_SPRING;

  const dx = neck[0] - core[0];
  const dz = neck[2] - core[2];
  const planar = Math.sqrt(dx * dx + dz * dz);
  if (planar > NECK_MAX_XZ) {
    const k = NECK_MAX_XZ / (planar + 1e-9);
    neck[0] = core[0] + dx * k;
    neck[2] = core[2] + dz * k;
  }
}

const impactGroup = new THREE.Group();
world.add(impactGroup);
const impacts = [];

let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}
window.addEventListener('pointerdown', ensureAudio, { once: true });

function playImpactSound(intensity) {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(130 + intensity * 180, t0);
  osc.frequency.exponentialRampToValueAtTime(70 + intensity * 50, t0 + 0.08);
  gain.gain.setValueAtTime(0.001, t0);
  gain.gain.exponentialRampToValueAtTime(0.15 + intensity * 0.1, t0 + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.1);
}

function spawnImpact(point, intensity) {
  const g = new THREE.SphereGeometry(0.04 + intensity * 0.03, 10, 8);
  const m = new THREE.MeshBasicMaterial({ color: 0xffcc7a, transparent: true, opacity: 0.95 });
  const mesh = new THREE.Mesh(g, m);
  mesh.position.copy(point);
  impactGroup.add(mesh);
  impacts.push({ mesh, t: 0, ttl: 0.22 + intensity * 0.15, base: 0.04 + intensity * 0.05 });
  playImpactSound(intensity);
}

function sampleSegmentVelocity(ch, a, b, t, dt) {
  const invDt = 1 / Math.max(dt, 1e-4);
  const pa = ch.joints[a];
  const pb = ch.joints[b];
  const ppa = ch.prevJoints[a];
  const ppb = ch.prevJoints[b];
  const va = [(pa[0] - ppa[0]) * invDt, (pa[1] - ppa[1]) * invDt, (pa[2] - ppa[2]) * invDt];
  const vb = [(pb[0] - ppb[0]) * invDt, (pb[1] - ppb[1]) * invDt, (pb[2] - ppb[2]) * invDt];
  return vlerp(va, vb, clamp(t, 0, 1));
}

function solveCollisions(dt) {
  const segments = [];
  for (const ch of [avatarLocal, avatarRemote]) {
    for (const [a, b] of EDGES) {
      if (isArmEdge(a, b)) continue;
      segments.push({ ch, a, b });
    }
  }

  for (let i = 0; i < segments.length; i++) {
    const s1 = segments[i];
    for (let j = i + 1; j < segments.length; j++) {
      const s2 = segments[j];
      if (s1.ch === s2.ch && (s1.a === s2.a || s1.a === s2.b || s1.b === s2.a || s1.b === s2.b)) continue;
      const p1 = s1.ch.joints[s1.a];
      const q1 = s1.ch.joints[s1.b];
      const p2 = s2.ch.joints[s2.a];
      const q2 = s2.ch.joints[s2.b];
      const c = segSegClosest(p1, q1, p2, q2);
      const pairKey = `${i}|${j}`;
      if (!isFinite(c.dist)) {
        activeImpactContacts.delete(pairKey);
        continue;
      }
      if (c.dist >= IMPACT_REARM_SEP) activeImpactContacts.delete(pairKey);
      if (c.dist >= MIN_SEP) continue;
      const now = performance.now();
      let nx = c.diff[0], ny = c.diff[1], nz = c.diff[2];
      let nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (nLen < 1e-8) {
        nx = 0; ny = 1; nz = 0; nLen = 1;
      }
      nx /= nLen; ny /= nLen; nz /= nLen;

      const v1 = sampleSegmentVelocity(s1.ch, s1.a, s1.b, c.s, dt);
      const v2 = sampleSegmentVelocity(s2.ch, s2.a, s2.b, c.t, dt);
      const relV = vsub(v1, v2);
      const closingSpeed = Math.max(0, -(relV[0] * nx + relV[1] * ny + relV[2] * nz));
      const intensity = clamp((closingSpeed - IMPACT_MIN_CLOSING_SPEED) / 3.0, 0, 1);
      const isNewContact = !activeImpactContacts.has(pairKey);
      if (isNewContact && intensity > 0.12 && now - lastImpactAt > IMPACT_COOLDOWN_MS) {
        const point = new THREE.Vector3((c.c1[0] + c.c2[0]) * 0.5, (c.c1[1] + c.c2[1]) * 0.5, (c.c1[2] + c.c2[2]) * 0.5);
        spawnImpact(point, intensity);
        lastImpactAt = now;
      }
      activeImpactContacts.add(pairKey);

      const push = (MIN_SEP - c.dist) * COLL_STIFF;
      const cx = nx * push;
      const cy = ny * push;
      const cz = nz * push;

      const w1a = invMass(s1.ch, s1.a, true) * (1 - c.s);
      const w1b = invMass(s1.ch, s1.b, true) * c.s;
      const w2a = invMass(s2.ch, s2.a, true) * (1 - c.t);
      const w2b = invMass(s2.ch, s2.b, true) * c.t;
      const wSum = w1a + w1b + w2a + w2b;
      if (wSum < 1e-8) continue;

      if (w1a > 0) {
        const k = w1a / wSum;
        p1[0] += cx * k; p1[1] += cy * k; p1[2] += cz * k;
      }
      if (w1b > 0) {
        const k = w1b / wSum;
        q1[0] += cx * k; q1[1] += cy * k; q1[2] += cz * k;
      }
      if (w2a > 0) {
        const k = w2a / wSum;
        p2[0] -= cx * k; p2[1] -= cy * k; p2[2] -= cz * k;
      }
      if (w2b > 0) {
        const k = w2b / wSum;
        q2[0] -= cx * k; q2[1] -= cy * k; q2[2] -= cz * k;
      }
    }
  }
}

function tickImpacts(dt) {
  for (let i = impacts.length - 1; i >= 0; i--) {
    const fx = impacts[i];
    fx.t += dt;
    const u = fx.t / fx.ttl;
    if (u >= 1) {
      impactGroup.remove(fx.mesh);
      fx.mesh.geometry.dispose();
      fx.mesh.material.dispose();
      impacts.splice(i, 1);
      continue;
    }
    const s = fx.base * (1 + u * 2.7);
    fx.mesh.scale.setScalar(s / fx.base);
    fx.mesh.material.opacity = 1 - u;
  }
}

const params = new URLSearchParams(location.search);
const room = params.get('room') || 'default';
const forceTrackers = params.get('trackers') === '1';
const myId = Math.random().toString(36).slice(2, 9);
const bc = new BroadcastChannel(`pvpkickboxer-room-${room}`);
let remoteState = null;
let remoteLastSeen = 0;

bc.onmessage = (e) => {
  const m = e.data;
  if (!m || m.id === myId || m.type !== 'pose') return;
  remoteState = m.payload;
  remoteLastSeen = performance.now();
};

function sendPoseNet() {
  if (!renderer.xr.isPresenting) return;
  const payload = {
    joints: {
      Head: avatarLocal.joints.Head,
      Neck: avatarLocal.joints.Neck,
      Core: avatarLocal.joints.Core,
      LeftKnee: avatarLocal.joints.LeftKnee,
      RightKnee: avatarLocal.joints.RightKnee
    },
    rot: {
      LeftKnee: avatarLocal.rot.LeftKnee.toArray(),
      RightKnee: avatarLocal.rot.RightKnee.toArray()
    }
  };
  bc.postMessage({ type: 'pose', id: myId, payload });
}

let netAccum = 0;

function driveRemoteAvatarFromState() {
  const online = remoteState && (performance.now() - remoteLastSeen < 1200);
  if (!online) {
    networkEl.textContent = `Network: no remote player, showing static opponent (room: ${room})`;
    if (remoteStartPose) avatarRemote.restore(remoteStartPose);
    return;
  }
  networkEl.textContent = `Network: remote connected (room: ${room})`;
  for (const key of Object.keys(remoteState.joints)) {
    const t = remoteState.joints[key];
    avatarRemote.joints[key] = vlerp(avatarRemote.joints[key], t, 0.5);
  }
  avatarRemote.rot.LeftKnee.fromArray(remoteState.rot.LeftKnee || [0, 0, 0, 1]);
  avatarRemote.rot.RightKnee.fromArray(remoteState.rot.RightKnee || [0, 0, 0, 1]);
}

function poseCentering() {
  const head = avatarLocal.joints.Head;
  const tgt = new THREE.Vector3(head[0], head[1] - 0.6, head[2]);
  controls.target.lerp(tgt, 0.15);
}

resetBtn.addEventListener('click', () => {
  if (startPose) avatarLocal.restore(startPose);
  if (remoteStartPose) avatarRemote.restore(remoteStartPose);
  resetCalibratorBasePosFromOpponentHead();
  clearCalibrationPoseHold();
  resetKneeHingeState();
  const coreNow = new THREE.Vector3().fromArray(avatarLocal.joints.Core);
  calibr.waistOffset.copy(coreNow.sub(hmdLocalPos()));
  calibr.valid = false;
  calibr.leftKneeOffset.set(0, 0, 0);
  calibr.rightKneeOffset.set(0, 0, 0);
  calibr.leftKneeRotRef.identity();
  calibr.rightKneeRotRef.identity();
  calibr.leftAnkleDirRef.identity();
  calibr.rightAnkleDirRef.identity();
  calibr.leftToeLocal.set(0, 0, 0);
  calibr.leftHeelLocal.set(0, 0, 0);
  calibr.rightToeLocal.set(0, 0, 0);
  calibr.rightHeelLocal.set(0, 0, 0);
  calibr.leftThighRef.set(0, 0, 0);
  calibr.rightThighRef.set(0, 0, 0);
  calibr.leftKneeAxisRef.set(0, 0, 0);
  calibr.rightKneeAxisRef.set(0, 0, 0);
  xrState.lockedLeftKneeSource = null;
  xrState.lockedRightKneeSource = null;
  xrState.lockedLeftKneeNode = null;
  xrState.lockedRightKneeNode = null;
  localStorage.removeItem(CALIB_STORAGE_KEY);
  statusEl.textContent = 'Pose reset. Calibration cleared.';
});

renderer.xr.addEventListener('sessionstart', () => {
  xrState.deviceBySource.clear();
  xrState.handBySource.clear();
  xrState.lockedLeftKneeSource = null;
  xrState.lockedRightKneeSource = null;
  xrState.lockedLeftKneeNode = null;
  xrState.lockedRightKneeNode = null;
  legPlant.Left.locked = false;
  legPlant.Right.locked = false;
  coreGroundConstraint.active = false;
  clearCalibrationPoseHold();
  resetKneeHingeState();
  controllerFloorCalib.minY = Infinity;
  pendingFloorAlign = true;
  refreshXRControllerList();
  refreshXRHands();
  const session = renderer.xr.getSession();
  const enabled = session?.enabledFeatures ? Array.from(session.enabledFeatures).join(',') : 'unknown';
  const sourceKinds = (session?.inputSources || []).map((s) => {
    const p = (s.profiles || []).join('|') || 'unknown';
    const mode = s.hand ? 'hand' : 'controller';
    const h = s.handedness || 'none';
    return `${mode}:${h}:${p}`;
  });
  const blend = session?.environmentBlendMode || 'opaque';
  const base = calibr.valid ? 'VR running; using saved calibration' : 'VR running; press Calibrate once in neutral stance';
  statusEl.textContent = `${base} blend=${blend} features=[${enabled}] sources=${sourceKinds.length}`;
});

renderer.xr.addEventListener('sessionend', () => {
  xrState.deviceBySource.clear();
  xrState.handBySource.clear();
  xrState.lockedLeftKneeSource = null;
  xrState.lockedRightKneeSource = null;
  xrState.lockedLeftKneeNode = null;
  xrState.lockedRightKneeNode = null;
  legPlant.Left.locked = false;
  legPlant.Right.locked = false;
  coreGroundConstraint.active = false;
  clearCalibrationPoseHold();
  resetKneeHingeState();
  controllerFloorCalib.minY = Infinity;
  pendingFloorAlign = false;
  world.position.y = 0;
  refreshXRControllerList();
  refreshXRHands();
  statusEl.textContent = 'Exited VR';
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let poses = [];
function findNeutralStandingPoseIndex(list) {
  if (!Array.isArray(list) || list.length === 0) return 0;

  const scorePose = (p) => {
    const desc = (p?.description || []).join(' ').toLowerCase();
    const tags = (p?.tags || []).join(' ').toLowerCase();
    const hay = `${desc} ${tags}`;
    let score = 0;
    if (hay.includes('standing')) score += 3;
    if (hay.includes('neutral')) score += 5;
    if (hay.includes('symmetric')) score += 2;
    if (hay.includes('staggered')) score += 1;
    if (hay.includes('south-paw')) score += 1;
    return score;
  };

  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < list.length; i++) {
    const s = scorePose(list[i]);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }
  return bestIdx;
}

async function loadData() {
  statusEl.textContent = 'Loading positions.json...';
  const r = await fetch('./positions.json');
  poses = await r.json();
  const startIdx = findNeutralStandingPoseIndex(poses);
  const p = poses[startIdx];
  avatarLocal.setPose(p.position[0]);
  avatarRemote.setPose(p.position[1]);
  scaleCharacter(avatarLocal, AVATAR_SCALE);
  scaleCharacter(avatarRemote, AVATAR_SCALE);
  resetCalibratorBasePosFromOpponentHead();
  const coreNow = new THREE.Vector3().fromArray(avatarLocal.joints.Core);
  calibr.waistOffset.copy(coreNow.sub(hmdLocalPos()));
  startPose = avatarLocal.snapshot();
  remoteStartPose = avatarRemote.snapshot();
  const baseStatus = calibr.valid ? 'Ready. Enter VR.' : 'Ready. Enter VR then Calibrate.';
  statusEl.textContent = `${baseStatus} Start pose id=${p.id} (${(p.description || [])[0] || 'standing'})`;
}

function step(dt) {
  if (pendingFloorAlign && renderer.xr.isPresenting) {
    alignWorldFloorForSession(renderer.xr.getSession());
    pendingFloorAlign = false;
  }
  avatarLocal.copyCurrentToPrev();
  avatarRemote.copyCurrentToPrev();
  updateGazeCalibrator();
  applyTrackingToLocalAvatar();
  applyPinned();
  driveRemoteAvatarFromState();

  // Pre-calibration should be rigid preview only; skip all local solver passes.
  if (!calibr.valid) {
    avatarLocal.applyMeshes();
    avatarRemote.applyMeshes();
    tickImpacts(dt);
    poseCentering();
    if (!renderer.xr.isPresenting) controls.update();
    return;
  }

  if (holdLocalPoseThisFrame) {
    avatarLocal.applyMeshes();
    avatarRemote.applyMeshes();
    tickImpacts(dt);
    poseCentering();
    if (!renderer.xr.isPresenting) controls.update();
    return;
  }

  capJointSpeed(avatarLocal, dt, MAX_LOCAL_JOINT_SPEED);
  capJointSpeed(avatarRemote, dt, MAX_REMOTE_JOINT_SPEED);

  const localTargets = captureJointTargets(avatarLocal);
  const remoteTargets = captureJointTargets(avatarRemote);
  const maxTravel = Math.max(estimateMaxTravel(avatarLocal), estimateMaxTravel(avatarRemote));
  const substeps = Math.max(1, Math.min(MAX_SOLVER_SUBSTEPS, Math.ceil(maxTravel / MAX_SUBSTEP_TRAVEL)));
  const itersPerSubstep = Math.max(1, Math.ceil(SOLVE_ITERS / substeps));

  for (let s = 1; s <= substeps; s++) {
    const t = s / substeps;
    blendFromPrevToTarget(avatarLocal, localTargets, t);
    blendFromPrevToTarget(avatarRemote, remoteTargets, t);
    for (let i = 0; i < itersPerSubstep; i++) {
      applyRotationChildTargets(avatarLocal, 0.24);
      applyRotationChildTargets(avatarRemote, 0.2);
      solveDistance(avatarLocal);
      solveDistance(avatarRemote);
      solveCollisions(dt / substeps);
    }
  }
  for (let i = 0; i < EXACT_BONE_PASSES; i++) {
    solveDistance(avatarLocal, 1);
    solveDistance(avatarRemote, 1);
  }
  stabilizeLocalNeckSpring();
  // snapLocalAvatarFeetToGround();
  for (let i = 0; i < 2; i++) {
    solveDistance(avatarLocal, 1);
    solveDistance(avatarRemote, 1);
  }
  enforceRigidFeetFromAnkles();
  avatarLocal.applyMeshes();
  avatarRemote.applyMeshes();
  tickImpacts(dt);
  poseCentering();

  if (!renderer.xr.isPresenting) controls.update();
}

let lastT = performance.now();
function animate() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  netAccum += dt;
  if (netAccum > 0.05) {
    sendPoseNet();
    netAccum = 0;
  }

  step(dt || 0.016);
  renderer.render(scene, camera);
}

loadData().catch((e) => {
  statusEl.textContent = `Load error: ${e.message}`;
  console.error(e);
});

renderer.setAnimationLoop(animate);
