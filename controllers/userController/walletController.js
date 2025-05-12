const User = require("../../models/userSchema")
const Wallet = require('../../models/walletSchema')
const Razorpay = require('razorpay');
const crypto = require('crypto');
require("dotenv").config()

const loadWallet = async (req, res) => {
  try {
    const userId = req.session.user

    const user = await User.findById(userId)
    const wallet = await Wallet.findOne({ userId })
    if (wallet) {
      const transactions = wallet.transactions
      console.log(Wallet)
      res.render('wallet', { user, wallet, transactions })
    } else {
      res.render('wallet', { user, wallet: null, transactions: null })
    }
  } catch (error) {
    console.error(error)
    res.redirect("/pageNotFound")
  }
}

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRETKEY
});

const addAmountToWallet = async (req, res) => {
  try {
    const { userId, amount } = req.body

    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid input data' })
    }

    let wallet = await Wallet.findOne({ userId: userId })

    if (!wallet) {
      wallet = new Wallet({
        userId,
        balance: amount,
        transactions: [{ type: 'credit', amount, description: 'Wallet top-up' }]
      })
    } else {
      wallet.balance += amount
      wallet.transactions.push({ type: 'credit', amount, description: 'Wallet top-up' })
    }
    await wallet.save()

    await Transaction.create({
      userId: userId,
      amount: amount,
      transactionType: "credit",
      paymentMethod: "online",
      paymentGateway: "razorpay",
      status: "completed",
      purpose: "wallet_add",
      description: `Fund added to the Wallet`,
      walletBalanceAfter: wallet.balance
    });

    res.status(HttpStatus.OK).json({ message: 'Money added successfully', wallet })
  } catch (error) {
    console.error('error occur while loadWallet', error)
    return res.redirect('/pageNotFound')
  }
}

const createRazorpayOrder = async (req, res) => {
  try {
    const orderAmount = parseFloat(req.body.amount)
    if (!orderAmount || isNaN(orderAmount) || orderAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid or missing amount' })
    }

    console.log('orderAmount:', orderAmount)
    const order = await razorpayInstance.orders.create({
      amount: Math.round(orderAmount * 100),
      currency: 'INR',
      payment_capture: 1,
    })
    console.log('order:', order)

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    })
  } catch (error) {
    console.error('Error creating Razorpay order:', error)
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message })
  }
}

const razorpayPaymentSuccess = async (req, res) => {
  try {
    console.log('hii')
    const userId = req.session.user
    const { amount, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_SECRETKEY)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex')

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' })
    }

    let wallet = await Wallet.findOne({ userId })
    const amountToAdd = parseFloat(amount)

    if (!wallet) {
      wallet = new Wallet({
        userId,
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
        description: 'Wallet top-up',
        date: new Date(),
        reason: 'Razorpay'
      })
    }

    await wallet.save()
    console.log('done')

    return res.json({ success: true, newBalance: wallet.balance })
  } catch (error) {
    console.error('Error in payment success:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

module.exports = {
  loadWallet,
  addAmountToWallet,
  createRazorpayOrder,
  razorpayPaymentSuccess
}