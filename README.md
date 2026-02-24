# PVP Kickboxer V1

WebXR browser prototype using GrappleMap avatars, hand tracking, and knee-mounted controllers.

## Run

From `X:\pvpkickboxer`:

```powershell
python -m http.server 8000
```

Open:

`http://localhost:8000/`

## V1 Features

- Uses avatar rig/pose data from `positions.json` (GrappleMap project format).
- WebXR VR with:
  - hand tracking wrist targets when available
  - controller tracking fallback for wrists
  - knee controller tracking for `LeftKnee`/`RightKnee`
  - PCVR tracker mode: if tracker input sources are detected, controllers are used for hands and trackers are used for knees
  - optional override: add `?trackers=1` to force tracker-priority knee mapping on PCVR
  - explicit WebXR session requirement for `hand-tracking` to avoid starting controller-only sessions
- Calibration button captures:
  - hip-relative knee offsets
  - knee-controller rotation references for foot heading intent
  - wrist offsets
  - auto-calibration also triggers when user looks up toward the ceiling (80% upward threshold) in VR
- Ho_Komura-style practical contact handling:
  - iterative constraint projection
  - segment-segment anti-penetration with minimum separation
  - limb budge from distributed collision corrections
- Impact feel:
  - contact flash effect at impact point
  - procedural impact sound scaled by strike speed
- Multiplayer (easy path):
  - local `BroadcastChannel` room sync (`?room=...`)
  - while no remote pose is seen, opponent holds static pose

## Notes

- This V1 multiplayer path is same-browser-profile/tab capable and low-setup.
- For internet multiplayer across devices, next step is WebRTC signaling or hosted relay.
