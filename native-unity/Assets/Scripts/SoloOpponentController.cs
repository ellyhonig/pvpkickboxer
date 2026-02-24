using UnityEngine;

namespace PvPKickboxer.Native
{
    public class SoloOpponentController : MonoBehaviour
    {
        [SerializeField] private AvatarRigMap opponentRig;
        [SerializeField] private bool hasRemotePeer;

        private Vector3 headStartPos;
        private Quaternion headStartRot;

        private void Start()
        {
            if (opponentRig?.Head)
            {
                headStartPos = opponentRig.Head.localPosition;
                headStartRot = opponentRig.Head.localRotation;
            }
        }

        private void Update()
        {
            if (hasRemotePeer) return;
            HoldStaticGuardPose();
        }

        public void SetRemotePeerState(bool connected)
        {
            hasRemotePeer = connected;
        }

        private void HoldStaticGuardPose()
        {
            if (!opponentRig?.Head) return;
            // Tiny idle motion while preserving static sparring target behavior.
            float t = Time.time;
            opponentRig.Head.localPosition = headStartPos + new Vector3(0f, Mathf.Sin(t * 1.2f) * 0.005f, 0f);
            opponentRig.Head.localRotation = headStartRot;
        }
    }
}
