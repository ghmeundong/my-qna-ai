const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  userId: String,
  role: String,
  question: String,
  answer: String,
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Chat", chatSchema);
