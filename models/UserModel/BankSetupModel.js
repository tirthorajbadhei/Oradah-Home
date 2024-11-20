const mongoose = require("mongoose");

const banksetupSchema = mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'register user',
        required: true,
    },
    bank_account: {
        type: String,
        required: true,
    },
    bank_type: {
        type: String,
        required: true,
    },
    account_number: {
        type: Number,
        required: true,
        unique: true // Ensures that the account number is unique
    },
    opening_balance: {
        type: Number,
        default: 0, // Default value of 0 if not specified
    },
});

const BanksetupModel = mongoose.model("banksetup", banksetupSchema);

module.exports = { BanksetupModel };
