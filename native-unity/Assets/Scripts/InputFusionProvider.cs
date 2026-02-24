using UnityEngine;

namespace PvPKickboxer.Native
{
    public class InputFusionProvider : MonoBehaviour
    {
        [Header("Rig References")]
        [SerializeField] private Transform centerEyeAnchor;
        [SerializeField] private Transform leftControllerAnchor;
        [SerializeField] private Transform rightControllerAnchor;
        [SerializeField] private Transform leftHandWristProxy;
        [SerializeField] private Transform rightHandWristProxy;

        [Header("State")]
        [SerializeField] private bool preferHandsWhenTracked = true;

        public Pose HeadPose { get; private set; }
        public Pose LeftHandPose { get; private set; }
        public Pose RightHandPose { get; private set; }
        public Pose LeftKneeControllerPose { get; private set; }
        public Pose RightKneeControllerPose { get; private set; }

        public bool LeftHandTracked { get; private set; }
        public bool RightHandTracked { get; private set; }

        private void LateUpdate()
        {
            RefreshHead();
            RefreshHandAndKneeTargets();
        }

        private void RefreshHead()
        {
            if (!centerEyeAnchor) return;
            HeadPose = new Pose(centerEyeAnchor.position, centerEyeAnchor.rotation);
        }

        private void RefreshHandAndKneeTargets()
        {
            Pose leftCtrl = ReadPose(leftControllerAnchor);
            Pose rightCtrl = ReadPose(rightControllerAnchor);
            Pose leftHand = ReadPose(leftHandWristProxy);
            Pose rightHand = ReadPose(rightHandWristProxy);

            LeftHandTracked = leftHandWristProxy && leftHandWristProxy.gameObject.activeInHierarchy;
            RightHandTracked = rightHandWristProxy && rightHandWristProxy.gameObject.activeInHierarchy;

            if (preferHandsWhenTracked && LeftHandTracked) LeftHandPose = leftHand;
            else LeftHandPose = leftCtrl;

            if (preferHandsWhenTracked && RightHandTracked) RightHandPose = rightHand;
            else RightHandPose = rightCtrl;

            // Controllers mounted to knees.
            LeftKneeControllerPose = leftCtrl;
            RightKneeControllerPose = rightCtrl;
        }

        private static Pose ReadPose(Transform t)
        {
            if (!t) return new Pose(Vector3.zero, Quaternion.identity);
            return new Pose(t.position, t.rotation);
        }
    }
}
