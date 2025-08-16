const mongoose = require("mongoose")
const { Schema } = mongoose

const couponSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    createdOn: {
        type: Date,
        default: Date.now,
        required: true
    },
    expiredOn: {
        type: Date,
        required: true
    },
    offerPrice:{
        type:Number,
        required:true
    },
    minimumPrice:{
        type:Number,
        required:true
    },
    restricted:{
        type:Boolean,
        default:false
    },
    islist:{
        type:Boolean,
        default:true
    },
    userId:{
        type:Schema.Types.ObjectId,
        ref:"User"
    },
    usedBy:[{
        type:Schema.Types.ObjectId,
        ref:"User"
    }]
})

const Coupon = mongoose.model("Coupon",couponSchema)
module.exports = Coupon