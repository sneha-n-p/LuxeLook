const mongoose = require('mongoose')
const env = require("dotenv").config()


const connectDB = async () => {
    try {

      await mongoose.connect('mongodb://0.0.0.0:27017/yourdbname');
      console.log('MongoDB Connected');

    } catch (err) {

      console.error(err);
      process.exit(1);
      
    }

  };
module.exports = connectDB
