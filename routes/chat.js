const { jsonRes } = require("../utils/response");
const { callChatGPT } = require("../utils/chatgpt");
const Chat = require("../models/chat");
const Prompt = require("../models/prompt");

const RECENT_PAIRS = process.env.RECENT_PAIRS
  ? Number(process.env.RECENT_PAIRS)
  : 1;

async function handleChat(data, res) {
  const { userId, role, question } = data;
  if (!question)
    return jsonRes(res, { success: false, msg: "question 필요" }, 400);

  const recentChats = await Chat.find({ userId })
    .sort({ timestamp: -1 })
    .limit(RECENT_PAIRS);

  const promptDoc = await Prompt.findOne({ role });
  const systemPrompt = promptDoc ? promptDoc.content : "기본 프롬프트";

  const messages = [{ role: "system", content: systemPrompt }];
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
}

async function handleHistory(parsed, res) {
  const userId = parsed.searchParams.get("userId");
  const skip = parseInt(parsed.searchParams.get("skip") || "0");
  const limit = parseInt(parsed.searchParams.get("limit") || "5");

  if (!userId) {
    return jsonRes(res, { success: false, msg: "userId 필요" }, 400);
  }

  try {
    const chats = await Chat.find({ userId })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    return jsonRes(res, {
      success: true,
      chats,
      hasMore: chats.length === limit,
    });
  } catch (err) {
    return jsonRes(res, { success: false, msg: "대화 조회 실패" }, 500);
  }
}

module.exports = { handleChat, handleHistory };
