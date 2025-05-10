const User = require("../../models/userSchema")
const Wallet = require('../../models/walletSchema')
const Razorpay = require('razorpay');
const crypto = require('crypto');



const loadWallet = async(req,res)=>{
    try {
        const userId = req.session.user

        const user = await User.findById(userId)
        const wallet = await Wallet.findOne({userId})
        if(wallet){
            const transactions = wallet.transactions
        console.log(Wallet)
        res.render('wallet',{user,wallet,transactions})
        }else{
        res.render('wallet',{user,wallet:null,transactions:null})
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
        const {
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
          amount,
        } = req.body;
    
        const userId = req.session.user;
    
        const expectedSignature = crypto
          .createHmac('sha256', process.env.RAZORPAY_SECRETKEY)
          .update(razorpay_order_id + "|" + razorpay_payment_id)
          .digest('hex');
    
        if (expectedSignature === razorpay_signature) {
          const wallet = await Wallet.findOne({ userId });
    
          if (wallet) {
            wallet.balance += Number(amount) / 100;
            wallet.transactions.push({
              type: 'credit',
              amount: Number(amount) / 100,
              description: 'Razorpay Wallet Top-Up',
              date: new Date(),
              reason: 'Wallet Recharge'
            });
            await wallet.save();
          } else {
            await Wallet.create({
              userId,
              balance: Number(amount) / 100,
              transactions: [{
                type: 'credit',
                amount: Number(amount) / 100,
                description: 'Razorpay Wallet Top-Up',
                date: new Date(),
                reason: 'Wallet Recharge'
              }]
            });
          }
    
          res.json({ success: true });
        } else {
          res.status(400).json({ success: false, message: 'Invalid signature' });
        }
      } catch (error) {
        console.error('Error in verifying Razorpay payment:', error);
        res.status(500).json({ success: false, error: 'Verification failed' });
      }
    }

module.exports = {
    loadWallet,
    addAmountToWallet
}