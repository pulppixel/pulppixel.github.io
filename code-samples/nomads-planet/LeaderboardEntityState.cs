using System;
using NomadsPlanet.Utils;
using Unity.Collections;
using Unity.Netcode;

namespace NomadsPlanet
{
    public struct LeaderboardEntityState : INetworkSerializable, IEquatable<LeaderboardEntityState>
    {
        public ulong ClientId;
        public FixedString32Bytes PlayerName;
        public int CharacterType;
        public int Coins;

        public void NetworkSerialize<T>(BufferSerializer<T> serializer) where T : IReaderWriter
        {
            serializer.SerializeValue(ref ClientId);
            serializer.SerializeValue(ref PlayerName);
            serializer.SerializeValue(ref CharacterType);
            serializer.SerializeValue(ref Coins);
        }

        public bool Equals(LeaderboardEntityState other)
        {
            return ClientId == other.ClientId &&
                   PlayerName.Equals(other.PlayerName) &&
                   CharacterType == other.CharacterType &&
                   Coins == other.Coins;
        }
    }
}