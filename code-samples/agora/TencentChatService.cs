using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using com.tencent.imsdk.unity;
using com.tencent.imsdk.unity.enums;
using com.tencent.imsdk.unity.types;
using Cysharp.Threading.Tasks;
using FLATBUFFERS;
using Newtonsoft.Json;
using R3;
using UnityEngine;

namespace REIW
{
    using Communication;

    /// <summary>
    /// Tencent IM SDK 통합 서비스 (싱글톤).
    /// SDK 초기화/로그인, 프로필 조회, C2C 메시지 파싱(아고라 초대/비공개 가입 요청), 채팅 로그 관리.
    /// 하위 모듈: TencentGroupService, TencentProfileService, TencentChatState.
    /// AgoraService가 이 서비스의 Observable을 구독하며, 순환 의존 방지를 위해 Resolver 콜백 주입.
    /// </summary>
    public class TencentChatService : IDisposable
    {
        #region Singleton — 생성, 해제, 인스턴스 접근

        /// <summary>초기화된 서비스 인스턴스. ~미초기화 시 예외 발생~ 예외 흐린 눈 (bool로 기다리는 녀석이 있네)</summary>
        public static TencentChatService Instance { get; private set; }

        /// <summary>
        /// 서비스 인스턴스 생성 + SDK 초기화 (앱 시작 시 1회).
        /// AgoraService.CreateInstance()보다 먼저 호출해야 합니다.
        /// </summary>
        public static async UniTask CreateInstanceAsync(
            long appId,
            string userSig,
            ulong userId,
            string userName,
            IEnumerable<string> groupIds,
            string worldGroupId,
            CancellationToken ct)
        {
            Instance?.Dispose();
            Instance = new TencentChatService();
            await Instance.InitializeAsync(appId, userSig, userId, userName, groupIds, worldGroupId, ct);
        }

        /// <summary>
        /// IM 초기화 완료 후 하위 서비스 일괄 생성.
        /// 외부에서 MessageRepository를 직접 꺼내지 않도록 여기서 캡슐화.
        /// </summary>
        public void InitializeDependentServices(ENUM_BYOK_TYPE savedByokType)
        {
            AgoraService.CreateInstance(this);
            TencentConversationChatService.CreateInstance(_messageRepository);
            ChatTurnGate.CreateInstance();
            BYOKDemo.CreateInstance(_messageRepository);
            BYOKDemo.Instance.LoadByokSettings(savedByokType);
            GroupService.FetchWorldGroupCacheAsync(CancellationToken.None).Forget();
            
            // 멤버십 변경 시 텐센트 프로필 업데이트
            Main.Singleton.userPlanState.OnMembershipChanged += OnMembershipChanged;
        }
        
        private void OnMembershipChanged()
        {
            UpdateMembershipToTencentAsync(CancellationToken.None).Forget();
        }
        
        private async UniTaskVoid UpdateMembershipToTencentAsync(CancellationToken ct)
        {
            var profile = await GetMyUserProfileAsync(ct);
            if (profile == null) return;

            if (!UserSummaryPayload.TryParse(profile.user_profile_face_url, out var payload))
                payload = new UserSummaryPayload();

            payload.mebmershipTier= Main.Singleton.userPlanState.GetTier();

            await UpdateMyUserSummaryPayloadAsync(payload, ct);
        }

        /// <summary>서비스 해제 (앱 종료 시)</summary>
        public static void ReleaseInstance()
        {
            Instance?.Dispose();
            Instance = null;
        }

        /// <summary>
        /// 앱 백그라운드/포그라운드 전환 시 IM 서버에 온/오프라인 상태 노티
        /// </summary>
        public void OnApplicationPause(bool pause)
        {
            if (!_isInitialized) return;

#if !UNITY_EDITOR && (UNITY_ANDROID || UNITY_IOS)
            if (pause)
            {
                TencentIMSDK.MsgDoBackground(0, (code, desc, data) =>
                    Debug.Log($"[Push] MsgDoBackground: {code} {desc} {data}"));
            }
            else
            {
                TencentIMSDK.MsgDoForeground((code, desc, data) =>
                    Debug.Log($"[Push] MsgDoForeground: {code} {desc} {data}"));
            }
#endif
        }

        #endregion

        #region 하위 모듈

        private readonly TencentChatState _state;
        private readonly IMessageRepository _messageRepository;

        /// <summary>그룹 가입/탈퇴/초대, GroupTip 콜백 처리</summary>
        public TencentGroupService GroupService { get; }

        /// <summary>프로필 이미지/닉네임 변경 구독 (초기화 시 생성)</summary>
        public TencentProfileService ProfileService { get; private set; }

        #endregion

        #region Observable — 그룹 이벤트 (AgoraService에서 구독)

        /// <summary>그룹에 새 멤버 가입 (GroupId 전달)</summary>
        public Observable<(string GroupId, string UserId)> OnGroupMemberEnter => _onGroupMemberEnter;

        /// <summary>그룹 멤버 자발적 탈퇴</summary>
        public Observable<(string GroupId, string UserId)> OnGroupMemberQuit => _onGroupMemberQuit;

        /// <summary>그룹 멤버 강퇴</summary>
        public Observable<(string GroupId, string userId, GroupKickReason reason)> OnGroupMemberKicked => _onGroupMemberKicked;

        /// <summary>그룹 해산 (아고라장이 삭제)</summary>
        public Observable<string> OnGroupDismissed => _onGroupDismissed;

        /// <summary>그룹 정보 변경 (이름, 설명 등)</summary>
        public Observable<string> OnGroupInfoChanged => _onGroupInfoChanged;

        /// <summary>아고라 초대 수신 (C2C CloudData 파싱 결과)</summary>
        public Observable<AgoraInviteReceivedData> OnAgoraInviteReceived => _onAgoraInviteReceived;

        /// <summary>그룹 Tip 이벤트 원본 (kTIMGroupTip_Invite 등)</summary>
        public Observable<GroupTipsElem> OnGroupTips => GroupService.OnGroupTips;

        /// <summary>World 그룹 NameCard 변경 (닉네임 동기화용)</summary>
        public Observable<(string UserId, string NewNameCard)> OnUserNameCardChanged => _onUserNameCardChanged;

        /// <summary>아고라 비공개 채널 초대 받을 때 </summary>
        public Observable<ChannelInviteReceivedData> OnChannelInviteReceived => _onChannelInviteReceived;

        public Observable<AgoraJoinRequestReceivedData> OnAgoraJoinRequestReceived => _onAgoraJoinRequestReceived;

        #endregion

        #region Observable — 채팅/상태 (UI에서 직접 구독)

        public Observable<IReadOnlyList<Incoming>> OnIncoming => _messageRepository.OnIncoming;

        #endregion

        #region 필드 — Subject (내부 이벤트 소스)
        private readonly Subject<ChannelInviteReceivedData> _onChannelInviteReceived = new();
        private readonly Subject<string> _onGroupDismissed = new();
        private readonly Subject<string> _onGroupInfoChanged = new();
        private readonly Subject<(string GroupId, string UserId)> _onGroupMemberQuit = new();
        private readonly Subject<(string GroupId, string UserId)> _onGroupMemberEnter = new();
        private readonly Subject<(string groupId, string userId, GroupKickReason reason)> _onGroupMemberKicked = new();
        private readonly Subject<(string UserId, string NewNameCard)> _onUserNameCardChanged = new();
        private readonly Subject<AgoraInviteReceivedData> _onAgoraInviteReceived = new();
        private readonly Subject<AgoraJoinRequestReceivedData> _onAgoraJoinRequestReceived = new();

        #endregion

        #region State 프록시 — 읽기 전용 (State 직접 노출 방지)

        public string MyUserId => _state.MyUserId;
        public string MirrorGroupID => _state.MirrorGroudID;
        public string WorldGroupId => _state.WorldGroupId;

        #endregion

        #region 생성자 / 초기화

        private bool _isInitialized;

        private TencentChatService()
        {
            _state = new TencentChatState();
            ITencentChatRepository repository = new TencentChatRepository();
            GroupService = new TencentGroupService(_state, repository);
            _messageRepository = new MessageRepository();
        }

        /// <summary>
        /// SDK 초기화 -> 로그인 -> 프로필 설정 -> 그룹 가입 일괄 수행.
        /// CreateInstanceAsync()에서 호출됨.
        /// </summary>
        private async UniTask InitializeAsync(
            long appId,
            string userSig,
            ulong userId,
            string userName,
            IEnumerable<string> groupIds,
            string worldGroupId,
            CancellationToken ct)
        {
            if (_isInitialized)
            {
                Debug.LogWarning("[TencentChatService] Already initialized");
                return;
            }

            _state.SetMyUserId(userId.ToString());
            _state.SetWorldGroupId(worldGroupId);

            var config = new SdkConfig
            {
                sdk_config_config_file_path = $"{Application.persistentDataPath}/Logs/.TIM-Config",
                sdk_config_log_file_path = $"{Application.persistentDataPath}/Logs/.TIM-Log"
            };

            TencentIMSDK.Init(appId, config);
            _isInitialized = true;

            await TIMHelper.WrapAsync<string>(cb => TencentIMSDK.Login(userId.ToString(), userSig, cb), ct);
            _state.IsLoggedIn.Value = true;

            var param = new UserProfileItem
            {
                user_profile_item_nick_name = userName,
                user_profile_item_add_permission = TIMProfileAddPermission.kTIMProfileAddPermission_NeedConfirm,
            };

            await TIMHelper.WrapAsync<string>(cb => TencentIMSDK.ProfileModifySelfUserProfile(param, cb), ct);

            ProfileService?.Dispose();
            ProfileService = new TencentProfileService(userId.ToString());

            GroupService.RegisterCallbacks();
            RegisterC2CMessageCallback();
            BindGroupTipRouting();

            UserDataModel.Singleton.RepoFacade ??= new TencentRepoFacade(userId.ToString());
            UserDataModel.Singleton.RepoFacade.RefreshAllFriendsToDto().Forget();
            UserDataModel.Singleton.RepoFacade.RefreshRequestsToDtoAsync().Forget();
            UserDataModel.Singleton.RepoFacade.RefreshAllBlacklistsToDto().Forget();

            foreach (var groupId in groupIds) await GroupService.JoinGroupAsync(groupId, ct);
            if (!string.IsNullOrEmpty(worldGroupId)) await GroupService.JoinGroupAsync(worldGroupId, ct);

            // 오프라인 푸시 토큰 등록 (IM 로그인 완료 후)
            RegisterOfflinePushToken().Forget();
        }

#pragma warning disable CS1998
        /// <summary>
        /// 오프라인 푸시 토큰을 IM 서버에 등록.
        /// Firebase FCM 토큰이 아직 안 왔으면 도착할 때까지 대기 후 등록.
        /// </summary>
        private async UniTaskVoid RegisterOfflinePushToken()
        {
#if !UNITY_EDITOR && (UNITY_ANDROID || UNITY_IOS)
            var platform = PlatformManager.Singleton?.Platform;
            if (platform == null)
            {
                Debug.LogWarning("[Push] Platform not available");
                return;
            }

            // 토큰이 아직 없으면 최대 15초 대기
            if (string.IsNullOrEmpty(platform.PushToken))
            {
                Debug.Log("[Push] PushToken not ready, waiting...");

                var cts = new CancellationTokenSource(TimeSpan.FromSeconds(15));
                try
                {
                    await UniTask.WaitUntil(
                        () => !string.IsNullOrEmpty(platform.PushToken),
                        cancellationToken: cts.Token);
                }
                catch (OperationCanceledException)
                {
                    Debug.LogWarning("[Push] PushToken wait timed out (15s)");
                    return;
                }
                finally
                {
                    cts.Dispose();
                }
            }

#if UNITY_ANDROID
            const int businessId = 8799;
#elif UNITY_IOS
            const int businessId = 17281;
#endif

            var pushToken = new OfflinePushToken
            {
                offline_push_token_token = platform.PushToken,
                offline_push_token_business_id = businessId,
                offline_push_token_is_tpns_token = false,
            };

            TencentIMSDK.MsgSetOfflinePushToken(pushToken, (code, desc, data) =>
            {
                if (code == 0)
                {
                    Debug.Log($"[Push] MsgSetOfflinePushToken OK — businessId:{businessId}, token:{platform.PushToken[..8]}...");
                }
                else
                {
                    Debug.LogError($"[Push] MsgSetOfflinePushToken FAIL: {code} / {desc}");
                }
            });
#endif
        }
#pragma warning restore CS1998

        #endregion

        // =====================================================================
        //  Public API
        // =====================================================================

        #region Public API — 프로필 (조회, 닉네임 변경, 프로필 이미지 변경)

        public async UniTask<UserProfile> GetMyUserProfileAsync(CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(_state.MyUserId))
            {
                throw new InvalidOperationException("[TencentChatService] MyUserId is not set.");
            }

            var param = new FriendShipGetProfileListParam
            {
                friendship_getprofilelist_param_identifier_array = new List<string> { _state.MyUserId }
            };

            var res = await TIMHelper.WrapAsync<List<UserProfile>>(cb => TencentIMSDK.ProfileGetUserProfileList(param, cb), ct);
            return res.FirstOrDefault();
        }
        
        public async UniTask<string> UpdateMyUserSummaryPayloadAsync(UserSummaryPayload payload, CancellationToken ct)
        {
            if (payload == null) throw new ArgumentNullException(nameof(payload));

            var json = JsonConvert.SerializeObject(payload);

            var param = new UserProfileItem
            {
                user_profile_item_face_url = json
            };

            if (!string.IsNullOrWhiteSpace(payload.nick))
                param.user_profile_item_nick_name = payload.nick;

            return await TIMHelper.WrapAsync<string>(
                cb => TencentIMSDK.ProfileModifySelfUserProfile(param, cb), ct);
        }

        #endregion

        #region Public API — 채팅 관련 (전송, 히스토리 조회, 갱신)

        public UniTask<MessageData> SendTextToGroupAsync(string groupId, string text, CancellationToken ct)
        {
            return _messageRepository.SendTextToGroup(groupId, text, ct);
        }

        public UniTask<MessageData> SendTextWithByokAsync(string groupId, string text, BYOKOptions options, CancellationToken ct)
        {
            return _messageRepository.SendTextToGroupWithByokOptions(groupId, text, options, ct);
        }

        public UniTask<List<ConvInfo>> GetConversationListAsync(CancellationToken ct)
        {
            return _messageRepository.GetConversationListAsync(ct);
        }

        #endregion

        // =====================================================================
        //  C2C 메시지 처리
        // =====================================================================

        #region C2C 메시지 처리 — 아고라 초대 / 비공개 가입 요청 파싱

        /// <summary>
        /// C2C(1:1) 메시지 수신 콜백.
        /// TIMCustomElem.Data의 stringKey로 초대/가입요청 등을 분기합니다.
        /// </summary>
        private void RegisterC2CMessageCallback() => TencentIMSDK.AddRecvNewMsgCallback(OnRecvNewMessage);
        private void UnregisterC2CMessageCallback() => TencentIMSDK.RemoveRecvNewMsgCallback(OnRecvNewMessage);

        private void OnRecvNewMessage(List<Message> messages, string userData)
        {
            foreach (var msg in messages)
            {
                switch (msg.message_conv_type)
                {
                    case TIMConvType.kTIMConv_C2C:
                        var customData = GetCustomDataFromMessage(msg);
                        if (!string.IsNullOrEmpty(customData))
                            TryParseAgoraC2CNotification(msg, customData);
                        break;

                    case TIMConvType.kTIMConv_Group:
                    case TIMConvType.kTIMConv_System:
                        TryHandleGroupReport(msg);
                        break;
                }
            }
        }

        /// <summary>
        /// 그룹 시스템 알림(GroupReport) 처리.
        /// 강퇴/해산 등 당사자 본인에게만 전달되는 알림을 감지합니다.
        /// GroupTips는 그룹에 남아있는 멤버에게만 전달되므로,
        /// 강퇴당한 본인은 GroupReport를 통해서만 알 수 있습니다.
        /// </summary>
        private void TryHandleGroupReport(Message msg)
        {
            if (msg.message_elem_array == null) return;

            foreach (var elem in msg.message_elem_array)
            {
                if (elem.elem_type != TIMElemType.kTIMElem_GroupReport) continue;

                var groupId = elem.group_report_elem_group_id;
                if (string.IsNullOrEmpty(groupId) || groupId == _state.WorldGroupId) continue;

                switch (elem.group_report_elem_report_type)
                {
                    case TIMGroupReportType.kTIMGroupReport_BeKicked:
                        var msg_text = elem.group_report_elem_msg ?? string.Empty;
                        var reason = msg_text switch
                        {
                            "User Membership Expired"   => GroupKickReason.MembershipExpired,
                            "Mirror Membership Expired" => GroupKickReason.MirrorMembershipExpired,
                            "Membership Expired"        => GroupKickReason.MembershipExpired,
                            "Agora Member Kicked"       => GroupKickReason.AdminKick,
                            _                           => GroupKickReason.Unknown
                        };

                        Debug.Log($"[TencentChat] GroupReport: BeKicked — Group: {groupId}, Reason: {reason}, Msg: {msg_text}".Color(Color.red).Bold());
                        _onGroupMemberKicked.OnNext((groupId, _state.MyUserId, reason));
                        break;

                    case TIMGroupReportType.kTIMGroupReport_Delete:
                        Debug.Log($"[TencentChat] GroupReport: Delete — Group: {groupId}".Color(Color.red).Bold());
                        _onGroupDismissed.OnNext(groupId);
                        break;
                }
            }
        }

        /// <summary>
        /// TIMCustomElem.Data 기반 C2C 알림 파싱.
        /// stringKey로 초대/가입요청 등을 구분합니다.
        /// </summary>
        private void TryParseAgoraC2CNotification(Message msg, string customData)
        {
            try
            {
                if (msg.message_sender == _state.MyUserId) return;

                var data = JsonUtility.FromJson<AgoraC2CCustomData>(customData);
                if (string.IsNullOrEmpty(data.stringKey)) return;

                switch (data.stringKey)
                {
                    case "agora_alaram_invite_agora_detail":
                        
                        if (ulong.TryParse(msg.message_sender, out var senderDbId) &&
                            UserDataModel.Singleton.FriendsDto.IsBlocked(senderDbId))
                        {
                            Debug.Log($"[TencentChat] 차단 유저 초대 무시: {msg.message_sender}");
                            break;
                        }
                        
                        _onAgoraInviteReceived.OnNext(new AgoraInviteReceivedData
                        {
                            AgoraId = data.agoraID,
                            AgoraName = data.agora_name,
                            InviterUserId = msg.message_sender,
                        });
                        Debug.Log($"[TencentChat] 아고라 초대 수신: {data.agora_name} from {data.user_name}".Bold());
                        break;
                    
                    case "agora_alaram_invite_channel_detail":
                        if (ulong.TryParse(msg.message_sender, out var senderDbId2) &&
                            UserDataModel.Singleton.FriendsDto.IsBlocked(senderDbId2))
                        {
                            Debug.Log($"[TencentChat] 차단 유저 채널 초대 무시: {msg.message_sender}");
                            break;
                        }

                        _onChannelInviteReceived.OnNext(new ChannelInviteReceivedData
                        {
                            ChannelId     = (ulong)data.channelID,
                            ChannelName   = data.channel_name,
                            InviterUserId = msg.message_sender,
                            InviteCode    = data.inviteCode,
                        });
                        Debug.Log($"[TencentChat] 채널 초대 수신: {data.channel_name} from {data.user_name}".Bold());
                        break;

                    case "agora_alaram_approval_agora":
                    {
                        if (ulong.TryParse(msg.message_sender, out var requesterDbId) &&
                            UserDataModel.Singleton.FriendsDto.IsBlocked(requesterDbId))
                        {
                            Debug.Log($"[TencentChat] 차단 유저 가입 요청 무시: {msg.message_sender}");
                            break;
                        }

                        _onAgoraJoinRequestReceived.OnNext(new AgoraJoinRequestReceivedData
                        {
                            AgoraId = data.agoraID,
                            AgoraName = data.agora_name,
                            RequesterUserId = msg.message_sender,
                            RequesterName = data.user_name,
                        });
                        Debug.Log($"[TencentChat] 비공개 가입 요청 수신: {data.agora_name} from {data.user_name}".Bold());
                        break;
                    }

                    default:
                        Debug.Log($"[TencentChat] 미처리 C2C 알림: {data.stringKey}");
                        break;
                }
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[TencentChat] C2C CustomData 파싱 실패: {e.Message}");
            }
        }

        // 누수 방지
        private readonly CompositeDisposable _disposables = new();

        /// <summary>
        /// GroupTip 이벤트를 타입별 Subject로 라우팅.
        /// InitializeAsync()에서 RegisterCallbacks() 이후 호출.
        /// </summary>
        private void BindGroupTipRouting()
        {
            // 월드 그룹은 아고라와 무관 -> 전체 필터
            var agoraTips = GroupService.OnGroupTips
                .Where(tip => tip.group_tips_elem_group_id != _state.WorldGroupId);

            // 멤버 입장
            agoraTips
                .Where(tip => tip.group_tips_elem_tip_type == TIMGroupTipType.kTIMGroupTip_Invite)
                .Select(tip => (tip.group_tips_elem_group_id, tip.group_tips_elem_op_user))
                .Subscribe(data => _onGroupMemberEnter.OnNext(data))
                .AddTo(_disposables);

            // 멤버 탈퇴
            agoraTips
                .Where(tip => tip.group_tips_elem_tip_type == TIMGroupTipType.kTIMGroupTip_Quit)
                .Select(tip => (tip.group_tips_elem_group_id, tip.group_tips_elem_op_user))
                .Subscribe(data => _onGroupMemberQuit.OnNext(data))
                .AddTo(_disposables);

            // 멤버 강퇴
            agoraTips
                .Where(tip => tip.group_tips_elem_tip_type == TIMGroupTipType.kTIMGroupTip_Kick)
                .Subscribe(tip =>
                {
                    var targets = tip.group_tips_elem_user_array;
                    if (targets == null) return;
                    foreach (var userId in targets)
                    {
                        _onGroupMemberKicked.OnNext((tip.group_tips_elem_group_id, userId, GroupKickReason.AdminKick));
                    }
                })
                .AddTo(_disposables);

            // 그룹 정보 변경
            agoraTips
                .Where(tip => tip.group_tips_elem_tip_type == TIMGroupTipType.kTIMGroupTip_GroupInfoChange)
                .Select(tip => tip.group_tips_elem_group_id)
                .Subscribe(groupId => _onGroupInfoChanged.OnNext(groupId))
                .AddTo(_disposables);

            // 아고라장 변경 (SetAdmin = 새 Owner 지정) -> 그룹 정보 변경으로 라우팅
            agoraTips
                .Where(tip => tip.group_tips_elem_tip_type == TIMGroupTipType.kTIMGroupTip_SetAdmin)
                .Subscribe(tip =>
                {
                    var targets = tip.group_tips_elem_user_array;
                    var targetLog = targets != null ? string.Join(", ", targets) : "null";
                    Debug.Log($"[TencentChat] OwnerChanged — Group: {tip.group_tips_elem_group_id}, NewOwner: {targetLog}");
                    _onGroupInfoChanged.OnNext(tip.group_tips_elem_group_id);
                })
                .AddTo(_disposables);

            // World 그룹 NameCard 변경 -> 닉네임 동기화
            GroupService.OnGroupTips
                .Where(tip => tip.group_tips_elem_group_id == _state.WorldGroupId)
                .Where(tip => tip.group_tips_elem_tip_type == TIMGroupTipType.kTIMGroupTip_MemberInfoChange)
                .Subscribe(tip =>
                {
                    var members = tip.group_tips_elem_changed_group_memberinfo_array;
                    if (members == null) return;

                    foreach (var m in members)
                    {
                        var nameCard = m.group_member_info_name_card;
                        if (string.IsNullOrEmpty(nameCard)) continue;

                        _onUserNameCardChanged.OnNext((m.group_member_info_identifier, nameCard));
                        Debug.Log($"[TencentChat] NameCard 변경: {m.group_member_info_identifier} → {nameCard}".Bold());
                    }
                })
                .AddTo(_disposables);
        }

        #endregion

        // =====================================================================
        //  Private 헬퍼
        // =====================================================================

        #region Private 헬퍼 — 텍스트 파싱

        /// <summary>메시지에서 첫 번째 CustomElem의 Data 추출</summary>
        private static string GetCustomDataFromMessage(Message msg)
        {
            if (msg.message_elem_array == null) return string.Empty;

            foreach (var elem in msg.message_elem_array)
            {
                if (elem.elem_type == TIMElemType.kTIMElem_Custom)
                    return elem.custom_elem_data ?? string.Empty;
            }

            return string.Empty;
        }

        #endregion

        // =====================================================================
        //  Dispose / 로그아웃
        // =====================================================================

        #region Dispose / 로그아웃

        public async UniTask LogoutAsync(CancellationToken ct)
        {
            await TIMHelper.WrapAsync<string>(TencentIMSDK.Logout, ct);
            _state.IsLoggedIn.Value = false;
        }

        public void Dispose()
        {
            if (Main.Singleton?.userPlanState != null)
            {
                Main.Singleton.userPlanState.OnMembershipChanged -= OnMembershipChanged;
            }

            _disposables.Dispose();

            ProfileService?.Dispose();
            ProfileService = null;

            UnregisterC2CMessageCallback();

            _onAgoraInviteReceived?.Dispose();
            _onGroupMemberEnter?.Dispose();
            _onGroupMemberQuit?.Dispose();
            _onGroupMemberKicked?.Dispose();
            _onGroupDismissed?.Dispose();
            _onGroupInfoChanged?.Dispose();
            _onUserNameCardChanged?.Dispose();

            GroupService?.Dispose();
            _state?.Dispose();
            _messageRepository?.Dispose();
            _onChannelInviteReceived?.Dispose();
            _onAgoraJoinRequestReceived?.Dispose();

            if (!_isInitialized) return;
            _isInitialized = false;

            try
            {
                TencentIMSDK.Uninit();
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[TencentChatService] UnInitSDK failed: {e.Message}".Bold());
            }
        }

        #endregion
    }
}