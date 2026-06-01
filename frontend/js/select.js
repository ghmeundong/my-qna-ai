const params = new URLSearchParams(window.location.search);
const userId = params.get("userId") || localStorage.getItem("userId");
const role = params.get("role") || localStorage.getItem("role");
const toast = document.getElementById("toast");
const welcomeText = document.getElementById("welcomeText");
const chatbotBtn = document.getElementById("chatbotBtn");
const messengerBtn = document.getElementById("messengerBtn");
const backBtn = document.getElementById("backBtn");

function showToast(msg, duration = 1800) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), duration);
}

if (!userId || !role) {
  window.location.href = "index.html";
} else {
  const message = `${userId}님, 동은이의 개인 서재에 오신 것을 환영합니다. 동은님 혹은 다른 분들과 대화하시려면 [메신저]를, 저와 대화하시려면 [AI 챗봇]을 선택해주세요. 단, 게스트 분들은 답변에 제한이 있을 수 있습니다.`;
  let index = 0;
  
  function typeMessage() {
    if (index < message.length) {
      welcomeText.textContent += message.charAt(index);
      index++;
      setTimeout(typeMessage, 15);
    }
  }
  
  typeMessage();
}

chatbotBtn.addEventListener("click", () => {
  window.location.href = `main.html?userId=${encodeURIComponent(userId)}&role=${encodeURIComponent(role)}&mode=chat`;
});

messengerBtn.addEventListener("click", () => {
  window.location.href = `main.html?userId=${encodeURIComponent(userId)}&role=${encodeURIComponent(role)}&mode=messenger`;
});

backBtn.addEventListener("click", () => {
  window.location.href = "index.html";
});

window.addEventListener("error", () => {
  showToast("알 수 없는 오류가 발생했습니다.");
});
