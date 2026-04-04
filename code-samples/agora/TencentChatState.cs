using System;
using System.Collections.Generic;
using R3;
using REIW.Communication;

namespace REIW
{
    /// <summary>
    /// Tencent IM 순수 상태 저장소. 비즈니스 로직 없음.
    /// 유저 ID, 그룹 목록, 채팅 로그를 보관하고 변경 시 Observable 발행.
    /// TencentChatService만 조작하며, 외부는 Service 프록시를 통해 읽기 전용 접근.
    /// </summary>
    public class TencentChatState : IDisposable
    {
        #region 필드 — Subject (내부 이벤트 소스)

        private readonly Subject<MessageData> _onNewMessage = new();
        private readonly Subject<string> _onGroupJoined = new();
        private readonly Subject<string> _onGroupLeft = new();
        private readonly Subject<Unit> _onChatLogsUpdated = new();

        #endregion

        #region 읽기 전용 속성 — 유저, 그룹, 채팅 로그

        /// <summary>SDK 로그인 완료 여부. TencentGroupService에서 await 가드로 사용.</summary>
        public ReactiveProperty<bool> IsLoggedIn { get; } = new(false);

        /// <summary>현재 로그인한 유저 ID (Tencent IM 기준)</summary>
        public string MyUserId { get; private set; }

        /// <summary>현재 가입된 그룹 ID 목록</summary>
        public List<string> JoinedGroupIds { get; } = new();

        /// <summary>월드 채팅 그룹 ID</summary>
        public string WorldGroupId { get; private set; }

        /// <summary>현재 활성 그룹 ID (목록의 첫 번째, 없으면 null)</summary>
        public string MirrorGroudID => JoinedGroupIds.Count > 0 ? JoinedGroupIds[0] : null;

        /// <summary>현재 활성 그룹의 채팅 로그</summary>
        public List<MessageData> ChatLogs { get; private set; } = new();

        #endregion

        #region Observable — UI 구독용

        /// <summary>새 메시지 수신</summary>
        public Observable<MessageData> OnNewMessage => _onNewMessage;

        /// <summary>그룹 가입 완료</summary>
        public Observable<string> OnGroupJoined => _onGroupJoined;

        /// <summary>그룹 탈퇴 완료</summary>
        public Observable<string> OnGroupLeft => _onGroupLeft;

        /// <summary>채팅 로그 전체 갱신</summary>
        public Observable<Unit> OnChatLogsUpdated => _onChatLogsUpdated;

        #endregion

        #region 상태 설정 — Service에서만 호출

        public void SetMyUserId(string userId) => MyUserId = userId;
        public void SetWorldGroupId(string groupId) => WorldGroupId = groupId;

        /// <summary>새 메시지 추가 -> 로그에 append + Observable 발행</summary>
        public void AddChatMessage(MessageData message)
        {
            ChatLogs.Add(message);
            _onNewMessage.OnNext(message);
        }

        /// <summary>채팅 로그 전체 교체 (히스토리 조회 결과)</summary>
        public void SetChatLogs(List<MessageData> logs)
        {
            ChatLogs = logs ?? new List<MessageData>();
            _onChatLogsUpdated.OnNext(Unit.Default);
        }

        public void ClearChatLogs()
        {
            ChatLogs.Clear();
            _onChatLogsUpdated.OnNext(Unit.Default);
        }

        #endregion

        #region 그룹 관리 — 가입/탈퇴

        /// <summary>그룹 가입 등록 (중복 방지)</summary>
        public void AddJoinedGroup(string groupId)
        {
            if (!JoinedGroupIds.Contains(groupId))
            {
                JoinedGroupIds.Add(groupId);
                _onGroupJoined.OnNext(groupId);
            }
        }

        /// <summary>그룹 탈퇴 제거</summary>
        public void RemoveJoinedGroup(string groupId)
        {
            if (JoinedGroupIds.Remove(groupId))
                _onGroupLeft.OnNext(groupId);
        }

        #endregion

        #region Dispose

        public void Dispose()
        {
            IsLoggedIn?.Dispose();
            _onNewMessage?.Dispose();
            _onGroupJoined?.Dispose();
            _onGroupLeft?.Dispose();
            _onChatLogsUpdated?.Dispose();
        }

        #endregion
    }
}