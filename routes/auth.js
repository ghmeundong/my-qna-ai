const bcrypt = require("bcrypt");
const { jsonRes } = require("../utils/response");
const User = require("../models/User");

async function handleSignup(data, res) {
  const { userId, password, authCode } = data;
  if (authCode !== "nontiscordardime")
    return jsonRes(res, { success: false, msg: "인증 코드 잘못됨" }, 400);

  if (!userId || !password)
    return jsonRes(
      res,
      { success: false, msg: "userId와 password 필요" },
      400
    );

  const exists = await User.findOne({ userId });
  if (exists)
    return jsonRes(
      res,
      { success: false, msg: "이미 존재하는 아이디" },
      409
    );

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new User({ userId, password: hashedPassword });
  await newUser.save();
  return jsonRes(res, { success: true, msg: "회원가입 성공!" });
}

async function handleLogin(data, res) {
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
      400
    );

  const user = await User.findOne({ userId });
  if (!user)
    return jsonRes(
      res,
      { success: false, msg: "아이디 또는 비밀번호 틀림" },
      401
    );

  const match = await bcrypt.compare(password, user.password);
  if (!match)
    return jsonRes(
      res,
      { success: false, msg: "아이디 또는 비밀번호 틀림" },
      401
    );

  return jsonRes(res, {
    success: true,
    userId: user.userId,
    role: user.role,
  });
}

module.exports = { handleSignup, handleLogin };
