const mongoose = require("mongoose")
const { Schema } = mongoose
const { v4: uuidv4 } = require("uuid")

const orderSchema = new Schema({
    orderId: {
        type: String,
        default: () => uuidv4(),
        unique: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    orderedItems: [{
        product: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        productName:{
            type:String,
            required:false
        },
        productImage:{
            type:String,
            required:false
        },
        quantity: {
            type: Number,
            required: true
        },
        price: {
            type: Number,
            default: 0
        },
        status: {
            type: String,
            enum: ['Ordered', 'Cancelled','Delivered','Return Request','Returned'],
            default: 'Ordered',
        },
        returnReason: {
            type:String,
            required:false,
        }
    }],
    totalPrice: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0
    },
    finalAmount: {
        type: Number,
        required: true
    },
  
    address: [{
        addressType: {
            type: String,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        streetAddress: {
            type: String,
            required: true
        },
        apartment: {
            type: String,
            required: false  
        },
        state: {
            type: String,
            required: true
        },
        pincode:{
            type:Number,
            required:true
        },
        phone:{
            type:String,
            reuired:true
        },
        altPhone:{
            type:String,
            required:false
        }
    }],
    invoiceDate: {
        type: Date
    },
    status: {
        type: String,
        required: true,
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled','Out For Delivery', 'Return Request', 'Returned']
    },
    createdOn: {
        type: Date,
        default: Date.now,
        required: true
    },
    couponApplied: {
        type: Boolean,
        default: false
    },
    returnReason :{
        type:String,
        required:false
    }
})

const Order = mongoose.model("Order", orderSchema)
module.exports = Order