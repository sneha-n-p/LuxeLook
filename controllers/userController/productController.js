const User = require("../../models/userSchema")
const env = require("dotenv").config()
const Product = require("../../models/productSchema")
const category = require("../../models/categorySchema")
const Category = require("../../models/categorySchema")
const StatusCode = require("../../statusCode")



const loadShop = async (req, res) => {
    try {
        let search = ""
        if (req.query.search) {
            search = req.query.search
        }
        let page = 1
        if (req.query.page) {
            page = req.query.page
        }
        const limit = 8
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
            const products = await Product.find({ isBlocked: false })
            const categories = await Category.find({ isBlocked: false })
            res.render("shop", { products: productData, user, totalPages, categories, currentPage: page, search, activePage: 'shop' })
        } else {
            const products = await Product.find({ isBlocked: false })
            const categories = await Category.find({ isBlocked: false })

            res.render("shop", { products, productData, user: null, totalPages, currentPage: page, search, categories })
            console.log(products)
        }
    } catch (error) {
        console.error(error)
        res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound")
    }
}

const loadProductDetails = async (req, res) => {
    try {
        if (req.session.user) {
            const id = req.session.user
            const user = await User.findById(id)
            const product = await Product.findById(req.params.id)
            const recommendedProducts = await Product.find({ _id: { $ne: product._id } }).limit(4);
            const sizeMap = {};
            product.variant.forEach(variant => {
                sizeMap[variant.size] = variant.quantity;
            });
            res.render('productDetails', { product, recommendedProducts, user, activePage: 'productDetails', sizeMap });
        } else {
            const product = await Product.findById(req.params.id);
            const recommendedProducts = await Product.find({ _id: { $ne: product._id } }).limit(4);
            res.render('productDetails', { product, recommendedProducts, user: null });
        }
    } catch (error) {
        console.error(error)
        res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound")
    }
}




module.exports = {
    loadShop,
    loadProductDetails,

}
