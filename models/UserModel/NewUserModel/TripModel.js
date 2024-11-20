const mongoose = require('mongoose');

const subTripSchema = new mongoose.Schema({
  tripDescription: { type: String },
  startPoint: { type: String, required: true }, // e.g., Point C
  endPoint: { type: String, required: true },   // e.g., Point E
  distanceTravelled: { type: Number, required: true },
  tipReceived: { type: Number, default: 0 },    // Only applicable for work trips
  date: { type: Date, required: true },
});

const tripSchema = new mongoose.Schema({
  car_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Car' },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'register user' },
  tripName: { type: String, required: true },
  tripDescription: { type: String },
  date: { type: Date, required: true },
  // Main trip details
  startPoint: { type: String },  // Starting point of the main trip
  endPoint: { type: String },    // Ending point of the main trip
  distanceTravelled: { type: Number, default: 0 }, // Total distance of the main trip
  // For Main Personal Trips
  personal: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId, auto: true }, // Automatically generated ID
      tripDescription: { type: String },
      distanceTravelled: { type: Number, default: 0 }, // Total distance from A to Z
      startPoint: { type: String }, // Main start point, e.g., Point A
      endPoint: { type: String },   // Main end point, e.g., Point Z
      date: { type: Date },
      subtrips: [subTripSchema],    // Array of subtrips like [Point C to Point E]
    }
  ],
  // For Main Work Trips
  work: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId, auto: true }, // Automatically generated ID
      tripDescription: { type: String },
      distanceTravelled: { type: Number, default: 0 }, // Total distance from A to Z
      startPoint: { type: String }, // Main start point, e.g., Point A
      endPoint: { type: String },   // Main end point, e.g., Point Z
      tipReceived: { type: Number, default: 0 },
      date: { type: Date },
      subtrips: [subTripSchema],    // Array of subtrips like [Point C to Point E]
    }
  ],

  isEnded: { type: Boolean, default: false },
});

const TripModel = mongoose.model('Trip', tripSchema);
module.exports = TripModel;
