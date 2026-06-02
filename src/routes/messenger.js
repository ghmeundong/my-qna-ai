const { jsonRes } = require("../utils/response");
const User = require("../models/user");
const UserChat = require("../models/userChat");
const { sendPushNotification } = require("../utils/notification");

async function handleParticipants(parsed, res) {
  const userId = parsed.searchParams.get("userId");
  if (!userId) {
    return jsonRes(res, { success: false, msg: "userId 필요" }, 400);
  }

  try {
    const users = await User.find({ userId: { $ne: userId } }).select("userId");
    const participantIds = users.map((user) => user.userId);
    return jsonRes(res, { success: true, participants: participantIds });
  } catch (err) {
    return jsonRes(res, { success: false, msg: "참여자 조회 실패" }, 500);
  }
}

async function handleMessageHistory(parsed, res) {
  const userId = parsed.searchParams.get("userId");
  const peerId = parsed.searchParams.get("peerId");
  const skip = parseInt(parsed.searchParams.get("skip") || "0");
  const limit = parseInt(parsed.searchParams.get("limit") || "20");

  if (!userId || !peerId) {
    return jsonRes(res, { success: false, msg: "userId와 peerId 필요" }, 400);
  }

  try {
    const messages = await UserChat.find({
      $or: [
        { senderId: userId, recipientId: peerId },
        { senderId: peerId, recipientId: userId },
      ],
    })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    return jsonRes(res, {
      success: true,
      messages,
      hasMore: messages.length === limit,
    });
  } catch (err) {
    return jsonRes(res, { success: false, msg: "메시지 조회 실패" }, 500);
  }
}

async function handleSendMessage(data, res) {
  const { fromUserId, toUserId, message } = data;
  if (!fromUserId || !toUserId || !message) {
    return jsonRes(res, { success: false, msg: "fromUserId, toUserId, message 필요" }, 400);
  }

  try {
    await UserChat.create({ senderId: fromUserId, recipientId: toUserId, message });
    await sendPushNotification(toUserId, {
      title: `${fromUserId}님으로부터 새 메시지가 도착했습니다.`,
      body: message,
      url: `/main.html?mode=messenger&peerId=${encodeURIComponent(fromUserId)}`,
      tag: `message-${fromUserId}-${toUserId}`,
    });
    return jsonRes(res, { success: true, msg: "메시지 전송 완료" });
  } catch (err) {
    return jsonRes(res, { success: false, msg: "메시지 저장 실패" }, 500);
  }
}

module.exports = { handleParticipants, handleMessageHistory, handleSendMessage };
