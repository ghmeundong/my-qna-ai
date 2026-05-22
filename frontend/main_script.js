const BASE_URL = "";
const chatArea = document.getElementById("chatArea");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const sidebar = document.getElementById("sidebar");
const logoutBtn = document.getElementById("logoutBtn");
const toast = document.getElementById("toast");
const params = new URLSearchParams(window.location.search);
const userId =
  params.get("userId") ||
  localStorage.getItem("userId") ||
  `guest_${Date.now()}`;
const role = params.get("role") || localStorage.getItem("role") || "guest";
if (!userId) {
  try {
    localStorage.clear();
  } catch (e) {}
  window.location.href = "login.html";
}

// 공통 함수: 메시지 추가
function addMessage(text, className) {
  const msg = document.createElement("div");
  msg.className = "message " + className;
  msg.textContent = text;
  chatArea.appendChild(msg);

  scrollChatToBottom();
}

// 공통 함수: 채팅 영역 스크롤
function scrollChatToBottom() {
  requestAnimationFrame(() => {
    chatArea.scrollTo({
      top: chatArea.scrollHeight,
      behavior: "smooth"
    });
  });
}

// 공통 함수: Toast
function showToast(msg, duration = 2000) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), duration);
}

// 공통 함수: POST
async function postData(url = "", data = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.status);
  }
  return res.json();
}

// typing indicator
function showTyping() {
  if (document.getElementById("typingIndicator")) return;
  const t = document.createElement("div");
  t.className = "typing";
  t.id = "typingIndicator";
  t.innerHTML =
    '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
  chatArea.appendChild(t);

  // 인디케이터가 추가될 때도 스크롤
  requestAnimationFrame(() => {
    chatArea.scrollTo({
      top: chatArea.scrollHeight,
      behavior: "smooth"
    });
  });
}
function hideTyping() {
  const t = document.getElementById("typingIndicator");
  if (t) t.remove();
}

// 초기 AI 메시지
addMessage(
  `안녕하세요! ${userId}님, 위대하고 지엄하신 김동은님에 대해 궁금한 점이 있으신가요?`,
  "ai",
);

let isRequesting = false;

async function sendMessage() {
  if (isRequesting) return;
  const question = userInput.value.trim();
  if (!question) return;

  userInput.value = "";
  addMessage(question, "user");
  showTyping();
  sendBtn.disabled = true;
  isRequesting = true;

  try {
    const data = await postData(`${BASE_URL}/chat`, { userId, role, question });
    addMessage(data.answer || "AI가 답변하지 못했습니다.", "ai");
  } catch (e) {
    console.error(e);
    addMessage("AI 응답 실패", "ai");
    showToast(e.message || "오류발생", 2500);
  } finally {
    hideTyping();
    sendBtn.disabled = false;
    userInput.focus();
    isRequesting = false;
  }
}

// 이벤트
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    if (isRequesting) {
      showToast("이전 요청이 처리 중입니다. 잠시만 기다려 주세요.", 1500);
      return;
    }
    sendMessage();
  }
});
sendBtn.addEventListener("click", sendMessage);
logoutBtn?.addEventListener("click", () => {
  try {
    localStorage.clear();
  } catch (e) {}
  window.location.href = "login.html";
});

userInput.addEventListener("focus", () => {
  scrollChatToBottom();
});

// 페이지 로드 시 기본 펼침
document.addEventListener("DOMContentLoaded", () => {
  sidebar.classList.add("expanded");
});

// 입력창 입력 시 숨김
userInput.addEventListener("input", () => {
  sidebar.classList.remove("expanded");
});

