// models/RegisteruserModel.js
const mongoose = require("mongoose");

const registeruserSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: {
    type: Number,
    required: true,
  },
  countryCode:{
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  UserType: {
    type: String,
    required: true,
  },
  BusinessType: {
    type: String,
  },
  BusinessCategories: {
    type: String,
  },
  state: {
    type: String,
    required: true,
  },
  Active: {
    type: Boolean,
    default: true, // Set default value to true
  },
  BusinessName: {
    type: String,
  },
  userprofile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'userprofile',
  },
  category: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'category',
  }],
  account: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'account',
  }],
  transaction: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'transaction',
  }],
  // Add references for cars and trips
  cars: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Car',
  }],
  milage: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'milage',
  }],
  trips: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
  }],
  Inventory: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
  }]
}, {
  timestamps: true,
});

const RegisteruserModel = mongoose.model("register user", registeruserSchema);
module.exports = { RegisteruserModel };
