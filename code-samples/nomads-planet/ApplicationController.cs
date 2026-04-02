using UnityEngine;
using Unity.Netcode;
using System.Threading.Tasks;

#if UNITY_ANDROID || UNITY_IOS
#else
using System.Collections;
using NomadsPlanet.Utils;
using UnityEngine.SceneManagement;
#endif

namespace NomadsPlanet
{
    public class ApplicationController : MonoBehaviour
    {
        [SerializeField] private ClientSingleton clientPrefab;
        [SerializeField] private HostSingleton hostPrefab;
        [SerializeField] private NetworkObject playerPrefab;

#if UNITY_ANDROID || UNITY_IOS
#else
        [SerializeField] private ServerSingleton serverPrefab;
#endif

        private ApplicationData _appData;

        private async void Start()
        {
            DontDestroyOnLoad(gameObject);

            await LaunchInMode(SystemInfo.graphicsDeviceType == UnityEngine.Rendering.GraphicsDeviceType.Null);
        }

        private async Task LaunchInMode(bool isDedicatedServer)
        {
            if (isDedicatedServer)
            {
                Application.targetFrameRate = 60;

                _appData = new ApplicationData();

#if UNITY_ANDROID || UNITY_IOS
#else
                ServerSingleton serverSingleton = Instantiate(serverPrefab);
                StartCoroutine(LoadGameSceneAsync(serverSingleton));
#endif
            }
            else
            {
                HostSingleton hostSingleton = Instantiate(hostPrefab);
                hostSingleton.CreateHost(playerPrefab);

                ClientSingleton clientSingleton = Instantiate(clientPrefab);
                bool authenticated = await clientSingleton.CreateClient();

                if (authenticated)
                {
                    ClientGameManager.GoToMenu();
                }
            }
        }

#if UNITY_ANDROID || UNITY_IOS
#else
        private IEnumerator LoadGameSceneAsync(ServerSingleton serverSingleton)
        {
            AsyncOperation asyncOperation = SceneManager.LoadSceneAsync(SceneName.GameScene);

            while (!asyncOperation.isDone)
            {
                yield return null;
            }

            Task createServerTask = serverSingleton.CreateServer(playerPrefab);
            yield return new WaitUntil(() => createServerTask.IsCompleted);

            Task startServerTask = serverSingleton.GameManager.StartGameServerAsync();
            yield return new WaitUntil(() => startServerTask.IsCompleted);
        }
#endif
    }
}