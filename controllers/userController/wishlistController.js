const User = require("../../models/userSchema")
const Product = require("../../models/productSchema")
const Wishlist = require("../../models/wishlistSchema")
const Category = require("../../models/categorySchema")
const { connect } = require("mongoose")
const env = require("dotenv").config()




const loadwishlist = async (req, res) => {
    try {
        let search = ""
        if (req.query.search) {
            search = req.query.search
        }
        let page = 1
        if (req.query.page) {
            page = req.query.page
        }
        const limit = 5
        const productData = await Product.find({
            isBlocked: false,
            $or: [
                { productName: { $regex: ".*" + search + ".*", $options: "i" } }
            ],
        })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec()

        const count = await Product.find({
            isBlocked: false,
            $or: [
                { productName: { $regex: ".*" + search + ".*", $options: "i" } }
            ],
        }).countDocuments()
        const totalPages = Math.ceil(count / limit);
        if (req.session.user) {
            const id = req.session.user
            const user = await User.findById(id)
            const products = await Product.find({ _id: { $in: user.wishlist } }).populate('category')
            const categories = await Category.find({ isBlocked: false })
            res.render("wishlist", { wishlist: products, user, totalPages, categories, currentPage: page, search, productData, activePage: 'wishlist'  })
        } else {
            res.redirect("/login", { products, productData, user: null, totalPages, currentPage: page, search, categories })
            console.log(products)
        }
    } catch (error) {
        console.error(error)
        res.redirect("/pageNotFound")
    }
}

const addToWishlist = async (req, res) => {
    try {
        const productId = req.body.productId
        const userId = req.session.user

        const user = await User.findById(userId)
        if (user.wishlist.includes(productId)) {
            return res.status(200).json({ success: false, message: "Product Already In Wishlist" })
        }
        user.wishlist.push(productId)
        await user.save()
        return res.status(200).json({ success: true, message: "Product Added To Wishlist" })

    } catch (error) {
        console.error(error)
        return res.status(500).json({ success: false, message: "Server Error" })
    }
}
const removeProduct = async (req, res) => {
    try {
        const productId = req.body.productId
        const userId = req.session.user
        const user = await User.findById(userId)
        const index = user.wishlist.indexOf(productId)
        user.wishlist.splice(index,1)
        await user.save()
        return res.status(200).json({ success: true, wishlistCount: user.wishlist.length });

    } catch (error) {
        console.error(error)
        return res.status(500).json({success:false,message:"Server Error"})
    }
}



module.exports = {
    loadwishlist,
    addToWishlist,
    removeProduct

}