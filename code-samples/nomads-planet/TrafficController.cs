using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using NomadsPlanet.Utils;
using LightType = NomadsPlanet.Utils.LightType;

namespace NomadsPlanet
{
    public class TrafficController : MonoBehaviour
    {
        private const int SignDuration = 10;

        private List<TrafficFlow> _trafficFlows = new(4);

        private void Awake()
        {
            _trafficFlows = GetComponentsInChildren<TrafficFlow>().ToList();
            _trafficFlows.ShuffleList();
        }

        private void Start()
        {
            foreach (var flow in _trafficFlows)
            {
                flow.SetLightAction(LightType.Red);
            }

            StartCoroutine(TrafficCycle());
        }

        // 하나의 신호가 초록불일 때, 나머지는 빨간불 유지
        // 초록 -> 노랑 -> 빨강
        private IEnumerator TrafficCycle()
        {
            while (gameObject)
            {
                int duration = Random.Range(SignDuration, SignDuration + 5);

                foreach (var flow in _trafficFlows)
                {
                    yield return StartCoroutine(ChangeLightTo(flow, LightType.Green, duration));
                    yield return StartCoroutine(ChangeLightTo(flow, LightType.Yellow, 3));

                    SetAllLightsTo(LightType.Red);
                }
            }
        }

        private void SetAllLightsTo(LightType lightType)
        {
            foreach (var flow in _trafficFlows)
            {
                flow.SetLightAction(lightType);
            }
        }

        private static IEnumerator ChangeLightTo(TrafficFlow trafficFlow, LightType lightType, int duration)
        {
            trafficFlow.SetLightAction(lightType);
            yield return new WaitForSeconds(duration);
        }
    }
}