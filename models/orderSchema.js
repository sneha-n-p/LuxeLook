

const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");


const orderSchema = new Schema({
  orderId: {
    type: String,
    unique: true,
    required:true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "user",
    required: true,
  },
  orderedItems: [
    {
      product: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      productName: {
        type: String,
      },
      productImage: {
        type: String,
      },
      quantity: {
        type: Number,
        required: true,
      },
      size: {
        type: String,
        required: true,
      },
      price: {
        type: Number,
        default: 0,
      },
      status: {
        type: String,
        enum: ['Pending','Confirmed',"Ordered", "Cancelled", "Delivered", "Return Request",'Payment Failed', "Returned"],
        default: "Ordered",
      },
      returnReason: String,
      cancelReason: String,
    },
  ],
  totalPrice: {
    type: Number,
    required: true,
  },
  discount: {
    type: Number,
    default: 0,
  },
  finalAmount: {
    type: Number,
    required: true,
  },
  address: [
    {
      addressType: {
        type: String,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      streetAddress: {
        type: String,
        required: true,
      },
      apartment: String,
      state: {
        type: String,
        required: true,
      },
      pincode: {
        type: Number,
        required: true,
      },
      phone: {
        type: String,
        required: true,
      },
      altPhone: String,
    },
  ],
  invoiceDate: {
    type: Date,
  },
  status: {
    type: String,
    required: true,
    enum: [
      "Pending",
      "Processing",
      "Shipped",
      'Partialy Returned',
      'Partialy Canceled',
      "Delivered",
      "Confirmed",
      "Cancelled",
      'Payment Failed',
      "Out For Delivery",
      "Return Request",
      "Returned",
    ],
  },
  createdOn: {
    type: Date,
    default: Date.now,
    required: true,
  },
  couponApplied: String,
  paymentMethod: String,
  returnReason: String,
});

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;