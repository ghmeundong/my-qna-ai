const { jsonRes } = require("../utils/response");
const Guestbook = require("../models/guestbook");

// IP 주소 추출 함수
function getClientIp(req) {
  let ip =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    req.socket.remoteAddress ||
    "Unknown";

  // localhost 형식으로 통일
  if (ip === "::1" || ip === "127.0.0.1" || ip === "::ffff:127.0.0.1") {
    ip = "localhost";
  }

  return ip;
}

async function handleVisitor(req, data, res) {
  const { userId, role, guestId } = data;

  if (!userId || !role) {
    return jsonRes(
      res,
      { success: false, msg: "userId와 role 필요" },
      400
    );
  }

  const ip = getClientIp(req);

  try {
    if (role === "guest") {
      // 게스트: 매번 새로운 방문자로 기록 (visitCount 없음)
      const guestRecord = new Guestbook({
        guestId: guestId,
        ip: ip,
        role: "guest",
      });
      await guestRecord.save();
      return jsonRes(res, { success: true, msg: "게스트 방문 기록됨" });
    } else {
      // 로그인 사용자: 기존 기록 확인 후 visitCount 증가
      const existingRecord = await Guestbook.findOne({
        userId: userId,
        role: "user",
      });

      if (existingRecord) {
        // 기존 기록 업데이트
        existingRecord.visitCount += 1;
        existingRecord.ip = ip; // IP 업데이트 (변경되었을 수 있음)
        existingRecord.timestamp = new Date();
        await existingRecord.save();
      } else {
        // 새로운 기록 생성
        const userRecord = new Guestbook({
          userId: userId,
          ip: ip,
          visitCount: 1,
          role: "user",
        });
        await userRecord.save();
      }

      return jsonRes(res, { success: true, msg: "사용자 방문 기록됨" });
    }
  } catch (err) {
    console.error("방문자 기록 오류:", err);
    return jsonRes(
      res,
      { success: false, msg: "방문자 기록 실패" },
      500
    );
  }
}

module.exports = { handleVisitor };
