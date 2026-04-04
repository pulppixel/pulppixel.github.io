using System;
using System.Collections.Generic;
using R3;
using REIW.Communication;

namespace REIW
{
    #region User Info

    /// <summary>
    /// Tencent IM 유저 정보 DTO
    /// </summary>
    [Serializable]
    public class TUserInfo : IEquatable<TUserInfo>
    {
        public ulong Id;
        public string Nick;
        public int Level;
        public uint Icon;
        public uint Frame;
        public string OfflineTime;

        public OnlineStatusType GetOnlineType() => OfflineTime is "Online" ? OnlineStatusType.Online : OnlineStatusType.Offline;

        public static TUserInfo GetCurrentData()
        {
            var userDto = UserDataModel.Singleton.PlayerInfoData;
            return new TUserInfo
            {
                Id = userDto.DatabaseID,
                Nick = userDto.NickName,
                Level = 1,
                Icon = userDto.ProfileData.Icon,
                Frame = userDto.ProfileData.IconFrame,
                OfflineTime = "Online",
            };
        }

        public bool Equals(TUserInfo other)
        {
            if (other is null) return false;
            if (ReferenceEquals(this, other)) return true;
            return Id == other.Id && Nick == other.Nick && Level == other.Level &&
                   Icon == other.Icon && Frame == other.Frame;
        }

        public override bool Equals(object obj)
        {
            if (obj is null) return false;
            if (ReferenceEquals(this, obj)) return true;
            if (obj.GetType() != GetType()) return false;
            return Equals((TUserInfo)obj);
        }

        public override int GetHashCode() => HashCode.Combine(Id, Nick, Level, Icon, Frame);
    }

    [Serializable]
    public struct AgoraC2CCustomData
    {
        public ulong agoraID;       // 주의: camelCase (서버 JSON 키)
        public string agora_name;
        public string stringKey;
        public string titleKey;
        public string user_name;
        
        public long channelID;
        public string channel_name;
        public string inviteCode;
    }

    public enum GroupKickReason
    {
        AdminKick, // 아고라장 강퇴
        MembershipExpired, // 멤버십 만료
        MirrorMembershipExpired, // 멤버십 만료 (미러만 채널에 있을 때...)
        Unknown
    }

    #endregion

    #region Friends

    /// <summary>
    /// 친구 목록, 요청 목록, 차단 목록 관리
    /// </summary>
    [Serializable]
    public class FriendsDto
    {
        public readonly int MAX_FRIEND_NUM = 1000;
        public readonly int MAX_BLOCK_NUM = 1000;
        
        public UDictionary<ulong, UserSummary> Friends { get; private set; } = new();
        public UDictionary<ulong, UserSummary> Blacklists { get; private set; } = new();
        public UDictionary<ulong, UserSummary> InComingPendencies { get; private set; } = new();
        public UDictionary<ulong, UserSummary> OutGoingPendencies { get; private set; } = new();

        public bool IsFriend(ulong dbid) => Friends.ContainsKey(dbid);
        public bool IsBlocked(ulong dbid) => Blacklists.ContainsKey(dbid);
        public bool HasIncoming(ulong dbid) => InComingPendencies.ContainsKey(dbid);
        public bool HasOutgoing(ulong dbid) => OutGoingPendencies.ContainsKey(dbid);
        
        public RelationState GetRelationState(string userId)
        {
            if (!ulong.TryParse(userId, out var dbid)) return RelationState.NONE;
            

            if (IsFriend(dbid)) return RelationState.Friend;
            if (IsBlocked(dbid)) return RelationState.Blocked;
            if (HasIncoming(dbid)) return RelationState.RequestReceived; // 나한테 신청 온 상태
            if (HasOutgoing(dbid)) return RelationState.RequestSent; // 내가 신청 보낸 상태

            return RelationState.NotFriend;
        }
        
        public void UpdateFriends(IEnumerable<UserSummary> list)
        {
            Friends.Clear();
            if (list == null) return;
            foreach (var s in list)
            {
                if (ulong.TryParse(s.UserId, out var id))
                    Friends[id] = s;
            }
        }
        
        public void UpdateBlacklists(IEnumerable<UserSummary> list)
        {
            Blacklists.Clear();
            if (list == null) return;

            foreach (var s in list)
            {
                if (string.IsNullOrEmpty(s.UserId)) continue;

                var key = s.UserId.ToUlongUserId();
                if (key == 0) continue;

                Blacklists[key] = s;
            }
        }
        
        public void UpdatePendencies(IEnumerable<UserSummary> incoming, IEnumerable<UserSummary> outgoing)
        {
            InComingPendencies.Clear();
            OutGoingPendencies.Clear();

            if (incoming != null)
                foreach (var s in incoming)
                    if (ulong.TryParse(s.UserId, out var id))
                        InComingPendencies[id] = s;

            if (outgoing != null)
                foreach (var s in outgoing)
                    if (ulong.TryParse(s.UserId, out var id))
                        OutGoingPendencies[id] = s;
        }
    }

    #endregion
}