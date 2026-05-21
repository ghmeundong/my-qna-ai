// server.js
const systemPrompt = fs.readFileSync(path.join(__dirname, "prompt.ini"), "utf8");
const http = require("http");
const fs = require("fs");
const path = require("path");
const https = require("https");
const url = require("url");
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "login.html"));
});


// MongoDB 연결
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error(err));

// User 모델 정의
const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: "regular" }
});
const User = mongoose.model("User", userSchema);

// Chat 모델 정의
const chatSchema = new mongoose.Schema({
  userId: String,
  role: String,
  question: String,
  answer: String,
  timestamp: { type: Date, default: Date.now }
});
const Chat = mongoose.model("Chat", chatSchema);

// 회원가입
app.post("/signup", async (req, res) => {
  const { userId, password, authCode } = req.body;
  if (!userId || !password || !authCode) {
    return res.json({ success: false, msg: "모든 항목을 입력해주세요." });
  }
  if (authCode !== "nontiscordardime") {
    return res.json({ success: false, msg: "인증 코드가 올바르지 않습니다." });
  }

  try {
    const existing = await User.findOne({ userId });
    if (existing) {
      return res.json({ success: false, msg: "이미 존재하는 아이디" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ userId, password: hashedPassword });
    await newUser.save();
    res.json({ success: true, msg: "회원가입 성공!" });
  } catch (err) {
    res.json({ success: false, msg: "회원가입 실패", error: err });
  }
});

// 로그인
app.post("/login", async (req, res) => {
  const { userId, password, role } = req.body;
  if (role === "guest") {
    return res.json({ success: true, userId: "guest", role: "guest", msg: "게스트 로그인 성공" });
  }

  try {
    const user = await User.findOne({ userId });
    if (!user) {
      return res.json({ success: false, msg: "사용자를 찾을 수 없습니다." });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ success: false, msg: "비밀번호가 틀렸습니다." });
    }
    res.json({ success: true, userId: user.userId, role: user.role, msg: "로그인 성공!" });
  } catch (err) {
    res.json({ success: false, msg: "로그인 실패", error: err });
  }
});

// 채팅
app.post("/chat", async (req, res) => {
  const { userId, role, question } = req.body;
  if (!question) {
    return res.json({ success: false, msg: "question 필요" });
  }

  try {
    // 최근 대화 불러오기
    const recentChats = await Chat.find({ userId }).sort({ timestamp: -1 }).limit(Number(process.env.RECENT_PAIRS) || 1);

    const messages = [
      { role: "system", content: systemPrompt }
    ];
    recentChats.reverse().forEach(c => {
      if (c.question) messages.push({ role: "user", content: c.question });
      if (c.answer) messages.push({ role: "assistant", content: c.answer });
    });
    messages.push({ role: "user", content: question });

    // ChatGPT 호출
    callChatGPT(messages, async (err, aiAnswer) => {
      if (err) {
        return res.json({ success: false, msg: "AI 호출 실패", error: err });
      }
      const newChat = new Chat({ userId, role, question, answer: aiAnswer });
      await newChat.save();
      res.json({ success: true, answer: aiAnswer });
    });
  } catch (err) {
    res.json({ success: false, msg: "채팅 실패", error: err });
  }
});

// 정적 파일 제공
app.use(express.static(path.join(__dirname, "frontend")));

// 서버 실행
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// ChatGPT 호출 함수 (원래 코드 그대로 유지)
function callChatGPT(messages, callback) {
  const postData = JSON.stringify({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.9,
  });

  const options = {
    hostname: "api.openai.com",
    path: "/v1/chat/completions",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData, "utf8"),
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    timeout: 30000,
  };

  const req = https.request(options, (res) => {
    let body = "";
    res.on("data", (chunk) => (body += chunk));
    res.on("end", () => {
      try {
        const json = JSON.parse(body);
        const answer = json?.choices?.[0]?.message?.content;
        callback(null, answer);
      } catch (err) {
        callback(err);
      }
    });
  });

  req.on("error", (err) => callback(err));
  req.write(postData);
  req.end();
}