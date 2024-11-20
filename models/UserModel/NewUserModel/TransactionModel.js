const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'register user',
        required: true,
    },
    Date: {
        type: Date,
        required: true
    },
    MainCategoryID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'category', // Reference to the category
        required: true,
    },
    CategoryType: {
        type: String,
        required: true,
    },
    CategoriesName: {
        type: String,
        required: true,
    },
    SubCategoryName: {
        SubCategoryID: { type: mongoose.Schema.Types.ObjectId, required: true },
        name: { type: String, required: true },
    },
    AccountID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'account', // Reference to the account

    },
    AccountName: {
        AccountID: { type: mongoose.Schema.Types.ObjectId, },
        Name: { type: String, },
    },
    Amount: {
        type: Number,
        required: true
    },
    TransactionType: {
        type: String,
        enum: ['Credit', 'Debit'],
        required: true
    },
    Description: {
        type: String,
    },
    Notes: {
        type: String,
    },
    depreciationMethod: {
        type: String,
    },
    salvagevalue: {
        type: Number,
    },
    lifeexpectancy: {
        type: Number,
    }

});
// Pre-save hook to format the Amount
transactionSchema.pre('save', function (next) {
    if (this.Amount !== undefined) {
        // Ensure the amount is a number and round it to two decimal places
        this.Amount = Math.round(this.Amount * 100) / 100; // Round to 2 decimal places
    }
    next();
});


const TransactionModel = mongoose.model("transaction", transactionSchema);

module.exports = { TransactionModel };
