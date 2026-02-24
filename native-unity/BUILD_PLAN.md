# Native Unity Plan (Meta Building Blocks Only)

## Goal
Create a Quest-native PVP kickboxing prototype using Meta XR Building Blocks for device/input setup and custom gameplay scripts for calibration, avatar driving, collision constraints, and impact feel.

## Required Unity Stack
- Unity 2022.3 LTS or 2023.2+.
- Meta XR All-in-One SDK (via Package Manager).
- OpenXR + Meta Quest feature group enabled.
- Android build target (Quest).

## Building Blocks To Add In Scene
1. `Camera Rig` (OVRCameraRig-based).
2. `Controller Tracking` block.
3. `Hand Tracking` block.
4. `Interaction` blocks as needed for debug UI button presses.

These blocks own tracking setup. Custom scripts below only read their outputs.

## Simultaneous Hands + Controllers
1. In OpenXR Meta settings, enable simultaneous hands/controllers support if available in installed SDK/runtime.
2. Keep both `Controller Tracking` and `Hand Tracking` blocks active.
3. `InputFusionProvider` reads both every frame and exposes confidence/fallback states to gameplay.

## Scene Objects
1. `KickboxerGameRoot`:
   - `KickboxerBootstrap`
   - `InputFusionProvider`
   - `KneeCalibrationService`
   - `AvatarPoseDriver`
   - `ContactConstraintSolver`
   - `ImpactFeedbackSystem`
2. `LocalAvatarRig` + `OpponentAvatarRig`:
   - children/bone references mapped in `AvatarRigMap`.
3. `OpponentStaticPoseHolder`:
   - holds guard/idle pose when no remote player.

## Runtime Flow
1. Read head/hands/controllers from building-block-provided tracking.
2. Estimate pelvis.
3. Derive knee targets from controller-to-hip relative offsets (calibrated).
4. Derive foot heading from calibrated controller rotation deltas.
5. Solve avatar pose.
6. Run non-penetration/contact projection pass.
7. Spawn impact VFX/SFX and apply budge impulse.
8. If no network peer, keep opponent in static pose.

## Calibration UX
1. Neutral stance capture.
2. Optional knee-by-knee capture.
3. Look-up trigger shortcut (80% ceiling gaze threshold).
4. Save profile to `PlayerPrefs`.

## Multiplayer (V1 Native)
- Keep networking adapter interface-based:
  - `INetworkPoseTransport`.
- Ship with `OfflinePoseTransport` default.
- Add Photon Fusion/NGO adapter later without touching tracking/calibration core.

## Execution Order
1. Build scene with building blocks.
2. Attach scripts from `Assets/Scripts`.
3. Map avatar bones in inspector.
4. Build to Quest and test:
   - hands+controllers simultaneous behavior,
   - knee calibration,
   - collision/impact response.
