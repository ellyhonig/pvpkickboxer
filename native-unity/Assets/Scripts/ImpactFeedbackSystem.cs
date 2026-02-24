using UnityEngine;

namespace PvPKickboxer.Native
{
    public class ImpactFeedbackSystem : MonoBehaviour
    {
        [SerializeField] private GameObject impactPrefab;
        [SerializeField] private AudioSource audioSource;
        [SerializeField] private AudioClip[] impactClips;
        [SerializeField] private float minImpactGap = 0.06f;

        private float lastImpactAt = -10f;

        public void ReportImpact(Vector3 worldPoint, float intensity)
        {
            if (Time.time - lastImpactAt < minImpactGap) return;
            lastImpactAt = Time.time;

            if (impactPrefab)
            {
                GameObject fx = Instantiate(impactPrefab, worldPoint, Quaternion.identity);
                float s = Mathf.Lerp(0.05f, 0.16f, intensity);
                fx.transform.localScale = Vector3.one * s;
                Destroy(fx, 0.35f);
            }

            if (audioSource && impactClips != null && impactClips.Length > 0)
            {
                int idx = Random.Range(0, impactClips.Length);
                audioSource.pitch = Mathf.Lerp(0.9f, 1.25f, intensity);
                audioSource.volume = Mathf.Lerp(0.3f, 1f, intensity);
                audioSource.PlayOneShot(impactClips[idx]);
            }
        }
    }
}
