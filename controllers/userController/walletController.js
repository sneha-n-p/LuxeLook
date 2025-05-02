const User = require("../../models/userSchema")
const Cart = require("../../models/cartSchema")
const Product = require("../../models/productSchema")
const Order = require("../../models/orderSchema")
const Address = require("../../models/addressSchema")
const mongoose = require('mongoose')

const loadWallet = async(req,res)=>{
    try {
        console.log(req.body)
        res.render('wallet',{user:null,wallet:null})
    } catch (error) {
        console.error(error)
        res.redirect("/pageNotFound")
    }
}

module.exports = {
    loadWallet
}