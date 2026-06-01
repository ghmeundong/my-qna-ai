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
  const message = `${userId}님, 이동할 서비스를 선택해주세요.`;
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
