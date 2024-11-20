const mongoose = require("mongoose");

const connect = mongoose.connect(
  `mongodb+srv://Tirthoraj:Tirthoraj@cluster0.nd9yv8x.mongodb.net/Finance?retryWrites=true&w=majority`
);

module.exports = { connect };
