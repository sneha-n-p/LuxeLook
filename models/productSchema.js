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
        required: true
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
        required: true
    },
    productImage: {
        type: [String],
        required: true
    },
    isBlocked: {
        type: Boolean,
        default: false
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
            required: true
        },
        color: {
            type: String,
            required:true
        },
        salePrice:{
            type:Number,
            required:true
        },
        quantity:{
            type:Number,
            required:true
        }
    }]

}, { timeseries: ture })


const Product = mongoose.model("Product", productSchema)

module.exports = Product