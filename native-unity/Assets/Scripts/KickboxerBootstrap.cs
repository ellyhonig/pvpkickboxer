using UnityEngine;

namespace PvPKickboxer.Native
{
    public class KickboxerBootstrap : MonoBehaviour
    {
        [SerializeField] private InputFusionProvider input;
        [SerializeField] private KneeCalibrationService calibration;
        [SerializeField] private AvatarPoseDriver poseDriver;
        [SerializeField] private ContactConstraintSolver contactSolver;
        [SerializeField] private ImpactFeedbackSystem impactFeedback;
        [SerializeField] private SoloOpponentController soloOpponent;

        private void Awake()
        {
            ValidateReferences();
        }

        private void ValidateReferences()
        {
            if (!input) Debug.LogError("[KickboxerBootstrap] Missing InputFusionProvider");
            if (!calibration) Debug.LogError("[KickboxerBootstrap] Missing KneeCalibrationService");
            if (!poseDriver) Debug.LogError("[KickboxerBootstrap] Missing AvatarPoseDriver");
            if (!contactSolver) Debug.LogError("[KickboxerBootstrap] Missing ContactConstraintSolver");
            if (!impactFeedback) Debug.LogError("[KickboxerBootstrap] Missing ImpactFeedbackSystem");
            if (!soloOpponent) Debug.LogWarning("[KickboxerBootstrap] SoloOpponentController not set");
        }
    }
}
