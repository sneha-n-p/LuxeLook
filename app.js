const express = require('express')
const app = express()
const env = require('dotenv').config()
const db = require("./dbConfig/db")
db()


app.listen(process.env.PORT,()=>console.log("server Running"))

module.exports = app