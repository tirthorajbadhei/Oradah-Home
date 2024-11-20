// models/CarModel.js
const mongoose = require('mongoose');

const carSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'register user', required: true }, // Reference to the user
    modelName: { type: String, required: true },
    vehicleNumber: { type: String, required: true, unique: true },
    totalDistanceTravelled: { type: Number, default: 0 }, // To be updated after each trip
    milage: [{ type: mongoose.Schema.Types.ObjectId, ref: 'milage' }]
});

const CarModel = mongoose.model('Car', carSchema);
module.exports = CarModel;
