const User = require("../../models/userSchema")
const Wishlist = require("../../models/wishlistSchema")
const Product = require("../../models/productSchema")
const Category = require("../../models/cartSchema")
const Cart = require("../../models/cartSchema")
const Address = require("../../models/addressSchema")
const Coupon = require("../../models/couponSchema")
const env = require("dotenv").config()
const mongoose = require('mongoose')
const StatusCode = require("../../statusCode")
const logger = require('../../helpers/logger')

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
            
            logger.debug(`items:,${items}`)
            const subTotal = items.reduce((acc, curr) => {
                return acc + (curr.totalPrice || 0);
            }, 0);

            logger.debug('subTotal:', subTotal)

            res.render("cart", {
                cart: items,
                user,
                totalPages,
                currentPage: page,
                search,
                subTotal,
                activePage: 'cart'
            })
        }
    } catch (error) {
        logger.error(error)
        res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound")
    }
}

const procedToCheckOut = async (req, res) => {
    try {
        const userId = req.session.user;
        const cartItems = req.body.cartItems;
        logger.debug('cartItems', cartItems)
        cartItems.map((item) => {
            if (item.quantity === 0) {
                return res.json({ success: false, message: 'The product Out of stock' })
            }
        })
        for (let item of cartItems) {
            const product = await Product.findById(item.productId).populate('category')
            logger.debug(`product.category:${product.category.status}`)

            if(item.isBlocked||product.category.status=='Unlisted') return res.json({success:false,message:`${product.productName} is Blocked By Admin`})
                
            for (let variants of product.variant) {
                if (variants.size === item.size) {
                    if (variants.quantity < item.quantity) {
                        return res.status(StatusCode.OK).json({ success: false, message: `In ${product.productName} ,Only ${variants.quantity} item available for this size.` })
                    } else if (item.quantity === 0) {
                        return res.status(StatusCode.OK).json({ success: false, message: `In ${product.productName} ,Only ${variants.quantity} item available for this size.` })

                    }
                }
            }
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
        return res.status(StatusCode.OK).json({ success: true });

    } catch (error) {
        logger.error(`Error updating cart quantities: ${error}`);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Internal Server Error' });
    }
};

const changeCartQuantity = async (req, res) => {
    try {
        const { productId, size, Action } = req.body
        const userId = req.session.user
        const cart = await Cart.findOne({ userId })
        const product = await Product.findById(productId)
        let maxLimit;
        product.variant.forEach(v => {
            if (v.size === size) {

                maxLimit = v.quantity < 5 ? v.quantity : 5
            }
        })
        if (maxLimit === 0) {
            cart.items.forEach(item => {
                if (item.productId.toString() === productId && item.size === size) {
                    item.quantity = 0
                }
            })
            await cart.save()
            return res.status(StatusCode.OK).json({ success: true, data: cart })
        }

        logger.debug(`product:,${product}`)

        logger.debug(`maxLimit:,${maxLimit}`)
        cart.items.forEach(item => {
            if (item.productId.toString() === productId && item.size === size) {
                if (Action === 'increment' && item.quantity < maxLimit) {
                    item.quantity++
                    item.totalPrice = (item.quantity * item.price)
                } else if (Action === 'decrement' && item.quantity > 1) {
                    item.quantity--
                    item.totalPrice = (item.quantity * item.price)
                } else {
                    if (Action === 'increment' && item.quantity == maxLimit) {
                       return res.status(StatusCode.OK).json({ success: true, data: cart,message:maxLimit!==5? `Only ${maxLimit} Stock Is Available `:`Limit Exeeded` })
                    }
                }
            }
        })
        logger.debug(`cart:${cart}`)
        await cart.save()
        res.status(StatusCode.OK).json({ success: true, data: cart })


    } catch (error) {
        logger.error(`error in Cart quantity changing:${error}`)
    }
}

const addToCart = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            res.json({ success: false, redirect: "/login" });
        }
        const { productId, quantity, size } = req.body;
        const CarQquantity = parseInt(quantity);
        const productData = await Product.findById(productId);
        const variant = productData.variant.find(v => v.size === size);
        const stock = variant.stock;

        if (!variant) {
            return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "Invalid product variant" });
        }

        const maxAllowed = stock <= 5 ? stock : 5;

        if (CarQquantity > maxAllowed) {
            return res.status(StatusCode.BAD_REQUEST).json({
                success: false,
                message: stock < 5
                    ? `Only ${stock} item(s) available in stock.`
                    : `Only 5 quantity of this product is allowed per order.`
            });
        }

        const cart = await Cart.findOne({ userId });

        const user = await User.findById(userId);
        const wishlistIndex = user.wishlist.indexOf(productId);
        if (wishlistIndex !== -1) {
            user.wishlist.splice(wishlistIndex, 1);
            await user.save();
        }

        const originalPrice = variant.salePrice;
        const populatedProduct = await Product.findById(productId).populate('category');

        const productOffer = productData.offer || 0;
        const categoryOffer = populatedProduct.category?.offer || 0;
        const bestOffer = Math.max(productOffer, categoryOffer);

        const discountedPrice = Math.round(originalPrice * (1 - bestOffer / 100));
        const totalPrice = discountedPrice * CarQquantity;


        const newCartItem = {
            productId,
            quantity: CarQquantity,
            size,
            price: originalPrice,
            totalPrice: totalPrice
        };

        let cartLength

        if (cart) {
            const existingItem = cart.items.find(item =>
                item.productId.toString() === productId && item.size === size
            );

            if (existingItem) {
                const totalQuantity = existingItem.quantity + CarQquantity;

                if (totalQuantity > maxAllowed) {
                    return res.status(StatusCode.BAD_REQUEST).json({
                        success: false,
                        message: stock < 5
                            ? `Only ${stock} item(s) available in stock.`
                            : `Only 5 quantity of this product is allowed per order.`
                    });
                }

                existingItem.quantity = totalQuantity;
                existingItem.totalPrice = totalQuantity * existingItem.price;
                await cart.save();
                cartLength = cart.items.length
                return res.status(StatusCode.OK).json({ success: true, message: "Product quantity updated in cart", cartLength });
            }

            cart.items.push(newCartItem);
            await cart.save();
            cartLength = cart.items.length
            logger.debug('cartLength:', cartLength)

            return res.status(StatusCode.OK).json({ success: true, message: "Product added to cart", cartLength });
        }

        const newCart = await Cart.create({
            userId,
            items: [newCartItem]
        });
        logger.debug('newCart:', newCart)
        cartLength = newCart.items.length
        return res.status(StatusCode.OK).json({ success: true, message: "Product added to cart", cartLength });

    } catch (error) {
        logger.error("Add to cart error:", error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "Server error" });
    }
};

const removeProductCart = async (req, res) => {
    try {
        const productId = req.body.productId
        const userId = req.session.user
        const cart = await Cart.findOne({ userId: userId })
        const index = cart.items.findIndex(item => item.productId.toString() === productId);
        logger.debug('index:', index);
        await cart.items.splice(index, 1)
        await cart.save()
        return res.status(StatusCode.OK).json({ success: true, cartCount: cart.items.length });

    } catch (error) {
        logger.error(error)
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "Server Error" })
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
        let razorpayKey = process.env.RAZORPAY_KEY_ID
        if (cart && cart.items.length > 0) {
            cartItems = cart.items.map(item => {
                const totalPrice = item.totalPrice;
                subtotal += totalPrice;
                return {
                    product: {
                        name: item.productId.productName,
                        imageUrl: item.productId.productImage[0],
                    },
                    quantity: item.quantity,
                    totalPrice: totalPrice,
                    size: item.size
                };
            });
        }
        if (address) {
            const addresses = address.address
            logger.debug('addresses:', addresses)
            logger.debug('cartItems:', cartItems)
            const delivery = 0
            const discount = 0
            const finalTotal = subtotal + delivery - discount;

            const coupons = await Coupon.find({
                islist: true,
                expiredOn: { $gte: new Date() },
                minimumPrice: { $lte: finalTotal },
                $or: [
                    { restricted: false },
                    { restricted: true, userId: userId },
            //         {restricted:true , refferedUserId: userId}
                ],
                usedBy: { $ne: userId },
            });

            res.render('checkout', {
                user,
                coupons,
                addresses,
                cartItems,
                subtotal,
                delivery,
                discount,
                finalTotal,
                razorpayKey,
                activePage: 'checkout'
            });
        } else {
            const delivery = subtotal > 1000 ? 0 : 50
            const discount = 0
            const finalTotal = subtotal + delivery - discount;
            const coupons = await Coupon.find({
                islist: true,
                expiredOn: { $gte: new Date() },
                minimumPrice: { $lte: finalTotal },
                $or: [
                    { restricted: false },
                    { restricted: true, userId: userId }
                ],
                usedBy: { $ne: userId }
            });

            res.render('checkout', {
                user,
                coupons,
                addresses: [],
                cartItems,
                subtotal,
                delivery,
                discount,
                finalTotal,
                razorpayKey,
                activePage: 'checkout'
            });
        }

    } catch (error) {
        logger.error(error);
        res.status(StatusCode.NOT_FOUND).redirect('/pageNotFound');
    }
}

module.exports = {
    loadcart,
    procedToCheckOut,
    changeCartQuantity,
    addToCart,
    removeProductCart,
    loadCheckOut
}