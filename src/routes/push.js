const { jsonRes } = require("../utils/response");
const PushSubscription = require("../models/pushSubscription");

async function handleSubscribe(data, res) {
  const { userId, subscription } = data || {};
  if (!userId || !subscription || !subscription.endpoint || !subscription.keys) {
    return jsonRes(res, { success: false, msg: "subscription 정보 필요" }, 400);
  }

  try {
    await PushSubscription.findOneAndUpdate(
      { userId },
      {
        userId,
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      },
      { upsert: true, returnDocument: "after" }
    );
    return jsonRes(res, { success: true, msg: "푸시 구독 정보 저장됨" });
  } catch (err) {
    console.error("Subscribe error:", err);
    return jsonRes(res, { success: false, msg: "구독 정보 저장 실패" }, 500);
  }
}

async function handleUnsubscribe(data, res) {
  const { userId } = data || {};
  if (!userId) {
    return jsonRes(res, { success: false, msg: "userId 필요" }, 400);
  }

  try {
    await PushSubscription.deleteOne({ userId });
    return jsonRes(res, { success: true, msg: "푸시 구독 정보 제거됨" });
  } catch (err) {
    console.error("Unsubscribe error:", err);
    return jsonRes(res, { success: false, msg: "구독 정보 제거 실패" }, 500);
  }
}

function handleVapidPublicKey(res) {
  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  if (!publicKey) {
    return jsonRes(res, { success: false, msg: "VAPID public key 없음" }, 500);
  }
  return jsonRes(res, { success: true, publicKey });
}

module.exports = { handleSubscribe, handleUnsubscribe, handleVapidPublicKey };
