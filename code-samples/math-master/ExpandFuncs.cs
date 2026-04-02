using System.Linq;
using System.Collections;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.Video;
using Random = UnityEngine.Random;

namespace ExpandFuncs_BHK
{
    public static class Act
    {
        // Find for child nodes only.
        public static T GetChildByName<T>(this Transform parent, string name) where T : Component
        {
            T target = null;

            for (var i = 0; i < parent.childCount; i++)
            {
                var child = parent.GetChild(i).GetComponent<T>();
                if (child == null || child.name != name) continue;
                target = child;
                break;
            }

            return target;
        }

        public static Transform GetChildTrByName(this Transform parent, string name)
        {
            return GetChildByName<Transform>(parent, name);
        }

        public static GameObject GetChildByName(this Transform parent, string name)
        {
            return GetChildTrByName(parent, name).gameObject;
        }

        public static IEnumerator DoNumberFlow(this TextMeshProUGUI tmp, int value, Ease ease = Ease.OutQuad,
            float speed = 1f,
            LoopType loopType = LoopType.Yoyo, int loopTime = 1)
        {
            var origin = int.Parse(tmp.text);
            var dir = value - origin;
            var curCount = 0;

            while (IsLoop(curCount++, loopTime))
            {
                var curTime = 0f;
                const float maxTime = 1f;

                while (curTime < maxTime)
                {
                    tmp.text = (origin + (int) (dir * BTweener.GetEvaluate(ease, curTime))).ToString();

                    yield return null;
                    curTime += Time.deltaTime * speed;
                }

                switch (loopType)
                {
                    case LoopType.Restart:
                        tmp.text = origin.ToString();
                        dir = value - origin;
                        break;
                    case LoopType.Yoyo:
                        tmp.text = value.ToString();
                        Funcs.Swap(ref value, ref origin);
                        dir = value - origin;
                        break;
                    case LoopType.Incremental:
                    default:
                        tmp.text = value.ToString();
                        origin = value;
                        value = dir + value;
                        dir = value - origin;
                        break;
                }
            }
        }

        /// <summary> 이동 액팅 </summary>
        /// <param name="value">목표 값</param>
        /// <param name="ease">효과 값 https://easings.net/ko# </param>
        /// <param name="speed">목표값 까지의 도달 속도</param>
        /// <param name="loopType">반복 유형 설정</param>
        /// <param name="loopTime">반복 횟수 (-1은 무한 반복)</param>
        /// <param name="amp">y값 증폭값</param>
        public static IEnumerator DoLocalMove(this RectTransform rectTr, Vector3 value, Ease ease = Ease.OutQuad,
            float speed = 1f, LoopType loopType = LoopType.Yoyo, int loopTime = 1, float amp = 1f)
        {
            var origin = rectTr.anchoredPosition3D;
            var dir = value - origin;
            var curCount = 0;

            while (IsLoop(curCount++, loopTime))
            {
                var curTime = 0f;
                const float maxTime = 1f;

                while (curTime < maxTime)
                {
                    rectTr.anchoredPosition3D = origin + dir * BTweener.GetEvaluate(ease, curTime) * amp;

                    yield return null;
                    curTime += Time.deltaTime * speed;
                }

                switch (loopType)
                {
                    case LoopType.Restart:
                        rectTr.anchoredPosition3D = origin;
                        dir = value - origin;
                        break;
                    case LoopType.Yoyo:
                        rectTr.anchoredPosition3D = value;
                        Funcs.Swap(ref value, ref origin);
                        dir = value - origin;
                        break;
                    case LoopType.Incremental:
                    default:
                        rectTr.anchoredPosition3D = value;
                        origin = value;
                        value = dir + value;
                        dir = value - origin;
                        break;
                }
            }
        }

        public static IEnumerator DoLocalMoveX(this RectTransform rectTr, float _value, Ease ease = Ease.OutQuad,
            float speed = 1f, LoopType loopType = LoopType.Yoyo, int loopTime = 1, float amp = 1f)
        {
            var origin = rectTr.anchoredPosition3D;
            var value = new Vector3(_value, origin.y);
            var dir = value - origin;
            var curCount = 0;

            while (IsLoop(curCount++, loopTime))
            {
                var curTime = 0f;
                const float maxTime = 1f;

                while (curTime < maxTime)
                {
                    rectTr.anchoredPosition3D = new Vector3(origin.x, rectTr.anchoredPosition3D.y) +
                                                dir * BTweener.GetEvaluate(ease, curTime) * amp;

                    yield return null;
                    curTime += Time.deltaTime * speed;
                }

                origin = new Vector3(origin.x, rectTr.anchoredPosition3D.y);

                switch (loopType)
                {
                    case LoopType.Restart:
                        rectTr.anchoredPosition3D = origin;
                        dir = value - origin;
                        break;
                    case LoopType.Yoyo:
                        rectTr.anchoredPosition3D = value;
                        Funcs.Swap(ref value, ref origin);
                        dir = value - origin;
                        break;
                    case LoopType.Incremental:
                    default:
                        rectTr.anchoredPosition3D = value;
                        origin = value;
                        value = dir + value;
                        dir = value - origin;
                        break;
                }
            }
        }

        public static IEnumerator DoLocalMoveY(this RectTransform rectTr, float _value, Ease ease = Ease.OutQuad,
            float speed = 1f, LoopType loopType = LoopType.Yoyo, int loopTime = 1, float amp = 1f)
        {
            var origin = rectTr.anchoredPosition3D;
            var value = new Vector3(origin.x, _value);
            var dir = value - origin;
            var curCount = 0;

            while (IsLoop(curCount++, loopTime))
            {
                var curTime = 0f;
                const float maxTime = 1f;

                while (curTime < maxTime)
                {
                    rectTr.anchoredPosition3D = new Vector3(rectTr.anchoredPosition3D.x, origin.y) +
                                                dir * BTweener.GetEvaluate(ease, curTime) * amp;

                    yield return null;
                    curTime += Time.deltaTime * speed;
                }

                origin = new Vector3(origin.x, rectTr.anchoredPosition3D.y);

                switch (loopType)
                {
                    case LoopType.Restart:
                        rectTr.anchoredPosition3D = origin;
                        dir = value - origin;
                        break;
                    case LoopType.Yoyo:
                        rectTr.anchoredPosition3D = value;
                        Funcs.Swap(ref value, ref origin);
                        dir = value - origin;
                        break;
                    case LoopType.Incremental:
                    default:
                        rectTr.anchoredPosition3D = value;
                        origin = value;
                        value = dir + value;
                        dir = value - origin;
                        break;
                }
            }
        }

        public static IEnumerator DoMove(this Transform _tr, Vector3 value, Ease ease = Ease.OutQuad,
            float speed = 1f, LoopType loopType = LoopType.Yoyo, int loopTime = 1, float amp = 1f)
        {
            var tr = _tr.gameObject.GetComponent<Transform>();
            var origin = tr.position;
            var dir = value - origin;
            var curCount = 0;

            while (IsLoop(curCount++, loopTime))
            {
                var curTime = 0f;
                const float maxTime = 1f;

                while (curTime < maxTime)
                {
                    tr.position = origin + dir * BTweener.GetEvaluate(ease, curTime) * amp;

                    yield return null;
                    curTime += Time.deltaTime * speed;
                }

                switch (loopType)
                {
                    case LoopType.Restart:
                        tr.position = origin;
                        dir = value - origin;
                        break;
                    case LoopType.Yoyo:
                        tr.position = value;
                        Funcs.Swap(ref value, ref origin);
                        dir = value - origin;
                        break;
                    case LoopType.Incremental:
                    default:
                        tr.position = value;
                        origin = value;
                        value = dir + value;
                        dir = value - origin;
                        break;
                }
            }
        }

        public static IEnumerator DoSizeDelta(this RectTransform rectTr, Vector2 value, Ease ease = Ease.OutQuad,
            float speed = 1f, LoopType loopType = LoopType.Yoyo, int loopTime = 1, float amp = 1f)
        {
            // mathf
            var origin = rectTr.sizeDelta;
            var dir = value - origin;
            var curCount = 0;

            while (IsLoop(curCount++, loopTime))
            {
                var curTime = 0f;
                const float maxTime = 1f;

                while (curTime < maxTime)
                {
                    rectTr.sizeDelta = origin + dir * BTweener.GetEvaluate(ease, curTime) * amp;

                    yield return null;
                    curTime += Time.deltaTime * speed;
                }

                switch (loopType)
                {
                    case LoopType.Restart:
                        rectTr.sizeDelta = origin;
                        dir = value - origin;
                        break;
                    case LoopType.Yoyo:
                        rectTr.sizeDelta = value;
                        Funcs.Swap(ref value, ref origin);
                        dir = value - origin;
                        break;
                    case LoopType.Incremental:
                    default:
                        rectTr.sizeDelta = value;
                        origin = value;
                        value = dir + value;
                        dir = value - origin;
                        break;
                }
            }
        }

        /// <summary>
        /// 사이즈 액팅 (LoopType:Yoyo LoopTime:2 로 두면 팝핑)
        /// </summary>
        /// <param name="value">목표 값</param>
        /// <param name="ease">효과 값 https://easings.net/ko# </param>
        /// <param name="speed">목표값 까지의 도달 속도</param>
        /// <param name="loopType">반복 유형 설정</param>
        /// <param name="loopTime">반복 횟수 (-1은 무한 반복)</param>
        /// <param name="amp">y값 증폭값</param>
        /// <returns></returns>
        public static IEnumerator DoScale(this RectTransform rectTr, Vector3 value, Ease ease = Ease.OutQuad,
            float speed = 1f, LoopType loopType = LoopType.Yoyo, int loopTime = 1, float amp = 1f)
        {
            // mathf
            var origin = rectTr.localScale;
            var dir = value - origin;
            var curCount = 0;

            while (IsLoop(curCount++, loopTime))
            {
                var curTime = 0f;
                const float maxTime = 1f;

                while (curTime < maxTime)
                {
                    rectTr.localScale = origin + dir * BTweener.GetEvaluate(ease, curTime) * amp;

                    yield return null;
                    curTime += Time.deltaTime * speed;
                }

                switch (loopType)
                {
                    case LoopType.Restart:
                        rectTr.localScale = origin;
                        dir = value - origin;
                        break;
                    case LoopType.Yoyo:
                        rectTr.localScale = value;
                        Funcs.Swap(ref value, ref origin);
                        dir = value - origin;
                        break;
                    case LoopType.Incremental:
                    default:
                        rectTr.localScale = value;
                        origin = value;
                        value = dir + value;
                        dir = value - origin;
                        break;
                }
            }
        }

        /// <summary> 사이즈 액팅 (LoopType:Yoyo LoopTime:2 로 두면 팝핑) </summary>
        /// <param name="_value">목표 값</param>
        /// <param name="ease">효과 값 https://easings.net/ko# </param>
        /// <param name="speed">목표값 까지의 도달 속도</param>
        /// <param name="loopType">반복 유형 설정</param>
        /// <param name="loopTime">반복 횟수 (-1은 무한 반복)</param>
        /// <param name="amp">y값 증폭값</param>
        public static IEnumerator DoScale(this RectTransform rectTr, float _value, Ease ease = Ease.OutQuad,
            float speed = 1f, LoopType loopType = LoopType.Yoyo, int loopTime = 1, float amp = 1f)
        {
            // mathf
            var origin = rectTr.localScale;
            var value = origin * _value;
            var dir = value - origin;
            var curCount = 0;

            while (IsLoop(curCount++, loopTime))
            {
                var curTime = 0f;
                const float maxTime = 1f;

                while (curTime < maxTime)
                {
                    rectTr.localScale = origin + dir * BTweener.GetEvaluate(ease, curTime) * amp;

                    yield return null;
                    curTime += Time.deltaTime * speed;
                }

                switch (loopType)
                {
                    case LoopType.Restart:
                        rectTr.localScale = origin;
                        dir = value - origin;
                        break;
                    case LoopType.Yoyo:
                        rectTr.localScale = value;
                        Funcs.Swap(ref value, ref origin);
                        dir = value - origin;
                        break;
                    case LoopType.Incremental:
                    default:
                        rectTr.localScale = value;
                        origin = value;
                        value = dir + value;
                        dir = value - origin;
                        break;
                }
            }
        }

        /// <summary> 회전 액팅 </summary>
        /// <param name="value">목표 값</param>
        /// <param name="ease">효과 값 https://easings.net/ko# </param>
        /// <param name="speed">목표값 까지의 도달 속도</param>
        /// <param name="loopType">반복 유형 설정</param>
        /// <param name="loopTime">반복 횟수 (-1은 무한 반복)</param>
        /// <param name="amp">y값 증폭값</param>
        public static IEnumerator DoLocalRotate(this RectTransform rectTr, Vector3 value, Ease ease = Ease.OutQuad,
            float speed = 1f, LoopType loopType = LoopType.Yoyo, int loopTime = 1, float amp = 1f)
        {
            var origin = rectTr.localEulerAngles;
            var dir = value - origin;
            var curCount = 0;

            while (IsLoop(curCount++, loopTime))
            {
                var curTime = 0f;
                const float maxTime = 1f;

                while (curTime < maxTime)
                {
                    rectTr.localEulerAngles = origin + dir * BTweener.GetEvaluate(ease, curTime) * amp;

                    yield return null;
                    curTime += Time.deltaTime * speed;
                }


                switch (loopType)
                {
                    case LoopType.Restart:
                        rectTr.localEulerAngles = origin;
                        dir = value - origin;
                        break;
                    case LoopType.Yoyo:
                        rectTr.localEulerAngles = value;
                        Funcs.Swap(ref value, ref origin);
                        dir = value - origin;
                        break;
                    case LoopType.Incremental:
                    default:
                        rectTr.localEulerAngles = value;
                        origin = value;
                        value = dir + value;
                        dir = value - origin;
                        break;
                }
            }
        }

        /// <summary> 투명도 액팅 </summary>
        /// <param name="value">목표 값</param>
        /// <param name="ease">효과 값 https://easings.net/ko# </param>
        /// <param name="speed">목표값 까지의 도달 속도</param>
        /// <param name="loopType">반복 유형 설정</param>
        /// <param name="loopTime">반복 횟수 (-1은 무한 반복)</param>
        public static IEnumerator DoFade(this Graphic img, float value, Ease ease = Ease.OutQuad, float speed = 1f,
            LoopType loopType = LoopType.Yoyo, int loopTime = 1)
        {
            var origin = img.color.a;
            var dir = value - origin;
            var curCount = 0;

            while (IsLoop(curCount++, loopTime))
            {
                var curTime = 0f;
                const float maxTime = 1f;

                while (curTime < maxTime)
                {
                    img.color = new Color(img.color.r, img.color.g, img.color.b,
                        origin + dir * BTweener.GetEvaluate(ease, curTime));

                    yield return null;
                    curTime += Time.deltaTime * speed;
                }


                switch (loopType)
                {
                    case LoopType.Restart:
                        img.color = new Color(img.color.r, img.color.g, img.color.b, origin);
                        dir = value - origin;
                        break;
                    case LoopType.Yoyo:
                        img.color = new Color(img.color.r, img.color.g, img.color.b, value);
                        Funcs.Swap(ref value, ref origin);
                        dir = value - origin;
                        break;
                    case LoopType.Incremental: // Not Use
                    default:
                        img.color = new Color(img.color.r, img.color.g, img.color.b, value);
                        origin = value;
                        value = dir + value;
                        dir = value - origin;
                        break;
                }
            }
        }

        /// <summary> 투명도 액팅 </summary>
        /// <param name="value">목표 값</param>
        /// <param name="ease">효과 값 https://easings.net/ko# </param>
        /// <param name="speed">목표값 까지의 도달 속도</param>
        /// <param name="loopType">반복 유형 설정</param>
        /// <param name="loopTime">반복 횟수 (-1은 무한 반복)</param>
        public static IEnumerator DoFade(this Material mat, float value, Ease ease = Ease.OutQuad, float speed = 1f,
            LoopType loopType = LoopType.Yoyo, int loopTime = 1)
        {
            var origin = mat.color.a;
            var dir = value - origin;
            var curCount = 0;

            while (IsLoop(curCount++, loopTime))
            {
                var curTime = 0f;
                const float maxTime = 1f;

                while (curTime < maxTime)
                {
                    mat.color = new Color(mat.color.r, mat.color.g, mat.color.b,
                        origin + dir * BTweener.GetEvaluate(ease, curTime));

                    yield return null;
                    curTime += Time.deltaTime * speed;
                }


                switch (loopType)
                {
                    case LoopType.Restart:
                        mat.color = new Color(mat.color.r, mat.color.g, mat.color.b, origin);
                        dir = value - origin;
                        break;
                    case LoopType.Yoyo:
                        mat.color = new Color(mat.color.r, mat.color.g, mat.color.b, value);
                        Funcs.Swap(ref value, ref origin);
                        dir = value - origin;
                        break;
                    case LoopType.Incremental: // Not Use
                    default:
                        mat.color = new Color(mat.color.r, mat.color.g, mat.color.b, value);
                        origin = value;
                        value = dir + value;
                        dir = value - origin;
                        break;
                }
            }
        }

        /// <summary> 투명도 액팅 </summary>
        /// <param name="value">목표 값</param>
        /// <param name="ease">효과 값 https://easings.net/ko# </param>
        /// <param name="speed">목표값 까지의 도달 속도</param>
        /// <param name="loopType">반복 유형 설정</param>
        /// <param name="loopTime">반복 횟수 (-1은 무한 반복)</param>
        public static IEnumerator DoFade(this CanvasGroup cg, float value, Ease ease = Ease.OutQuad, float speed = 1f,
            LoopType loopType = LoopType.Yoyo, int loopTime = 1)
        {
            var origin = cg.alpha;
            var dir = value - origin;
            var curCount = 0;

            while (IsLoop(curCount++, loopTime))
            {
                var curTime = 0f;
                const float maxTime = 1f;

                while (curTime < maxTime)
                {
                    cg.alpha = origin + dir * BTweener.GetEvaluate(ease, curTime);

                    yield return null;
                    curTime += Time.deltaTime * speed;
                }


                switch (loopType)
                {
                    case LoopType.Restart:
                        cg.alpha = origin;
                        dir = value - origin;
                        break;
                    case LoopType.Yoyo:
                        cg.alpha = value;
                        Funcs.Swap(ref value, ref origin);
                        dir = value - origin;
                        break;
                    case LoopType.Incremental: // Not Use
                    default:
                        cg.alpha = value;
                        origin = value;
                        value = dir + value;
                        dir = value - origin;
                        break;
                }
            }
        }

        /// <summary> 오디오 볼륨 페이드 조절 </summary>
        /// <param name="value">목표 값</param>
        /// <param name="ease">효과 값 https://easings.net/ko# </param>
        /// <param name="speed">목표값 까지의 도달 속도</param>
        /// <param name="loopType">반복 유형 설정</param>
        /// <param name="loopTime">반복 횟수 (-1은 무한 반복)</param>
        public static IEnumerator DoFade(this AudioSource audio, float value, Ease ease = Ease.OutQuad,
            float speed = 1f, LoopType loopType = LoopType.Yoyo, int loopTime = 1)
        {
            var origin = audio.volume;
            var dir = value - origin;
            var curCount = 0;

            while (IsLoop(curCount++, loopTime))
            {
                var curTime = 0f;
                const float maxTime = 1f;

                while (curTime < maxTime)
                {
                    audio.volume = origin + dir * BTweener.GetEvaluate(ease, curTime);

                    yield return null;
                    curTime += Time.deltaTime * speed;
                }


                switch (loopType)
                {
                    case LoopType.Restart:
                        audio.volume = origin;
                        dir = value - origin;
                        break;
                    case LoopType.Yoyo:
                        audio.volume = value;
                        Funcs.Swap(ref value, ref origin);
                        dir = value - origin;
                        break;
                    case LoopType.Incremental: // Not Use
                    default:
                        audio.volume = value;
                        origin = value;
                        value = dir + value;
                        dir = value - origin;
                        break;
                }
            }
        }

        /// <summary> 비디오 볼륨 페이드 조절 </summary>
        /// <param name="value">목표 값</param>
        /// <param name="ease">효과 값 https://easings.net/ko# </param>
        /// <param name="speed">목표값 까지의 도달 속도</param>
        /// <param name="loopType">반복 유형 설정</param>
        /// <param name="loopTime">반복 횟수 (-1은 무한 반복)</param>
        public static IEnumerator DoFade(this VideoPlayer video, float value, Ease ease = Ease.OutQuad,
            float speed = 1f, LoopType loopType = LoopType.Yoyo, int loopTime = 1)
        {
            var origin = video.GetDirectAudioVolume(0);
            var dir = value - origin;
            var curCount = 0;

            while (IsLoop(curCount++, loopTime))
            {
                var curTime = 0f;
                const float maxTime = 1f;

                while (curTime < maxTime)
                {
                    video.SetDirectAudioVolume(0, origin + dir * BTweener.GetEvaluate(ease, curTime));

                    yield return null;
                    curTime += Time.deltaTime * speed;
                }


                switch (loopType)
                {
                    case LoopType.Restart:
                        video.SetDirectAudioVolume(0, origin);
                        dir = value - origin;
                        break;
                    case LoopType.Yoyo:
                        video.SetDirectAudioVolume(0, value);
                        Funcs.Swap(ref value, ref origin);
                        dir = value - origin;
                        break;
                    case LoopType.Incremental: // Not Use
                    default:
                        video.SetDirectAudioVolume(0, value);
                        origin = value;
                        value = dir + value;
                        dir = value - origin;
                        break;
                }
            }
        }

        /// <summary> 채우기 액팅 (Img Type은 무조건 Filled여야함) </summary>
        /// <param name="value">목표 값</param>
        /// <param name="ease">효과 값 https://easings.net/ko# </param>
        /// <param name="speed">목표값 까지의 도달 속도</param>
        /// <param name="loopType">반복 유형 설정</param>
        /// <param name="loopTime">반복 횟수 (-1은 무한 반복)</param>
        /// <param name="amp">y값 증폭값</param>
        public static IEnumerator DoFillAmount(this Image img, float value, Ease ease = Ease.OutQuad, float speed = 1f,
            LoopType loopType = LoopType.Yoyo, int loopTime = 1)
        {
            if (img.type != Image.Type.Filled)
            {
                // 여기서 임의로 설정할 순 없기 때문
                Funcs.WriteLineError("Error Img Type", 12);
                yield break;
            }

            var origin = img.fillAmount;
            var dir = value - origin;
            var curCount = 0;

            while (IsLoop(curCount++, loopTime))
            {
                var curTime = 0f;
                const float maxTime = 1f;

                while (curTime < maxTime)
                {
                    img.fillAmount = origin + dir * BTweener.GetEvaluate(ease, curTime);

                    yield return null;
                    curTime += Time.deltaTime * speed;
                }


                switch (loopType)
                {
                    case LoopType.Restart:
                        img.fillAmount = origin;
                        dir = value - origin;
                        break;
                    case LoopType.Yoyo:
                        img.fillAmount = value;
                        Funcs.Swap(ref value, ref origin);
                        dir = value - origin;
                        break;
                    case LoopType.Incremental:
                    default:
                        img.fillAmount = value;
                        origin = value;
                        value = dir + value;
                        dir = value - origin;
                        break;
                }
            }
        }

        /// <summary> 투명도 액팅 </summary>
        /// <param name="value">목표 값</param>
        /// <param name="ease">효과 값 https://easings.net/ko# </param>
        /// <param name="speed">목표값 까지의 도달 속도</param>
        /// <param name="loopType">반복 유형 설정</param>
        /// <param name="loopTime">반복 횟수 (-1은 무한 반복)</param>
        public static IEnumerator DoColor(this Material mat, Color value, Ease ease = Ease.OutQuad, float speed = 1f,
            LoopType loopType = LoopType.Yoyo, int loopTime = 1)
        {
            var origin = mat.color;
            var dir = value - origin;
            var curCount = 0;

            while (IsLoop(curCount++, loopTime))
            {
                var curTime = 0f;
                const float maxTime = 1f;

                while (curTime < maxTime)
                {
                    mat.color = origin + dir * BTweener.GetEvaluate(ease, curTime);

                    yield return null;
                    curTime += Time.deltaTime * speed;
                }

                switch (loopType)
                {
                    case LoopType.Restart:
                        mat.color = origin;
                        dir = value - origin;
                        break;
                    case LoopType.Yoyo:
                        mat.color = value;
                        Funcs.Swap(ref value, ref origin);
                        dir = value - origin;
                        break;
                    case LoopType.Incremental:
                    default:
                        mat.color = value;
                        origin = value;
                        value = dir + value;
                        dir = value - origin;
                        break;
                }
            }
        }

        /// <summary> 이미지 칼라 액팅 </summary>
        /// <param name="value">목표 값</param>
        /// <param name="ease">효과 값 https://easings.net/ko# </param>
        /// <param name="speed">목표값 까지의 도달 속도</param>
        /// <param name="loopType">반복 유형 설정</param>
        /// <param name="loopTime">반복 횟수 (-1은 무한 반복)</param>
        public static IEnumerator DoColor(this Graphic img, Color value, Ease ease = Ease.OutQuad, float speed = 1f,
            LoopType loopType = LoopType.Yoyo, int loopTime = 1)
        {
            var origin = img.color;
            var dir = value - origin;
            var curCount = 0;

            while (IsLoop(curCount++, loopTime))
            {
                var curTime = 0f;
                const float maxTime = 1f;

                while (curTime < maxTime)
                {
                    img.color = origin + dir * BTweener.GetEvaluate(ease, curTime);

                    yield return null;
                    curTime += Time.deltaTime * speed;
                }


                switch (loopType)
                {
                    case LoopType.Restart:
                        img.color = origin;
                        dir = value - origin;
                        break;
                    case LoopType.Yoyo:
                        img.color = value;
                        Funcs.Swap(ref value, ref origin);
                        dir = value - origin;
                        break;
                    case LoopType.Incremental:
                    default:
                        img.color = value;
                        origin = value;
                        value = dir + value;
                        dir = value - origin;
                        break;
                }
            }
        }

        /// <summary> 셰이더 FLOAT 값 액팅 </summary>
        public static IEnumerator MatFloatValue(this Material mat, string _propertyName, float value,
            Ease ease = Ease.OutQuad,
            float speed = 1f, LoopType loopType = LoopType.Yoyo, int loopTime = 1)
        {
            var origin = mat.GetFloat(_propertyName);
            var dir = value - origin;
            var curCount = 0;

            while (IsLoop(curCount++, loopTime))
            {
                var curTime = 0f;
                const float maxTime = 1f;

                while (curTime < maxTime)
                {
                    mat.SetFloat(_propertyName, origin + dir * BTweener.GetEvaluate(ease, curTime));

                    yield return null;
                    curTime += Time.deltaTime * speed;
                }

                switch (loopType)
                {
                    case LoopType.Restart:
                        mat.SetFloat(_propertyName, origin);
                        dir = value - origin;
                        break;
                    case LoopType.Yoyo:
                        mat.SetFloat(_propertyName, value);
                        Funcs.Swap(ref value, ref origin);
                        dir = value - origin;
                        break;
                    case LoopType.Incremental:
                    default:
                        mat.SetFloat(_propertyName, value);
                        origin = value;
                        value = dir + value;
                        dir = value - origin;
                        break;
                }
            }
        }

        private static bool IsLoop(int curCount, int maxCount)
        {
            if (maxCount == -1)
                return true;

            return curCount < maxCount;
        }
    }

    public struct Funcs
    {
        // 세번째 숫자마다 , 찍어서 반환
        public static string GetMoneyForm(int money)
        {
            var str = money.ToString();
            var chArr = str.ToCharArray();

            if (chArr.Length < 4)
                return str;

            var index = 0;
            str = "";
            for (var i = chArr.Length - 1; i >= 0; i--)
            {
                if (index % 4 == 3)
                {
                    index = 0;
                    str += ',';
                }

                str += chArr[i];
                index++;
            }

            chArr = str.ToCharArray();
            System.Array.Reverse(chArr);
            return new string(chArr);
        }

        public static void Swap<T>(ref T a, ref T b)
        {
            (a, b) = (b, a);
        }

        /// <summary>00:00표기로 분,초 표기</summary>
        public static string GetTime(int second)
        {
            return $"{second / 60:00}:{second % 60:00}";
        }

        /// <summary> 입력 숫자 분의 1 확률로 true 반환 </summary>
        /// <param name="n"> 높을 수록 희박하다 </param>
        public static bool Probability(int n)
        {
            if (n <= 0)
                return false;

            return Random.Range(0, n) == 0;
        }

        /// <summary> n% 확률로 true 반환 </summary>
        /// <param name="n"> 무조건 1~100 사이값 입력 </param>
        public static bool Percent(int n)
        {
            if (n < 0 || n > 100)
                return false;

            var percent = new bool[100];
            for (var i = 0; i < 100; i++)
            {
                if (i < n)
                    percent[i] = true;
                else
                    percent[i] = false;
            }

            return percent[Random.Range(0, 100)];
        }

        /// <summary> 현재 애니메이션이 time만큼 흘러갔는가? (0~1) </summary>
        /// <param name="animator">무슨 애니메이션인가?</param>
        /// <param name="name">진행할 애니메이션의 상태 이름은 무엇인가?</param>
        /// <param name="time">얼마나 흐른 후 true를 반환하길 원하는가? (0~1, 시간 무관, 비율로 계산)</param>
        public static bool IsAnimDone(Animator animator, string name, float time)
        {
            return animator.GetCurrentAnimatorStateInfo(0).IsName(name) &&
                   animator.GetCurrentAnimatorStateInfo(0).normalizedTime >= time;
        }

        /// <summary>배열 멤버 중 랜덤으로 하나를 반환한다.</summary>
        public static T GetRandomMember<T>(T[] array)
        {
            return array[Random.Range(0, array.Length)];
        }

        /// <summary>리스트 멤버 중 랜덤으로 하나를 반환한다.</summary>
        public static T GetRandomMember<T>(List<T> list)
        {
            return list[Random.Range(0, list.Count)];
        }

        /// <summary>내부 멤버들의 정렬을 바꿔준다.</summary>
        public static void ResortList<T>(ref T[] arr, int[] indexList)
        {
            var len = arr.Length;
            if (indexList.Length != arr.Length)
            {
                WriteLineError("Length Error", 16);
                return;
            }

            var tmp = (T[]) arr.Clone();


            for (var i = 0; i < len; i++)
            {
                arr[i] = tmp[indexList[i]];
            }
        }

        /// <param name="length">배열 총 길이</param>
        public static int[] GetRandomIntArr(int length)
        {
            var randArr = Enumerable.Range(0, length).ToArray();

            for (var i = 0; i < length; ++i)
            {
                var index = Random.Range(i, length);
                (randArr[index], randArr[i]) = (randArr[i], randArr[index]);
            }

            return randArr;
        }

        /// <summary> 퀵 정렬 </summary>
        /// <param name="array">array</param>
        /// <param name="p">0</param>
        /// <param name="r">array.Length - 1</param>
        public static void QuickSort(int[] array, int p, int r)
        {
            // Quick Sort
            if (p < r)
            {
                var q = Partition(array, p, r);
                QuickSort(array, p, q - 1);
                QuickSort(array, q + 1, r);
            }

            // Partition
            int Partition(int[] _array, int _p, int _r)
            {
                var q = _p;
                for (var j = _p; j < _r; j++)
                {
                    if (_array[j] > array[_r]) continue;
                    Swap(ref _array[q], ref _array[j]);
                    q++;
                }

                Swap(ref _array[q], ref _array[_r]);
                return q;
            }
        }

        /// <param name="list">섞을 리스트 변수, ref로 넘겨줄 것 (사실 안그래도 됨)</param>
        public static void ShuffleList<T>(ref List<T> list)
        {
            for (var i = 0; i < list.Count; ++i)
            {
                var random1 = Random.Range(0, list.Count);
                var random2 = Random.Range(0, list.Count);

                (list[random1], list[random2]) = (list[random2], list[random1]);
            }
        }

        /// <param name="array">섞을 배열 변수, ref로 넘겨줄 것</param>
        public static void ShuffleArray<T>(ref T[] array)
        {
            for (var index = 0; index < array.Length; ++index)
            {
                var random1 = Random.Range(0, array.Length);
                var random2 = Random.Range(0, array.Length);

                (array[random1], array[random2]) = (array[random2], array[random1]);
            }
        }

        /// <summary> 최대 공약수, 순서 상관 없음 </summary>
        /// <param name="a">숫자 1</param>
        /// <param name="b">숫자 2</param>
        /// <returns></returns>
        public static int GetGCD(int a, int b)
        {
            if (a == 0 || b == 0)
                return 0;

            if (b > a)
            {
                (a, b) = (b, a);
            }

            return (a % b == 0 ? b : GetGCD(b, a % b));
        }

        /// <summary> 약수 리스트 반환 </summary>
        /// <param name="n">정수 입력</param>
        public static List<int> GetDivisors(int n)
        {
            var divisors = new List<int>();
            for (var i = 1; i <= n; i++)
            {
                if (n % i == 0)
                {
                    divisors.Add(i);
                }
            }

            return divisors;
        }

        /// <summary> 약수의 개수 구하기 </summary>
        /// <param name="n"> 자연수 입력 </param>
        public static int GetNumDivisors(int n)
        {
            var sum = 0;
            for (var i = 1; i <= Mathf.Sqrt(n); i++)
            {
                if (n % i != 0) continue;
                if (n / i == i)
                    sum++;
                else
                    sum += 2;
            }

            return sum;
        }

        /// <summary> 일정 수 이하의 소수 출력 </summary>
        /// <param name="max"></param>
        public static IEnumerable<long> GetPrimeNumbers(long max)
        {
            var primeNumbers = new List<long>();
            var isprime = new bool[max + 5];

            for (var i = 2; i <= max; i++)
                isprime[i] = true;

            for (var i = 2; i <= max; i++)
            {
                if (!isprime[i]) continue;
                for (var j = i * i; j <= max; j += i)
                    isprime[j] = false;
            }

            for (var i = 2; i <= max; i++)
            {
                if (isprime[i] == true)
                    primeNumbers.Add(i);
            }

            return primeNumbers;
        }

        /// <summary> 기약 분수인지 확인, 뒤에 두개는 무조건 기약분수로 들어와야 함 </summary>
        /// <param name="bottom"></param>
        /// <param name="top"></param>
        /// <param name="answerBottom"></param>
        /// <param name="answerTop"></param>
        public static bool IsIrreducibleFraction(int bottom, int top, int answerBottom, int answerTop)
        {
            // 적어도 정답보단 커야해
            if ((bottom <= answerBottom) || (top <= answerTop))
                return true;

            var bottomPortion = bottom / answerBottom; // 2
            var topPortion = top / answerTop;

            if ((bottomPortion == 1) && (topPortion == 1))
                return true;

            // 둘다 같은 배수를 갖고 있다면, -> 이게 포인트
            return bottomPortion != topPortion;
        }

        /// <summary> 콘솔창에 글자 띄우기 \n </summary>
        /// <param name="_message">문자열</param>
        /// <param name="_size">폰트 크기</param>
        public static void WriteLine(object _message, int _size = 18)
        {
#if UNITY_EDITOR
            Debug.Log("<size=" + _size + ">" + "<color=black>" + _message + "</color></size>\n");
#endif
        }

        /// <summary> 콘솔창에 글자 띄우기 \n </summary>
        /// <param name="_message">문자열</param>
        /// <param name="_size">폰트 크기</param>
        public static void WriteLineError(object _message, int _size = 18)
        {
#if UNITY_EDITOR
            Debug.LogError("<size=" + _size + ">" + "<color=black>" + _message + "</color></size>\n");
#endif
        }
    }
}