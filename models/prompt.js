const mongoose = require("mongoose");

const promptSchema = new mongoose.Schema({
  role: { type: String, required: true, unique: true },
  content: { type: String, required: true },
});

module.exports = mongoose.model("Prompt", promptSchema);
