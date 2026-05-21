// server.js
const http = require("http");
const fs = require("fs");
const path = require("path");
const https = require("https");
const url = require("url");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
require("dotenv").config();

// prompt.ini 읽기
const promptPath = path.join(__dirname, "prompt.ini");
let CUSTOM_PROMPT = "";
if (fs.existsSync(promptPath)) {
  const lines = fs.readFileSync(promptPath, "utf-8").split("\n");
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const [key, ...vals] = line.split("=");
    if (key.trim() === "PROMPT") CUSTOM_PROMPT = vals.join("=").trim();
  });
}
console.log("Custom prompt loaded, length:", CUSTOM_PROMPT.length);

// MongoDB 연결
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

// User 모델
const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: "regular" },
});
const User = mongoose.model("User", userSchema);

// Chat 모델
const chatSchema = new mongoose.Schema({
  userId: String,
  role: String,
  question: String,
  answer: String,
  timestamp: { type: Date, default: Date.now },
});
const Chat = mongoose.model("Chat", chatSchema);

// JSON 응답
function jsonRes(res, obj, status = 200) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

// ChatGPT 호출
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
        if (!answer) return callback(new Error("OpenAI 응답에 content 없음"));
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

const RECENT_PAIRS = process.env.RECENT_PAIRS
  ? Number(process.env.RECENT_PAIRS)
  : 1;
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsed.pathname || "/";

  if (req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      let data;
      try {
        data = JSON.parse(body || "{}");
      } catch {
        data = {};
      }

      try {
        // 회원가입
        if (pathname === "/signup") {
          const { userId, password, authCode } = data;
          if (authCode !== "nontiscordardime")
            return jsonRes(
              res,
              { success: false, msg: "인증 코드 잘못됨" },
              400,
            );

          if (!userId || !password)
            return jsonRes(
              res,
              { success: false, msg: "userId와 password 필요" },
              400,
            );

          const exists = await User.findOne({ userId });
          if (exists)
            return jsonRes(
              res,
              { success: false, msg: "이미 존재하는 아이디" },
              409,
            );

          const hashedPassword = await bcrypt.hash(password, 10); // saltRounds = 10
          const newUser = new User({ userId, password: hashedPassword });
          await newUser.save();
          return jsonRes(res, { success: true, msg: "회원가입 성공!" });
        }

        // 로그인
        if (pathname === "/login") {
          const { userId, password, role } = data;
          if (role === "guest") {
            const guestId = `guest_${Date.now()}`;
            return jsonRes(res, {
              success: true,
              userId: guestId,
              role: "guest",
            });
          }

          if (!userId || !password)
            return jsonRes(
              res,
              { success: false, msg: "userId와 password 필요" },
              400,
            );

          const user = await User.findOne({ userId });
          if (!user)
            return jsonRes(
              res,
              { success: false, msg: "아이디 또는 비밀번호 틀림" },
              401,
            );

          const match = await bcrypt.compare(password, user.password);
          if (!match)
            return jsonRes(
              res,
              { success: false, msg: "아이디 또는 비밀번호 틀림" },
              401,
            );

          return jsonRes(res, {
            success: true,
            userId: user.userId,
            role: user.role,
          });
        }

        // 채팅
        if (pathname === "/chat") {
          const { userId, role, question } = data;
          if (!question)
            return jsonRes(res, { success: false, msg: "question 필요" }, 400);

          const recentChats = await Chat.find({ userId })
            .sort({ timestamp: -1 })
            .limit(RECENT_PAIRS);

          const messages = [
            { role: "system", content: CUSTOM_PROMPT || "기본 프롬프트 내용" },
          ];
          recentChats.reverse().forEach((c) => {
            if (c.question)
              messages.push({ role: "user", content: c.question });
            if (c.answer)
              messages.push({ role: "assistant", content: c.answer });
          });
          messages.push({ role: "user", content: question });

          callChatGPT(messages, async (err, aiAnswer) => {
            if (err) {
              return jsonRes(res, { success: false, msg: "AI 호출 실패" }, 500);
            }
            await Chat.create({ userId, role, question, answer: aiAnswer });
            jsonRes(res, { success: true, answer: aiAnswer });
          });
          return;
        }

        return jsonRes(
          res,
          { success: false, msg: "알 수 없는 POST 경로" },
          404,
        );
      } catch (err) {
        return jsonRes(
          res,
          { success: false, msg: "서버 오류", error: err },
          500,
        );
      }
    });
    return;
  }

  // GET → 정적 파일 제공
  const baseDir = path.resolve(__dirname, "frontend");
  const target = pathname === "/" ? "login.html" : pathname.replace(/^\/+/, "");
  const resolved = path.resolve(baseDir, target);
  if (!resolved.startsWith(baseDir)) {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  fs.readFile(resolved, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    const mimeTypes = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".json": "application/json",
    };
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });
    res.end(content);
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
