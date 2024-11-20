const mongoose = require("mongoose");

const userprofileSchema = mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'register user',
        required: true,
    },
    address: {
        type: String,
        // required: true,
    },
    currency: {
        type: String,
    },
    fiscal_year: {
        type: String,
    },
    balanceStartOfTheYear:{
        type: Number,
        default:0
    },
    profilePicture:{
        type: String,
    }
});

const UserporfileModel = mongoose.model("userprofile", userprofileSchema);

module.exports = { UserporfileModel };
