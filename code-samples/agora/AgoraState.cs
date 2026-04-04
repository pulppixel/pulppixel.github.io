using System;
using System.Collections.Generic;
using System.Linq;
using R3;

namespace REIW
{
    /// <summary>
    /// 아고라 순수 상태 저장소. 비즈니스 로직 없음.
    /// 아고라 목록, 선택 상태, 채널, 알림을 ReactiveProperty로 보관.
    /// AgoraService만 조작하며, 외부는 Service 프록시를 통해 읽기 전용 접근.
    /// </summary>
    public class AgoraState : IDisposable
    {
        private const string PrefLastAgoraId = "LastSelectedAgoraId";

        #region 필드 — ReactiveProperty, 알림 리스트

        private readonly ReactiveProperty<AgoraInfoData> _selectedAgora = new();
        private readonly ReactiveProperty<AgoraChannelData> _currentChannel = new();
        private readonly ReactiveProperty<int> _unreadCount = new(0);
        private readonly Subject<ulong> _onMembershipChanged = new();
        private readonly List<AgoraNotificationData> _notifications = new();

        #endregion

        public AgoraState()
        {
            var saved = AgoraNotificationHistory.Load();
            _notifications.AddRange(saved);
            SortNotifications();
            RecalculateUnread();
        }

        #region 읽기 전용 속성 — 아고라 목록, 선택 상태, 채널, 알림

        /// <summary>내가 가입한 아고라 목록</summary>
        public List<AgoraInfoData> MyAgoraList { get; } = new();

        /// <summary>현재 UI에서 선택된 아고라</summary>
        public ReadOnlyReactiveProperty<AgoraInfoData> SelectedAgora => _selectedAgora;

        /// <summary>현재 접속 중인 채널 (null이면 채널 밖)</summary>
        public ReadOnlyReactiveProperty<AgoraChannelData> CurrentChannel => _currentChannel;

        /// <summary>선택된 아고라의 아고라장 여부</summary>
        public bool IsOwner => _selectedAgora.Value is { IsOwner: true };

        /// <summary>알림 목록 (미처리 선택형 우선 → 최신순 정렬)</summary>
        public IReadOnlyList<AgoraNotificationData> Notifications => _notifications;

        /// <summary>미처리 선택형 알림 수 (뱃지 표시용)</summary>
        public ReadOnlyReactiveProperty<int> UnreadCount => _unreadCount;

        /// <summary>멤버 가입/탈퇴/강퇴 시 발행 — PopupEditMembers 등에서 구독</summary>
        public Observable<ulong> OnMembershipChanged => _onMembershipChanged;

        #endregion

        #region 채널 진입 데이터 — 씬 로딩에 필요한 일시 데이터

        /// <summary>현재 채널의 존 ID</summary>
        public int ZoneId { get; set; }

        /// <summary>현재 채널의 Tencent IM 그룹 ID</summary>
        public string GroupId { get; set; }

        /// <summary>채널 진입 시 캐릭터 위치/방향 데이터</summary>
        public SubJectData FieldData { get; set; }

        /// <summary>서버 스냅샷 전송 주기 (ms)</summary>
        public uint SnapShotInterval { get; set; }

        #endregion

        #region 아고라 생성 플로우 — 생성 UI에서 사용하는 임시 DTO

        /// <summary>아고라 생성 중 임시 저장용 DTO</summary>
        public AgoraCreationDto CreationDto { get; } = new();

        public void ResetCreationDto() => CreationDto.Clear();

        #endregion

        #region 아고라 선택 / 채널 상태 변경

        /// <summary>아고라 선택 -> PlayerPrefs에 마지막 선택 ID 저장</summary>
        public void SetSelectedAgora(AgoraInfoData agora)
        {
            _selectedAgora.Value = agora;
            if (agora != null)
            {
                ETPlayerPrefs.SetString(PrefLastAgoraId, agora.AgoraId.ToString());
            }
        }

        /// <summary>채널 설정 -> GroupId도 함께 갱신</summary>
        public void SetCurrentChannel(AgoraChannelData channel)
        {
            _currentChannel.Value = channel;
            GroupId = channel?.GroupId;
        }

        public void ClearCurrentChannel()
        {
            _currentChannel.Value = null;
            GroupId = null;
        }

        /// <summary>마지막으로 선택한 아고라 ID 복원 (앱 재시작 시)</summary>
        public ulong? GetLastSelectedAgoraId()
        {
            var saved = ETPlayerPrefs.GetString(PrefLastAgoraId);
            return ulong.TryParse(saved, out var id) ? id : null;
        }

        #endregion

        #region 아고라 목록 조작 — 추가, 제거, 수정, 조회

        /// <summary>서버에서 받은 전체 목록으로 교체</summary>
        public void SetAgoraList(IEnumerable<AgoraInfoData> agoras)
        {
            MyAgoraList.Clear();
            MyAgoraList.AddRange(agoras);
        }

        public void AddAgora(AgoraInfoData agora) => MyAgoraList.Add(agora);

        /// <summary>아고라 제거 — 선택 상태도 함께 해제</summary>
        public bool RemoveAgora(ulong agoraId)
        {
            var removed = MyAgoraList.RemoveAll(a => a.AgoraId == agoraId) > 0;

            if (_selectedAgora.Value?.AgoraId == agoraId)
            {
                _selectedAgora.Value = null;
            }

            return removed;
        }

        /// <summary>기존 아고라 정보 교체 — 채널 목록은 이전 값을 보존</summary>
        public void UpdateAgora(AgoraInfoData updated)
        {
            var index = MyAgoraList.FindIndex(a => a.AgoraId == updated.AgoraId);
            if (index >= 0)
            {
                updated.SetChannels(MyAgoraList[index].Channels);
                MyAgoraList[index] = updated;
            }

            if (_selectedAgora.Value?.AgoraId == updated.AgoraId)
            {
                updated.SetChannels(_selectedAgora.Value.Channels);
                _selectedAgora.Value = updated;
            }
        }

        public AgoraInfoData FindAgora(ulong agoraId)
            => MyAgoraList.Find(a => a.AgoraId == agoraId);

        #endregion

        #region 멤버 변경 알림 — MemberCount 변동 시 UI에 전달

        public void NotifyMemberInfoChanged(ulong agoraId) => _onMembershipChanged.OnNext(agoraId);

        #endregion

        #region 알림 관리 — 추가, 처리, 정렬, 삭제

        /// <summary>알림 추가 후 자동 정렬</summary>
        public void AddNotification(AgoraNotificationData noti)
        {
            _notifications.RemoveAll(n => 
                n.Type == noti.Type && 
                n.AgoraId == noti.AgoraId && 
                n.SenderUserId == noti.SenderUserId);
            
            _notifications.Add(noti);
            SortNotifications();
            RecalculateUnread();
            AgoraNotificationHistory.Save(_notifications); 
        }

        /// <summary>
        /// 알림 처리 완료 마킹 (삭제하지 않고 남겨둠).
        /// 기획서: 처리된 알림은 음영 처리되어 리스트에 유지.
        /// </summary>
        public void HandleNotification(AgoraNotificationData noti, NotificationHandleResult result)
        {
            noti.IsHandled = true;
            noti.HandleResult = result;
            SortNotifications();
            RecalculateUnread();
            AgoraNotificationHistory.Save(_notifications); 
        }

        /// <summary>단일 알림 제거 (유효하지 않은 요청 팝업 → 제거용)</summary>
        public void RemoveNotification(AgoraNotificationData noti)
        {
            _notifications.Remove(noti);
            RecalculateUnread();
            AgoraNotificationHistory.Save(_notifications);
        }

        /// <summary>복수 알림 일괄 삭제 (삭제 모드용)</summary>
        public void RemoveNotifications(IEnumerable<AgoraNotificationData> targets)
        {
            var set = new HashSet<AgoraNotificationData>(targets);
            _notifications.RemoveAll(n => set.Contains(n));
            RecalculateUnread();
            AgoraNotificationHistory.Save(_notifications);
        }

        /// <summary>
        /// 정렬: 미처리 선택형 우선 → 최신순.
        /// 기획서 정렬 기준: 1순위 = 선택형 알림(미처리), 2순위 = 최신순
        /// </summary>
        public void SortNotifications()
        {
            _notifications.Sort((a, b) =>
            {
                int priorityCompare = b.IsPendingAction.CompareTo(a.IsPendingAction);
                if (priorityCompare != 0) return priorityCompare;
                return b.Timestamp.CompareTo(a.Timestamp);
            });
        }

        /// <summary>미처리 선택형 알림 수 (뱃지 카운트)</summary>
        private void RecalculateUnread()
        {
            _unreadCount.Value = _notifications.Count(n => n.IsPendingAction);
        }

        #endregion

        #region Dispose

        public void Dispose()
        {
            CreationDto.Clear();
            _selectedAgora?.Dispose();
            _currentChannel?.Dispose();
            _unreadCount?.Dispose();
            _onMembershipChanged?.Dispose();
        }

        #endregion
    }
}