// models/CarModel.js
const mongoose = require('mongoose');

const milageSchema = new mongoose.Schema({
    // Main Journey details
    car_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Car' },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'register user' },
    tripName: { type: String },
    tripDescription: { type: String },
    date: { type: Date, required: true },
    startPoint: { type: String },  // Starting point of the main trip
    endPoint: { type: String },    // Ending point of the main trip
    distanceTravelled: { type: Number, default: 0 }, // Total distance of the main trip
    JourneyMode: { type: String },

    trips: [
        {
            TripServices: [{ type: String }], // Array of service types for each trip
            tripName: { type: String },
            tripDescription: { type: String },
            startPoint: { type: String }, // Main start point, e.g., Point A
            endPoint: { type: String },   // Main end point, e.g., Point Z
            tipReceived: { type: Number, default: 0 },
            date: { type: Date },
        }
    ],
});

const MilageModel = mongoose.model('milage', milageSchema);
module.exports = MilageModel;
