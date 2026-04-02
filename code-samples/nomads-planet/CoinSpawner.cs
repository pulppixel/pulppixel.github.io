using UnityEngine;
using Unity.Netcode;

namespace NomadsPlanet
{
    public class CoinSpawner : NetworkBehaviour
    {
        // Coin Settings
        [SerializeField] private RespawningCoin coinPrefab;
        [SerializeField] private int maxCoins = 50;
        [SerializeField] private int coinValue = 10;

        // Spawn Range
        [SerializeField] private Vector2 xSpawnRange;
        [SerializeField] private Vector2 zSpawnRange;

        private const float CoinYPosition = 1.5f;
        private readonly Collider[] _coinBuffer = new Collider[1];
        private Vector3 _coinSize;

        public override void OnNetworkSpawn()
        {
            // 서버에서만 코인을 생성할 수 있도록 한다.
            if (!IsServer)
            {
                return;
            }

            _coinSize = coinPrefab.GetComponent<BoxCollider>().size;

            for (int i = 0; i < maxCoins; i++)
            {
                SpawnCoin();
            }
        }

        /// <summary>
        /// 유효한 위치에 코인을 하나 생성한다.
        /// </summary>
        private void SpawnCoin()
        {
            RespawningCoin coinInstance = Instantiate(
                coinPrefab,
                GetSpawnPoint(),
                Quaternion.identity);

            coinInstance.SetValue(coinValue);
            coinInstance.GetComponent<NetworkObject>().Spawn();
            coinInstance.transform.SetParent(this.transform);

            coinInstance.OnCollected += HandleCoinCollected;
        }

        /// <summary>
        /// 누군가 코인을 얻었을 경우, 다른 위치로 이동시킨다. (코인량 보존) 
        /// </summary>
        /// <param name="coin">수집된 코인</param>
        private void HandleCoinCollected(RespawningCoin coin)
        {
            coin.transform.position = GetSpawnPoint();
            coin.Reset();
        }

        /// <summary>
        /// 코인의 생성 위치를 결정한다.
        /// </summary>
        /// <returns>생성 위치 반환</returns>
        private Vector3 GetSpawnPoint()
        {
            float x = Random.Range(xSpawnRange.x, xSpawnRange.y);
            float z = Random.Range(zSpawnRange.x, zSpawnRange.y);

            Vector3 spawnPoint = new Vector3(x, CoinYPosition, z);
            return IsSpawnPointFree(spawnPoint) ? spawnPoint : GetSpawnPoint();
        }

        /// <summary>
        /// 생성 위치가 다른 누군가와 겹치지는 않는지 검사한다.
        /// </summary>
        /// <param name="spawnPoint">확인할 곳의 위치 좌표</param>
        /// <returns>위치가 겹치지 않으면 true, 겹치면!! false</returns>
        private bool IsSpawnPointFree(Vector3 spawnPoint)
        {
            int numColliders = Physics.OverlapBoxNonAlloc(spawnPoint, _coinSize, _coinBuffer);

            return numColliders == 0;
        }
    }
}