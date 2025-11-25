const User = require("../../models/userSchema")
const Product = require("../../models/productSchema")
const Wishlist = require("../../models/wishlistSchema")
const Category = require("../../models/categorySchema")
const { connect } = require("mongoose")
const env = require("dotenv").config()
const StatusCode = require('../../statusCode')
const logger = require('../../helpers/logger')




const loadwishlist = async (req, res) => {
    try {
        let search = req.query.search || "";
        let sort = req.query.sort || "";
        let page = parseInt(req.query.page) || 1;
        
        const limit = 6
        const productData = await Product.find({
            isBlocked: false,
            $or: [
                { productName: { $regex: ".*" + search + ".*", $options: "i" } }
            ],
        })
        .limit(limit)
        .skip((page - 1) * limit)
        .exec()
        
        const user = await User.findById(req.session.user)
        let count = user.wishlist.length
        const totalPages = Math.ceil(count / limit);
        logger.info(totalPages)
        if (req.session.user) {
            const id = req.session.user
            const user = await User.findById(id)
            const products = await Product.find({ _id: { $in: user.wishlist } }).populate('category')
            const categories = await Category.find({ isBlocked: false })
            res.render("wishlist", { wishlist: products, user, totalPages, categories, currentPage: page, search, productData, activePage: 'wishlist' })
        } else {
            res.redirect("/login", { products, productData, user: null, totalPages, currentPage: page, search, categories })
            logger.debug(`${products}`)
        }
    } catch (error) {
        logger.error(error)
        res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound")
    }
}

const addToWishlist = async (req, res) => {
    try {
        const productId = req.body.productId
        const userId = req.session.user
        if (!userId) {
            res.json({ success: false, redirect: "/login" });
        }

        const user = await User.findById(userId)
        if (user.wishlist.includes(productId)) {
            return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "Product Already In Wishlist" })
        }
        const products = await Product.find({ _id: { $in: user.wishlist } }).populate('category')
        const whishListCount = products.length + 1
        user.wishlist.push(productId)
        await user.save()
        return res.status(StatusCode.OK).json({ success: true, message: "Product Added To Wishlist", TotalWhishlistCount: whishListCount })

    } catch (error) {
        logger.error(error)
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "Server Error" })
    }
}
const removeProduct = async (req, res) => {
    try {
        const productId = req.body.productId
        const userId = req.session.user
        const user = await User.findById(userId)
        const index = user.wishlist.indexOf(productId)
        user.wishlist.splice(index, 1)
        await user.save()
        return res.status(StatusCode.OK).json({ success: true, wishlistCount: user.wishlist.length });

    } catch (error) {
        logger.error(error)
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "Server Error" })
    }
}

module.exports = {
    loadwishlist,
    addToWishlist,
    removeProduct
}