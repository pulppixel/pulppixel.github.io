using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using Cysharp.Threading.Tasks;
using FLATBUFFERS;
using R3;
using UnityEngine;

namespace REIW
{
    /// <summary>
    /// Agora 비즈니스 로직 조율 서비스
    /// - Repository 이벤트 -> State 업데이트
    /// - 씬 로딩, UI 전환 등 복합 로직 처리
    /// - Presenter/ViewModel에서 호출하는 Public API 제공
    /// </summary>
    public class AgoraService : IDisposable
    {
        private const int MaxChannelMembers = 8;

        #region Singleton — 생성, 해제, 인스턴스 접근

        public static AgoraService Instance { get; private set; }

        /// <summary>
        /// 서비스 인스턴스 생성 (앱 시작 시 1회).
        /// - AgoraState, AgoraRepository 내부 생성
        /// - TencentChatService에 아고라 이름 Resolver 주입 (순환 의존 방지)
        /// - 서버에 아고라 목록 최초 요청
        /// </summary>
        public static void CreateInstance(TencentChatService chatService)
        {
            Instance?.Dispose();

            var state = new AgoraState();
            var repository = new AgoraRepository();

            Instance = new AgoraService(repository, state, chatService);
            Instance._repository.RequestAgoraList();
        }

        /// <summary>서비스 해제 (앱 종료 시)</summary>
        public static void ReleaseInstance()
        {
            Instance?.Dispose();
            Instance = null;
        }

        #endregion

        #region 필드 — 의존성, Disposable, 내부 Subject

        private readonly IAgoraRepository _repository;
        private readonly AgoraState _state;
        private readonly TencentChatService _chatService;
        private readonly CompositeDisposable _disposables = new();
        private CancellationTokenSource _fetchMemberCts;
        private bool _pendingAutoSelect;
        private bool _isEnteringChannel;
        private bool _pendingForceExit;

        /// <summary>아고라 목록 갱신 시 UI에 전달하는 내부 Subject</summary>
        private readonly Subject<Unit> _onListRefreshed = new();

        /// <summary>채널 목록을 UI에 직접 밀어넣을 때 사용 (생성/멤버조회 완료 시)</summary>
        private readonly Subject<List<AgoraChannelData>> _onChannelListForUI = new();

        private readonly Subject<Unit> _onChannelDataChanged = new();

        #endregion

        #region Observable — UI 구독용 (Presenter/ViewModel에서 Subscribe)

        /// <summary>아고라 목록이 서버에서 갱신되었을 때 (목록 전체 교체)</summary>
        public Observable<Unit> OnListRefreshed => _onListRefreshed;

        /// <summary>새 아고라 생성 완료</summary>
        public Observable<AgoraInfoData> OnAgoraAdded => _repository.OnAgoraCreated.Select(r => r.Agora);

        /// <summary>아고라 가입 완료 (공개/초대 수락/비공개 승인 모두)</summary>
        public Observable<AgoraInfoData> OnAgoraJoined => _repository.OnAgoraJoined;

        /// <summary>아고라 삭제 또는 탈퇴 완료 (AgoraId 전달)</summary>
        public Observable<ulong> OnAgoraDeleted => _repository.OnAgoraRemoved;

        /// <summary>아고라 정보 수정 완료 (이름, 설명, 아이콘 등)</summary>
        public Observable<AgoraInfoData> OnAgoraUpdated => _repository.OnAgoraUpdated;

        /// <summary>채널 목록 수신 (서버 응답 + 내부 UI 갱신 병합)</summary>
        public Observable<List<AgoraChannelData>> OnChannelListReceived => _onChannelListForUI;

        /// <summary>채널 정보 수정 완료</summary>
        public Observable<AgoraChannelData> OnChannelUpdated => _repository.OnChannelUpdated;

        /// <summary>아고라 검색 결과 수신 (이미 가입한 아고라 자동 필터링)</summary>
        public Observable<List<AgoraInfoData>> OnSearchResultReceived => _repository.OnSearchResultReceived.Select(FilterSearchResults);

        private List<AgoraInfoData> FilterSearchResults(List<AgoraInfoData> results)
        {
            var myList = _state.MyAgoraList;
            var myIds = new HashSet<ulong>(myList.Count);
            for (int i = 0; i < myList.Count; i++)
            {
                if (myList[i] != null) myIds.Add(myList[i].AgoraId);
            }

            var filtered = new List<AgoraInfoData>();
            for (int i = 0; i < results.Count; i++)
            {
                if (!myIds.Contains(results[i].AgoraId))
                    filtered.Add(results[i]);
            }

            return filtered;
        }

        public Observable<Unit> OnChannelDataChanged => _onChannelDataChanged;

        #endregion

        #region State 프록시 — 읽기 전용 (State 직접 노출 방지)

        public IReadOnlyList<AgoraInfoData> MyAgoraList => _state.MyAgoraList;
        public ReadOnlyReactiveProperty<AgoraInfoData> SelectedAgora => _state.SelectedAgora;
        public ReadOnlyReactiveProperty<AgoraChannelData> CurrentChannel => _state.CurrentChannel;
        public bool IsOwner => _state.IsOwner;

        public ReadOnlyReactiveProperty<int> UnreadNotificationCount => _state.UnreadCount;
        public IReadOnlyList<AgoraNotificationData> Notifications => _state.Notifications;
        public Observable<ulong> OnMemberInfoChanged => _state.OnMembershipChanged;

        public AgoraCreationDto CreationDto => _state.CreationDto;

        #endregion

        #region 생성자 / Dispose

        private AgoraService(IAgoraRepository repository, AgoraState state, TencentChatService chatService)
        {
            _repository = repository;
            _state = state;
            _chatService = chatService;

            BindAgoraEvents();
            BindChannelEvents();
            BindInviteEvents();
            BindMemberInfoEvents();
            BindGroupLifecycleEvents();
        }

        public void Dispose()
        {
            _fetchMemberCts?.Cancel();
            _fetchMemberCts?.Dispose();
            _disposables.Dispose();
            _onListRefreshed.Dispose();
            _onChannelListForUI.Dispose();
            _onChannelDataChanged.Dispose();
            _repository.Dispose();
            _state.Dispose();
        }

        public ulong? GetLastSelectedAgoraId() => _state.GetLastSelectedAgoraId();

        #endregion

        // =====================================================================
        //  이벤트 바인딩
        //  Repository 이벤트 -> State 갱신 -> UI 알림
        //  TencentChatService IM 콜백 -> 알림 생성 / 목록 갱신
        // =====================================================================

        #region 이벤트 바인딩 — 아고라 CRUD (목록 수신, 생성, 가입, 삭제, 수정)

        private void BindAgoraEvents()
        {
            // 목록 수신 -> State 교체 -> UI 갱신, 비공개 승인 시 자동 선택
            _repository.OnAgoraListReceived
                .TraceWithStack("Repo.OnAgoraListReceived -> BindAgoraEvents")
                .Subscribe(agoras =>
                {
                    // ── 교체 전: 현재 선택 상태 스냅샷 ──
                    var prevSelected = _state.SelectedAgora.CurrentValue;
                    var prevAgoraId = prevSelected?.AgoraId;
                    bool wasOwner = prevSelected?.IsOwner ?? false;

                    // ── 리스트 교체 ──
                    _state.SetAgoraList(agoras);
                    _onListRefreshed.OnNext(Unit.Default);

                    // ── 교체 후: SelectedAgora를 새 리스트의 객체로 재연결 ──
                    if (prevAgoraId.HasValue)
                    {
                        var refreshed = agoras.Find(a => a.AgoraId == prevAgoraId.Value);
                        if (refreshed != null)
                        {
                            _state.SetSelectedAgora(refreshed);

                            // 아고라장 승격 감지 -> 알림
                            if (!wasOwner && refreshed.IsOwner)
                            {
                                PushNotification(
                                    AgoraNotificationType.AgoraMasterPromoted,
                                    refreshed.AgoraId, refreshed.AgoraName);
                            }
                        }
                    }

                    if (_pendingAutoSelect && agoras.Count > 0)
                    {
                        _pendingAutoSelect = false;
                        SelectAgora(agoras[^1]);
                    }
                })
                .AddTo(_disposables);

            // 생성 완료 -> 목록 추가 + 자동 선택
            _repository.OnAgoraCreated
                .TraceWithStack("Repo.OnAgoraCreated -> BindAgoraEvents")
                .Subscribe(result =>
                {
                    _state.AddAgora(result.Agora);
                    _state.SetSelectedAgora(result.Agora);
                    _onChannelListForUI.OnNext(result.Agora.Channels);
                })
                .AddTo(_disposables);

            // 가입 완료 -> 목록 추가, 첫 아고라면 자동 선택
            _repository.OnAgoraJoined
                .TraceWithStack("Repo.OnAgoraJoined -> BindAgoraEvents")
                .Subscribe(agora =>
                {
                    if (agora == null || agora.AgoraId == 0) return;
                    _state.AddAgora(agora);
                    SelectAgora(agora);
                    _chatService.GroupService.JoinGroupAsync(agora.GroupId, CancellationToken.None).Forget();
                })
                .AddTo(_disposables);

            // 삭제/탈퇴 완료 -> 아이콘 캐시 무효화 + 목록 제거
            _repository.OnAgoraRemoved
                .TraceWithStack("Repo.OnAgoraRemoved -> BindAgoraEvents")
                .Subscribe(agoraId =>
                {
                    var agora = _state.FindAgora(agoraId);
                    if (agora != null)
                    {
                        ClearMirrorDeployIfInAgora(agora);
                    }

                    ClearMirrorDeployIfAgoraId(agoraId);
                    InvalidateIconCache(agoraId);
                    _state.RemoveAgora(agoraId);
                })
                .AddTo(_disposables);

            // 정보 수정 -> 캐시 무효화 + State 갱신 + 아고라장 승격 알림
            _repository.OnAgoraUpdated
                .TraceWithStack("Repo.OnAgoraUpdated -> BindAgoraEvents")
                .Subscribe(HandleAgoraUpdated)
                .AddTo(_disposables);
        }

        /// <summary>아고라 정보 수정 처리 — 아고라장 승격 시 알림 생성</summary>
        private void HandleAgoraUpdated(AgoraInfoData updated)
        {
            InvalidateIconCache(_state.FindAgora(updated.AgoraId));

            var wasOwner = _state.FindAgora(updated.AgoraId)?.IsOwner ?? false;
            _state.UpdateAgora(updated);

            if (!wasOwner && updated.IsOwner)
            {
                PushNotification(
                    AgoraNotificationType.AgoraMasterPromoted,
                    updated.AgoraId, updated.AgoraName);
            }
        }

        public void RefreshAgoraList() => _repository.RequestAgoraList();

        #endregion

        #region 이벤트 바인딩 — 채널 CRUD (목록, 생성, 입장, 퇴장, 수정, 멤버)

        private void BindChannelEvents()
        {
            // 채널 목록 수신 -> 선택된 아고라에 채널 설정 + 멤버 수 일괄 조회
            _repository.OnChannelListReceived
                .TraceWithStack("Repo.OnChannelListReceived -> BindChannelEvents")
                .Subscribe(HandleChannelListReceived)
                .AddTo(_disposables);

            // 채널 생성 완료 -> 목록 추가 + 자동 Join
            // AgoraService.cs — _repository.OnChannelCreated Subscribe 내부
            _repository.OnChannelCreated
                .TraceWithStack("Repo.OnChannelCreated -> BindChannelEvents")
                .Subscribe(channel =>
                {
                    _state.SelectedAgora.CurrentValue?.Channels.Add(channel);
                    NotifyChannelListChanged();

                    // 생성 플로우 팝업 닫기
                    var popupUI = UIManager.Singleton.GetUI<PopupUI>(UIList.PopupUI);
                    popupUI?.HideWithSlideAnim();

                    CommonAlertUI.ShowTwoButton(
                        "notice_enter_createchannel".ToGlobalText(),
                        onConfirm: () => _repository.RequestChannelJoin(channel.ChannelId)
                    );
                })
                .AddTo(_disposables);

            // 채널 Join 완료 -> 캐릭터 리셋 + State 갱신 + Tencent 그룹 가입 + 씬 진입
            _repository.OnChannelJoined
                .TraceWithStack("Repo.OnChannelJoined -> BindChannelEvents")
                .Subscribe(result =>
                {
                    IngameFieldSubjectSystem.Instance.ReSetMyPersonaCharacter();

                    _state.SetCurrentChannel(result.Channel);
                    _state.ZoneId = result.ZoneId;
                    _state.FieldData = result.FieldData;

                    Debug.Log("[KEE] 아고라 채널 정보 !! \n".Bold() +
                              $" — AgoraId: {result.Channel.AgoraId}, \n".Bold() +
                              $" - ChannelId: {result.Channel.ChannelId}, \n".Bold() +
                              $" - GroupId: {result.Channel.GroupId}, \n".Bold() +
                              $" - UserId: {UserDataModel.Singleton.PlayerInfoData.DatabaseID} \n".Bold());

                    EnterChannel();
                })
                .AddTo(_disposables);

            // 채널 Enter 완료 (씬 로드 후 서버 확인) -> 스냅샷 주기 설정
            _repository.OnChannelEntered
                .TraceWithStack("Repo.OnChannelEntered -> BindChannelEvents")
                .Subscribe(snapshotInterval =>
                {
                    _state.SnapShotInterval = snapshotInterval;
                    Debug.Log($"[AgoraService] GroupId: {_state.GroupId}".Bold());
                })
                .AddTo(_disposables);

            // 채널 Leave -> Tencent 그룹 퇴장 + 씬 나가기
            _repository.OnChannelLeft
                .TraceWithStack("Repo.OnChannelLeft -> BindChannelEvents")
                .Subscribe(fieldData =>
                {
                    _state.FieldData = fieldData;
                    ExitChannel();
                })
                .AddTo(_disposables);

            // 채널 정보 수정 -> 목록 내 해당 채널 교체
            _repository.OnChannelUpdated
                .TraceWithStack("Repo.OnChannelUpdated -> BindChannelEvents")
                .Subscribe(updated =>
                {
                    var channels = _state.SelectedAgora.CurrentValue?.Channels;
                    if (channels == null) return;

                    var index = channels.FindIndex(c => c.ChannelId == updated.ChannelId);
                    if (index >= 0) channels[index] = updated;
                    NotifyChannelListChanged();
                })
                .AddTo(_disposables);

            // 채널 멤버 목록 수신 -> 채널에 멤버 설정 + UI 갱신
            _repository.OnChannelMemberListReceived
                .TraceWithStack("Repo.OnChannelMemberListReceived -> BindChannelEvents")
                .Subscribe(HandleChannelMemberListReceived)
                .AddTo(_disposables);

            // 채널 삭제 (ACK + NFY 통합) -> 리스트 제거 + 현재 채널이면 강제 퇴장
            _repository.OnChannelDeleted
                .TraceWithStack("Repo.OnChannelDeleted -> BindChannelEvents")
                .Subscribe(channelId =>
                {
                    var selected = _state.SelectedAgora.CurrentValue;
                    var channels = selected?.Channels;
                    Debug.Log($"[AgoraService] 채널 삭제 이벤트 수신: {channelId}, channels: {channels?.Count ?? -1}");
                    if (channels == null) return;

                    // 1 삭제된 채널의 GroupId 확보 (리스트 제거 전에)
                    var deletedChannel = channels.FirstOrDefault(c => c.ChannelId == channelId);
                    var deletedGroupId = deletedChannel?.GroupId;

                    // 2 채널 리스트에서 제거
                    channels.RemoveAll(c => c.ChannelId == channelId);
                    _onChannelListForUI.OnNext(channels);
                    Debug.Log($"[AgoraService] 채널 리스트 갱신: 남은 채널={channels.Count}");

                    // 3 미러 잔류 해제
                    var persona = UserDataModel.Singleton.PersonaInfoDto;
                    if (!string.IsNullOrEmpty(deletedGroupId) && persona.DeployedChannelGroupId == deletedGroupId)
                    {
                        persona.ClearMirrorDeploy();
                        Debug.Log($"[AgoraService] 미러 잔류 해제: {deletedGroupId}");
                    }

                    // 4 현재 채널이 삭제된 채널이면 강제 퇴장
                    var current = _state.CurrentChannel.CurrentValue;
                    if (current != null && current.ChannelId == channelId)
                    {
                        if (_isEnteringChannel)
                        {
                            // 씬 로딩 중이면 즉시 퇴장하지 않고 플래그만 세팅
                            Debug.Log("[AgoraService] 씬 로딩 중 채널 삭제 감지 — 로드 완료 후 퇴장 예약");
                            _pendingForceExit = true;
                        }
                        else
                        {
                            _state.ClearCurrentChannel();
                            CommonAlertUI.ShowOneButton("alert_autoclose".ToSystemText());
                            ExitChannel();
                        }
                    }
                })
                .AddTo(_disposables);
        }

        /// <summary>
        /// 채널 목록 수신 처리. Dictionary로 O(1) 룩업하여 O(n²) → O(n) 개선.
        /// 폴링(5초)마다 호출되므로 할당 최소화.
        /// </summary>
        private void HandleChannelListReceived(List<AgoraChannelData> channels)
        {
            var selected = _state.SelectedAgora.CurrentValue;
            if (selected == null) return;

            var oldChannels = selected.Channels;

            if (oldChannels != null && IsSameChannelLayout(oldChannels, channels))
            {
                // 레이아웃 동일 → 기존 객체 필드만 갱신 (할당 없음)
                // oldChannels와 channels의 순서·크기가 같으므로 인덱스 매칭
                for (int i = 0; i < channels.Count; i++)
                {
                    var old = oldChannels[i];
                    var newCh = channels[i];
                    old.ChannelName = newCh.ChannelName;
                    old.Description = newCh.Description;
                    old.ChannelType = newCh.ChannelType;
                }

                _onChannelListForUI.OnNext(oldChannels);
                FetchAllChannelMemberCounts(oldChannels).Forget();
            }
            else
            {
                // 레이아웃 변경 → 기존 멤버 정보 이관
                if (oldChannels != null && oldChannels.Count > 0)
                {
                    // Dictionary 빌드: oldChannels 크기만큼만 할당 (보통 수 개)
                    var oldMap = new Dictionary<ulong, AgoraChannelData>(oldChannels.Count);
                    for (int i = 0; i < oldChannels.Count; i++)
                    {
                        oldMap[oldChannels[i].ChannelId] = oldChannels[i];
                    }

                    for (int i = 0; i < channels.Count; i++)
                    {
                        if (oldMap.TryGetValue(channels[i].ChannelId, out var old))
                        {
                            channels[i].SetChannelMembers(old.ChannelMembers);
                        }
                    }
                }

                selected.SetChannels(channels);
                _onChannelListForUI.OnNext(channels);
                FetchAllChannelMemberCounts(channels).Forget();
            }
        }

        private void HandleChannelMemberListReceived(ChannelMemberListResult result)
        {
            var channels = _state.SelectedAgora.CurrentValue?.Channels;
            if (channels == null) return;

            for (int i = 0; i < channels.Count; i++)
            {
                if (channels[i].ChannelId == result.ChannelId)
                {
                    channels[i].SetChannelMembers(result.Members);
                    _onChannelDataChanged.OnNext(Unit.Default);
                    return;
                }
            }
        }

        #endregion

        #region 이벤트 바인딩 — 초대 & 비공개 가입 (Tencent IM C2C + GroupTip)

        /// <summary>
        /// 초대 수신, 비공개 가입 요청 수신, 비공개 가입 승인 감지, 기존 멤버 알림.
        /// - 초대/가입요청: C2C 메시지 기반 (TencentChatService가 파싱)
        /// - 가입 승인 + 기존 멤버 알림: kTIMGroupTip_Invite (isMe 분기)
        /// </summary>
        private void BindInviteEvents()
        {
            // 아고라 초대 수신 -> 알림 생성
            _chatService.OnAgoraInviteReceived
                .TraceWithStack("Chat.OnAgoraInviteReceived -> BindInviteEvents")
                .Subscribe(invite =>
                {
                    if (invite.InviterUserId == GetMyUserId()) return;

                    PushNotification(
                        AgoraNotificationType.AgoraInvite,
                        invite.AgoraId, invite.AgoraName,
                        senderUserId: invite.InviterUserId);
                })
                .AddTo(_disposables);

            // 비공개 가입 요청 수신 (아고라장에게만 도착) -> 알림 생성
            _chatService.OnAgoraJoinRequestReceived
                .TraceWithStack("Chat.OnAgoraJoinRequestReceived -> BindInviteEvents")
                .Subscribe(request =>
                {
                    PushNotification(
                        AgoraNotificationType.AgoraApplyRequest,
                        request.AgoraId, request.AgoraName,
                        senderUserId: request.RequesterUserId,
                        senderNickname: request.RequesterName,
                        targetDbId: ulong.TryParse(request.RequesterUserId, out var id) ? id : 0);
                })
                .AddTo(_disposables);

            // 그룹 초대 감지 (kTIMGroupTip_Invite) — 비공개 가입 승인 감지 전용
            _chatService.OnGroupTips
                .TraceWithStack("Chat.OnGroupTips -> BindInviteEvents")
                .Where(tip => tip.group_tips_elem_tip_type == TIMGroupTipType.kTIMGroupTip_Invite)
                .Subscribe(tip =>
                {
                    var groupId = tip.group_tips_elem_group_id;
                    var targets = tip.group_tips_elem_user_array;
                    if (targets == null) return;

                    // 내가 대상인지
                    var myUserId = UserDataModel.Singleton.PlayerInfoData.DatabaseID;
                    bool isMe = targets.Any(u => u.ToUlongUserId() == myUserId);
                    if (!isMe) return;

                    // 아고라와 무관한 그룹 제외
                    if (groupId == TencentChatService.Instance.WorldGroupId) return;
                    if (groupId.Contains("SingleChat")) return;

                    // 채널 그룹 제외 (채널 입장 시 Invite Tip 발동)
                    bool isChannelGroup = false;
                    var myList = _state.MyAgoraList;
                    for (int i = 0; i < myList.Count; i++)
                    {
                        var channels = myList[i].Channels;
                        if (channels == null) continue;

                        for (int j = 0; j < channels.Count; j++)
                        {
                            if (channels[j].GroupId == groupId)
                            {
                                isChannelGroup = true;
                                break;
                            }
                        }

                        if (isChannelGroup) break;
                    }

                    if (isChannelGroup) return;

                    // 이미 내 아고라 목록에 있으면 = 공개 가입 (OnAgoraJoined에서 처리됨)
                    if (FindAgoraByGroupId(groupId) != null) return;

                    // 여기 도달 = 비공개 가입 승인
                    var groupName = tip.group_tips_elem_group_name;
                    PushNotification(
                        AgoraNotificationType.AgoraApplyApproved,
                        0, groupName);

                    _pendingAutoSelect = _state.MyAgoraList.Count == 0;
                    _repository.RequestAgoraList();
                })
                .AddTo(_disposables);
            
            _chatService.OnChannelInviteReceived
                .TraceWithStack("Chat.OnAgoraChannelInviteReceived -> BindInviteEvents")
                .Subscribe(invite =>
                {
                    PushNotification(
                        AgoraNotificationType.ChannelInvite,
                        0, invite.ChannelName,
                        senderUserId: invite.InviterUserId,
                        channelId: invite.ChannelId,
                        channelName: invite.ChannelName,
                        inviteCode: invite.InviteCode);
                })
                .AddTo(_disposables);
        }

        #endregion

        #region 이벤트 바인딩 — 멤버 입퇴장/강퇴 (Tencent IM GroupTip)

        /// <summary>
        /// 그룹 멤버 변동 처리.
        /// - 가입: MemberCount++ (알림은 kTIMGroupTip_Invite에서 전 멤버에게 발송)
        /// - 탈퇴: MemberCount--
        /// - 강퇴: 내가 당했으면 아고라 제거 + 알림, 남이면 MemberCount--
        /// </summary>
        private void BindMemberInfoEvents()
        {
            // 신규 멤버 가입 -> 인원 증가 (알림은 kTIMGroupTip_Invite에서 처리)
            _chatService.OnGroupMemberEnter
                .TraceWithStack("Chat.OnGroupMemberEnter -> BindMemberInfoEvents")
                .Subscribe(data =>
                {
                    // 본인 가입은 OnAgoraJoined에서 이미 정확한 카운트를 받았으므로 스킵
                    if (data.UserId == GetMyUserId()) return;

                    var agora = FindAgoraByGroupId(data.GroupId);
                    if (agora == null) return;

                    agora.MemberCount++;
                    _state.NotifyMemberInfoChanged(agora.AgoraId);
                })
                .AddTo(_disposables);

            // 멤버 탈퇴 -> 인원 감소
            _chatService.OnGroupMemberQuit
                .TraceWithStack("Chat.OnGroupMemberQuit -> BindMemberInfoEvents")
                .Subscribe(data => DecrementMemberCount(data.GroupId))
                .AddTo(_disposables);

            // 멤버 강퇴 -> 내가 당했으면 아고라 제거, 아니면 인원 감소
            _chatService.OnGroupMemberKicked
                .TraceWithStack("Chat.OnGroupMemberKicked -> BindMemberInfoEvents")
                .Subscribe(HandleMemberKicked)
                .AddTo(_disposables);

            // World 그룹 NameCard 변경 -> 현재 아고라 멤버 UI 갱신
            _chatService.OnUserNameCardChanged
                .TraceWithStack("Chat.OnUserNameCardChanged -> BindMemberInfoEvents")
                .Subscribe(_ =>
                {
                    var selected = _state.SelectedAgora.CurrentValue;
                    if (selected != null)
                    {
                        _state.NotifyMemberInfoChanged(selected.AgoraId);
                    }
                })
                .AddTo(_disposables);
        }

        /// <summary>강퇴 처리 — 내가 당한 경우와 타인이 당한 경우 분기</summary>
        private void HandleMemberKicked((string GroupId, string UserId, GroupKickReason Reason) data)
        {
            if (data.UserId != GetMyUserId())
            {
                DecrementMemberCount(data.GroupId);
                return;
            }

            // 미러만 강퇴 — 채널 퇴장 없이 미러 상태만 정리
            if (data.Reason == GroupKickReason.MirrorMembershipExpired)
            {
                var mirrorAgora = FindAgoraByGroupId(data.GroupId);
                if (mirrorAgora != null)
                {
                    ClearMirrorDeployIfInAgora(mirrorAgora);
                }

                return;
            }

            // 내가 강퇴당함
            var agora = FindAgoraByGroupId(data.GroupId);
            if (agora == null) return;

            var agoraName = agora.AgoraName;

            // ── 미러/채널 상태를 정리 전에 먼저 캡처 ──
            var current = _state.CurrentChannel.CurrentValue;
            var wasInChannel = current != null && current.AgoraId == agora.AgoraId;

            // ── 정리 ──
            ClearMirrorDeployIfInAgora(agora);
            _state.RemoveAgora(agora.AgoraId);

            // ── 채널 퇴장 ──
            if (wasInChannel)
            {
                if (_isEnteringChannel)
                {
                    _pendingForceExit = true;
                }
                else
                {
                    _state.ClearCurrentChannel();
                    ExitChannel();
                }
            }

            UIManager.Hide<PopupUI>(UIList.PopupUI);

            // ── 알림 분기 ──
            // 멤버십 만료 계열은 NFY_MEMBERSHIP_EXPIRE에서 이미 팝업 처리됨
            if (data.Reason != GroupKickReason.MembershipExpired && data.Reason != GroupKickReason.MirrorMembershipExpired)
            {
                var alertText = "alert_agorakick".ToSystemText(new Dictionary<string, object>
                {
                    { "agoraName", agoraName }
                });

                CommonAlertUI.ShowOneButton(alertText);
            }

            PushNotification(
                AgoraNotificationType.AgoraKicked,
                agora.AgoraId, agoraName);

            _repository.RequestAgoraList();
        }

        #endregion


        #region 이벤트 바인딩 — 그룹 생명주기 (해산, 정보 변경)

        /// <summary>
        /// 타인에 의한 아고라 해산/수정 처리.
        /// - 해산: 내 목록에서 제거 + 알림
        /// - 정보 변경: IM 콜백에 상세 정보 없으므로 서버에 전체 목록 재요청
        /// </summary>
        private void BindGroupLifecycleEvents()
        {
            // 아고라 해산
            _chatService.OnGroupDismissed
                .TraceWithStack("Chat.OnGroupDismissed -> BindGroupLifecycleEvents")
                .Subscribe(groupId =>
                {
                    var agora = FindAgoraByGroupId(groupId);
                    if (agora == null) return;

                    var agoraName = agora.AgoraName;

                    // ── 채널 퇴장 체크 ──
                    var current = _state.CurrentChannel.CurrentValue;
                    var wasInChannel = current != null && current.AgoraId == agora.AgoraId;

                    ClearMirrorDeployIfInAgora(agora);
                    _state.RemoveAgora(agora.AgoraId);

                    // ── 채널에 있었으면 퇴장 ──
                    if (wasInChannel)
                    {
                        if (_isEnteringChannel)
                        {
                            _pendingForceExit = true;
                        }
                        else
                        {
                            _state.ClearCurrentChannel();
                            ExitChannel();
                        }
                    }

                    PushNotification(
                        AgoraNotificationType.AgoraClosed,
                        agora.AgoraId, agoraName);
                })
                .AddTo(_disposables);

            // 아고라 정보 변경
            _chatService.OnGroupInfoChanged
                .TraceWithStack("Chat.OnGroupInfoChanged -> BindGroupLifecycleEvents")
                .Subscribe(groupId =>
                {
                    if (FindAgoraByGroupId(groupId) != null)
                    {
                        _repository.RequestAgoraList();
                    }
                })
                .AddTo(_disposables);
        }

        #endregion

        // =====================================================================
        //  Public API
        //  UI/Presenter에서 호출. Repository 직접 접근 방지.
        // =====================================================================

        #region Public API — 아고라 CRUD

        /// <summary>선택된 아고라의 채널 목록을 서버에서 다시 받아옴 (폴링용)</summary>
        public void RefreshChannelList()
        {
            var selected = _state.SelectedAgora.CurrentValue;
            if (selected != null)
            {
                _repository.RequestChannelList(selected.AgoraId);
            }
        }

        /// <summary>아고라 선택 -> 채널 목록 자동 요청</summary>
        public void SelectAgora(AgoraInfoData agora)
        {
            if (agora == null) return;

            _state.SetSelectedAgora(agora);
            _repository.RequestChannelList(agora.AgoraId);
        }

        public void SearchAgoraWithKeyword(string keyword) => _repository.RequestAgoraSearch(keyword);
        public void SearchAgoraWithInterests(string[] interests) => _repository.RequestAgoraSearch(interests);
        public void LeaveAgora(ulong agoraId) => _repository.RequestAgoraLeave(agoraId);
        public void DeleteAgora(ulong agoraId) => _repository.RequestAgoraDelete(agoraId);
        public void RequestChangeOwner(ulong agoraId, ulong dbId) => _repository.RequestChangeOwner(agoraId, dbId);
        public void RequestKickMember(ulong agoraId, ulong dbId) => _repository.RequestKickMember(agoraId, dbId);

        public void JoinAgora(ulong agoraId)
        {
            var max = Main.Singleton.userPlanState.LimitValue(Main.FeatureKey.MaxAgoraCount);
            if (max <= 0)
            {
                PromotionPopupUtility.Show(PromotionPopupType.MembershipPurchase);
                return;
            }

            if (_state.MyAgoraList.Count >= max)
            {
                CommonAlertUI.ShowOneButton("alert_max_signedagora".ToSystemText());
                return;
            }

            _repository.RequestAgoraJoin(agoraId);
        }

        public void UpdateAgora(ulong agoraId, string name, string description, string iconUrl, AgoraType type)
            => _repository.RequestAgoraUpdate(agoraId, name, description, iconUrl, type);

        public void RequestInviteAgora(ulong agoraId, string agoraName, ulong dbId)
            => _repository.RequestAgoraInvite(agoraId, agoraName, dbId);

        public void ResetCreationDto() => _state.ResetCreationDto();
        public AgoraInfoData FindAgora(ulong agoraId) => _state.FindAgora(agoraId);

        #endregion

        #region Public API — 알림 & 초대 수락/거절

        /// <summary>초대 수락 -> 아고라 가입 요청</summary>
        private bool AcceptAgoraInvite(ulong agoraId)
        {
            var max = Main.Singleton.userPlanState.LimitValue(Main.FeatureKey.MaxAgoraCount);
            if (max <= 0)
            {
                PromotionPopupUtility.Show(PromotionPopupType.MembershipPurchase);
                return false;
            }

            if (_state.MyAgoraList.Count >= max)
            {
                CommonAlertUI.ShowOneButton("alert_max_signedagora".ToSystemText());
                return false;
            }

            _repository.RequestAgoraJoin(agoraId);
            return true;
        }

        /// <summary>비공개 아고라 가입 요청 (일반 유저 -> 아고라장에게 C2C 전송)</summary>
        public void RequestPrivateAgoraJoin(ulong agoraId) => _repository.RequestPrivateJoin(agoraId);

        /// <summary>
        /// 비공개 아고라 가입 수락 (아고라장 -> 서버 승인 + IM 그룹 초대).
        /// IM 그룹 초대 시 요청자 측에 kTIMGroupTip_Invite가 발동되어 아고라 목록이 자동 갱신됩니다.
        /// </summary>
        private void AcceptPrivateJoin(ulong agoraId, ulong targetDbId)
        {
            _repository.RequestPrivateJoinAccept(agoraId, targetDbId);

            // 요청자를 Tencent IM 그룹에 초대 -> 요청자 측 kTIMGroupTip_Invite 발동 -> 목록 갱신
            var agora = _state.FindAgora(agoraId);
            if (agora?.GroupId is { } groupId && !string.IsNullOrEmpty(groupId))
            {
                TencentGroupService.InviteToGroupAsync(groupId, new List<string> { targetDbId.ToString() }, CancellationToken.None).Forget();
            }
        }

        /// <summary>
        /// 알림 카드의 수락/거절 버튼 처리.
        /// 기획서: 처리 후 알림을 삭제하지 않고 IsHandled=true로 마킹하여 음영 처리.
        /// </summary>
        public void HandleNotificationAction(AgoraNotificationData nfy, bool accepted)
        {
            if (nfy.IsHandled) return;

            if (accepted)
            {
                switch (nfy.Type)
                {
                    case AgoraNotificationType.AgoraInvite:
                        if (!AcceptAgoraInvite(nfy.AgoraId)) return;

                        MarkRelatedNotificationsHandled(nfy, NotificationHandleResult.Accepted);
                        return;
                    case AgoraNotificationType.AgoraApplyRequest:
                        AcceptPrivateJoin(nfy.AgoraId, nfy.TargetDbId);
                        break;
                    case AgoraNotificationType.ChannelInvite:
                        _repository.RequestChannelJoin(nfy.ChannelId, nfy.InviteCode);
                        // TODO: 채널 초대 수락 API (서버 프로토콜 확인 필요)
                        break;
                }
            }

            // TODO: 거절 시 서버에 거절 API 호출이 필요하면 여기에 추가
            _state.HandleNotification(nfy, accepted ? NotificationHandleResult.Accepted : NotificationHandleResult.Declined);
        }

        private void MarkRelatedNotificationsHandled(AgoraNotificationData source, NotificationHandleResult result)
        {
            // HandleNotification이 리스트를 수정할 수 있으므로 역순 순회
            var notifications = _state.Notifications;
            for (int i = notifications.Count - 1; i >= 0; i--)
            {
                var n = notifications[i];
                if (n.Type == source.Type && n.AgoraId == source.AgoraId)
                {
                    _state.HandleNotification(n, result);
                }
            }
        }

        /// <summary>
        /// 삭제 모드에서 선택한 알림 일괄 삭제.
        /// 기획서: 미처리 알림을 삭제하면 자동 거절 처리됨 (별도 거절 확인 팝업 없음).
        /// </summary>
        public void DeleteNotifications(List<AgoraNotificationData> targets)
        {
            foreach (var nfy in targets)
            {
                if (nfy.IsPendingAction)
                {
                    // 미처리 선택형 -> 자동 거절 처리
                    HandleNotificationAction(nfy, accepted: false);
                }
            }

            _state.RemoveNotifications(targets);
        }

        /// <summary>유효하지 않은 요청으로 판명된 알림을 리스트에서 제거</summary>
        public void RemoveInvalidNotification(AgoraNotificationData nfy)
        {
            _state.RemoveNotification(nfy);
        }

        /// <summary>Tencent IM 그룹에 유저 초대 (채널 입장용)</summary>
        public async UniTask<bool> InviteToChannelAsync(string channelGroupId, string userId, CancellationToken ct)
        {
            return await TencentGroupService.InviteToGroupAsync(channelGroupId, new List<string> { userId }, ct);
        }

        #endregion

        #region Public API — 채널 (생성, 입장, 삭제, 수정, 멤버 조회)

        public void CreateChannel(ulong agoraId, string channelName, string description,
            ENUM_AGORA_CHANNEL_TYPE channelType)
            => _repository.RequestChannelCreate(agoraId, channelName, description, channelType);

        /// <summary>
        /// 채널 입장 — 멤버 수 조회 후 MaxChannelMembers 이상이면 입장 차단.
        /// 채널 정보가 없으면 조건 없이 Join 시도.
        /// </summary>
        public async UniTask JoinChannel(ulong channelId)
        {
            var channel = _state.SelectedAgora.CurrentValue?.Channels
                .FirstOrDefault(c => c.ChannelId == channelId);

            if (channel == null)
            {
                _repository.RequestChannelJoin(channelId);
                return;
            }

            var result = await RequestChannelMemberListAsync(channelId);
            if (result is { MemberCount: >= MaxChannelMembers })
            {
                CommonAlertUI.ShowOneButton("alert_channel_full".ToSystemText());
                return;
            }

            _repository.RequestChannelJoin(channelId);
        }

        public void DeleteChannel(ulong agoraId, ulong channelId)
            => _repository.RequestChannelDelete(agoraId, channelId);

        public void UpdateChannel(ulong agoraId, ulong channelId, string channelName, string description)
            => _repository.RequestChannelUpdate(agoraId, channelId, channelName, description);

        private void RequestChannelMemberList(ulong channelId)
            => _repository.RequestChannelMemberList(channelId);

        #endregion

        #region Public API — Tencent IM 아고라 멤버 조회

        /// <summary>
        /// 아고라 멤버 목록 조회 (Tencent IM 그룹 기반).
        /// ※ 채널 멤버(현재 3D 씬 접속자)와는 다릅니다.
        /// SDK 호출은 TencentGroupService에 위임합니다.
        /// </summary>
        public UniTask<List<AgoraMemberData>> GetMembersAsync(string groupId, CancellationToken ct)
            => _chatService.GroupService.GetAgoraMembersAsync(groupId, ct);

        #endregion

            // =====================================================================
            //  씬 전환 — 채널 입장 / 퇴장
            // =====================================================================

            #region 씬 전환 — 채널 입장 / 퇴장 (3D 월드 로딩 + UI 전환)

            public void EnterChannel() => EnterChannelWithLoadingAsync().Forget();
            public void ExitChannel() => ExitChannelWithLoadingAsync().Forget();

            private async UniTask EnterChannelWithLoadingAsync()
            {
                UIManager.Show<LoadingPopupUI>(UIList.LoadingPopupUI);
                try
                {
                    await EnterChannelAsync();
                }
                finally
                {
                    UIManager.Hide<LoadingPopupUI>(UIList.LoadingPopupUI);
                }
            }

            private async UniTask ExitChannelWithLoadingAsync()
            {
                UIManager.Show<LoadingPopupUI>(UIList.LoadingPopupUI);
                try
                {
                    await ExitChannelAsync();
                }
                finally
                {
                    UIManager.Hide<LoadingPopupUI>(UIList.LoadingPopupUI);
                }
            }

            private async UniTask EnterChannelAsync()
            {
                try
                {
                    _isEnteringChannel = true;
                    _pendingForceExit = false;

                    EnsureLocalPlayerActive();

                    var didLoad = await IngameLevelLoaderSystem.Instance.LoadAttractionMainLevelAsync(
                        AttractionLevelType.MultiRoom,
                        _state.FieldData.Position,
                        _state.FieldData.Direction);

                    if (!didLoad || _pendingForceExit)
                    {
                        LogUtil.Log($"[AgoraService] 씬 로드 실패 또는 채널 삭제됨: pendingForceExit={_pendingForceExit}");
                        _isEnteringChannel = false;

                        if (_pendingForceExit)
                        {
                            _pendingForceExit = false;
                            _state.ClearCurrentChannel();
                            CommonAlertUI.ShowOneButton("alert_autoclose".ToSystemText());
                            ExitChannel();
                        }

                        return;
                    }

                    await IngameLevelLoaderSystem.Instance.UnloadMainlLevelAsync();

                    // 씬 로드 완료 후에도 한번 더 체크
                    if (_pendingForceExit)
                    {
                        _isEnteringChannel = false;
                        _pendingForceExit = false;
                        _state.ClearCurrentChannel();
                        CommonAlertUI.ShowOneButton("alert_autoclose".ToSystemText());
                        ExitChannel();
                        return;
                    }

                    _repository.RequestChannelEnter();

                    SetPlayerPosition(_state.FieldData.Position, _state.FieldData.Direction);
                    await UniTask.Yield();

                    UIManager.Hide<HomeUI>(UIList.HomeUI);
                    UIManager.Show<AgoraRoomUI>(UIList.AgoraRoomUI);
                    InputController.Singleton.CurrentActionMap = InputController.InputActionMapType.Player;

                    LogUtil.Log($"[AgoraService] 채널 입장 완료: {_state.CurrentChannel.CurrentValue?.ChannelName}");
                }
                finally
                {
                    _isEnteringChannel = false;
                }
            }

            private async UniTask ExitChannelAsync()
            {
                // 카메라 시점 복구 (미러 시점인 채로 퇴장한 경우 대비)
                if (IngameCameraSystem.Instance != null)
                {
                    IngameCameraSystem.Instance.SelectTarget(EnumCategory.User, init: true);
                }

                // 방문 기록 저장 (씬 언로드 전에 수행)
                var channel = _state.CurrentChannel.CurrentValue;
                var agora = SelectedAgora.CurrentValue;
                if (channel != null && agora != null)
                {
                    MirrorVisitHistory.RecordVisit(channel, agora);
                }

                EnsureLocalPlayerActive();

                var didLoad = await IngameLevelLoaderSystem.Instance.LobbyLevelAsync(false);
                if (!didLoad)
                {
                    LogUtil.Log("[AgoraService] 로비 씬 로드 실패");
                    return;
                }

                await IngameLevelLoaderSystem.Instance.UnloadMainlLevelAsync();

                SetPlayerPosition(Vector3.zero, new Vector3(0f, 180f, 0f));
                await UniTask.Yield();

                UIManager.Hide<AgoraRoomUI>(UIList.AgoraRoomUI);
                UIManager.Show<HomeUI>(UIList.HomeUI, null, true);
                _state.ClearCurrentChannel();

                // 채널 멤버 수 갱신 (씬 퇴장 후 AgoraUI 복귀 시 최신 인원 표시)
                var channels = _state.SelectedAgora.CurrentValue?.Channels;
                if (channels != null)
                {
                    FetchAllChannelMemberCounts(channels).Forget();
                }

                InputController.Singleton.CurrentActionMap = InputController.InputActionMapType.UI;
                LogUtil.Log("[AgoraService] 채널 퇴장 완료");
            }

            #endregion

            // =====================================================================
            //  Private 헬퍼
            // =====================================================================

            #region Private 헬퍼 — 알림 생성

            /// <summary>
            /// 알림 생성 공통 메서드.
            /// 기획서 스트링키 체계에 맞춰 텍스트를 직접 넣지 않고, Type + 파라미터로 UI에서 동적 생성.
            /// </summary>
            private void PushNotification(
                AgoraNotificationType type, ulong agoraId, string agoraName,
                string senderUserId = null, string senderNickname = null,
                ulong targetDbId = 0, ulong channelId = 0, string channelName = null
                ,string inviteCode = null)
            {
                _state.AddNotification(new AgoraNotificationData
                {
                    Type = type,
                    AgoraId = agoraId,
                    AgoraName = agoraName,
                    ChannelId = channelId,
                    ChannelName = channelName,
                    SenderUserId = senderUserId,
                    SenderNickname = senderNickname ?? (senderUserId != null ? ResolveNickname(senderUserId) : null),
                    TargetDbId = targetDbId,
                    Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                    InviteCode = inviteCode,
                });
            }

            #endregion

            #region Private 헬퍼 — 조회 & 멤버 수 관리

            private AgoraInfoData FindAgoraByGroupId(string groupId)
            {
                var list = _state.MyAgoraList;
                for (int i = 0; i < list.Count; i++)
                {
                    if (list[i].GroupId == groupId) return list[i];
                }

                return null;
            }

            /// <summary>아고라 멤버 수 1 감소 + 멤버 변경 이벤트 발행</summary>
            private void DecrementMemberCount(string groupId)
            {
                var agora = FindAgoraByGroupId(groupId);
                if (agora is not { MemberCount: > 0 }) return;

                agora.MemberCount--;
                _state.NotifyMemberInfoChanged(agora.AgoraId);
            }

            /// <summary>아고라 아이콘 URL 이미지 캐시 무효화 (수정/삭제 시 호출)</summary>
            private void InvalidateIconCache(ulong agoraId) => InvalidateIconCache(_state.FindAgora(agoraId));

            private static void InvalidateIconCache(AgoraInfoData agora)
            {
                if (agora != null && !string.IsNullOrEmpty(agora.IconUrl))
                {
                    AvatarSpriteCache.Invalidate(agora.IconUrl);
                }
            }

            /// <summary>채널 멤버 목록 1회성 비동기 조회 (타임아웃 포함)</summary>
            private async UniTask<ChannelMemberListResult?> RequestChannelMemberListAsync(
                ulong channelId, int timeoutMs = 3000, CancellationToken ct = default)
            {
                var tcs = new UniTaskCompletionSource<ChannelMemberListResult>();

                using var sub = _repository.OnChannelMemberListReceived
                    .Where(r => r.ChannelId == channelId)
                    .Take(1)
                    .Subscribe(res => tcs.TrySetResult(res));

                RequestChannelMemberList(channelId);

                // ct와 timeout 중 먼저 발동되는 쪽으로 취소
                using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                linkedCts.CancelAfter(timeoutMs);

                var (isCanceled, result) = await tcs.Task
                    .AttachExternalCancellation(linkedCts.Token)
                    .SuppressCancellationThrow();

                if (isCanceled)
                {
                    _repository.ClearPendingMembers();
                }

                return isCanceled ? null : result;
            }

            /// <summary>모든 채널의 멤버 수를 순차 조회. 재호출 시 이전 실행 자동 취소.</summary>
            private async UniTaskVoid FetchAllChannelMemberCounts(List<AgoraChannelData> channels)
            {
                _fetchMemberCts?.Cancel();
                _fetchMemberCts?.Dispose();
                _fetchMemberCts = new CancellationTokenSource();
                _repository.ClearPendingMembers();

                var ct = _fetchMemberCts.Token;

                // 스냅샷: ToList()보다 배열이 할당 작음.
                // await 도중 channels 참조가 교체될 수 있으므로 스냅샷 필요.
                var snapshot = channels.ToArray();
                for (int i = 0; i < snapshot.Length; i++)
                {
                    if (ct.IsCancellationRequested) return;
                    await RequestChannelMemberListAsync(snapshot[i].ChannelId, 2000, ct);
                    if (ct.IsCancellationRequested) return;
                    await UniTask.Delay(50, cancellationToken: ct).SuppressCancellationThrow();
                }
            }

            public void NotifyChannelListChanged()
            {
                var channels = _state.SelectedAgora.CurrentValue?.Channels;
                if (channels != null) _onChannelListForUI.OnNext(channels);
            }

            #endregion

            #region Private 헬퍼 — 유저 정보, Tencent IM, 씬/플레이어

            private static string GetMyUserId() => UserDataModel.Singleton.PlayerInfoData.DatabaseID.ToString();

            /// <summary>FriendsDto에서 닉네임 조회. 없으면 userId 그대로 반환.</summary>
            private static string ResolveNickname(string senderUserId)
            {
                if (ulong.TryParse(senderUserId, out var dbId))
                {
                    var friends = UserDataModel.Singleton.FriendsDto.Friends;
                    if (friends.TryGetValue(dbId, out var summary))
                    {
                        return summary.Nickname;
                    }
                }

                return senderUserId;
            }

            /// <summary>
            /// 아고라 제거 시, 미러가 해당 아고라의 채널에 잔류 중이면 상태 클리어.
            /// </summary>
            private static void ClearMirrorDeployIfInAgora(AgoraInfoData agora)
            {
                var persona = UserDataModel.Singleton.PersonaInfoDto;
                if (string.IsNullOrEmpty(persona.DeployedChannelGroupId) && persona.DeployedAgoraId == 0) return;

                if (persona.DeployedAgoraId != 0 && persona.DeployedAgoraId == agora.AgoraId)
                {
                    Debug.Log($"[AgoraService] 미러 잔류 해제 (AgoraId 매칭): {persona.DeployedChannelGroupId}");
                    persona.ClearMirrorDeploy();
                    return;
                }

                var channels = agora.Channels;
                if (channels == null) return;
                var deployedId = persona.DeployedChannelGroupId;
                if (string.IsNullOrEmpty(deployedId)) return;

                for (int i = 0; i < channels.Count; i++)
                {
                    if (channels[i].GroupId == deployedId)
                    {
                        Debug.Log($"[AgoraService] 미러 잔류 해제 (GroupId 매칭): {deployedId}");
                        persona.ClearMirrorDeploy();
                        return;
                    }
                }
            }

            private static void ClearMirrorDeployIfAgoraId(ulong agoraId)
            {
                var persona = UserDataModel.Singleton.PersonaInfoDto;
                if (persona.DeployedAgoraId != 0 && persona.DeployedAgoraId == agoraId)
                {
                    Debug.Log($"[AgoraService] 미러 잔류 해제 (AgoraId 폴백): {persona.DeployedChannelGroupId}");
                    persona.ClearMirrorDeploy();
                }
            }

            private static void EnsureLocalPlayerActive()
            {
                var localPlayer = IngameFieldSubjectSystem.GetLocalPlayer();
                if (!localPlayer.NetworkGameObject.activeSelf)
                {
                    localPlayer.NetworkGameObject.SetActive(true);
                }
            }

            private static void SetPlayerPosition(Vector3 position, Vector3 direction)
            {
                var character = PlayerController.Instance.LinkedCharacter;
                character.CharacterLookDir = direction;
                character.SetPositionAndRotation(position, Quaternion.Euler(direction));
            }

            private static bool IsSameChannelLayout(List<AgoraChannelData> oldList, List<AgoraChannelData> newList)
            {
                if (oldList == null || newList == null) return false;
                if (oldList.Count != newList.Count) return false;

                for (int i = 0; i < oldList.Count; i++)
                {
                    if (oldList[i].ChannelId != newList[i].ChannelId) return false;
                }

                return true;
            }

            #endregion
    }
}