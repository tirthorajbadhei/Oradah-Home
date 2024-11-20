const mongoose = require("mongoose");

const categorysetupSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'register user',
        required: true,
    },
    category: {
        type: String,
        unique: true, // Ensures an index is created for uniqueness
        required: true, // It's a good idea to require this field as well
    },
    sub_category: {
        type: [{
            sub: {
                type: String,
            },
        }],
    },

});

const CategorysetupModel = mongoose.model("categorysetup", categorysetupSchema);

module.exports = { CategorysetupModel };
