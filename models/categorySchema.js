const mongoose = require("mongoose")
const {Schema} = mongoose


const categorySchema = new mongoose.Schema({
    name:{
        type:String,
        required:true,
        unique:true
    },
    description:{
        type:String,
        required:true
    },
    status:{
        type:String,
        required:true,
        enum:['Listed','Unlisted']
    },
    createdAt:{
        type:Date,
        default:Date.now
    },
    offerPrice:{
        type:Number,
        required:false

    },
    offer:{
        type:Number,
        required:false
    }
    
})
const Category = mongoose.model("Category",categorySchema)

module.exports = Category