const mongoose = require("mongoose");

const guestbookSchema = new mongoose.Schema({
  userId: String, // 로그인 사용자: 실제 userId, 게스트: null
  guestId: String, // 게스트: guest_ID, 로그인 사용자: null
  ip: { type: String, required: true },
  visitCount: Number, // 로그인 사용자만 기록
  role: { type: String, enum: ["user", "guest"], required: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Guestbook", guestbookSchema);
