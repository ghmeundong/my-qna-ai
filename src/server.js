// server.js
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
require("dotenv").config();

// 모델 임포트
const User = require("./models/user");
const Chat = require("./models/chat");
const Prompt = require("./models/prompt");
const Guestbook = require("./models/guestbook");
const UserChat = require("./models/userChat");

// 라우트 임포트
const { handleSignup, handleLogin } = require("./routes/auth");
const { handleChat, handleHistory } = require("./routes/chat");
const {
  handleParticipants,
  handleMessageHistory,
  handleSendMessage,
} = require("./routes/messenger");
const { handleSubscribe, handleUnsubscribe, handleVapidPublicKey } = require("./routes/push");
const { sendPushNotification } = require("./utils/notification");
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
        } else if (pathname === "/message") {
          await handleSendMessage(data, res);
        } else if (pathname === "/subscribe") {
          await handleSubscribe(data, res);
        } else if (pathname === "/unsubscribe") {
          await handleUnsubscribe(data, res);
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
    } else if (pathname === "/participants") {
      handleParticipants(parsed, res);
    } else if (pathname === "/messages") {
      handleMessageHistory(parsed, res);
    } else if (pathname === "/vapidPublicKey") {
      handleVapidPublicKey(res);
    } else {
      handleStaticFiles(pathname, res);
    }
    return;
  }
});

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const onlineUsers = new Map();

io.on("connection", (socket) => {
  socket.on("join", ({ userId }) => {
    if (!userId) return;
    onlineUsers.set(userId, socket.id);
    socket.data.userId = userId;
  });

  socket.on("private_message", async (payload) => {
    const { fromUserId, toUserId, message } = payload || {};
    if (!fromUserId || !toUserId || !message) return;

    try {
      await UserChat.create({
        senderId: fromUserId,
        recipientId: toUserId,
        message,
      });

      const recipientSocketId = onlineUsers.get(toUserId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("private_message", {
          fromUserId,
          toUserId,
          message,
          timestamp: new Date().toISOString(),
        });
      }

      await sendPushNotification(toUserId, {
        title: `${fromUserId}님으로부터 새 메시지가 도착했습니다.`,
        body: message,
        url: `/main.html?mode=messenger&peerId=${encodeURIComponent(fromUserId)}`,
        tag: `message-${fromUserId}-${toUserId}`,
      });
    } catch (err) {
      console.error("Socket message save failed:", err);
    }
  });

  socket.on("typing", (payload) => {
    const { fromUserId, toUserId } = payload || {};
    if (!fromUserId || !toUserId) return;

    const recipientSocketId = onlineUsers.get(toUserId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("typing", { fromUserId, toUserId });
    } 
  });

  socket.on("stop_typing", (payload) => {
    const { fromUserId, toUserId } = payload || {};
    if (!fromUserId || !toUserId) return;

    const recipientSocketId = onlineUsers.get(toUserId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("stop_typing", { fromUserId, toUserId });
    }
  });

  socket.on("disconnect", () => {
    const userId = socket.data.userId;
    if (userId && onlineUsers.get(userId) === socket.id) {
      onlineUsers.delete(userId);
    }
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
