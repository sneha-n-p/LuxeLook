const User = require("../../models/userSchema")
const Wishlist = require("../../models/wishlistSchema")
const Product = require("../../models/productSchema")
const Category = require("../../models/cartSchema")
const Cart = require("../../models/cartSchema")
const env = require("dotenv")

const loadcart = async(req,res)=>{
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
            const products = await Product.find({ _id: { $in: user.cart } }).populate('category')
            const categories = await Category.find({ isBlocked: false })
            const availableQuantity = await Product.find({quantity:products.quatity})
            res.render("cart", {cart: products, user, totalPages, categories, currentPage: page, search, productData,availableQuantity })
        } else {
            res.redirect("/login", { products, productData, user: null, totalPages, currentPage: page, search, categories,availableQuandity })
            console.log(products)
        }
    } catch (error) {
        console.error(error)
        res.redirect("/pageNotFound")
    }
}

const addToCart = async(req,res)=>{
    try {
        const productId = req.body.productId
        const userId = req.session.user

        const user = await User.findById(userId)
        if (user.cart.includes(productId)) {
            return res.status(200).json({ success: false, message: "Product Already In Cart" })
        }
        user.cart.push(productId)
        await user.save()
        return res.status(200).json({ success: true, message: "Product Added To Cart" })

    } catch (error) {
        console.error(error)
        return res.status(500).json({ success: false, message: "Server Error" })
    }
}




module.exports = {
    loadcart,
    addToCart
}