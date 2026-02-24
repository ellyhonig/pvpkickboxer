# Project Notepad

Purpose: Track user preferences, what was correct, and what missed the mark.

## Things You Liked
- Calibration/tracking plan structure was approved.
- Hip-relative knee estimation plus calibration-driven foot pointing approach was approved.
- Requested auto-calibration trigger from looking up at ceiling threshold (~80% upward), now implemented.
- Requested a native app path using Meta Building Block style setup.
- Requested continuous notes that track everything done with compact rollups.
- Requested enabling tooling so I can interact with Unity directly (MCP bridge path).

## Things You Did Not Like
- None recorded yet.

## Things I Got Right
- Captured requirement to use avatars from `X:\grapplemap\GOLDENCHILD\grapplemap_sandbox - Copy`.
- Included WebXR hand tracking and controller tracking (controllers mounted to knees).
- Included multiplayer as an easy-add path and a solo fallback opponent avatar pose.
- Included anti-interpenetration/contact constraint direction tied to `Ho_Komura`.
- Included impact feel requirements: effect + sound + limb budge on contact.
- Delivered V1 prototype in this repo with runnable files and imported `positions.json`.
- Updated startup pose selection to choose neutral standing from the database rather than hardcoded first entry.
- Added PCVR mapping support so controllers can drive hands while trackers drive knees when tracker sources are detected.
- Relaxed calibration gate so testing can proceed even when only one/no knee tracker is exposed to WebXR.
- Deployed live Firebase Hosting build for Quest testing with dedicated project `pvpkickboxer-v1-ellyh`.
- Investigated WebXR hand+controller support and patched session creation to explicitly request `hand-tracking`; redeployed for Quest retest.
- Set up `mcp-unity` tooling locally (clone/build/config) and added startup/setup docs.
- Applied direct Unity project file configuration on request (manifest + settings + script import) to reduce manual editor setup.
- Added Unity editor automation script `NativeSceneBootstrapper` to generate a native prototype scene with prewired PvPKickboxer components, tracking anchors, local/opponent rigs, collider lists, and bootstrap references.
- Added look-up calibration extension so head pose can be vertically offset above neck target height when needed.

## Things I Got Wrong / Need Correction
- None recorded yet.
- Initial tracker auto-detection missed your Tundra setup; added broader tracker heuristics and a forced tracker mode override.
- Original XR registration only captured target-ray controller nodes; updated to capture grip-node sources too (important for SteamVR tracker exposure).
- Initial Quest build did not explicitly request WebXR `hand-tracking`, which can prevent hand input on newer Three.js defaults.
- Hand sources were initially wired only for XR indices 0/1; updated to register hand nodes across all indices so simultaneous controller+hand sources can be consumed when runtime provides them.
- MCP Unity connection was briefly healthy (scene query succeeded), then transport dropped while executing scene bootstrap menu action; needs reconnect before direct scene ops can continue.
- Unity logs confirmed the menu command failed because the custom menu path was not registered at runtime; added a duplicate editor script at `Assets/Editor/NativeSceneBootstrapper.cs` to improve pickup reliability after refresh/recompile.
- User confirmed `Tools/PvPKickboxer/Build Native Prototype Scene` now appears in Unity; remaining blocker is Codex MCP transport (`Transport closed`) from this session.
- In a fresh Codex session, MCP transport recovered and scene bootstrap executed successfully from agent side.
- XR conversion to `XRRig` works via menu command, but Meta Interaction SDK rig auto-add menu entries currently no-op in this scene despite reporting success.
- Runtime validation from MCP: PvPKickboxer scripts compile and run without captured script-specific exceptions; current recurring errors are from Meta QuickActions editor window (`QuickActionsWizard`) and appear tooling-related.
- Visual parity update: prototype avatar now uses connector cylinders between joints (web-style stick-limb look) and reduced foot size to avoid oversized feet.
- XR anchor wiring update: bootstrap now binds `InputFusionProvider` to `XRRig` camera + controller/wrist proxy anchors instead of only static placeholder anchors.
- Constraint model update: knees now constrained to hip-centered spherical distance band (min/max) and other major limb segments enforce min/max distances to prevent unrealistic stretch/compression from extreme driver poses.
- Input policy update: hand drivers now consume only hand-tracking wrist proxies, knee drivers consume only controller anchors; design supports simultaneous hands+controllers.
- Hand tracking state bug: previous hand-tracked gating depended on proxy hierarchy active-state; corrected to use runtime tracking validity from `OpenXRPoseMultiplexer`.
- Current blocker: MCP bridge in this session intermittently drops with `Transport closed` after Unity reload, delaying automated in-editor verification.

## Open Assumptions To Verify
- Which native networking stack to choose first after offline mode (Photon Fusion vs NGO vs custom relay).
- Networking stack preference after V1 local multiplayer (`BroadcastChannel`) (WebRTC + signaling vs hosted service).
- Exact interpretation/details of `Ho_Komura` implementation in the source project.

## Update Rules
- Add entries immediately when the user confirms, rejects, or corrects something.
- Keep entries short and concrete.
- Never delete old entries; if superseded, mark as superseded with date.
- Maintain `ACTION_LOG.md` as the full running list of actions.
- Compress repetitive action entries into rollups to control size while preserving key decisions and outcomes.
