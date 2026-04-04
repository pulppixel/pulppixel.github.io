using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using com.tencent.imsdk.unity;
using com.tencent.imsdk.unity.enums;
using com.tencent.imsdk.unity.types;
using Cysharp.Threading.Tasks;
using FLATBUFFERS;
using R3;
using REIW.Communication;
using UnityEngine;

namespace REIW
{
    /// <summary>
    /// Tencent IM 그룹 관리 서비스. TencentChatService가 생성/관리.
    /// 그룹 가입(재시도)/탈퇴, 멤버 초대/확인, 멤버 목록 조회, GroupTip 콜백 -> Observable 발행.
    /// </summary>
    public class TencentGroupService : IDisposable
    {
        #region 필드 — 의존성, 콜백 상태

        private readonly TencentChatState _state;
        private readonly ITencentChatRepository _repository;
        private bool _isCallbackRegistered;

        #endregion

        #region Observable — GroupTip 이벤트 (TencentChatService에서 구독)

        /// <summary>
        /// GroupTip 원본 이벤트.
        /// TencentChatService가 구독하여 멤버 입퇴장/강퇴/해산 등으로 분기합니다.
        /// AgoraService도 kTIMGroupTip_Invite를 직접 구독합니다.
        /// </summary>
        public Observable<GroupTipsElem> OnGroupTips => _onGroupTips;

        private readonly Subject<GroupTipsElem> _onGroupTips = new();

        #endregion

        #region 생성자 / 콜백 등록

        public TencentGroupService(TencentChatState state, ITencentChatRepository repository)
        {
            _state = state ?? throw new ArgumentNullException(nameof(state));
            _repository = repository ?? throw new ArgumentNullException(nameof(repository));
        }

        /// <summary>GroupTip 콜백 등록 (TencentChatService.InitializeAsync에서 호출)</summary>
        public void RegisterCallbacks()
        {
            if (_isCallbackRegistered) return;
            TencentIMSDK.SetGroupTipsEventCallback(OnGroupTipsCallback);
            _isCallbackRegistered = true;
        }

        private void UnregisterCallbacks()
        {
            if (!_isCallbackRegistered) return;
            TencentIMSDK.RemoveGroupTipsEventCallback(OnGroupTipsCallback);
            _isCallbackRegistered = false;
        }

        #endregion

        #region Public API — 그룹 가입 (재시도 포함) 및 그룹 검색

        /// <summary>
        /// 그룹 가입 — 이미 가입된 경우 스킵, 실패 시 최대 MaxJoinRetry회 재시도.
        /// 가입 후 채팅 로그도 로드합니다.
        /// </summary>
        public async UniTask<bool> JoinGroupAsync(string groupId, CancellationToken ct)
        {
            if (string.IsNullOrEmpty(groupId))
            {
                Debug.LogWarning("[TencentGroupService] GroupId is empty");
                return false;
            }

            // SDK 초기화 완료 대기
            if (!_state.IsLoggedIn.CurrentValue)
            {
                Debug.Log("[TencentGroupService] Waiting for Tencent IM login...");
                await _state.IsLoggedIn.Where(x => x).FirstAsync(ct);
            }

            try
            {
                await TIMHelper.WrapAsync<string>(cb => TencentIMSDK.GroupJoin(groupId, "hello", cb), ct);
                Debug.Log($"[TencentGroupService] Joined: {groupId}".Bold());
            }
            catch (Exception ex) when (ex.Message.Contains("already group member"))
            {
                // 이미 가입됨 = 성공
                Debug.Log($"[TencentGroupService] Already joined: {groupId}".Bold());
            }
            catch (Exception ex)
            {
                Debug.LogError($"[TencentGroupService] Join failed: {groupId}, {ex.Message}");
                return false;
            }

            _state.AddJoinedGroup(groupId);

            try
            {
                var messages = await _repository.GetMessageHistoryAsync(groupId, 100, ChannelType.Current, ct);
                _state.SetChatLogs(messages);
            }
            catch (Exception logEx)
            {
                Debug.LogWarning($"[TencentGroupService] Chat log load failed (ignored): {logEx.Message}");
            }

            return true;
        }

        /// <summary>
        /// Tencent IM 그룹 존재 여부 확인.
        /// 그룹이 없거나 해산된 경우 false 반환.
        /// </summary>
        public static async UniTask<bool> IsGroupExistAsync(string groupId, CancellationToken ct)
        {
            if (string.IsNullOrEmpty(groupId)) return false;

            try
            {
                var groupIds = new List<string> { groupId };
                await TIMHelper.WrapAsync<List<GetGroupInfoResult>>(
                    cb => TencentIMSDK.GroupGetGroupInfoList(groupIds, cb), ct);
                return true;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// Tencent IM 그룹 정보 조회. 없으면 null.
        /// </summary>
        public static async UniTask<GroupDetailInfo> GetGroupInfoAsync(string groupId, CancellationToken ct)
        {
            if (string.IsNullOrEmpty(groupId)) return null;

            try
            {
                var groupIds = new List<string> { groupId };
                var results = await TIMHelper.WrapAsync<List<GetGroupInfoResult>>(
                    cb => TencentIMSDK.GroupGetGroupInfoList(groupIds, cb), ct);

                return results?.FirstOrDefault()?.get_groups_info_result_info;
            }
            catch
            {
                return null;
            }
        }

        #endregion

        #region Public API — 그룹 멤버 초대 / 확인

        /// <summary>그룹에 멤버 초대 (비공개 채널용)</summary>
        public static async UniTask<bool> InviteToGroupAsync(string groupId, List<string> userIds, CancellationToken ct)
        {
            if (string.IsNullOrEmpty(groupId) || userIds == null || userIds.Count == 0)
            {
                Debug.LogWarning("[TencentGroupService] InviteToGroup: invalid params");
                return false;
            }

            try
            {
                var param = new GroupInviteMemberParam
                {
                    group_invite_member_param_group_id = groupId,
                    group_invite_member_param_identifier_array = userIds,
                };

                await TIMHelper.WrapAsync<List<GroupInviteMemberResult>>(
                    cb => TencentIMSDK.GroupInviteMember(param, cb), ct);

                Debug.Log($"[TencentGroupService] 그룹 초대 완료: {groupId} ({userIds.Count}명)".Bold());
                return true;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[TencentGroupService] 그룹 초대 실패: {groupId}, {ex.Message}");
                return false;
            }
        }

        /// <summary>유저가 특정 그룹의 멤버인지 확인</summary>
        public static async UniTask<bool> IsGroupMemberAsync(string groupId, string userId, CancellationToken ct)
        {
            if (string.IsNullOrEmpty(groupId) || string.IsNullOrEmpty(userId)) return false;

            try
            {
                var param = new GroupGetMemberInfoListParam
                {
                    group_get_members_info_list_param_group_id = groupId,
                    group_get_members_info_list_param_identifier_array = new List<string> { userId },
                };

                var result = await TIMHelper.WrapAsync<GroupGetMemberInfoListResult>(
                    cb => TencentIMSDK.GroupGetMemberInfoList(param, cb), ct);

                return result?.group_get_member_info_list_result_info_array?.Count > 0;
            }
            catch
            {
                return false;
            }
        }

        #endregion

        #region Public API — 월드 그룹 멤버 캐시 & 검색

        private bool _isCacheFetching;

        /// <summary>
        /// 월드 그룹 멤버를 SDK 로컬 캐시에 풀링 (nextSeq=0까지 반복).
        /// PopupFriendAdd 진입 시 + 주기적 타이머에서 호출.
        /// </summary>
        public async UniTask FetchWorldGroupCacheAsync(CancellationToken ct)
        {
            var worldGroupId = _state.WorldGroupId;
            if (string.IsNullOrEmpty(worldGroupId)) return;
            if (_isCacheFetching) return;

            _isCacheFetching = true;
            try
            {
                ulong nextSeq = 0;
                do
                {
                    var param = new GroupGetMemberInfoListParam
                    {
                        group_get_members_info_list_param_group_id = worldGroupId,
                        group_get_members_info_list_param_next_seq = nextSeq,
                    };

                    var res = await TIMHelper.WrapAsync<GroupGetMemberInfoListResult>(
                        cb => TencentIMSDK.GroupGetMemberInfoList(param, cb), ct);

                    nextSeq = res.group_get_member_info_list_result_next_seq;
                    var count = res.group_get_member_info_list_result_info_array?.Count ?? 0;
                } while (nextSeq != 0);
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[CACHE] 캐시 풀링 실패: {ex.Message}");
            }
            finally
            {
                _isCacheFetching = false;
            }
        }

        /// <summary>
        /// SDK 로컬 캐시에서 월드 그룹 멤버 키워드 검색.
        /// FetchWorldGroupCacheAsync 이후 호출해야 결과가 나옵니다.
        /// </summary>
        public async UniTask<List<GroupMemberInfo>> SearchWorldGroupMembersAsync(string keyword, CancellationToken ct)
        {
            var worldGroupId = _state.WorldGroupId;
            if (string.IsNullOrEmpty(worldGroupId) || string.IsNullOrWhiteSpace(keyword))
            {
                return new List<GroupMemberInfo>();
            }

            var param = new GroupMemberSearchParam
            {
                group_search_member_params_groupid_list = new List<string> { worldGroupId },
                group_search_member_params_keyword_list = new List<string> { keyword },
                group_search_member_params_field_list = new List<TIMGroupMemberSearchFieldKey>
                {
                    // TIMGroupMemberSearchFieldKey.kTIMGroupMemberSearchFieldKey_Identifier,
                    TIMGroupMemberSearchFieldKey.kTIMGroupMemberSearchFieldKey_NickName,
                    TIMGroupMemberSearchFieldKey.kTIMGroupMemberSearchFieldKey_NameCard,
                },
            };

            try
            {
                var res = await TIMHelper.WrapAsync<List<GroupSearchGroupMembersResult>>(
                    cb => TencentIMSDK.GroupSearchGroupMembers(param, cb), ct);

                return res
                    .SelectMany(r => r.group_search_member_result_member_info_list)
                    .Where(m => m.group_member_info_identifier != _state.MyUserId)
                    .OrderByDescending(m => m.group_member_info_join_time)
                    .ToList();
            }
            catch (Exception ex)
            {
                Debug.LogError($"[TencentGroupService] 멤버 검색 실패: {ex.Message}");
                return new List<GroupMemberInfo>();
            }
        }

        #endregion

        #region Public API — 아고라 멤버 목록 조회

        /// <summary>
        /// 아고라 멤버 목록 조회 (Tencent IM 그룹 기반).
        /// ※ 채널 멤버(현재 3D 씬 접속자)와는 다릅니다.
        /// AgoraService에서 호출하며, SDK 의존성을 이 계층에서 격리합니다.
        /// </summary>
        public async UniTask<List<AgoraMemberData>> GetAgoraMembersAsync(string groupId, CancellationToken ct)
        {
            var param = new GroupGetMemberInfoListParam
            {
                group_get_members_info_list_param_group_id = groupId,
                group_get_members_info_list_param_next_seq = 0
            };

            var result = await TIMHelper.WrapAsync<GroupGetMemberInfoListResult>(
                cb => TencentIMSDK.GroupGetMemberInfoList(param, cb), ct);

            var memberList = new List<AgoraMemberData>();

            foreach (var info in result.group_get_member_info_list_result_info_array)
            {
                var raw = info.group_member_info_face_url;
                var parseSuccess = UserSummaryPayload.TryParse(raw, out var parsed);

                var role = info.group_member_info_member_role == TIMGroupMemberRole.kTIMMemberRole_Admin
                    ? ENUM_AGORA_MEMBER_ROLE.OWNER
                    : ENUM_AGORA_MEMBER_ROLE.MEMBER;

                AgoraMemberData memberData;

                if (!parseSuccess)
                {
                    memberData = new AgoraMemberData
                    {
                        ContentId = null,
                        UserId = info.group_member_info_identifier,
                        Nickname = info.group_member_info_nick_name,
                        FaceUrl = "",
                        Role = role,
                        JoinTime = info.group_member_info_join_time,
                        ShutupTime = info.group_member_info_shutup_time,
                    };
                }
                else
                {
                    memberData = new AgoraMemberData
                    {
                        ContentId = new ContentIdData(
                            parsed.category,
                            parsed.kind,
                            parsed.serial,
                            parsed.id
                        ),

                        UserId = parsed.id.ToString(),
                        Nickname = parsed.nick,
                        FaceUrl = parsed.avatarUrl,
                        Role = role,
                        JoinTime = info.group_member_info_join_time,
                        ShutupTime = info.group_member_info_shutup_time,
                        MembershipTier = parsed.mebmershipTier
                    };
                }

                memberList.Add(memberData);
            }

            return memberList;
        }

        #endregion

        #region Private — GroupTip 콜백

        /// <summary>
        /// Tencent IM GroupTip 콜백 — 원본 이벤트를 Subject로 발행.
        /// TencentChatService 및 AgoraService가 구독하여 타입별로 분기 처리합니다.
        /// </summary>
        private void OnGroupTipsCallback(GroupTipsElem message, string userData)
        {
            _onGroupTips.OnNext(message);

            // 디버그 로그
            var userArray = message.group_tips_elem_user_array ?? new List<string>();
            var color = message.group_tips_elem_tip_type switch
            {
                TIMGroupTipType.kTIMGroupTip_Invite => Color.green,
                TIMGroupTipType.kTIMGroupTip_Quit => Color.gray,
                TIMGroupTipType.kTIMGroupTip_Kick => Color.red,
                TIMGroupTipType.kTIMGroupTip_GroupInfoChange => Color.cyan,
                TIMGroupTipType.kTIMGroupTip_MemberInfoChange => Color.yellow,
                _ => Color.white
            };

            var log = $"===== [GroupTips] : {message.group_tips_elem_tip_type} =====\n\n" +
                      $" - Group: {message.group_tips_elem_group_name} ({message.group_tips_elem_group_id})\n" +
                      $" - Operator: {message.group_tips_elem_op_user}\n" +
                      $" - Targets: [{string.Join(", ", userArray)}]\n" +
                      $" - MemberNum: {message.group_tips_elem_member_num}\n" +
                      $" - Platform: {message.group_tips_elem_platform}\n" +
                      "==========================================";

            Debug.Log(log.Color(color).Bold());
        }

        #endregion

        #region Dispose

        public void Dispose()
        {
            UnregisterCallbacks();
            _onGroupTips?.Dispose();
        }

        #endregion
    }
}