using UnityEngine;
using System.Collections.Generic;

namespace ExpandFuncs_BHK
{
    /// HelpURL: https://easings.net/#
    /// 애니메이션 커브 없이 미리 설정된 Ease 값만으로 액팅을 주기 위해 만든 기능
    public static class BTweener
    {
        private delegate float Func(float x);

        private static readonly List<Func> Acts = new List<Func>()
        {
            Linear,
            InSine, OutSine, InOutSine,
            InQuad, OutQuad, InOutQuad,
            InCubic, OutCubic, InOutCubic,
            InQuart, OutQuart, InOutQuart,
            InQuint, OutQuint, InOutQuint,
            InExpo, OutExpo, InOutExpo,
            InCirc, OutCirc, InOutCirc,
            InBack, OutBack, InOutBack,
            InElastic, OutElastic, InOutElastic,
            InBounce, OutBounce, InOutBounce
        };

        /// <summary>
        /// Animation Curve의 Evaluate와 동일하게 사용
        /// </summary>
        /// <param name="ease">넣고 싶은 액팅 추가</param>
        /// <param name="x">현재 x값(시간) 추가 0~1, 여기를 천천히 넣으면 천천히 액팅</param>
        /// <returns></returns>
        public static float GetEvaluate(Ease ease, float x)
        {
            return Acts[(int) ease](x);
        }

        #region - Ease Functions - default: 0f~ 1f

        private static float Linear(float x)
        {
            return x;
        }

        private static float InSine(float x)
        {
            return 1f - Mathf.Cos((x * Mathf.PI) / 2f);
        }

        private static float OutSine(float x)
        {
            return Mathf.Sin((x * Mathf.PI) / 2f);
        }

        private static float InOutSine(float x)
        {
            return -(Mathf.Cos(Mathf.PI * x) - 1f) / 2f;
        }

        private static float InQuad(float x)
        {
            return x * x;
        }

        private static float OutQuad(float x)
        {
            return 1f - Mathf.Pow(1f - x, 2);
        }

        private static float InOutQuad(float x)
        {
            return x < 0.5f ? 2f * x * x : 1f - Mathf.Pow(-2f * x + 2f, 2f) / 2f;
        }

        private static float InCubic(float x)
        {
            return Mathf.Pow(x, 3);
        }

        private static float OutCubic(float x)
        {
            return 1f - Mathf.Pow(1f - x, 3f);
        }

        private static float InOutCubic(float x)
        {
            return x < 0.5f ? 4f * x * x * x : 1f - Mathf.Pow(-2f * x + 2f, 3f) / 2f;
        }

        private static float InQuart(float x)
        {
            return Mathf.Pow(x, 4);
        }

        private static float OutQuart(float x)
        {
            return 1f - Mathf.Pow(1f - x, 4f);
        }

        private static float InOutQuart(float x)
        {
            return x < 0.5f ? 8f * Mathf.Pow(x, 4) : 1f - Mathf.Pow(-2f * x + 2f, 4f) / 2f;
        }

        private static float InQuint(float x)
        {
            return Mathf.Pow(x, 5);
        }

        private static float OutQuint(float x)
        {
            return 1f - Mathf.Pow(1f - x, 5f);
        }

        private static float InOutQuint(float x)
        {
            return x < 0.5f ? 16f * Mathf.Pow(x, 5) : 1f - Mathf.Pow(-2f * x + 2f, 5f) / 2f;
        }

        private static float InExpo(float x)
        {
            return x == 0f ? 0f : Mathf.Pow(2f, 10f * x - 10f);
        }

        private static float OutExpo(float x)
        {
            return x.Equals(1f) ? 1f : 1f - Mathf.Pow(2f, -10f * x);
        }

        private static float InOutExpo(float x)
        {
            return x == 0f
                ? 0f
                : x.Equals(1f)
                    ? 1f
                    : x < 0.5f
                        ? Mathf.Pow(2f, 20 * x - 10f) / 2f
                        : (2f - Mathf.Pow(2f, -20f * x + 10f)) / 2f;
        }

        private static float InCirc(float x)
        {
            return 1f - Mathf.Sqrt(1f - Mathf.Pow(x, 2f));
        }

        private static float OutCirc(float x)
        {
            return Mathf.Sqrt(1f - Mathf.Pow(x - 1f, 2f));
        }

        private static float InOutCirc(float x)
        {
            return x < 0.5f
                ? (1f - Mathf.Sqrt(1f - Mathf.Pow(2f * x, 2f))) / 2f
                : (Mathf.Sqrt(1f - Mathf.Pow(-2f * x + 2f, 2f)) + 1f) / 2f;
        }

        private static float InBack(float x)
        {
            const float c1 = 1.70158f;
            const float c3 = c1 + 1f;

            return c3 * Mathf.Pow(x, 3) - c1 * Mathf.Pow(x, 2);
        }

        private static float OutBack(float x)
        {
            const float c1 = 1.70158f;
            const float c3 = c1 + 1f;

            return 1f + c3 * Mathf.Pow(x - 1f, 3f) + c1 * Mathf.Pow(x - 1f, 2f);
        }

        private static float InOutBack(float x)
        {
            const float c1 = 1.70158f;
            const float c2 = c1 * 1.525f;

            return x < 0.5f
                ? (Mathf.Pow(2f * x, 2f) * ((c2 + 1f) * 2f * x - c2)) / 2f
                : (Mathf.Pow(2f * x - 2f, 2f) * ((c2 + 1f) * (x * 2f - 2f) + c2) + 2f) / 2f;
        }

        private static float InElastic(float x)
        {
            const float c4 = (2f * Mathf.PI) / 3;

            return x == 0f
                ? 0f
                : x.Equals(1f)
                    ? 1f
                    : -Mathf.Pow(2f, 10f * x - 10f) * Mathf.Sin((x * 10f - 10.75f) * c4);
        }

        private static float OutElastic(float x)
        {
            const float c4 = (2f * Mathf.PI) / 3f;

            return x == 0f
                ? 0f
                : x.Equals(1f)
                    ? 1f
                    : Mathf.Pow(2f, -10f * x) * Mathf.Sin((x * 10f - 0.75f) * c4) + 1f;
        }

        private static float InOutElastic(float x)
        {
            const float c5 = (2f * Mathf.PI) / 4.5f;

            return x == 0f
                ? 0f
                : x.Equals(1f)
                    ? 1f
                    : x < 0.5f
                        ? -(Mathf.Pow(2f, 20 * x - 10f) * Mathf.Sin((20f * x - 11.125f) * c5)) / 2f
                        : (Mathf.Pow(2f, -20 * x + 10f) * Mathf.Sin((20f * x - 11.125f) * c5)) / 2f + 1f;
        }

        private static float InBounce(float x)
        {
            return 1f - OutBounce(1f - x);
        }

        private static float OutBounce(float x)
        {
            const float n1 = 7.5625f;
            const float d1 = 2.75f;

            if (x < 1f / d1)
            {
                return n1 * x * x;
            }
            else if (x < 2f / d1)
            {
                return n1 * (x -= 1.5f / d1) * x + 0.75f;
            }
            else if (x < 2.5 / d1)
            {
                return n1 * (x -= 2.25f / d1) * x + 0.9375f;
            }
            else
            {
                return n1 * (x -= 2.625f / d1) * x + 0.984375f;
            }
        }

        private static float InOutBounce(float x)
        {
            return x < 0.5f
                ? (1f - OutBounce(1f - 2f * x)) / 2f
                : (1f + OutBounce(2f * x - 1f)) / 2f;
        }

        #endregion
    }
}