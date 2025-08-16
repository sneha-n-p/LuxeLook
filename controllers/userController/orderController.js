const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");
const Address = require("../../models/addressSchema");
const Wallet = require("../../models/walletSchema");
const Coupon = require('../../models/couponSchema');
const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const StatusCode = require("../../statusCode");
const path = require('path');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const fs = require('fs');

const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressId, paymentMethod, coupon, couponId } = req.body;

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
      product.quatity-= item.quantity
    }


    const totalPrice = orderedItems.reduce((acc, item) => acc + item.quantity * item.price, 0);

    let discount = 0;
    let appliedCoupon = null;
    let couponName = null;

    if (coupon && couponId) {
      appliedCoupon = await Coupon.findOne({
        name: coupon,
      });

      if (appliedCoupon) {
        discount = appliedCoupon.offerPrice || 0;
        couponName = appliedCoupon.name;

        await Coupon.findByIdAndUpdate(couponId, {
          $push: { usedBy: userId }
        });
      } else {
        return res.status(StatusCode.BAD_REQUEST).json({
          success: false,
          message: 'Invalid, expired, restricted, or already used coupon.'
        });
      }
    }

    const finalAmount = Math.max(Number(totalPrice) - discount, 0);

    async function generateOrderId() {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");

      const startOfDay = new Date(year, now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfDay = new Date(year, now.getMonth(), now.getDate(), 23, 59, 59);

      const todayCount = await Order.countDocuments({
        createdOn: { $gte: startOfDay, $lte: endOfDay }
      });

      const orderNumber = String(todayCount + 1).padStart(2, "0");

      return `ORD-${year}-${month}-${day}-${orderNumber}`;
    }

    const newOrder = new Order({
      orderId: await generateOrderId(),
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
      status: paymentMethod === 'COD' ? 'Pending' : 'Confirmed',
      couponApplied: couponName,
      paymentMethod,
    });

    await newOrder.save();

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
    const userId = req.session.user;
    const user = await User.findById(userId);
    const cartData = await Cart.findOne({ userId: userId });
    const address = await Address.findOne({ userId: userId });
    const order = await Order.find({ userId: userId })
      .sort({ createdOn: -1 })
      .limit(1)
      .populate("orderedItems.product");
    res.render('orderSuccess', { user, orders: order[0] });
  } catch (error) {
    console.error(error);
    res.status(StatusCode.NOT_FOUND).redirect('/pageNotFound');
  }
};

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
      currentPath: '/orders'
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
    const user = await User.findById(userId);

    if (!order) {
      return res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound");
    }

    res.render("orderDetailsView", { order, user, activePage: "orderDetailsView", currentPath: '/orders' });
  } catch (error) {
    console.log(error);
    res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound");
  }
};

const cancelSingleProduct = async (req, res) => {
  try {
    const { productId, orderId, reason ,size} = req.body;
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
    const variant = product.variant.find(v => v.size === size);
    if (!variant) {
      return res.status(StatusCode.BAD_REQUEST).json({ message: 'Variant with matching size not found' });
    }
    variant.quantity += itemToCancel.quantity
    product.quatity += itemToCancel.quantity
    await product.save();

    // const itemInOrder = order.orderedItems.id(itemToCancel._id);
    // itemInOrder.status = 'Cancelled';
    // itemInOrder.cancelReason = reason;
    const itemInOrder = order.orderedItems.find(
  (item) =>
    item.product.toString() === itemToCancel.product.toString() &&
    item.size === size
);

if (itemInOrder) {
  itemInOrder.status = "Cancelled";
  itemInOrder.cancelReason = reason;
}

    const activeItems = order.orderedItems.filter(item => item.status !== 'Cancelled');
    const originalTotal = order.orderedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const discountAmount = order.discount;

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
    console.log(req.body)
    const order = await Order.findById(orderId);
    if (!order) return res.status(StatusCode.NOT_FOUND).json({ message: 'Order not found' });

    if (order.status === 'Cancelled') {
      return res.status(StatusCode.BAD_REQUEST).json({ message: 'Order is already cancelled' });
    }

    for (let item of order.orderedItems) {
      const product = await Product.findById(item.product);
      if (product) {
        const variant = product.variant.find(v => v.size === item.size);
        if (variant) {
          variant.quantity += item.quantity
          product.quatity+=item.quantity
          await product.save();
        }
      }
    }

    order.orderedItems.forEach(item => {
      item.status = 'Cancelled';
      item.cancelReason = reason;
    });


    if (order.paymentMethod === 'RAZORPAY') {
      const refundAmount = order.finalAmount;
      const transaction = {
        amount: refundAmount,
        type: 'credit',
        date: new Date(),
        description: `Refund for Order ${orderId}`,
        reason: "Order Cancel"
      };

      const wallet = await Wallet.findOne({ userId: order.userId });
      const amountToAdd = parseFloat(order.finalAmount)


      if (!wallet) {
        wallet = new Wallet({
          userId: order.userId,
          balance: amountToAdd,
          transactions: [
            {
              type: 'credit',
              amount: amountToAdd,
              description: 'Wallet top-up',
              date: new Date(),
              reason: 'Razorpay'
            },
          ],
        })
      } else {
        wallet.balance += amountToAdd
        wallet.transactions.push({
          type: 'credit',
          amount: amountToAdd,
          description: 'Order Cancel',
          date: new Date(),
          reason: 'Razorpay'
        })
      }
      await wallet.save()
    }
    order.status = 'Cancelled';
    await order.save();

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
      return res.status(StatusCode.NOT_FOUND).json({ success: false, message: 'Order not found' });
    }

    if (order.userId.toString() !== userId.toString()) {
      return res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
    }

    if (order.status !== 'Delivered') {
      return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: 'Only delivered orders can be returned' });
    }

    order.status = 'Return Request';
    order.returnReason = reason;

    order.orderedItems.forEach(item => {
      if (item.status === 'Delivered') {
        item.status = 'Return Request';
        item.returnReason = reason;
      }
    });

    await order.save();

    res.status(StatusCode.CREATED).json({ success: true, message: 'Return request submitted successfully' });
  } catch (error) {
    console.error('Return request error:', error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Internal server error' });
  }
};

const singleProductReturn = async (req, res) => {
  try {
    const { orderId, productId, reason,size } = req.body

    const order = await Order.findById(orderId)

    order.orderedItems.forEach(item => {
      if (item.product.toString() === productId && item.size === size) {
        item.status = 'Return Request'
        item.returnReason = reason
      }
    })
    await order.save()
    res.status(StatusCode.OK).json({ success: true })

  } catch (error) {
    console.error('single product return,error is there: ', error)
  }
}

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRETKEY
});

const razorpay = async (req, res) => {
  try {
    const { amount } = req.body;
    const options = {
      amount,
      currency: "INR",
      receipt: "receipt_order_" + Date.now(),
    };

    const order = await razorpayInstance.orders.create(options);
    res.status(StatusCode.OK).json({ success: true, order });
  } catch (error) {
    console.error('Razorpay order creation failed:', error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ error: 'Failed to create order' });
  }
};

const loadFailure = async (req, res) => {
  try {
    const userId = req.session.user
    const data = JSON.parse(req.query.data);
    const { addressId, coupon, paymentMethod, Total, size } = data
    const { error } = req.query

    const addId = new mongoose.Types.ObjectId(addressId)
    const addresses = await Address.findOne({ userId })
    if (!addresses) {
      res.status(StatusCode.BAD_REQUEST)
      return
    }
    const address = addresses.address.find((item) => item._id.equals(addId))
    const cart = await Cart.findOne({ userId }).populate('items.productId');

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

      // variant.quantity -= item.quantity;
    }
    console.log('cart', cart)

    const totalPrice = orderedItems.reduce((acc, item) => acc + item.quantity * item.price, 0);

    let discount = 0;
    let appliedCoupon = null;
    let couponName = null;

    if (coupon && couponId) {
      appliedCoupon = await Coupon.findOne({
        name: coupon,
      });

      if (appliedCoupon) {
        discount = appliedCoupon.offerPrice || 0;
        couponName = appliedCoupon.name;

        await Coupon.findByIdAndUpdate(couponId, {
          $push: { usedBy: userId }
        });
      } else {
        return res.status(StatusCode.BAD_REQUEST).json({
          success: false,
          message: 'Invalid, expired, restricted, or already used coupon.'
        });
      }
    }
    const finalAmount = Math.max(Number(totalPrice) - discount, 0);

    async function generateOrderId() {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");

      const startOfDay = new Date(year, now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfDay = new Date(year, now.getMonth(), now.getDate(), 23, 59, 59);

      const todayCount = await Order.countDocuments({
        createdOn: { $gte: startOfDay, $lte: endOfDay }
      });

      const orderNumber = String(todayCount + 1).padStart(2, "0");

      return `ORD-${year}-${month}-${day}-${orderNumber}`;
    }

    const newOrder = new Order({
      orderId: await generateOrderId(),
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
      status: 'payment Failed',
      couponApplied: couponName,
      paymentMethod,
    });
    await newOrder.save()
    await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

    res.render('razorpayfailer', { order: newOrder, error: error || '' });
  } catch (error) {
    console.error("Error occur while loadFailure:", error);
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).redirect('/pageNotFound');
  }
};

const loadRetryCheckout = async (req, res) => {
  try {
    const userId = req.session.user
    const { orderId } = req.query
    const user = await User.findById(userId)
    const order = await Order.findById(orderId).populate('orderedItems.product')
    let razorpayKey = process.env.RAZORPAY_KEY_ID
    if (!order) {
      res.status(StatusCode.BAD_REQUEST).redirect('/orders')
    }

    const coupons = await Coupon.find({
      islist: true,
      expiredOn: { $gte: new Date() },
      minimumPrice: { $lte: order.finalAmount },
      $or: [
        { restricted: false },
        { restricted: true, userId: userId }
      ],
      usedBy: { $ne: userId }
    });

    console.log(order)
    return res.status(StatusCode.OK).render('retryCheckout', {
      user: user,
      order: order,
      addresses: order.address,
      finalTotal: order.finalAmount,
      cartItems: order.orderedItems,
      subtotal: order.totalPrice,
      delivery: 0,
      discount: order.discount,
      coupons,
      razorpayKey,
      activePage: 'checkout'
    })
  } catch (error) {
    console.log('error in retry:', error)
    res.status(StatusCode.INTERNAL_SERVER_ERROR).redirect('/pageNotFound')
  }
}

const loadRetryPlaceOrder = async (req, res) => {
  try {
    const { coupon, orderId, paymentMethod } = req.body
    const order = await Order.findById(orderId)

    if (coupon.trim() !== '') {
      const applycoupon = await Coupon.findOne({ name: coupon })
      order.discount = applycoupon.offerPrice
      order.couponApplied = coupon
    }

    if (paymentMethod === "COD") {
      order.status = 'Pending'
    } else {
      order.status = 'Confirmed'
    }
    order.paymentMethod = paymentMethod
    await order.save()

    res.status(StatusCode.CREATED).json({ success: true })
  } catch (error) {
    console.log("loadRetryPlaceOrder error:", error)
  }
}


const generateInvoice = async (req, res) => {
  try {
    const userId = req.session.user;
    const orderId = req.query.orderId;

    const order = await Order.findOne({ orderId: orderId, userId });
    if (!order) {
      return res.status(StatusCode.BAD_REQUEST).send("Order not found");
    }

    if (order.status !== "Delivered") {
      return res.status(StatusCode.BAD_REQUEST).send("Invoice is only available for delivered orders");
    }

    if (!order.invoiceDate) {
      order.invoiceDate = new Date();
      await order.save();
    }
    let newOrder = []
    order.orderedItems.forEach(item=>{
      if(item.status === 'Delivered' || item.status === 'Returened'){
        newOrder.push(item)
      }
    })
    order.orderedItems = newOrder

    console.log('newOrder:',newOrder)

    const templatePath = path.join(__dirname, "../../views/user/invoice_template.ejs");
    const html = await ejs.renderFile(templatePath, { order });

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: "networkidle0" });

    const invoiceDir = path.join(__dirname, "../../public/invoices");
    if (!fs.existsSync(invoiceDir)) {
      fs.mkdirSync(invoiceDir, { recursive: true });
    }

    const fileName = `invoice-${order.orderId}.pdf`;
    const filePath = path.join(invoiceDir, fileName);

    await page.pdf({
      path: filePath,
      format: "A4",
      printBackground: true,
      margin: {
        top: "20px",
        right: "20px",
        bottom: "20px",
        left: "20px",
      },
    });

    await browser.close();

    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error("Error sending file:", err);
        res.status(StatusCode.BAD_REQUEST).send("Error generating invoice");
      }
    });
  } catch (error) {
    console.error("Error generating invoice:", error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).send("Error generating invoice");
  }
};

module.exports = {
  placeOrder,
  loadOrderSuccess,
  loadOrders,
  viewOrderDetails,
  cancelSingleProduct,
  cancelOrders,
  singleProductReturn,
  returnOrder,
  razorpay,
  loadFailure,
  generateInvoice,
  loadRetryPlaceOrder,
  loadRetryCheckout
};