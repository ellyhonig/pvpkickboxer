# Action Log (Rolling)

Purpose: Chronological list of work performed. Kept compact via periodic rollups.

## 2026-02-23
- Created WebXR prototype files and imported source data (`positions.json`, Ho_Komura PDF).
- Implemented VR tracking, calibration, impact feedback, and practical non-penetration solver.
- Added local room sync path (`BroadcastChannel`) and static solo opponent fallback.
- Changed startup pose selection to neutral standing from the positions database.
- Added PCVR tracker heuristics for knee mapping and `?trackers=1` override.
- Added look-up (80% ceiling) auto-calibration trigger.
- Hosted and deployed Firebase project `pvpkickboxer-v1-ellyh`.
- Investigated hand+controller simultaneity limits in Quest WebXR and patched explicit hand-tracking session requests plus broader hand source registration.
- Started native path: scaffolded `native-unity` implementation kit using Meta Building Blocks integration points.
- Added Unity-native scripts for input fusion, knee calibration, avatar driving, contact constraints, impact feedback, solo opponent fallback, bootstrap validation, and network transport interface.
- Installed and built `mcp-unity` server locally under `tools/mcp-unity/Server~`.
- Added Codex MCP server configuration for `mcp-unity` in `C:\Users\ellyh\.codex\config.toml`.
- Added `tools/start_mcp_unity.ps1` and `tools/MCP_UNITY_SETUP.md` for one-command startup + Unity-side install steps.
- Patched new Unity project `Z:\pvpkickboxer\PvPKickboxerNative` manifest with OpenXR, XR Management, Meta XR SDK, and MCP Unity package dependencies.
- Updated Unity project settings for XR-friendly defaults (`AndroidMinSdkVersion=29`, `activeInputHandler=Both`).
- Copied native gameplay scripts into `Assets/Scripts/PvPKickboxerNative` and added in-project `NEXT_STEPS.md`.
- Verified MCP Unity connectivity from agent side (`get_scene_info` returned active scene data).
- Added Unity editor script `Assets/Editor/PvPKickboxerNative/NativeSceneBootstrapper.cs` to auto-build a native prototype scene and wire all core PvPKickboxer systems.
- Recompiled Unity scripts successfully via MCP (`0 warnings`).
- Attempted MCP menu execution for scene bootstrap; call timed out then MCP transport closed before confirming scene creation, pending reconnect and retry.
- Reviewed Unity console diagnostics confirming domain-reload restart behavior and explicit menu lookup failure (`Tools/PvPKickboxer/Build Native Prototype Scene` not registered).
- Added duplicate bootstrapper at `Z:\pvpkickboxer\PvPKickboxerNative\Assets\Editor\NativeSceneBootstrapper.cs` to eliminate potential folder/assembly pickup ambiguity on next Unity refresh/recompile.
- User confirmed custom tool menu now exists without manual refresh.
- Retried MCP operations; Codex-side calls still fail with `Transport closed` even after running `tools/start_mcp_unity.ps1`, so scene bootstrap execution remains blocked on MCP channel recovery.
- New Codex session restored MCP connectivity (`get_scene_info` healthy again).
- Executed `Tools/PvPKickboxer/Build Native Prototype Scene` via MCP successfully.
- Verified generated scene `Assets/Scenes/PvPKickboxerNativePrototype.unity` and core objects/components (`KickboxerGameRoot`, tracking anchors, local/opponent rigs, colliders, impact prefab wiring).
- Ran XR menu conversion command (`GameObject/XR/Convert Main Camera To XR Rig`) and confirmed `XRRig` hierarchy exists with tracked main camera.
- Tried Meta Interaction SDK rig menu entries (`Add OVR Interaction Rig`, `Add UnityXR Interaction Rig`); commands reported success but produced no additional hierarchy changes in this scene.
- Saved scene via MCP after verification.
- Ran automated validation pass on `PvPKickboxerNativePrototype`: loaded scene, cleaned duplicate editor class conflict by neutralizing `Assets/Editor/NativeSceneBootstrapper.cs`, and recompiled scripts (`0 warnings`).
- Triggered Play Mode via MCP and sampled key avatar transforms; no PvPKickboxer script exceptions surfaced in captured errors.
- Captured repeated `NullReferenceException` from Meta editor QuickActions wizard window (`com.meta.xr.sdk.interaction` editor code), indicating editor tooling noise rather than runtime gameplay script failure.
- Ran Unity EditMode tests via MCP (`0 failed`; no authored tests yet).
- Updated scene bootstrap generator to add web-style limb connector cylinders and corrected foot mesh scale.
- Updated bootstrap generator to auto-create/use XR rig anchors (`Main Camera`, `LeftControllerAnchor`, `RightControllerAnchor`, wrist proxies) and wire `InputFusionProvider`/calibration to those references.
- Recompiled scripts (`0 warnings`), rebuilt `PvPKickboxerNativePrototype`, and verified new objects/refs via MCP.
- Added runtime `EditorPlaybackRigDriver` for in-Editor Play Mode control of head/controllers to visualize avatar/body movement without headset input.
- Wired `EditorPlaybackRigDriver` in scene bootstrap and rebuilt scene; verified component references are bound to `Main Camera`, controller anchors, and wrist proxies.
- Updated `InputFusionProvider` policy: hands are hand-tracking-only (`handsDrivenByHandTrackingOnly=true`), knees are controller-only (`kneesDrivenByControllersOnly=true`), preserving simultaneous hand+controller usage.
- Added hard limb-distance constraints in `AvatarPoseDriver` with explicit knee-on-hip-sphere behavior and min/max clamps for hip-knee, knee-ankle, ankle-foot, shoulder-elbow, elbow-wrist.
- Recompiled scripts (`0 warnings`) and rebuilt scene; verified new constraint/policy fields are present on `KickboxerGameRoot` components.
- Added runtime `OpenXRPoseMultiplexer` to drive head/controller/hand proxy anchors from XR input devices (controller + hand tracking characteristics in parallel).
- Added editor menu `Tools/PvPKickboxer/Build And Run Quest (Dev)` that forces scene-in-build-settings and triggers Android dev build with auto-run.
- Triggered Quest build/run; build is actively progressing in IL2CPP/Bee compile phase (Android arm64), indicating long first-build pipeline rather than immediate configuration failure.

## 2026-02-24
- Implemented hand-tracking reliability patch in `OpenXRPoseMultiplexer`: explicit tracked-state outputs, hand fallback via `XRNode.LeftHand/RightHand` devices, and cleaner head pose reads from `XRNode.CenterEye` device features.
- Updated `InputFusionProvider` to consume authoritative hand-tracked booleans from `OpenXRPoseMultiplexer` (instead of inferring from proxy object active state), preserving hand-only hand drivers and controller-only knee drivers.
- Added runtime auto-binding (`GetComponent<OpenXRPoseMultiplexer>()`) in `InputFusionProvider.Awake()` so existing scenes benefit without manual inspector rewiring.
- Extended look-up calibration flow in `KneeCalibrationService` to compute/store `HeadPoseOffsetWorld` so HMD pose can be lifted above neck target height after calibration.
- Updated `AvatarPoseDriver` to apply calibration head offset and continuously keep neck below the calibrated head pose, addressing neck/head misalignment.
- Updated scene bootstrap wiring (`NativeSceneBootstrapper`) so `InputFusionProvider.poseMultiplexer` is auto-bound in freshly generated scenes.
- Recompiled once successfully after initial patch set; then MCP bridge repeatedly dropped with `Transport closed` after Unity reloads, blocking final MCP-driven play-mode validation from this session.

## Rollup Rules
- Keep newest 30 detailed actions as-is.
- Merge repetitive adjacent actions into one summary line.
- Keep one per-day summary at top of each date block.
- Do not remove decision-significant events (requirements changes, architecture pivots, deployment URLs).
