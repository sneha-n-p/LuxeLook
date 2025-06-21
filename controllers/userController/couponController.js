const User = require("../../models/userSchema")
const Wishlist = require("../../models/wishlistSchema")
const Product = require("../../models/productSchema")
const Category = require("../../models/cartSchema")
const Cart = require("../../models/cartSchema")
const Address = require("../../models/addressSchema")
const Coupon = require("../../models/couponSchema")
const StatusCode = require("../../statusCode")
const env = require("dotenv").config()

const applyCoupon = async (req, res) => {
  try {
    const { coupon, subtotal } = req.body;
    const userId = req.session.user;

    const validCoupon = await Coupon.findOne({ name: coupon, islist: true });

    if (!validCoupon) {
      return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: 'Invalid coupon' });
    }

    if (validCoupon.usedBy.includes(userId)) {
      return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: 'Coupon already used' });
    }

    const discount = validCoupon.offerPrice;
    const finalTotal = subtotal - discount;

    return res.json({
      success: true,
      discount,
      finalTotal,
      couponId: validCoupon._id
    });

  } catch (error) {
    console.error('Coupon apply error:', error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Server error' });
  }
};


module.exports = {
  applyCoupon
}