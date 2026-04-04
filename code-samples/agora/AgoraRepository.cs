using System.Collections.Generic;
using Cysharp.Threading.Tasks;
using FLATBUFFERS;
using R3;
using REIW.Network;
using UnityEngine;

namespace REIW
{
    /// <summary>
    /// Agora 네트워크 통신 구현체
    /// - ACK 핸들러 등록/해제
    /// - 서버 요청 메서드
    /// - Observable 이벤트 발행
    /// </summary>
    public class AgoraRepository : IAgoraRepository
    {
        #region Subjects

        private readonly Subject<List<AgoraInfoData>> _onAgoraListReceived = new();
        private readonly Subject<AgoraCreatedResult> _onAgoraCreated = new();
        private readonly Subject<AgoraInfoData> _onAgoraJoined = new();
        private readonly Subject<ulong> _onAgoraRemoved = new();
        private readonly Subject<AgoraInfoData> _onAgoraUpdated = new();
        private readonly Subject<AgoraInviteReceivedData> _onAgoraInviteReceived = new();
        private readonly Subject<List<AgoraInfoData>> _onSearchResultReceived = new();

        // 채널 관련...
        private readonly Subject<List<AgoraChannelData>> _onChannelListReceived = new();
        private readonly Subject<AgoraChannelData> _onChannelCreated = new();
        private readonly Subject<ChannelJoinedResult> _onChannelJoined = new();
        private readonly Subject<uint> _onChannelEntered = new();
        private readonly Subject<SubJectData> _onChannelLeft = new();
        private readonly Subject<AgoraChannelData> _onChannelUpdated = new();
        private readonly Subject<ulong> _onChannelDeleted = new();
        private readonly Subject<ChannelMemberListResult> _onChannelMemberListReceived = new();

        #endregion

        #region Observable Properties

        public Observable<List<AgoraInfoData>> OnAgoraListReceived => _onAgoraListReceived;
        public Observable<AgoraCreatedResult> OnAgoraCreated => _onAgoraCreated;
        public Observable<AgoraInfoData> OnAgoraJoined => _onAgoraJoined;
        public Observable<ulong> OnAgoraRemoved => _onAgoraRemoved;
        public Observable<AgoraInfoData> OnAgoraUpdated => _onAgoraUpdated;
        public Observable<List<AgoraInfoData>> OnSearchResultReceived => _onSearchResultReceived;

        // 채널 관련...
        public Observable<List<AgoraChannelData>> OnChannelListReceived => _onChannelListReceived;
        public Observable<AgoraChannelData> OnChannelCreated => _onChannelCreated;
        public Observable<ChannelJoinedResult> OnChannelJoined => _onChannelJoined;
        public Observable<uint> OnChannelEntered => _onChannelEntered;
        public Observable<SubJectData> OnChannelLeft => _onChannelLeft;
        public Observable<AgoraChannelData> OnChannelUpdated => _onChannelUpdated;
        public Observable<ulong> OnChannelDeleted => _onChannelDeleted;
        public Observable<ChannelMemberListResult> OnChannelMemberListReceived => _onChannelMemberListReceived;

        #endregion

        #region Pending Request Tracking

        // 삭제/탈퇴 요청 시 ID 추적 (ACK에 ID가 안 오는 경우 대비)
        private ulong? _pendingDeleteAgoraId;
        private ulong? _pendingLeaveAgoraId;
        private ulong? _pendingDeleteChannelId;
        private readonly Queue<ulong> _pendingMemberListQueue = new();

        #endregion

        #region Lifecycle

        public AgoraRepository() => RegisterMessageHandlers();

        public void Dispose()
        {
            UnregisterMessageHandlers();
            DisposeSubjects();
        }

        private void DisposeSubjects()
        {
            _onAgoraListReceived.Dispose();
            _onAgoraCreated.Dispose();
            _onAgoraJoined.Dispose();
            _onAgoraRemoved.Dispose();
            _onAgoraUpdated.Dispose();
            _onSearchResultReceived.Dispose();
            _onAgoraInviteReceived.Dispose();

            _onChannelListReceived.Dispose();
            _onChannelCreated.Dispose();
            _onChannelJoined.Dispose();
            _onChannelEntered.Dispose();
            _onChannelLeft.Dispose();
            _onChannelUpdated.Dispose();
            _onChannelMemberListReceived.Dispose();
            _onChannelDeleted.Dispose();
        }

        #endregion

        #region Message Handler Registration

        private void RegisterMessageHandlers()
        {
            var network = ReNetworkClient.Singleton;

            // Agora handlers
            network.AddMessageBufferHandler<AGORA_LIST_ACK>(PROTOCOL.AGORA_LIST_ACK, HandleAgoraListAck);
            network.AddMessageBufferHandler<AGORA_CREATE_ACK>(PROTOCOL.AGORA_CREATE_ACK, HandleAgoraCreateAck);
            network.AddMessageBufferHandler<AGORA_SEARCH_ACK>(PROTOCOL.AGORA_SEARCH_ACK, HandleAgoraSearchAck);
            network.AddMessageBufferHandler<AGORA_JOIN_ACK>(PROTOCOL.AGORA_JOIN_ACK, HandleAgoraJoinAck);
            network.AddMessageBufferHandler<AGORA_DELETE_ACK>(PROTOCOL.AGORA_DELETE_ACK, HandleAgoraDeleteAck);
            network.AddMessageBufferHandler<AGORA_LEAVE_ACK>(PROTOCOL.AGORA_LEAVE_ACK, HandleAgoraLeaveAck);
            network.AddMessageBufferHandler<AGORA_UPDATE_ACK>(PROTOCOL.AGORA_UPDATE_ACK, HandleAgoraUpdateAck);
            network.AddMessageBufferHandler<AGORA_INVITE_ACK>(PROTOCOL.AGORA_INVITE_ACK, HandleAgoraInviteAck);
            network.AddMessageBufferHandler<AGORA_PRIVATE_JOIN_ACK>(PROTOCOL.AGORA_PRIVATE_JOIN_ACK, HandlePrivateJoinAck);
            network.AddMessageBufferHandler<AGORA_PRIVATE_JOIN_ACCEPT_ACK>(PROTOCOL.AGORA_PRIVATE_JOIN_ACCEPT_ACK, HandlePrivateJoinAcceptAck);
            network.AddMessageBufferHandler<AGORA_CHANGE_OWNER_ACK>(PROTOCOL.AGORA_CHANGE_OWNER_ACK, HandleChangeOwnerAck);
            network.AddMessageBufferHandler<AGORA_MEMBER_KICK_ACK>(PROTOCOL.AGORA_MEMBER_KICK_ACK, HandleMemberKickAck);

            // Channel handlers
            network.AddMessageBufferHandler<AGORA_CHANNEL_LIST_ACK>(PROTOCOL.AGORA_CHANNEL_LIST_ACK, HandleChannelListAck);
            network.AddMessageBufferHandler<AGORA_CHANNEL_CREATE_ACK>(PROTOCOL.AGORA_CHANNEL_CREATE_ACK, HandleChannelCreateAck);
            network.AddMessageBufferHandler<AGORA_CHANNEL_JOIN_ACK>(PROTOCOL.AGORA_CHANNEL_JOIN_ACK, HandleChannelJoinAck);
            network.AddMessageBufferHandler<AGORA_CHANNEL_ENTER_ACK>(PROTOCOL.AGORA_CHANNEL_ENTER_ACK, HandleChannelEnterAck);
            network.AddMessageBufferHandler<AGORA_CHANNEL_LEAVE_ACK>(PROTOCOL.AGORA_CHANNEL_LEAVE_ACK, HandleChannelLeaveAck);
            network.AddMessageBufferHandler<AGORA_CHANNEL_UPDATE_ACK>(PROTOCOL.AGORA_CHANNEL_UPDATE_ACK, HandleChannelUpdateAck);
            network.AddMessageBufferHandler<AGORA_CHANNEL_MEMBER_LIST_ACK>(PROTOCOL.AGORA_CHANNEL_MEMBER_LIST_ACK, HandleChannelMemberListAck);
            network.AddMessageBufferHandler<AGORA_CHANNEL_DELETE_ACK>(PROTOCOL.AGORA_CHANNEL_DELETE_ACK, HandleChannelDeleteAck);
            network.AddMessageBufferHandler<AGORA_CHANNEL_DELETE_NFY>(PROTOCOL.AGORA_CHANNEL_DELETE_NFY, HandleChannelDeleteNfy);

            // Server Redirect
            network.AddMessageBufferHandler<SERVER_REDIRECT_ACK>(PROTOCOL.SERVER_REDIRECT_ACK, HandleServerRedirectAck);
        }

        private void UnregisterMessageHandlers()
        {
            var network = ReNetworkClient.Singleton;

            network.RemoveMessageBufferHandler<AGORA_LIST_ACK>(PROTOCOL.AGORA_LIST_ACK, HandleAgoraListAck);
            network.RemoveMessageBufferHandler<AGORA_CREATE_ACK>(PROTOCOL.AGORA_CREATE_ACK, HandleAgoraCreateAck);
            network.RemoveMessageBufferHandler<AGORA_SEARCH_ACK>(PROTOCOL.AGORA_SEARCH_ACK, HandleAgoraSearchAck);
            network.RemoveMessageBufferHandler<AGORA_JOIN_ACK>(PROTOCOL.AGORA_JOIN_ACK, HandleAgoraJoinAck);
            network.RemoveMessageBufferHandler<AGORA_DELETE_ACK>(PROTOCOL.AGORA_DELETE_ACK, HandleAgoraDeleteAck);
            network.RemoveMessageBufferHandler<AGORA_LEAVE_ACK>(PROTOCOL.AGORA_LEAVE_ACK, HandleAgoraLeaveAck);
            network.RemoveMessageBufferHandler<AGORA_UPDATE_ACK>(PROTOCOL.AGORA_UPDATE_ACK, HandleAgoraUpdateAck);
            network.RemoveMessageBufferHandler<AGORA_INVITE_ACK>(PROTOCOL.AGORA_INVITE_ACK, HandleAgoraInviteAck);
            network.RemoveMessageBufferHandler<AGORA_PRIVATE_JOIN_ACK>(PROTOCOL.AGORA_PRIVATE_JOIN_ACK, HandlePrivateJoinAck);
            network.RemoveMessageBufferHandler<AGORA_PRIVATE_JOIN_ACCEPT_ACK>(PROTOCOL.AGORA_PRIVATE_JOIN_ACCEPT_ACK, HandlePrivateJoinAcceptAck);
            network.RemoveMessageBufferHandler<AGORA_CHANGE_OWNER_ACK>(PROTOCOL.AGORA_CHANGE_OWNER_ACK, HandleChangeOwnerAck);
            network.RemoveMessageBufferHandler<AGORA_MEMBER_KICK_ACK>(PROTOCOL.AGORA_MEMBER_KICK_ACK, HandleMemberKickAck);

            network.RemoveMessageBufferHandler<AGORA_CHANNEL_LIST_ACK>(PROTOCOL.AGORA_CHANNEL_LIST_ACK, HandleChannelListAck);
            network.RemoveMessageBufferHandler<AGORA_CHANNEL_CREATE_ACK>(PROTOCOL.AGORA_CHANNEL_CREATE_ACK, HandleChannelCreateAck);
            network.RemoveMessageBufferHandler<AGORA_CHANNEL_JOIN_ACK>(PROTOCOL.AGORA_CHANNEL_JOIN_ACK, HandleChannelJoinAck);
            network.RemoveMessageBufferHandler<AGORA_CHANNEL_ENTER_ACK>(PROTOCOL.AGORA_CHANNEL_ENTER_ACK, HandleChannelEnterAck);
            network.RemoveMessageBufferHandler<AGORA_CHANNEL_LEAVE_ACK>(PROTOCOL.AGORA_CHANNEL_LEAVE_ACK, HandleChannelLeaveAck);
            network.RemoveMessageBufferHandler<AGORA_CHANNEL_UPDATE_ACK>(PROTOCOL.AGORA_CHANNEL_UPDATE_ACK, HandleChannelUpdateAck);
            network.RemoveMessageBufferHandler<AGORA_CHANNEL_MEMBER_LIST_ACK>(PROTOCOL.AGORA_CHANNEL_MEMBER_LIST_ACK, HandleChannelMemberListAck);
            network.RemoveMessageBufferHandler<AGORA_CHANNEL_DELETE_ACK>(PROTOCOL.AGORA_CHANNEL_DELETE_ACK, HandleChannelDeleteAck);
            network.RemoveMessageBufferHandler<AGORA_CHANNEL_DELETE_NFY>(PROTOCOL.AGORA_CHANNEL_DELETE_NFY, HandleChannelDeleteNfy);

            network.RemoveMessageBufferHandler<SERVER_REDIRECT_ACK>(PROTOCOL.SERVER_REDIRECT_ACK, HandleServerRedirectAck);
        }

        #endregion

        #region Request Methods

        public void RequestAgoraList()
        {
            ReNetworkClient.Singleton.REQ_AGORA_LIST();
        }

        public void RequestAgoraSearch(string keyword)
        {
            ReNetworkClient.Singleton.REQ_AGORA_SEARCH(keyword);
        }

        public void RequestAgoraSearch(string[] interests)
        {
            ReNetworkClient.Singleton.REQ_AGORA_SEARCH(interests);
        }

        public void RequestAgoraJoin(ulong agoraId)
        {
            ReNetworkClient.Singleton.REQ_AGORA_JOIN(agoraId);
        }

        public void RequestAgoraLeave(ulong agoraId)
        {
            _pendingLeaveAgoraId = agoraId;
            ReNetworkClient.Singleton.REQ_AGORA_LEAVE(agoraId);
        }

        public void RequestAgoraDelete(ulong agoraId)
        {
            _pendingDeleteAgoraId = agoraId;
            ReNetworkClient.Singleton.REQ_AGORA_DELETE(agoraId);
        }

        public void RequestAgoraUpdate(ulong agoraId, string name, string description, string iconUrl, AgoraType type)
        {
            ReNetworkClient.Singleton.REQ_AGORA_UPDATE(agoraId, name, description, iconUrl, type);
        }

        public void RequestPrivateJoin(ulong agoraId)
        {
            ReNetworkClient.Singleton.REQ_AGORA_PRIVATE_JOIN(agoraId);
        }

        // 비공개방 수락!
        public void RequestPrivateJoinAccept(ulong agoraId, ulong targetDbId)
        {
            ReNetworkClient.Singleton.REQ_AGORA_PRIVATE_JOIN_ACCEPT(agoraId, targetDbId);
        }

        public void RequestChangeOwner(ulong agoraId, ulong dbId)
        {
            ReNetworkClient.Singleton.REQ_AGORA_CHANGE_OWNER(agoraId, dbId);
        }

        public void RequestKickMember(ulong agoraId, ulong dbId)
        {
            ReNetworkClient.Singleton.REQ_AGORA_MEMBER_KICK(agoraId, dbId);
        }

        public void RequestAgoraInvite(ulong agoraId, string agoraName, ulong dbId)
        {
            ReNetworkClient.Singleton.REQ_AGORA_INVITE(agoraId, agoraName, dbId);
        }

        public void RequestChannelList(ulong agoraId)
        {
            ReNetworkClient.Singleton.REQ_AGORA_CHANNEL_LIST(agoraId);
        }

        public void RequestChannelCreate(ulong agoraId, string channelName, string description, ENUM_AGORA_CHANNEL_TYPE channelType)
        {
            ReNetworkClient.Singleton.REQ_AGORA_CHANNEL_CREATE(agoraId, channelName, description, channelType);
        }

        private ulong _pendingRedirectChannelId;

        public void RequestChannelJoin(ulong channelId,string inviteCode="")
        {
            _pendingRedirectChannelId = channelId;
            ReNetworkClient.Singleton.REQ_AGORA_CHANNEL_JOIN(channelId,inviteCode);
        }

        public void RequestChannelEnter()
        {
            ReNetworkClient.Singleton.REQ_AGORA_CHANNEL_ENTER();
        }

        public void RequestChannelDelete(ulong agoraId, ulong channelId)
        {
            _pendingDeleteChannelId = channelId;
            ReNetworkClient.Singleton.REQ_AGORA_CHANNEL_DELETE(agoraId, channelId);
        }

        public void RequestChannelUpdate(ulong agoraId, ulong channelId, string channelName, string description)
        {
            ReNetworkClient.Singleton.REQ_AGORA_CHANNEL_UPDATE(agoraId, channelId, channelName, description);
        }

        public void RequestChannelMemberList(ulong channelId)
        {
            _pendingMemberListQueue.Enqueue(channelId);
            ReNetworkClient.Singleton.REQ_AGORA_CHANNEL_MEMBER_LIST(channelId);
        }

        public void ClearPendingMembers()
        {
            _pendingMemberListQueue.Clear();
            // while (_pendingMemberListQueue.TryDequeue(out _)) { }
        }

        #endregion

        #region ACK Handlers - Agora

        private void HandleAgoraListAck(AGORA_LIST_ACK ack)
        {
            var raw = ack.UnPack().Agoras;
            var agoras = new List<AgoraInfoData>(raw.Count);
            for (int i = 0; i < raw.Count; i++)
            {
                agoras.Add(raw[i].ToAgoraInfoData());
            }

            _onAgoraListReceived.OnNext(agoras);
        }

        private void HandleAgoraCreateAck(AGORA_CREATE_ACK ack)
        {
            var data = ack.UnPack();
            if (data.ErrorCode != (uint)EnumError.E_SUCCESS)
            {
                AgoraError(data.ErrorCode);
                var popupUI = UIManager.Singleton.GetUI<PopupUI>(UIList.PopupUI);
                if (popupUI != null)
                {
                    popupUI.HideWithSlideAnim();
                }

                return;
            }

            var newAgora = data.Agora.ToAgoraInfoData();
            var defaultChannel = data.AgoraChannel.ToAgoraChannelData();

            // 여긴 생성 쪽이라 1번만 실행된다. (수정도 아님)
            if (defaultChannel.GroupId == "channel_default_title")
            {
                defaultChannel.GroupId = "channel_default_title".ToContentText();
            }

            newAgora.Channels.Add(defaultChannel);
            _onAgoraCreated.OnNext(new AgoraCreatedResult(newAgora, defaultChannel));
        }

        private static void AgoraError(uint reason)
        {
            EnumError eError = (EnumError)reason;

            // Permission Failed는 구매 유도 팝업만 노출
            if (eError == EnumError.E_AGORA_PERMISSION_FAILED)
            {
                var type = Main.Singleton.userPlanState.GetTier() == EnumMembershipTier.Free
                    ? PromotionPopupType.MembershipPurchase
                    : PromotionPopupType.MembershipUpgrade;
                PromotionPopupUtility.Show(type);
                return;
            }

            var message = eError switch
            {
                EnumError.E_AGORA_MAX_COUNT_FAILED => "alert_agorafull".ToSystemText(),
                EnumError.E_AGORA_CHANNEL_FULL => "alert_enoughmember".ToSystemText(),
                _ => "alert_generalfail".ToSystemText()
            };

            CommonAlertUI.ShowOneButton(message);
        }

        private void HandleAgoraJoinAck(AGORA_JOIN_ACK ack)
        {
            var data = ack.UnPack();

            if (data.ErrorCode == (uint)EnumError.E_SUCCESS)
            {
                var agora = data.Agora.ToAgoraInfoData();
                if (agora == null || agora.AgoraId == 0)
                {
                    Debug.LogError("[AgoraRepo] 아고라 가입 ACK: Agora 데이터 없음");
                    return;
                }

                _onAgoraJoined.OnNext(agora);
            }
            else
            {
                AgoraError(data.ErrorCode);
            }
        }

        private void HandleAgoraSearchAck(AGORA_SEARCH_ACK ack)
        {
            var raw = ack.UnPack().Agoras;
            var agoras = new List<AgoraInfoData>(raw.Count);
            for (int i = 0; i < raw.Count; i++)
            {
                agoras.Add(raw[i].ToAgoraInfoData());
            }

            _onSearchResultReceived.OnNext(agoras);
        }

        private static void HandleAgoraInviteAck(AGORA_INVITE_ACK ack)
        {
            var data = ack.UnPack();
            if (data.ErrorCode == (uint)EnumError.E_SUCCESS)
            {
            }
            else
            {
                AgoraError(data.ErrorCode);
            }
        }

        private static void HandlePrivateJoinAck(AGORA_PRIVATE_JOIN_ACK ack)
        {
            
            var data = ack.UnPack();
            if (data.ErrorCode == (uint)EnumError.E_SUCCESS)
            {
                // 가입 요청 전송 완료 (대기 상태 안내 등)
                // Debug.Log("[AgoraRepo] 비공개 아고라 가입 요청 완료".Bold());
            }
            else
            {
                AgoraError(data.ErrorCode);
            }
            
        }

        private void HandlePrivateJoinAcceptAck(AGORA_PRIVATE_JOIN_ACCEPT_ACK ack)
        {
            var agora = ack.UnPack().Agora?.ToAgoraInfoData();
            if (agora != null)
            {
                // _onAgoraJoined.OnNext(agora);
                _onAgoraUpdated.OnNext(agora);  // 기존 아고라 정보 갱신 (멤버 수 등)
            }
        }

        private void HandleAgoraDeleteAck(AGORA_DELETE_ACK ack)
        {
            if (_pendingDeleteAgoraId is not { } agoraId)
            {
                Debug.LogWarning("[AgoraRepo] 삭제 ACK 수신했으나 pending ID 없음");
                return;
            }

            _pendingDeleteAgoraId = null;
            MirrorVisitHistory.RemoveAllByAgora(agoraId);
            _onAgoraRemoved.OnNext(agoraId);
        }

        private void HandleAgoraLeaveAck(AGORA_LEAVE_ACK ack)
        {
            if (_pendingLeaveAgoraId is not { } agoraId)
            {
                Debug.LogWarning("[AgoraRepo] 탈퇴 ACK 수신했으나 pending ID 없음");
                return;
            }

            _pendingLeaveAgoraId = null;
            MirrorVisitHistory.RemoveAllByAgora(agoraId); 
            _onAgoraRemoved.OnNext(agoraId);
        }

        private void HandleAgoraUpdateAck(AGORA_UPDATE_ACK ack)
        {
            var data = ack.UnPack();
            if (data.Agora == null)
            {
                Debug.LogWarning("[AgoraRepo] UPDATE ACK: Agora 데이터 없음");
                return;
            }

            var updated = data.Agora.ToAgoraInfoData();
            _onAgoraUpdated.OnNext(updated);
        }

        private void HandleChangeOwnerAck(AGORA_CHANGE_OWNER_ACK ack)
        {
            var agora = ack.UnPack().Agora?.ToAgoraInfoData();
            if (agora != null)
            {
                _onAgoraUpdated.OnNext(agora); // 기존 업데이트 파이프라인 재사용
            }
        }

        private void HandleMemberKickAck(AGORA_MEMBER_KICK_ACK ack)
        {
        }

        #endregion

        #region ACK Handlers - Channel

        private void HandleChannelListAck(AGORA_CHANNEL_LIST_ACK ack)
        {
            var raw = ack.UnPack().AgoraChannels;
            List<AgoraChannelData> channels;

            if (raw == null || raw.Count == 0)
            {
                channels = new List<AgoraChannelData>(0);
            }
            else
            {
                channels = new List<AgoraChannelData>(raw.Count);
                for (int i = 0; i < raw.Count; i++)
                {
                    channels.Add(raw[i].ToAgoraChannelData());
                }
            }

            _onChannelListReceived.OnNext(channels);
        }

        private void HandleChannelCreateAck(AGORA_CHANNEL_CREATE_ACK ack)
        {
            var data =ack.UnPack();
            
            if (data.ErrorCode == (uint)EnumError.E_SUCCESS)
            {
                var channel =data.AgoraChannel.ToAgoraChannelData();
                _onChannelCreated.OnNext(channel);
            }
            else
            {
                AgoraError(data.ErrorCode);
            }
        }

        private void HandleChannelJoinAck(AGORA_CHANNEL_JOIN_ACK ack)
        {
            var data = ack.UnPack();
            if (data.ErrorCode == (uint)EnumError.E_SUCCESS)
            {
                // Redirect 필요
                if (data.Redirect)
                {
                    // ex) ws://192.168.52.148:43000
                    var infoServer = data.Server;
                    /*
                        # 외부접속용 주소, 포트
                        PUBLIC_ADDR=192.168.52.148
                        PUBLIC_PORT=43005

                        # 외부접속용 주소, 포트
                        PUBLIC_ADDR=dev-game-01.eterna.voyagergames.gg
                        PUBLIC_PORT=443
                     */
                    var server = ReNetworkClient.Singleton.GetGameServerClient();
                    var protocol = "ws://" + infoServer.Addr + ":" + infoServer.Port;

                    server.PrepareRedirect(infoServer.RedirectToken);
                    server.SetSocket(protocol);
                    server.ConnectAsync().ContinueWith(gameServerConnected =>
                    {
                        if (!gameServerConnected)
                        {
                            LogUtil.LogError("Game Server 연결 실패");
                        }
                        else
                        {
                            server.StartProcessingMessages().Forget();
                            // 다른곳으로 이동
                            // ReNetworkClient.Singleton.REQ_SERVER_REDIRECT(infoServer.RedirectToken);
                        }
                    }).Forget();

                    return;
                }

                var channel = data.AgoraChannel.ToAgoraChannelData();
                var zoneId = data.BasePos.ZoneID;
                var fieldData = data.BasePos.ToFieldData();

                _onChannelJoined.OnNext(new ChannelJoinedResult(channel, zoneId, fieldData));
            }
            else if (data.ErrorCode == (uint)EnumError.E_AGORA_CHANNEL_FULL)
            {
                // 아고라 채널 꽉참.
                // 미러 접속 못함.
                CommonAlertUI.ShowOneButton(
                    "alert_enoughmember".ToSystemText()
                );
            }
            else
            {
                AgoraError(data.ErrorCode);
            }
        }

        private void HandleServerRedirectAck(SERVER_REDIRECT_ACK ack)
        {
            var data = ack.UnPack();
            RequestChannelJoin(_pendingRedirectChannelId);
        }

        private void HandleChannelEnterAck(AGORA_CHANNEL_ENTER_ACK ack)
        {
            var snapshotInterval = ack.UnPack().SnapshotInterval;
            _onChannelEntered.OnNext(snapshotInterval);
        }

        private void HandleChannelLeaveAck(AGORA_CHANNEL_LEAVE_ACK ack)
        {
            var fieldData = ack.UnPack().BasePos.ToFieldData();
            _onChannelLeft.OnNext(fieldData);
        }

        private void HandleChannelUpdateAck(AGORA_CHANNEL_UPDATE_ACK ack)
        {
            if (!ack.AgoraChannel.HasValue) return;

            var info = ack.AgoraChannel.Value;
            var channel = new AgoraChannelData
            {
                ChannelId = info.ChannelID,
                ChannelName = info.ChannelName,
                Description = info.Description,
                GroupId = info.GroupID
            };

            _onChannelUpdated.OnNext(channel);
        }

        private void HandleChannelMemberListAck(AGORA_CHANNEL_MEMBER_LIST_ACK ack)
        {
            if (!_pendingMemberListQueue.TryDequeue(out var channelId))
            {
                Debug.LogWarning("[AgoraRepo] 멤버 목록 ACK 수신했으나 pending 큐 비어있음 — 무시");
                return;
            }

            var raw = ack.UnPack().SubjectIDs;
            List<ContentIdData> members;

            if (raw == null || raw.Count == 0)
            {
                members = new List<ContentIdData>(0);
            }
            else
            {
                members = new List<ContentIdData>(raw.Count);
                for (int i = 0; i < raw.Count; i++)
                {
                    members.Add(raw[i].ToContentId());
                }
            }

            _onChannelMemberListReceived.OnNext(new ChannelMemberListResult(channelId, members));
        }

        private void HandleChannelDeleteAck(AGORA_CHANNEL_DELETE_ACK ack)
        {
            if (_pendingDeleteChannelId is not { } channelId)
            {
                Debug.LogWarning("[AgoraRepo] 채널 삭제 ACK 수신했으나 pending channelId 없음");
                return;
            }

            MirrorVisitHistory.RemoveRecord(channelId.ToString());
            _pendingDeleteChannelId = null;
            _onChannelDeleted.OnNext(channelId);
        }

        private void HandleChannelDeleteNfy(AGORA_CHANNEL_DELETE_NFY nfy)
        {
            var channelId = nfy.ChannelID;
            _onChannelDeleted.OnNext(channelId);
        }

        #endregion
    }
}