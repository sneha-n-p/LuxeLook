const User = require("../../models/userSchema")
const Wishlist = require("../../models/wishlistSchema")
const Product = require("../../models/productSchema")
const Category = require("../../models/cartSchema")
const Cart = require("../../models/cartSchema")
const Address = require("../../models/addressSchema")
const Coupon = require("../../models/couponSchema")
const env = require("dotenv").config()

const applyCoupon = async(req,res)=>{
    try {
    const { coupon, subtotal } = req.body;
    const validCoupon = await Coupon.findOne({ name: coupon, islist: true });
    console.log('req.validCoupon:',validCoupon)

    if (!validCoupon) {
      return res.json({ success: false, message: 'Invalid coupon' });
    }

    const discount = validCoupon.offerPrice;
    const finalTotal = subtotal - discount;

    return res.json({ success: true, discount, finalTotal });
  } catch (error) {
    console.error('Coupon apply error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }

}

module.exports={
applyCoupon
}