// models/AppreciationDepreciation.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the AppreciationDepreciation schema
const appreciationdepreciationSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  purchaseDate: {
    type: Date,
    required: true
  },
  purchasePrice: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Office Computer', 'Building', 'Vehicle', 'Furniture', 'Software',
      'Land', 'Artwork', 'Machinery', 'Jewelry', 'Real Estate', 'Aircraft'
    ]
  },
  type: {
    type: String,
    enum: ['depreciable', 'appreciable'],
    required: true
  },
  depreciationRate: {
    type: Number,
    min: 0,
    max: 1,
    default: 0
  },
  appreciationRate: {
    type: Number,
    min: 0,
    max: 1,
    default: 0
  },
  currentValue: {
    type: Number
  }
});

// Create the model from the schema
const AppreciationdepreciationModel = mongoose.model('Appreciationdepreciation', appreciationdepreciationSchema);

module.exports = {AppreciationdepreciationModel};
