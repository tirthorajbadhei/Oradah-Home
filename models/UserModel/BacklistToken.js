const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const BlacklistedTokenSchema = new Schema({
  token: { type: String, required: true },
  expiresAt: { type: Date, required: true }
});

const BlacklistedTokenModel = mongoose.model('BlacklistedToken', BlacklistedTokenSchema);

module.exports = { BlacklistedTokenModel };
