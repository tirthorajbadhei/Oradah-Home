const mongoose = require('mongoose');

const depreciationSchema = new mongoose.Schema({
    cost: {
        type: Number,
        required: true,
        min: 0 // Ensure 0 is allowed
    },
    salvageValue: {
        type: Number,
        required: true,
        min: 0 // Ensure 0 is allowed
    },
    usefulLife: {
        type: Number,
        required: true,
        min: 1 // Ensure useful life is at least 1
    },
    depreciationPerYear: {
        type: Number
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Calculate straight-line depreciation before saving
depreciationSchema.pre('save', function(next) {
    if (this.cost >= 0 && this.salvageValue >= 0 && this.usefulLife >= 1) {
        this.depreciationPerYear = (this.cost - this.salvageValue) / this.usefulLife;
    }
    next();
});

const DepreciationModel = mongoose.model('Depreciation', depreciationSchema);
module.exports = DepreciationModel;
