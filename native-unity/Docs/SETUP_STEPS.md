# Unity Setup Steps (Meta Building Blocks)

## 1. Project Setup
1. Create/open Unity 2022.3 LTS project.
2. Install Meta XR All-in-One SDK.
3. Switch to Android target.
4. Enable OpenXR and Meta Quest support in XR Plug-in Management.

## 2. Add Building Blocks
1. Add `Camera Rig` building block.
2. Add `Controller Tracking` building block.
3. Add `Hand Tracking` building block.
4. Keep both enabled in scene.

## 3. Add Game Root
1. Create empty `KickboxerGameRoot`.
2. Attach:
   - `KickboxerBootstrap`
   - `InputFusionProvider`
   - `KneeCalibrationService`
   - `AvatarPoseDriver`
   - `ContactConstraintSolver`
   - `ImpactFeedbackSystem`
   - `SoloOpponentController`

## 4. Wire Tracking References
In `InputFusionProvider`:
1. `Center Eye Anchor` -> camera rig center eye transform.
2. `Left Controller Anchor` / `Right Controller Anchor` -> controller anchors.
3. `Left Hand Wrist Proxy` / `Right Hand Wrist Proxy` -> wrist transforms from hand building block.

## 5. Wire Avatars
1. Assign local avatar bones in `AvatarRigMap`.
2. Assign opponent avatar bones in second `AvatarRigMap`.
3. Add capsule colliders to limbs and register them in `ContactConstraintSolver`.

## 6. Calibration
1. Run app.
2. Look up at ceiling (80% threshold) to auto-calibrate, or call `CalibrateNow`.
3. Verify knees follow controller-to-hip relative model.
4. Verify foot heading changes with controller rotation.

## 7. Solo/Multiplayer
1. Leave `SoloOpponentController` active for no-peer mode.
2. For multiplayer later, implement `INetworkPoseTransport` and inject into driver flow.

## 8. Build
1. Set package name/signing for Android.
2. Build and Run to Quest.
