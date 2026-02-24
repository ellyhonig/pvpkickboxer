using UnityEngine;

namespace PvPKickboxer.Native
{
    public interface INetworkPoseTransport
    {
        bool HasRemotePeer { get; }
        void SendLocalPose(PoseSnapshot snapshot);
        bool TryGetRemotePose(out PoseSnapshot snapshot);
    }

    [System.Serializable]
    public struct PoseSnapshot
    {
        public Vector3 headPos;
        public Quaternion headRot;
        public Vector3 leftWristPos;
        public Quaternion leftWristRot;
        public Vector3 rightWristPos;
        public Quaternion rightWristRot;
        public Vector3 leftKneePos;
        public Quaternion leftKneeRot;
        public Vector3 rightKneePos;
        public Quaternion rightKneeRot;
        public double sentAt;
    }
}
