using UnityEngine;

namespace PvPKickboxer.Native
{
    public class KneeCalibrationService : MonoBehaviour
    {
        [SerializeField] private InputFusionProvider input;
        [SerializeField] private AvatarPoseDriver poseDriver;
        [SerializeField] private Transform calibrationForwardRef;
        [SerializeField] private float lookUpThresholdY = 0.8f;
        [SerializeField] private float lookUpHoldSeconds = 0.35f;
        [SerializeField] private float retriggerCooldown = 2.5f;

        public Vector3 LeftKneeOffsetLocal { get; private set; }
        public Vector3 RightKneeOffsetLocal { get; private set; }
        public Quaternion LeftKneeRotationRef { get; private set; } = Quaternion.identity;
        public Quaternion RightKneeRotationRef { get; private set; } = Quaternion.identity;
        public bool HasCalibration { get; private set; }

        private float lookUpSince = -1f;
        private float lastCalibrationTime = -100f;

        private const string PrefKey = "pvpkickboxer_native_calibration_v1";

        private void Start()
        {
            Load();
        }

        private void Update()
        {
            AutoTriggerFromLookUp();
        }

        public void CalibrateNow()
        {
            if (!input || !poseDriver) return;

            Vector3 pelvis = poseDriver.EstimatePelvisPosition();
            Vector3 leftKnee = poseDriver.GetCurrentLeftKneePosition();
            Vector3 rightKnee = poseDriver.GetCurrentRightKneePosition();

            LeftKneeOffsetLocal = leftKnee - (input.LeftKneeControllerPose.position - pelvis);
            RightKneeOffsetLocal = rightKnee - (input.RightKneeControllerPose.position - pelvis);
            LeftKneeRotationRef = input.LeftKneeControllerPose.rotation;
            RightKneeRotationRef = input.RightKneeControllerPose.rotation;

            HasCalibration = true;
            lastCalibrationTime = Time.unscaledTime;
            Save();
        }

        private void AutoTriggerFromLookUp()
        {
            if (!input) return;
            Vector3 headForward = input.HeadPose.rotation * Vector3.forward;
            bool lookingUp = headForward.y >= lookUpThresholdY;

            if (!lookingUp)
            {
                lookUpSince = -1f;
                return;
            }

            if (lookUpSince < 0f) lookUpSince = Time.unscaledTime;

            bool held = (Time.unscaledTime - lookUpSince) >= lookUpHoldSeconds;
            bool cooled = (Time.unscaledTime - lastCalibrationTime) >= retriggerCooldown;
            if (held && cooled) CalibrateNow();
        }

        private void Save()
        {
            string payload = JsonUtility.ToJson(new CalibrationPayload
            {
                leftKneeOffset = LeftKneeOffsetLocal,
                rightKneeOffset = RightKneeOffsetLocal,
                leftKneeRot = LeftKneeRotationRef,
                rightKneeRot = RightKneeRotationRef,
                hasCalibration = HasCalibration
            });
            PlayerPrefs.SetString(PrefKey, payload);
            PlayerPrefs.Save();
        }

        private void Load()
        {
            if (!PlayerPrefs.HasKey(PrefKey)) return;
            CalibrationPayload payload = JsonUtility.FromJson<CalibrationPayload>(PlayerPrefs.GetString(PrefKey));
            LeftKneeOffsetLocal = payload.leftKneeOffset;
            RightKneeOffsetLocal = payload.rightKneeOffset;
            LeftKneeRotationRef = payload.leftKneeRot;
            RightKneeRotationRef = payload.rightKneeRot;
            HasCalibration = payload.hasCalibration;
        }

        [System.Serializable]
        private struct CalibrationPayload
        {
            public Vector3 leftKneeOffset;
            public Vector3 rightKneeOffset;
            public Quaternion leftKneeRot;
            public Quaternion rightKneeRot;
            public bool hasCalibration;
        }
    }
}
