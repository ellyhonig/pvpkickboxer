using System;
using UnityEngine;

namespace PvPKickboxer.Native
{
    [Serializable]
    public class AvatarRigMap
    {
        public Transform Head;
        public Transform Neck;
        public Transform Core;

        public Transform LeftShoulder;
        public Transform RightShoulder;
        public Transform LeftElbow;
        public Transform RightElbow;
        public Transform LeftWrist;
        public Transform RightWrist;

        public Transform LeftHip;
        public Transform RightHip;
        public Transform LeftKnee;
        public Transform RightKnee;
        public Transform LeftAnkle;
        public Transform RightAnkle;
        public Transform LeftFoot;
        public Transform RightFoot;
    }
}
