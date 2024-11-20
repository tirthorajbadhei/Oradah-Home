const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'register user', required: true }, // Reference to the user
    itemName: {
        type: String,
        required: true, // The name of the inventory item
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'category', // Reference to the category
        required: true,
    },
    purchaseDate: {
        type: Date,
        required: true,
    },
    purchasePrice: {
        type: Number,
        required: true, // Cost of purchasing the item
    },
    quantity: {
        type: Number,
        required: true, // Quantity of items in stock
        default: 0, // Default quantity is 0 if not specified
    },
    reorderLevel: {
        type: Number, //reordering is triggered and notify user that their stock in low
        default: 0, // Default reorder level, adjust based on your business needs
    },
    depreciationMethod: {
        type: String, // Method of depreciation (e.g., straight-line, units of production)
        required: false,
    },
    usefulLife: {
        type: Number, // The useful life of the item (in years)
        required: false,
    },
    salvageValue: {
        type: Number, // Estimated value at the end of useful life
        required: false,
    },
    depreciationForecast: [
        {
            year: Number,   // Depreciation Forcast Array
            depreciation: Number,
            endingValue: Number,
        },
    ],
    remainingValue: {
        type: Number, // The value of the item after depreciation
        default: function () {
            return this.purchasePrice; // Initially, the remaining value is the purchase price
        },
    },
    lastUpdated: {
        type: Date,
        default: Date.now, // Automatically updates the last modified date
    },
});


const InventoryModel = mongoose.model('Inventory', inventorySchema);

module.exports = InventoryModel;
