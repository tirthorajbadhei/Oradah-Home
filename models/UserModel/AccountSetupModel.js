const mongoose = require("mongoose");

const accountsetupSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'register user',
        required: true,
    },
    basic_categories: {
        type: String,
        enum: ['Income', 'Expense','Transfer','Assets','Liabilities'],
        required: true,
    },
    category_type: {
        type: String,
        // required: true,
    },
    sub_category_type: {
        type: String,
        // required: true,
    },
    bank_account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'banksetup', // Reference to the BanksetupModel
        required: true,
    },
    bank_to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'banksetup', // Reference to the BanksetupModel for transfers
    },
    transaction: {
        type: [{
            type: {
                type: String,
                enum: ['Credit', 'Debit'], // Specify valid transaction types
                required: true,
            },
            amount: {
                type: Number,
                required: true,
                min: 0, // Amount must be a positive number
            },
            transaction_date: {
                type: Date, //mention transaction record date
            },
        }],
        // required: true,
    },
    createdAt: {
        type: Date,
        required: true,
    },
});

const AccountsetupModel = mongoose.model("accountsetup", accountsetupSchema);

module.exports = { AccountsetupModel };
