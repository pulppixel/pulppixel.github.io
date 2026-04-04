using System.Collections.Generic;
using System.Threading;
using com.tencent.imsdk.unity;
using com.tencent.imsdk.unity.enums;
using com.tencent.imsdk.unity.types;
using Cysharp.Threading.Tasks;
using REIW.Communication;

namespace REIW
{
    public class TencentChatRepository : ITencentChatRepository
    {
        /// <summary>
        /// 특정 그룹의 최신 메시지 히스토리 조회
        /// </summary>
        public async UniTask<List<MessageData>> GetMessageHistoryAsync(string groupId, uint count, ChannelType type, CancellationToken ct)
        {
            var param = new MsgGetMsgListParam
            {
                msg_getmsglist_param_count = count,
                msg_getmsglist_param_is_ramble = true,
                msg_getmsglist_param_is_forward = false,
            };

            var res = await TIMHelper.WrapAsync<List<Message>>(
                cb => TencentIMSDK.MsgGetMsgList(groupId, type.ToTimConvType(), param, cb), ct);

            if (res == null || res.Count == 0)
                return new List<MessageData>(0);

            var result = new List<MessageData>(res.Count);
            for (int i = 0; i < res.Count; i++)
            {
                result.Add(MessageData.From(res[i]));
            }

            return result;
        }

        /// <summary>
        /// 특정 메시지 이전의 과거 메시지 조회 (페이징)
        /// </summary>
        public async UniTask<List<MessageData>> GetMessageHistoryBeforeAsync(string groupId, string lastMessageId, uint count, CancellationToken ct)
        {
            var param = new MsgGetMsgListParam
            {
                msg_getmsglist_param_count = count,
                msg_getmsglist_param_last_msg = new Message { message_msg_id = lastMessageId },
                msg_getmsglist_param_is_ramble = true,
                msg_getmsglist_param_is_forward = false,
            };

            var res = await TIMHelper.WrapAsync<List<Message>>(
                cb => TencentIMSDK.MsgGetMsgList(groupId, TIMConvType.kTIMConv_Group, param, cb), ct);

            if (res == null || res.Count == 0)
                return new List<MessageData>(0);

            var result = new List<MessageData>(res.Count);
            for (int i = 0; i < res.Count; i++)
            {
                result.Add(MessageData.From(res[i]));
            }

            return result;
        }
    }
}