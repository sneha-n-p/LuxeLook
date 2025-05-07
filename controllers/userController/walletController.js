const User = require("../../models/userSchema")
const Cart = require("../../models/cartSchema")
const Product = require("../../models/productSchema")
const Order = require("../../models/orderSchema")
const Address = require("../../models/addressSchema")
const mongoose = require('mongoose')
const Wallet = require('../../models/walletSchema')

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

module.exports = {
    loadWallet
}