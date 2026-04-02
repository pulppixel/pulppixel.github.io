using Unity.Netcode;

namespace NomadsPlanet
{
    public abstract class Coin : NetworkBehaviour
    {
        protected int coinValue = 10;
        protected bool alreadyCollected;

        public abstract int Collect();

        public void SetValue(int value)
        {
            coinValue = value;
        }

        protected void Show(bool show)
        {
            gameObject.SetActive(show);
        }
    }
}