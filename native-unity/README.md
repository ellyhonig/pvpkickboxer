# Native Unity Kit

This folder contains a Unity-native implementation kit for the Quest app path using Meta Building Blocks for XR setup.

## Included
- `BUILD_PLAN.md`: architecture and execution plan.
- `Docs/SETUP_STEPS.md`: concrete scene setup and wiring steps.
- `Assets/Scripts/*.cs`: gameplay/tracking/calibration/contact/impact scaffolding.

## Important
- This is a script-and-plan kit, not a complete Unity project.
- Create/open a Unity project, import Meta XR SDK, then copy `Assets/Scripts` into your Unity project and wire references per setup doc.

## Scripts
- `KickboxerBootstrap.cs`
- `InputFusionProvider.cs`
- `KneeCalibrationService.cs`
- `AvatarPoseDriver.cs`
- `ContactConstraintSolver.cs`
- `ImpactFeedbackSystem.cs`
- `SoloOpponentController.cs`
- `INetworkPoseTransport.cs`
- `AvatarRigMap.cs`
