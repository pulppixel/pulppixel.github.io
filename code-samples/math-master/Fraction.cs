using System.Linq;
using UnityEngine;

namespace Expantion_Fraction
{
    #region Enums

    public enum FSort
    {
        /// <summary> 대분수 </summary>
        Mixed,

        /// <summary> 진분수 </summary>
        Proper,

        /// <summary> 자연수 </summary>
        Natural
    };

    #endregion

    /// <summary> 분수 기본 </summary>.
    [System.Serializable]
    public struct Fraction : System.IEquatable<Fraction>
    {
        /// <summary> 분수의 자연수 부분 </summary>
        public int natural { get; }

        /// <summary> 분수의 분모 부분 </summary>
        public int bottom { get; }

        /// <summary> 분수의 분자 부분 </summary>
        public int top { get; }

        /// <summary> 가분수일 때의 분자 부분 </summary>
        /// improper_top => bottom * natural + top;
        public int improper_top { get; }

        /// <summary> 분수 유형 </summary>
        public FSort sort { get; }

        public static Fraction one => new Fraction(0, 1, 1);

        /// <summary> 분수 기본 (되도록 기약분수로 입력) </summary>
        /// <param name="_natural"> 자연수 부분 입력 (진분수일 시 0 입력) </param>
        /// <param name="_bottom"> 분모 부분 입력 (1보단 크게) </param>
        /// <param name="_top"> 분자 부분 입력 </param>
        public Fraction(int _natural, int _bottom, int _top)
        {
            this.natural = _natural;
            this.bottom = _bottom;
            this.top = _top;

            if (bottom == 0)
            {
                Debug.LogError($"{top}/{bottom} Fraction Input Error!!");
            }

            // 가분수거나 자연수라면
            if (top >= bottom)
            {
                natural += top / bottom;
                top %= bottom;
            }

            // 기약분수 확인 생략 (약분 가능한 분수도 분수이긴 함)
            improper_top = bottom * natural + top;

            // 분수 종류 얻기
            if ((natural == 0) && (top > 0) && (bottom > 1))
                sort = FSort.Proper;
            else if ((natural != 0) && (top == 0))
                sort = FSort.Natural;
            else
                sort = FSort.Mixed;
        }

        /// <summary> 분수 기본 (되도록 기약분수로 입력) </summary>
        /// <param name="_natural"> 자연수 부분 입력 (진분수일 시 0 입력) </param>
        /// <param name="_bottom"> 분모 부분 입력 (1보단 크게) </param>
        /// <param name="_top"> 분자 부분 입력 </param>
        public Fraction(int _natural, int _bottom, int _top, FSort _sort)
        {
            this.natural = _natural;
            this.bottom = _bottom;
            this.top = _top;
            this.sort = _sort;

            if (bottom == 0)
            {
                Debug.LogError($"{top}/{bottom} Fraction Input Error!!");
            }

            // 가분수거나 자연수라면
            if (top >= bottom)
            {
                natural += top / bottom;
                top %= bottom;

                // 분수 종류 얻기
                if ((natural == 0) && (top > 0) && (bottom > 1))
                    sort = FSort.Proper;
                else if ((natural != 0) && (top == 0))
                    sort = FSort.Natural;
                else
                    sort = FSort.Mixed;
            }

            improper_top = bottom * natural + top;
        }

        /// <summary> 분수와 자연수의 곱셈 </summary>
        public static Fraction operator *(Fraction f1, int n)
        {
            var bottom = f1.bottom;
            var top = f1.improper_top * n;
            var gcd = GetGCD(bottom, top);

            bottom /= gcd;
            top /= gcd;

            return new Fraction(top / bottom, bottom, top % bottom);
        }

        public static Fraction operator *(int n, Fraction f1)
        {
            var bottom = f1.bottom;
            var top = f1.improper_top * n;
            var gcd = GetGCD(bottom, top);

            bottom /= gcd;
            top /= gcd;

            return new Fraction(top / bottom, bottom, top % bottom);
        }

        /// <summary> 분수와 분수의 곱셈 </summary>
        public static Fraction operator *(Fraction f1, Fraction f2)
        {
            var bottom = f1.bottom * f2.bottom;
            var top = f1.improper_top * f2.improper_top;
            var gcd = GetGCD(bottom, top);

            bottom /= gcd;
            top /= gcd;

            return new Fraction(top / bottom, bottom, top % bottom);
        }

        /// <summary> 분수와 분수의 덧셈 </summary>
        public static Fraction operator +(Fraction f1, Fraction f2)
        {
            var bottom = f1.bottom * f2.bottom;
            var top = (f1.improper_top * f2.bottom) + (f2.improper_top * f1.bottom);
            var gcd = GetGCD(bottom, top);

            bottom /= gcd;
            top /= gcd;

            return new Fraction(top / bottom, bottom, top % bottom);
        }

        /// <summary> 분수와 분수의 뺄셈 (음수 가능) </summary>
        public static Fraction operator -(Fraction f1, Fraction f2)
        {
            var bottom = f1.bottom * f2.bottom;
            var top = (f1.improper_top * f2.bottom) - (f2.improper_top * f1.bottom);

            var isMinus = top < 0;
            top = isMinus ? Mathf.Abs(top) : top;
            var gcd = GetGCD(bottom, top);

            bottom /= gcd;
            top /= gcd;

            return new Fraction((top / bottom) * (isMinus ? -1 : 1), bottom, top % bottom);
        }

        /// <summary> 분수와 분수의 나눗셈 </summary>
        public static Fraction operator /(Fraction f1, Fraction f2)
        {
            var bottom = f1.bottom * f2.improper_top;
            var top = f1.improper_top * f2.bottom;
            var gcd = GetGCD(bottom, top);

            bottom /= gcd;
            top /= gcd;

            return new Fraction(top / bottom, bottom, top % bottom);
        }

        public static Fraction operator /(Fraction f1, int n)
        {
            var bottom = f1.bottom * n;
            var top = f1.improper_top;
            var gcd = GetGCD(bottom, top);

            bottom /= gcd;
            top /= gcd;

            return new Fraction(top / bottom, bottom, top % bottom);
        }

        public static bool operator ==(Fraction f1, Fraction f2)
        {
            return f1.Equals(f2);
        }

        public static bool operator !=(Fraction f1, Fraction f2)
        {
            return !f1.Equals(f2);
        }

        public static bool operator <(Fraction f1, Fraction f2)
        {
            var top1 = f1.improper_top * f2.bottom;
            var top2 = f2.improper_top * f1.bottom;

            return top1 < top2;
        }

        public static bool operator >(Fraction f1, Fraction f2)
        {
            var top1 = f1.improper_top * f2.bottom;
            var top2 = f2.improper_top * f1.bottom;

            return top1 > top2;
        }

        public static bool operator <=(Fraction f1, Fraction f2)
        {
            var top1 = f1.improper_top * f2.bottom;
            var top2 = f2.improper_top * f1.bottom;

            return top1 <= top2;
        }

        public static bool operator >=(Fraction f1, Fraction f2)
        {
            var top1 = f1.improper_top * f2.bottom;
            var top2 = f2.improper_top * f1.bottom;

            return top1 >= top2;
        }

        public static Fraction Max(Fraction f1, Fraction f2)
        {
            var t1 = f1.improper_top * f2.bottom;
            var t2 = f2.improper_top * f1.bottom;

            return t1 == Mathf.Max(t1, t2) ? f1 : f2;
        }

        public static Fraction Max(params Fraction[] fs)
        {
            var ab = 1;
            foreach (var b in fs)
            {
                ab *= b.bottom;
            }

            var arr = new int[fs.Length];
            for (var i = 0; i < fs.Length; i++)
            {
                arr[i] = fs[i].improper_top * ab / fs[i].bottom;
            }

            var max = Mathf.Max(arr);

            for (var i = 0; i < fs.Length; i++)
            {
                if (arr[i] == max)
                {
                    return fs[i];
                }
            }

            Debug.LogError("Null");
            return new Fraction();
        }

        public static Fraction Min(Fraction f1, Fraction f2)
        {
            var t1 = f1.improper_top * f2.bottom;
            var t2 = f2.improper_top * f1.bottom;

            return t1 == Mathf.Min(t1, t2) ? f1 : f2;
        }

        public static Fraction Min(params Fraction[] fs)
        {
            var ab = fs.Aggregate(1, (current, b) => current * b.bottom);
            var arr = new int[fs.Length];
            for (var i = 0; i < fs.Length; i++)
            {
                arr[i] = fs[i].improper_top * ab / fs[i].bottom;
            }

            var min = Mathf.Min(arr);

            for (var i = 0; i < fs.Length; i++)
            {
                if (arr[i] == min)
                {
                    return fs[i];
                }
            }

            Debug.LogError("Null");
            return new Fraction();
        }

        public bool Equals(Fraction f1)
        {
            return (f1.top == this.top) && (f1.bottom == this.bottom) && (f1.natural == this.natural);
        }

        /// <summary> true면 약분 가능, false면 약분 불가능 </summary>
        public static bool IsReducible(int i1, int i2)
        {
            return GetGCD(i1, i2) != 1;
        }

        /// <summary> true면 약분 가능, false면 기약분수 </summary>
        public static bool IsReducible(Fraction f1)
        {
            return GetGCD(f1.bottom, f1.top) != 1;
        }

        /// <summary> True-> 잘못 입력, 정답, 오답 등, False-> 기약분수 액팅 </summary>
        /// <param name="input">입력 분수</param>
        /// <param name="answer">답안 분수</param>
        public static bool IsReducible(Fraction input, Fraction answer)
        {
            // 자연수 부분이 다르다면 오답이야
            if (input.natural != answer.natural)
                return false;

            // 둘이 같으면 정답이야.
            if (input.Equals(answer))
                return true;

            var b = input.bottom / answer.bottom;
            var t = input.top / answer.top;

            if ((b == 1) && (t == 1))
                return true;

            return b != t;
        }

        /// <summary> True-> 잘못 입력, 오답 등, False-> 기약분수 액팅 </summary>
        /// <param name="bottom">입력한 분모 입력</param>
        /// <param name="top">입력한 분자 입력</param>
        /// <param name="answer">*정답 분수 입력</param>
        public static bool IsReducible(int bottom, int top, Fraction answer)
        {
            // 적어도 정답보단 커야해
            if ((bottom <= answer.bottom) || (top <= answer.top))
                return true;

            var bottomPortion = bottom / answer.bottom; // 2
            var topPortion = top / answer.top;

            if ((bottomPortion == 1) && (topPortion == 1))
                return true;

            // 둘다 같은 배수를 갖고 있다면,
            return bottomPortion != topPortion;
        }

        /// <summary> 약분된 분수 반환 </summary>
        /// <param name="f1"></param>
        public static Fraction Reduce(Fraction f1)
        {
            var gcd = GetGCD(f1.bottom, f1.improper_top);
            var bottom = f1.bottom / gcd;
            var top = f1.improper_top / gcd;

            return new Fraction(top / bottom, bottom, top % bottom);
        }

        /// <summary> 최대공약수 공식 (입력 순서 상관 x) </summary>
        public static int GetGCD(int a, int b)
        {
            if (a == 0 || b == 0)
                return 0;

            if (b > a)
            {
                (a, b) = (b, a);
            }

            return a % b == 0 ? b : GetGCD(b, a % b);
        }

        /// <summary> 최소 공배수 공식 (입력 순서 상관 x) </summary>
        public static int GetLCM(int a, int b)
        {
            if (a == 0 || b == 0)
                return 0;

            return Mathf.Abs(a * b) / GetGCD(a, b);
        }

        public override int GetHashCode()
        {
            // ReSharper disable once BaseObjectGetHashCodeCallInGetHashCode
            return base.GetHashCode();
        }

        public override string ToString()
        {
            switch (this.sort)
            {
                case FSort.Mixed:
                    return $"({natural} {top}/{bottom})";
                case FSort.Proper:
                    return $"({top}/{bottom})";
                case FSort.Natural:
                    return $"({natural})";
                default:
                    return "";
            }
        }

        public string ImproperToString()
        {
            switch (this.sort)
            {
                case FSort.Mixed:
                    return $"({improper_top}/{bottom})";
                case FSort.Proper:
                    return $"({top}/{bottom})";
                case FSort.Natural:
                    return $"({natural})";
                default:
                    return "";
            }
        }
    }
}