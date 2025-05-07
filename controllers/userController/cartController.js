const User = require("../../models/userSchema")
const Wishlist = require("../../models/wishlistSchema")
const Product = require("../../models/productSchema")
const Category = require("../../models/cartSchema")
const Cart = require("../../models/cartSchema")
const Address = require("../../models/addressSchema")
const env = require("dotenv")

const loadcart = async (req, res) => {
    try {
        let search = req.query.search || ""
        let page = parseInt(req.query.page) || 1
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
            const cart = await Cart.findOne({ userId: id }).populate("items.productId")

            const items = cart ? cart.items : []
            console.log('items:', items)
            const subTotal = items.reduce((acc, curr) => {
                return acc + (curr.totalPrice || 0);
            }, 0);

            res.render("cart", {
                cart: items,
                user,
                totalPages,
                currentPage: page,
                search,
                subTotal
            })
        }
    } catch (error) {
        console.error(error)
        res.redirect("/pageNotFound")
    }
}

const procedToCheckOut = async (req, res) => {
    try {
        const userId = req.session.user;
        const cartItems = req.body.cartItems;
        console.log('cartItems:',cartItems)

        for (let item of cartItems) {
            const totalPrice = item.price * item.quantity;
            const updateResult = await Cart.updateOne(
                { userId: userId, "items.productId": item.productId },
                {
                    $set: {
                        "items.$.quantity": item.quantity,
                        "items.$.totalPrice": totalPrice
                    }
                }
            );
        }
            return res.json({ success: true });

    } catch (error) {
        console.error("Error updating cart quantities:", error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};






const addToCart = async (req, res) => {
    try {
        const productId = req.body.productId
        const productData = await Product.findById(productId)
        const userId = req.session.user
        const cart = await Cart.findOne({ userId })
        const newCart = {
            productId: productId,
            quantity: 1,
            price: productData.salePrice,
            totalPrice: productData.salePrice * 1
        }
        const user = await User.findById(userId)
        const wishlistIndex = user.wishlist.indexOf(productId);
        if (wishlistIndex !== -1) {
            user.wishlist.splice(wishlistIndex, 1);
            await user.save();
        }
        if (cart) {

            const existingItem = cart.items.find(item =>
                item.productId.toString() === productId
            )
            if (existingItem) {
                existingItem.quantity += 1
                existingItem.totalPrice = existingItem.quantity * existingItem.price
                await cart.save()
                return res.status(200).json({ success: true, message: "Product Added Succesfully" })
            }
            cart.items.push(newCart)
            await cart.save()
            return res.status(200).json({ success: true, message: "Product Added Succesfully" })
        }
        const saveCartData = new Cart({
            userId: userId,
            items: [newCart]
        })
        await saveCartData.save()
        return res.status(200).json({ success: true, message: "Product Added To Cart" })

    } catch (error) {
        console.error(error)
        return res.status(500).json({ success: false, message: "Server Error" })
    }
}

const removeProductCart = async (req, res) => {
    try {
        const productId = req.body.productId
        const userId = req.session.user
        const cart = await Cart.findOne({ userId: userId })
        const index = cart.items.findIndex(item => item.productId.toString() === productId);
        console.log('index:', index);
        await cart.items.splice(index, 1)
        await cart.save()
        return res.status(200).json({ success: true, cartCount: cart.items.length });

    } catch (error) {
        console.error(error)
        return res.status(500).json({ success: false, message: "Server Error" })
    }
}

const loadCheckOut = async (req, res) => {
    try {
        const userId = req.session.user
        const user = await User.findById(userId)
        const address = await Address.findOne({ userId: userId })
        const cart = await Cart.findOne({ userId: userId }).populate("items.productId")
        let cartItems = [];
        let subtotal = 0;

        if (cart && cart.items.length > 0) {
            cartItems = cart.items.map(item => {
                const totalPrice = item.productId.salePrice * item.quantity;
                subtotal += totalPrice;
                return {
                    product: {
                        name: item.productId.productName,
                        imageUrl: item.productId.productImage[0],
                    },
                    quantity: item.quantity,
                    totalPrice: totalPrice
                };
            });
        }
        if(address){
            const addresses = address.address
            console.log('cartItems:', cartItems)
            const delivery = subtotal > 1000 ? 0 : 50
            const discount = 0
            const finalTotal = subtotal  + delivery - discount;
    
            res.render('checkout', {
                user,
                addresses,
                cartItems,
                subtotal,
                delivery,
                discount,
                finalTotal
            });
        }else{
            const delivery = subtotal > 1000 ? 0 : 50
            const discount = 0
            const finalTotal = subtotal  + delivery - discount;
    
            res.render('checkout', {
                user,
                addresses:null,
                cartItems,
                subtotal,
                delivery,
                discount,
                finalTotal
            });
        }

    } catch (error) {
        console.error(error);
        res.redirect('/pageNotFound');
    }
}




module.exports = {
    loadcart,
    procedToCheckOut,
    addToCart,
    removeProductCart,
    loadCheckOut
}