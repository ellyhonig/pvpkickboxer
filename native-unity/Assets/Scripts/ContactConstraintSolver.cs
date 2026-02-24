using System.Collections.Generic;
using UnityEngine;

namespace PvPKickboxer.Native
{
    public class ContactConstraintSolver : MonoBehaviour
    {
        [SerializeField] private List<CapsuleCollider> localLimbs = new();
        [SerializeField] private List<CapsuleCollider> opponentLimbs = new();
        [SerializeField] private float minSeparation = 0.03f;
        [SerializeField] private float pushStrength = 0.6f;
        [SerializeField] private int iterations = 3;
        [SerializeField] private ImpactFeedbackSystem impactFeedback;

        private readonly Collider[] overlapCache = new Collider[16];

        private void LateUpdate()
        {
            for (int i = 0; i < iterations; i++)
            {
                SolveInterpenetration(localLimbs, opponentLimbs);
                SolveInterpenetration(localLimbs, localLimbs);
                SolveInterpenetration(opponentLimbs, opponentLimbs);
            }
        }

        private void SolveInterpenetration(List<CapsuleCollider> setA, List<CapsuleCollider> setB)
        {
            for (int i = 0; i < setA.Count; i++)
            {
                CapsuleCollider a = setA[i];
                if (!a || !a.enabled) continue;

                int hits = Physics.OverlapSphereNonAlloc(a.bounds.center, a.bounds.extents.magnitude, overlapCache, ~0, QueryTriggerInteraction.Ignore);
                for (int h = 0; h < hits; h++)
                {
                    Collider c = overlapCache[h];
                    if (!c || c == a) continue;
                    if (!(c is CapsuleCollider b)) continue;
                    if (!setB.Contains(b)) continue;
                    if (ReferenceEquals(setA, setB) && b.GetInstanceID() <= a.GetInstanceID()) continue;

                    if (Physics.ComputePenetration(
                            a, a.transform.position, a.transform.rotation,
                            b, b.transform.position, b.transform.rotation,
                            out Vector3 dir, out float dist))
                    {
                        Vector3 push = dir * (dist + minSeparation) * pushStrength * 0.5f;
                        a.transform.position += push;
                        b.transform.position -= push;

                        if (impactFeedback != null)
                        {
                            Vector3 p = (a.bounds.center + b.bounds.center) * 0.5f;
                            impactFeedback.ReportImpact(p, Mathf.Clamp01(dist * 8f));
                        }
                    }
                }
            }
        }
    }
}
