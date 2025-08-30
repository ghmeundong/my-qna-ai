// server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');

// .env 읽기
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...vals] = line.split('=');
    if (!key) return;
    process.env[key.trim()] = vals.join('=').trim();
  });
}

// prompt.ini 읽기
const promptPath = path.join(__dirname, 'prompt.ini');
let CUSTOM_PROMPT = '';
if (fs.existsSync(promptPath)) {
  const lines = fs.readFileSync(promptPath, 'utf-8').split('\n');
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...vals] = line.split('=');
    if (!key) return;
    if (key.trim() === 'PROMPT') CUSTOM_PROMPT = vals.join('=').trim();
  });
}
console.log('Custom prompt loaded, length:', CUSTOM_PROMPT.length);

const apiKey = process.env.OPENAI_API_KEY;
const DEBUG_MOCK = process.env.DEBUG_MOCK === '1';
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const MAX_BODY_BYTES = process.env.MAX_BODY_BYTES ? Number(process.env.MAX_BODY_BYTES) : 1 * 1024 * 1024;

if (!apiKey && !DEBUG_MOCK) {
  console.error('OPENAI_API_KEY가 설정되지 않았습니다. .env 파일 확인');
  process.exit(1);
}

const usersPath = path.join(__dirname, 'db', 'users.json');
const chatsPath = path.join(__dirname, 'db', 'chats.json');

// DB 초기화
try {
  const dbDir = path.join(__dirname, 'db');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  if (!fs.existsSync(usersPath)) fs.writeFileSync(usersPath, '[]', 'utf8');
  if (!fs.existsSync(chatsPath)) fs.writeFileSync(chatsPath, '[]', 'utf8');
} catch (e) {
  console.error('DB 초기화 오류:', e);
  process.exit(1);
}

// JSON 읽기/쓰기
function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const txt = fs.readFileSync(filePath, 'utf-8');
    if (!txt) return [];
    return JSON.parse(txt);
  } catch (e) {
    console.error('readJson 오류:', filePath, e);
    return [];
  }
}

function writeJson(filePath, data) {
  try {
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
  } catch (e) {
    console.error('writeJson 오류:', filePath, e);
    throw e;
  }
}

// JSON 응답
function jsonRes(res, obj, status = 200) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

// ChatGPT 호출
function callChatGPT(messages, callback) {
  if (DEBUG_MOCK) {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    return process.nextTick(() => callback(null, `모의응답: ${lastUser ? lastUser.content : ''}`));
  }

  const postData = JSON.stringify({ model: "gpt-4o-mini", messages, temperature: 0.7 });

  const options = {
    hostname: "api.openai.com",
    path: "/v1/chat/completions",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData, 'utf8'),
      "Authorization": `Bearer ${apiKey}`
    },
    timeout: 30000
  };

  const req = https.request(options, res => {
    let body = "";
    res.on("data", chunk => body += chunk);
    res.on("end", () => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return callback(new Error(`OpenAI API error ${res.statusCode}: ${body}`));
      }
      try {
        const json = JSON.parse(body);
        const answer = json?.choices?.[0]?.message?.content;
        if (!answer) return callback(new Error('OpenAI 응답에 content 없음'));
        callback(null, answer);
      } catch (err) { callback(err); }
    });
  });

  req.on('timeout', () => req.destroy(new Error('request timeout')));
  req.on("error", err => callback(err));
  req.write(postData);
  req.end();
}

process.on('uncaughtException', err => console.error('uncaughtException:', err));
process.on('unhandledRejection', (reason, p) => console.error('unhandledRejection:', p, 'reason:', reason));

const RECENT_PAIRS = process.env.RECENT_PAIRS ? Number(process.env.RECENT_PAIRS) : 1;

const server = http.createServer((req, res) => {
  const startTime = Date.now();
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const parsed = url.parse(req.url || '/');
    const pathname = parsed.pathname || '/';

    console.log(`[${new Date().toISOString()}] ${req.method} ${pathname}`);

    if (req.method === 'POST') {
      let body = '';
      let receivedBytes = 0;
      req.on('data', chunk => {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_BODY_BYTES) {
          res.writeHead(413, { 'Content-Type': 'text/plain' });
          res.end('Request Entity Too Large');
          req.destroy();
        }
        body += chunk;
      });
      req.on('end', async () => {
        if (req.destroyed) return;
        let data;
        try { data = JSON.parse(body || '{}'); } catch (e) { data = {}; }

        try {
          const users = readJson(usersPath);

          // 회원가입
          if (pathname === '/signup') {
            const { userId, password, authCode } = data;
            if (authCode !== 'nontiscordardime') return jsonRes(res, { success: false, msg: '인증 코드 잘못됨' }, 400);
            if (!userId || !password) return jsonRes(res, { success: false, msg: 'userId와 password 필요' }, 400);
            if (users.find(u => u.userId === userId)) return jsonRes(res, { success: false, msg: '이미 존재하는 아이디' }, 409);

            users.push({ userId, password, role: 'regular' });
            writeJson(usersPath, users);
            console.log(`[SIGNUP] userId=${userId}`);
            return jsonRes(res, { success: true, msg: '회원가입 성공!' });
          }

          // 로그인
          if (pathname === '/login') {
            const { userId, password, role } = data;
            if (role === 'guest') {
              const guestId = `guest_${Date.now()}`;
              console.log(`[LOGIN] guestId=${guestId}`);
              return jsonRes(res, { success: true, userId: guestId, role: 'guest' });
            }
            if (!userId || !password) return jsonRes(res, { success: false, msg: 'userId와 password 필요' }, 400);
            const user = users.find(u => u.userId === userId && u.password === password);
            if (!user) return jsonRes(res, { success: false, msg: '아이디 또는 비밀번호 틀림' }, 401);
            console.log(`[LOGIN] userId=${user.userId}, role=${user.role}`);
            return jsonRes(res, { success: true, userId: user.userId, role: user.role });
          }

          // 채팅
          if (pathname === '/chat') {
            const { userId, role, question } = data;
            if (!question) return jsonRes(res, { success: false, msg: 'question 필요' }, 400);

            const chats = readJson(chatsPath);
            let userChats = chats.filter(c => c.userId === userId);
            const recentPairs = userChats.slice(-RECENT_PAIRS);

            const messages = [{ role: "system", content: CUSTOM_PROMPT || "기본 프롬프트 내용" }];
            recentPairs.forEach(pair => {
              if (pair.question) messages.push({ role: "user", content: String(pair.question) });
              if (pair.answer) messages.push({ role: "assistant", content: String(pair.answer) });
            });
            messages.push({ role: "user", content: question });

            callChatGPT(messages, (err, aiAnswer) => {
              if (err) {
                console.error('[CHAT] AI 호출 실패', err);
                return jsonRes(res, { success: false, msg: 'AI 호출 실패', details: DEBUG_MOCK ? String(err) : undefined }, 500);
              }
              const allChats = readJson(chatsPath);
              allChats.push({ userId, role, question, answer: aiAnswer, timestamp: Date.now() });
              writeJson(chatsPath, allChats);
              console.log(`[CHAT] userId=${userId} question="${question}"`);
              jsonRes(res, { success: true, answer: aiAnswer });
            });

            return;
          }

          return jsonRes(res, { success: false, msg: '알 수 없는 POST 경로' }, 404);
        } catch (e) {
          console.error('[POST 처리 오류]', e);
          return jsonRes(res, { success: false, msg: '서버 오류', details: DEBUG_MOCK ? String(e) : undefined }, 500);
        }
      });
      return;
    }

    // GET -> 정적 파일 제공
    const baseDir = path.resolve(__dirname, 'frontend');
    const target = pathname === '/' ? 'login.html' : pathname.replace(/^\/+/, '');
    const resolved = path.resolve(baseDir, target);
    if (!resolved.startsWith(baseDir)) {
      res.writeHead(400); res.end('Bad request'); return;
    }

    fs.readFile(resolved, (err, content) => {
      if (err) { console.error(`[GET] 404 ${target}`); res.writeHead(404); res.end('Not found'); return; }
      const ext = path.extname(resolved).toLowerCase();
      const mimeTypes = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json' };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
      res.end(content);
      console.log(`[GET] 200 ${target}`);
    });

  } catch (outerErr) {
    console.error('[서버 처리 예외]:', outerErr);
    try { jsonRes(res, { success:false, msg:'서버 처리 중 오류 발생' }, 500); } catch(e){ }
  } finally {
    const duration = Date.now() - startTime;
    console.log(`Request 처리 시간: ${duration}ms`);
  }
});

// Render 배포용 포트
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
