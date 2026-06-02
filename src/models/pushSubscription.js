const mongoose = require("mongoose");

const pushSubscriptionSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  endpoint: { type: String, required: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
});

module.exports = mongoose.model("PushSubscription", pushSubscriptionSchema);
