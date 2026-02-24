using UnityEngine;

namespace PvPKickboxer.Native
{
    public class AvatarPoseDriver : MonoBehaviour
    {
        [SerializeField] private InputFusionProvider input;
        [SerializeField] private KneeCalibrationService calibration;
        [SerializeField] private AvatarRigMap localRig;
        [SerializeField] private float pelvisHeadBlend = 0.45f;
        [SerializeField] private float pelvisHeightOffset = 0.55f;
        [Header("Avatar Visuals")]
        [SerializeField] private bool hideArms = true;
        [SerializeField] private float torsoThicknessScale = 1.12f;

        [Header("Smoothing")]
        [SerializeField] private float kneeLerp = 0.42f;
        [SerializeField] private float coreLerp = 0.5f;

        private Vector3 coreBaseScale = Vector3.one;

        private void Awake()
        {
            CacheCoreScale();
            ApplyAvatarVisualOverrides();
        }

        public Vector3 EstimatePelvisPosition()
        {
            Vector3 head = input ? input.HeadPose.position : Vector3.zero;
            return new Vector3(head.x * pelvisHeadBlend, head.y - pelvisHeightOffset, head.z * pelvisHeadBlend);
        }

        public Vector3 GetCurrentLeftKneePosition() => localRig.LeftKnee ? localRig.LeftKnee.position : Vector3.zero;
        public Vector3 GetCurrentRightKneePosition() => localRig.RightKnee ? localRig.RightKnee.position : Vector3.zero;

        private void LateUpdate()
        {
            if (!input || localRig == null) return;
            DriveCoreAndHead();
            DriveKneesAndFootHeading();
        }

        private void CacheCoreScale()
        {
            if (localRig?.Core) coreBaseScale = localRig.Core.localScale;
        }

        private void ApplyAvatarVisualOverrides()
        {
            ApplyTorsoThickness();
            if (hideArms) HideArmRenderers();
        }

        private void DriveCoreAndHead()
        {
            Vector3 pelvis = EstimatePelvisPosition();
            if (localRig.Core)
            {
                localRig.Core.position = Vector3.Lerp(localRig.Core.position, pelvis, coreLerp);
            }

            if (localRig.Head)
            {
                localRig.Head.position = input.HeadPose.position;
                localRig.Head.rotation = input.HeadPose.rotation;
            }
        }

        private void ApplyTorsoThickness()
        {
            if (!localRig?.Core) return;
            Vector3 targetScale = coreBaseScale;
            targetScale.x *= torsoThicknessScale;
            targetScale.z *= torsoThicknessScale;
            localRig.Core.localScale = targetScale;
        }

        private void HideArmRenderers()
        {
            HideRenderersUnder(localRig?.LeftShoulder);
            HideRenderersUnder(localRig?.LeftElbow);
            HideRenderersUnder(localRig?.LeftWrist);
            HideRenderersUnder(localRig?.RightShoulder);
            HideRenderersUnder(localRig?.RightElbow);
            HideRenderersUnder(localRig?.RightWrist);
        }

        private static void HideRenderersUnder(Transform root)
        {
            if (!root) return;
            Renderer[] renderers = root.GetComponentsInChildren<Renderer>(true);
            for (int i = 0; i < renderers.Length; i++)
            {
                renderers[i].enabled = false;
            }
        }

        private void DriveKneesAndFootHeading()
        {
            Vector3 pelvis = EstimatePelvisPosition();
            Vector3 leftKneeTarget = input.LeftKneeControllerPose.position;
            Vector3 rightKneeTarget = input.RightKneeControllerPose.position;

            if (calibration && calibration.HasCalibration)
            {
                leftKneeTarget = pelvis + (input.LeftKneeControllerPose.position - pelvis) + calibration.LeftKneeOffsetLocal;
                rightKneeTarget = pelvis + (input.RightKneeControllerPose.position - pelvis) + calibration.RightKneeOffsetLocal;
            }

            if (localRig.LeftKnee)
            {
                localRig.LeftKnee.position = Vector3.Lerp(localRig.LeftKnee.position, leftKneeTarget, kneeLerp);
            }
            if (localRig.RightKnee)
            {
                localRig.RightKnee.position = Vector3.Lerp(localRig.RightKnee.position, rightKneeTarget, kneeLerp);
            }

            ApplyFootHeadingFromControllerRotation();
        }

        private void ApplyFootHeadingFromControllerRotation()
        {
            if (calibration == null || !calibration.HasCalibration) return;

            Quaternion leftDelta = input.LeftKneeControllerPose.rotation * Quaternion.Inverse(calibration.LeftKneeRotationRef);
            Quaternion rightDelta = input.RightKneeControllerPose.rotation * Quaternion.Inverse(calibration.RightKneeRotationRef);

            float leftYaw = leftDelta.eulerAngles.y;
            float rightYaw = rightDelta.eulerAngles.y;

            if (localRig.LeftFoot)
            {
                Vector3 e = localRig.LeftFoot.eulerAngles;
                localRig.LeftFoot.eulerAngles = new Vector3(e.x, leftYaw, e.z);
            }
            if (localRig.RightFoot)
            {
                Vector3 e = localRig.RightFoot.eulerAngles;
                localRig.RightFoot.eulerAngles = new Vector3(e.x, rightYaw, e.z);
            }
        }
    }
}
