using System.Collections.Generic;
using FLATBUFFERS;
using UnityEngine;

namespace REIW
{
    /// <summary>
    /// 아고라 기본 정보 DTO
    /// </summary>
    [System.Serializable]
    public class AgoraInfoData
    {
        public ulong AgoraId;
        public string GroupId; // 아고라에서 관리하는 그룹... (자동 가입이라 따로 join할 필요는 없습니다)
        public ContentIdData UserId; // 아고라장
        public string AgoraName;
        public string Description;
        public string IconUrl;
        public AgoraType AgoraType;
        public int MemberCount;
        public List<string> Interests;
        public long CreatedTime;
        public List<AgoraChannelData> Channels { get; private set; } = new();
        public void SetChannels(List<AgoraChannelData> channels) => Channels = channels;
        public bool IsOwner => UserId.Equals(UserDataModel.GetContentIdData());

        public override string ToString()
        {
            var interests = Interests != null ? string.Join(", ", Interests) : "없음";

            return $"Id: {AgoraId}\n" +
                   $" - GroupId: {GroupId}\n" +
                   $" - Name: {AgoraName}\n" +
                   $" - IsOwner: {IsOwner}\n" +
                   $" - Members: {MemberCount}\n" +
                   $" - Interests: [{interests}]\n" +
                   $" - Description: {Description}\n" +
                   $" - Type: {AgoraType}\n" +
                   $" - CreatedTime: {System.DateTimeOffset.FromUnixTimeSeconds(CreatedTime)}\n" +
                   $" - UserId: {UserId.DbId}\n" +
                   $" - IconUrl: {IconUrl}";
        }
    }

    /// <summary>
    /// 아고라 비공개 채널 초대 데이터 
    /// </summary>
    public class ChannelInviteReceivedData
    {
        public ulong ChannelId { get; set; }
        public string ChannelName { get; set; }
        public string InviterUserId { get; set; }
        public string InviteCode { get; set; }
    }
    
    /// <summary>
    /// 아고라 채널 정보 DTO (INFO_AGORA_CHANNEL 대응)
    /// </summary>
    [System.Serializable]
    public class AgoraChannelData
    {
        public ulong ChannelId;
        public ulong AgoraId;
        public string GroupId;
        public string ChannelName;
        public string Description;
        public ENUM_AGORA_CHANNEL_TYPE ChannelType;

        public int MemberCount { get; private set; }
        public int MirrorCount { get; private set; }

        /// <summary>
        /// 채널 멤버 목록에 내 미러(Category=656)가 존재하는지 확인.
        /// mirrorDbId는 PersonaInfoDto.DatabaseID 기준.
        /// </summary>
        public bool HasMyMirror(ulong mirrorDbId)
        {
            if (ChannelMembers == null) return false;
            for (int i = 0; i < ChannelMembers.Count; i++)
            {
                var m = ChannelMembers[i];
                if (m.Category == 656 && m.DbId == mirrorDbId) return true;
            }

            return false;
        }

        /// <summary>
        /// 채널 멤버 목록 (User + Mirror 포함)
        /// </summary>
        public List<ContentIdData> ChannelMembers { get; private set; }

        /// <summary>
        /// 채널 멤버 설정 및 MemberCount 자동 계산
        /// </summary>
        public void SetChannelMembers(List<ContentIdData> members)
        {
            ChannelMembers = members;

            if (members == null)
            {
                MemberCount = 0;
                MirrorCount = 0;
                return;
            }

            int userCount = 0;
            int mirrorCount = 0;
            for (int i = 0; i < members.Count; i++)
            {
                switch (members[i].Category)
                {
                    case 2: userCount++; break;
                    case 656: mirrorCount++; break;
                }
            }

            MemberCount = userCount;
            MirrorCount = mirrorCount;
        }

        public override string ToString() => $"Channel [{ChannelId}] {ChannelName} ({MemberCount}명)";
    }

    /// <summary>
    /// Agora 생성 플로우에서 팝업들이 공유하는 데이터 모델
    /// </summary>
    public class AgoraCreationDto
    {
        public bool IsInProgress { get; set; }

        public HashSet<AgoraInterestTable> SelectedInterests { get; } = new();
        public HashSet<ulong> InvitedFriendIds { get; } = new();
        public string AgoraName { get; set; }
        public Texture2D AgoraImage { get; set; }
        public string Description { get; set; }
        public AgoraType AgoraType { get; set; }
        public string AgoraImageUrl; // 업로드 완료된 S3 URL 캐싱

        public void Clear()
        {
            IsInProgress = false;
            SelectedInterests.Clear();
            InvitedFriendIds.Clear();
            AgoraName = null;
            Description = null;
            AgoraType = default;
            AgoraImageUrl = null;

            if (AgoraImage != null)
            {
                Object.Destroy(AgoraImage);
                AgoraImage = null;
            }
        }
    }

    /// <summary>
    /// 아고라 멤버 정보 DTO
    /// </summary>
    [System.Serializable]
    public class AgoraMemberData
    {
        public ContentIdData ContentId; // 서버 프로토콜용 (강퇴/Owner변경)
        public string UserId; // Tencent UserId
        public string Nickname;
        public string FaceUrl;
        public ENUM_AGORA_MEMBER_ROLE Role;
        public long JoinTime;
        public uint ShutupTime;
        public EnumMembershipTier MembershipTier;

        public bool IsMuted => ShutupTime > 0;
        public bool IsOwner => Role == ENUM_AGORA_MEMBER_ROLE.OWNER;
    }

    /// <summary>
    /// 필드 내 위치/방향 정보
    /// </summary>
    [System.Serializable]
    public class SubJectData
    {
        public ContentIdData SubjectId;
        public Vector3 Position;
        public Vector3 Direction;
    }

    /// <summary>
    /// 아고라 초대 수신 데이터 (C2C 메시지에서 파싱)
    /// </summary>
    public class AgoraInviteReceivedData
    {
        public ulong AgoraId;
        public string AgoraName;
        public string InviterUserId;
    }

    public struct AgoraJoinRequestReceivedData
    {
        public ulong AgoraId;
        public string AgoraName;
        public string RequesterUserId;
        public string RequesterName;
    }

    // =========================================================================
    //  알림 시스템
    // =========================================================================

    /// <summary>
    /// 아고라 알림 유형.
    /// 기획서 기준: 일반형(Info) / 선택형(Invite, Approval)
    /// </summary>
    public enum AgoraNotificationType
    {
        // ── 선택형 (수락/거절 버튼) ──
        AgoraInvite, // 비공개 아고라 초대
        ChannelInvite, // 비공개 채널 초대
        AgoraApplyRequest, // 비공개 가입 요청 (관리자에게 표시)

        // ── 일반형 (안내) ──
        AgoraApplyApproved, // 가입 승인됨
        AgoraApplyDeclined, // 가입 거절됨
        AgoraKicked, // 추방됨
        AgoraAdminPromoted, // 관리자 권한 부여
        AgoraMasterPromoted, // 아고라장 승진

        // ── 기타 (기획서 범위 밖이지만 기존 유지) ──
        ChannelClosed, // 채널 폐기
        AgoraClosed, // 아고라 폐기
        NewMemberJoined, // 신규 멤버
    }

    /// <summary>알림 처리 결과 (수락/거절 중 어느 쪽을 선택했는지)</summary>
    public enum NotificationHandleResult
    {
        Accepted,
        Declined
    }

    /// <summary>
    /// 아고라 알림 데이터.
    /// 기획서 스트링키 체계에 맞춰 Title/Description 대신 Type+파라미터로 텍스트를 동적 생성합니다.
    /// </summary>
    public class AgoraNotificationData
    {
        public AgoraNotificationType Type;
        public long Timestamp;

        /// <summary>처리 완료 여부 (수락 또는 거절을 선택함)</summary>
        public bool IsHandled;

        /// <summary>어떤 액션으로 처리했는지 (처리 완료 시 음영 표시용)</summary>
        public NotificationHandleResult? HandleResult;

        // ── 컨텍스트 데이터 (타입에 따라 선택적 사용) ──
        public ulong AgoraId;
        public string AgoraName;
        public ulong ChannelId;
        public string ChannelName;
        public ulong TargetDbId; // 가입 요청자의 DbId (승인/거절 API용)
        public string SenderUserId; // 초대자 또는 요청자 UserId
        public string SenderNickname; // 상세 팝업 {user_name}용

        public string InviteCode; // 비공개 채널 초대 수락용
        // ── 편의 프로퍼티 ──

        /// <summary>선택형 알림인가 (수락/거절 버튼 표시 대상)</summary>
        public bool IsActionable => Type is
            AgoraNotificationType.AgoraInvite or
            AgoraNotificationType.AgoraApplyRequest or
            AgoraNotificationType.ChannelInvite;

        /// <summary>미처리 선택형인가 (정렬 1순위 기준, 뱃지 카운트 기준)</summary>
        public bool IsPendingAction => IsActionable && !IsHandled;

        /// <summary>상세 팝업 진입 가능 여부 (선택형 + 미처리만)</summary>
        public bool CanShowDetail => IsActionable && !IsHandled;

        /// <summary>카테고리 라벨 스트링키 (안내 / 초대 / 승인)</summary>
        public string CategoryKey => Type switch
        {
            AgoraNotificationType.AgoraInvite or AgoraNotificationType.ChannelInvite => "agora_alaram_invite",
            AgoraNotificationType.AgoraApplyRequest => "agora_alaram_approval",
            _ => "agora_alaram_info"
        };

        /// <summary>리스트 설명 텍스트 스트링키</summary>
        public string DescriptionKey => Type switch
        {
            AgoraNotificationType.AgoraApplyApproved => "agora_alaram_info_accept",
            AgoraNotificationType.AgoraApplyDeclined => "agora_alaram_info_decline",
            AgoraNotificationType.AgoraKicked => "agora_alaram_info_kick",
            AgoraNotificationType.AgoraAdminPromoted => "agora_alaram_info_beadmin",
            AgoraNotificationType.AgoraMasterPromoted=>"agora_alaram_info_beadmin",
            AgoraNotificationType.AgoraInvite => "agora_alaram_invite_agora",
            AgoraNotificationType.ChannelInvite => "agora_alaram_invite_channel",
            AgoraNotificationType.AgoraApplyRequest => "agora_alaram_approval_agora",
            _ => ""
        };

        /// <summary>상세 팝업 본문 스트링키</summary>
        public string DetailKey => Type switch
        {
            AgoraNotificationType.AgoraInvite => "agora_alaram_invite_agora_detail",
            AgoraNotificationType.ChannelInvite => "agora_alaram_invite_channel_detail",
            AgoraNotificationType.AgoraApplyRequest => "agora_alaram_approval_agora",
            _ => ""
        };
    }
}