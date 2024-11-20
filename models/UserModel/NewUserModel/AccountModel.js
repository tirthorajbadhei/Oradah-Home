const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'register user',
        required: true,
    },
    AccountType: {
        type: String,
        required: true,
    },
    AccountName: [{
        Name: {
            type: String,
            required: true
        },
        OpeningBalance: {
            type: Number,
            default: 0
        }
    }]
});


const AccountModel = mongoose.model("account", accountSchema);

module.exports = { AccountModel };
