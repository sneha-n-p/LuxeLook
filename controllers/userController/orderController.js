const User = require("../../models/userSchema")
const Cart = require("../../models/cartSchema")
const Product = require("../../models/productSchema")
const Order = require("../../models/orderSchema")
const Address = require("../../models/addressSchema")
const Wallet = require("../../models/walletSchema")
const Coupon = require('../../models/couponSchema')
const mongoose = require('mongoose')
const Razorpay = require('razorpay');
const StatusCode = require("../../statusCode")

const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    console.log('req.body:', req.body);
    const { addressId, paymentMethod, coupon, size,couponId } = req.body;

    if (!userId) {
      return res.status(StatusCode.UNAUTHORIZED).json({
        success: false,
        message: 'Please log in to place an order.',
      });
    }

    const AddId = new mongoose.Types.ObjectId(addressId);
    const addresses = await Address.findOne({ userId });
    if (!addresses) {
      return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: 'No addresses found for this user.',
      });
    }

    const address = addresses.address.find((add) => add._id.equals(AddId));
    if (!address) {
      return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: 'Address not found. Please add a valid address.',
      });
    }

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    console.log('cart:',cart)
    if (!cart || cart.items.length === 0) {
      return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: 'Cart is empty.',
      });
    }

    const orderedItems = [];
    for (const item of cart.items) {
      const selectedSize = item.size; 
      const product = item.productId;

      if (!product.variant || !Array.isArray(product.variant)) {
        return res.status(StatusCode.BAD_REQUEST).json({
          success: false,
          message: `No variants found for product: ${product.productName}`,
        });
      }

      const variant = product.variant.find((v) => v.size === selectedSize);
      if (!variant) {
        return res.status(StatusCode.BAD_REQUEST).json({
          success: false,
          message: `Variant not found for size ${selectedSize} in product ${product.productName}`,
        });
      }

      if (variant.quantity < item.quantity) {
        return res.status(StatusCode.BAD_REQUEST).json({
          success: false,
          message: `Not enough stock for ${product.productName} in size ${selectedSize}`,
        });
      }

      orderedItems.push({
        product: product._id,
        quantity: item.quantity,
        size: selectedSize,
        price: item.totalPrice,
        productName: product.productName,
        productImage: product.productImage[0],
      });

      variant.quantity -= item.quantity;
    }

    const totalPrice = orderedItems.reduce((acc, item) => acc + item.quantity * item.price, 0);

let discount = 0;
let appliedCoupon = null;
let couponName = null;

if (coupon && couponId) {
  console.log('Validating coupon:', { coupon, couponId, userId, totalPrice });

  appliedCoupon = await Coupon.findOne({
  name: coupon,
  // status: 'active',
  // expiredOn: { $gte: new Date() },
  // minimumPrice: { $lte: totalPrice },
  // usedBy: { $ne: userId },
  // $or: [
  //   { restricted: false },
  //   { restricted: true, userId: { $in: [new mongoose.Types.ObjectId(userId)] } }
  // ]
});


  if (appliedCoupon) {
    console.log(' Valid coupon found:', appliedCoupon);
    discount = appliedCoupon.offerPrice || 0;
    couponName = appliedCoupon.name;

    await Coupon.findByIdAndUpdate(couponId, {
      $push: { usedBy: userId }
    });
  } else {
    console.log(' Coupon validation failed:', { coupon, couponId });

    return res.status(400).json({
      success: false,
      message: 'Invalid, expired, restricted, or already used coupon.'
    });
  }
} else {
  console.log(' No coupon provided or missing couponId.');
}
    const finalAmount = Math.max(Number(totalPrice) - discount, 0);
    console.log('Order details:', {
      totalPrice,
      discount,
      finalAmount,
      couponName,
      address,
    });

    const newOrder = new Order({
      orderedItems,
      userId,
      totalPrice,
      discount,
      finalAmount,
      address: [
        {
          addressType: address.addressType,
          name: address.name,
          city: address.city,
          streetAddress: address.streetAddress,
          apartment: address.apartment,
          state: address.state,
          pincode: address.pincode,
          phone: address.phone,
          altPhone: address.altPhone,
        },
      ],
      status: paymentMethod === 'COD' ? 'Confirmed' : 'Pending',
      couponApplied: couponName,
      paymentMethod,
    });

    await newOrder.save();

    // Update product stock
    for (const item of cart.items) {
      const product = item.productId;
      await product.save();
    }

    await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

    if (paymentMethod === 'COD') {
      return res.redirect('/orderSuccess');
    } else {
      return res.status(StatusCode.OK).json({
        success: true,
        message: 'Order placed successfully.',
        orderId: newOrder._id,
      });
    }
  } catch (error) {
    console.error('Error placing order:', error);
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Something went wrong.',
      error: error.message,
    });
  }
};

const loadOrderSuccess = async (req, res) => {
  try {
    const userId = req.session.user
    console.log('req.body:', req.body)
    const user = await User.findById(userId)
    const cartData = await Cart.findOne({ userId: userId })
    const address = await Address.findOne({ userId: userId })
    const order = await Order.find({ userId: userId })
      .sort({ createdOn: -1 })
      .limit(1)
      .populate("orderedItems.product");
    res.render('orderSuccess', { user, orders: order[0] })
  } catch (error) {
    console.error(error)
    res.status(StatusCode.NOT_FOUND).redirect('/pageNotFound')
  }


}

const loadOrders = async (req, res) => {
  try {
    let search = req.query.search || "";
    let page = parseInt(req.query.page) || 1;
    const limit = 5;

    const userId = req.session.user;
    const user = await User.findById(userId);

    const matchQuery = {
      userId: userId,
    };

    const count = await Order.countDocuments(matchQuery);
    const totalPages = Math.ceil(count / limit);

    const orders = await Order.find(matchQuery)
      .populate("orderedItems.product")
      .sort({ createdOn: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    res.render("orderDetails", {
      user,
      orders,
      totalPages,
      currentPage: page,
      search,
      activePage: 'orderDetails',
      currentPath:'/orders'
    });
  } catch (error) {
    console.error(error);
    res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound");
  }
};



const viewOrderDetails = async (req, res) => {
  try {
    const userId = req.session.user;
    const orderId = req.params.id;

    const order = await Order.findOne({ _id: orderId, userId }).populate("orderedItems.product");
    console.log("order:", order)
    const user = await User.findById(userId);
    const address = await Address.find()

    if (!order) {
      return res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound");
    }

    res.render("orderDetailsView", { order, user, activePage: "orderDetailsView" ,currentPath:'/orders'});
  } catch (error) {
    console.log(error);
    res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound");
  }
};

const cancelSingleProduct = async (req, res) => {
  try {
    const { productId, orderId, reason } = req.body;
    const order = await Order.findById(orderId).populate('orderedItems.product');

    if (!order) return res.status(StatusCode.NOT_FOUND).json({ message: 'Order not found' });

    const itemToCancel = order.orderedItems.find(item =>
      item.product._id.toString() === productId
    );

    if (!itemToCancel) return res.status(StatusCode.NOT_FOUND).json({ message: 'Product not found in order' });
    if (itemToCancel.status === 'Cancelled') {
      return res.status(StatusCode.BAD_REQUEST).json({ message: 'Product is already cancelled' });
    }

    const product = await Product.findById(productId);
    const variant = product.variant.find(v => v.size === itemToCancel.size);
    if (!variant) {
      return res.status(StatusCode.BAD_REQUEST).json({ message: 'Variant with matching size not found' });
    }
    variant.quantity += itemToCancel.quantity;
    await product.save();

    const itemInOrder = order.orderedItems.id(itemToCancel._id);
    itemInOrder.status = 'Cancelled';
    itemInOrder.cancelReason = reason;

    const activeItems = order.orderedItems.filter(item => item.status !== 'Cancelled');
    const originalTotal = order.orderedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const discountAmount = originalTotal - order.finalAmount;

    const itemTotal = itemToCancel.price * itemToCancel.quantity;
    const itemDiscountShare = (itemTotal / originalTotal) * discountAmount;
    const refundAmount = itemTotal - itemDiscountShare;

    order.totalPrice = activeItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    order.finalAmount = order.totalPrice - (
      (order.totalPrice / originalTotal) * discountAmount
    );

    const allCancelled = order.orderedItems.every(item => item.status === 'Cancelled');
    if (allCancelled) order.status = 'Cancelled';

    await order.save();

    if (order.paymentMethod === 'RAZORPAY') {
      const transaction = {
        type: 'credit',
        amount: Math.round(refundAmount),
        description: `Refund for cancellation in Order ${orderId}`,
        date: new Date(),
        reason: 'Order Cancel'
      };

      const wallet = await Wallet.findOne({ userId: order.userId });
      if (!wallet) return res.status(StatusCode.NOT_FOUND).json({ message: 'Wallet not found for user' });

      wallet.balance += transaction.amount;
      wallet.transactions.push(transaction);
      await wallet.save();
    }

    res.json({ success: true, message: 'Product cancelled successfully' });

  } catch (error) {
    console.error('Cancel error:', error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
  }
};


const cancelOrders = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    console.log('req:',req.body)
    const order = await Order.findById(orderId);
    if (!order) return res.status(StatusCode.NOT_FOUND).json({ message: 'Order not found' });

    if (order.status === 'Cancelled') {
      return res.status(StatusCode.BAD_REQUEST).json({ message: 'Order is already cancelled' });
    }
    if (reason !== 'Select a reason') { 
      return res.status(StatusCode.BAD_REQUEST).json({ message: 'Select a Reason' });
    }

    // Update variant quantities
    for (let item of order.orderedItems) {
      const product = await Product.findById(item.product);
      if (product) {
        const variant = product.variant.find(v => v.size === item.size);
        if (variant) {
          variant.quantity += item.quantity;
          await product.save();
        }
      }
    }

    order.orderedItems.forEach(item => {
      item.status = 'Cancelled';
      item.cancelReason = reason;
    });

    order.status = 'Cancelled';
    await order.save();

    if (order.paymentMethod === 'RAZORPAY') {
      const refundAmount = order.finalAmount;
      const transaction = {
        amount: refundAmount,
        type: 'credit',
        date: new Date(),
        description: `Refund for Order ${orderId}`,
        reason: "Order Cancel"
      }

      const wallet = await Wallet.findOne({ userId: order.userId });
      if (!wallet) {
        return res.status(StatusCode.BAD_REQUEST).json({ message: 'Wallet not found for user' });
      }

      wallet.balance += refundAmount;
      wallet.transactions.push(transaction);
      await wallet.save();
    }

    return res.status(StatusCode.OK).json({ success: true, message: 'Order cancelled successfully' });

  } catch (error) {
    console.error("Cancel order error:", error);
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error" });
  }
};



const returnOrder = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    const userId = req.session.user;

    const order = await Order.findById(orderId).populate('orderedItems.product');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.userId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    order.status = 'Returned';
    order.returnReason = reason;

    let totalRefund = 0;
    for (const item of order.orderedItems) {
      item.status = 'Returned';

      const product = await Product.findById(item.product);
      const variant = product.variant.find(v => v.size === item.size);
      if (variant) {
        variant.quantity += item.quantity;
        await product.save();
      }

      totalRefund += item.price * item.quantity;
    }

    const wallet = await Wallet.findOne({userId:userId});
    const transaction = {
      amount : order.finalAmount,
      type :'credit',
      description : `Refound amount of order ${order.orderId}`,
      reason : 'Return'
    }
    if (!wallet) {
      const newWallet = new Wallet({
        userId : userId,
        balance : order.finalAmount,
        transactions : [transaction]
      })
      await newWallet.save()
    }else{
      wallet.balance += order.finalAmount
      wallet.transactions.push(transaction)
      wallet.save()
    }
    await order.save();

    res.status(200).json({ success: true, message: 'Return processed and amount credited to wallet.' });

  } catch (error) {
    console.error('Return request error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRETKEY
});

const razorpay = async (req, res) => {
  try {
    const { amount } = req.body;
    console.log('req.body:', req.body)
    const options = {
      amount,
      currency: "INR",
      receipt: "receipt_order_" + Date.now(),
    };

    const order = await razorpayInstance.orders.create(options);
    console.log('order:', order)
    res.status(StatusCode.OK).json({ success: true, order });
  } catch (error) {
    console.error('Razorpay order creation failed:', error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ error: 'Failed to create order' });
  }
}

const loadFailure = async (req, res) => {
  try {
    const { orderId, error } = req.query
    res.render('razorpayfailer', { orderId: orderId || '', error: error || '' })
  } catch (error) {
    console.error("Error occur while loadFailure:", error)
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).redirect('/pageNotFound')
  }
}

module.exports = {
  placeOrder,
  loadOrderSuccess,
  loadOrders,
  viewOrderDetails,
  cancelSingleProduct,
  cancelOrders,
  returnOrder,
  razorpay,
  loadFailure
}