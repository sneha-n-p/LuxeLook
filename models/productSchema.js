const mongoose = require("mongoose")
const { Schema } = mongoose


const productSchema = new Schema({
    productName: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    brand: {
        type: String,
        required: false
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },
    regularPrice: {
        type: Number,
        required: true
    },
    salePrice: {
        type: Number,
        required: true
    },
    productOffer: {
        type: Number,
        default: 0
    },
    quatity: {
        type: Number,
        default: true
    },
    color: {
        type: String,
        required: false
    },
    productImage: {
        type: [String],
        required: true
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    size:{
        type: Array,
        required:true
    },
    status: {
        type: String,
        enum: ["available", "out of stock", "Discountinued"],
        reuired: true,
        default: "available"
    },
    variant: [{
        size: {
            type: String,
            required: false
        },
        color: {
            type: String,
            required:false
        },
        salePrice:{
            type:Number,
            required:false
        },
        quantity:{
            type:Number,
            required:false
        }
    }],
    offer:{
        type:Number,
        default:0
    },
    createdAt:{
        type:Date,
        default:Date.now
    }

})


const Product = mongoose.model("Product", productSchema)

module.exports = Product