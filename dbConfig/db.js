const mongoose = require('mongoose')
const env = require("dotenv").config()
const logger = require('../helpers/logger')


const connectDB = async () => {
    try {

      await mongoose.connect('mongodb://0.0.0.0:27017/LuxeLook');
      logger.http('MongoDB Connected');

    } catch (err) {

      console.error(err);
      process.exit(1);
      
    }

  };
module.exports = connectDB
