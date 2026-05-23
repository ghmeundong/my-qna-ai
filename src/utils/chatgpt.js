const https = require("https");

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

module.exports = { callChatGPT };
