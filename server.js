// server.js
const http = require("http");
const mongoose = require("mongoose");
require("dotenv").config();

// 모델 임포트
const User = require("./models/user");
const Chat = require("./models/chat");
const Prompt = require("./models/prompt");
const Guestbook = require("./models/guestbook");

// 라우트 임포트
const { handleSignup, handleLogin } = require("./routes/auth");
const { handleChat, handleHistory } = require("./routes/chat");
const { handleStaticFiles } = require("./routes/static");
const { handleVisitor } = require("./routes/visitor");

// MongoDB 연결
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsed.pathname || "/";

  // POST 요청 처리
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
        if (pathname === "/signup") {
          await handleSignup(data, res);
        } else if (pathname === "/login") {
          await handleLogin(data, res);
        } else if (pathname === "/chat") {
          await handleChat(data, res);
        } else if (pathname === "/visitor") {
          await handleVisitor(req, data, res);
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, msg: "알 수 없는 POST 경로" }));
        }
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, msg: "서버 오류" }));
      }
    });
    return;
  }

  // GET 요청 처리
  if (req.method === "GET") {
    if (pathname === "/history") {
      handleHistory(parsed, res);
    } else {
      handleStaticFiles(pathname, res);
    }
    return;
  }
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
