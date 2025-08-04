const express = require("express")
const router = express.Router()
const userController = require("../controllers/userController/userController")
const passport  = require('../dbConfig/passport')
const profileController = require("../controllers/userController/profileController")
const productController = require("../controllers/userController/productController")
const wishlistController = require("../controllers/userController/wishlistController")
const cartController = require("../controllers/userController/cartController")
const addressController  = require("../controllers/userController/addressController")
const orderController = require("../controllers/userController/orderController")
const walletController = require("../controllers/userController/walletController")
const couponController = require("../controllers/userController/couponController")
const {userAuth,userAuthCheck} = require('../middlewares/auth')
const upload = require("../helpers/multer")



router.get("/pageNotFound",userController.pageNotFound)
router.get("/",userController.loadHomePage)
router.get("/signup",userAuthCheck,userController.loadSignup)
router.post("/signup",userController.postSignup)
router.post("/verify-otp",userController.verifyOtp)
router.post("/resend-otp",userController.resendOtp)
router.post("/sample",userController.sample)

router.get("/auth/google",passport.authenticate('google',{scope:['profile','email']}))
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup' }), async (req, res) => {
    try {
        req.session.user = req.user._id;
        res.redirect('/');
    } catch (error) {
        console.log("Google login error:", error);
        res.redirect('/signup');
    }
});

router.get('/login',userAuthCheck,userController.loadLogin)
router.post('/login',userController.postLogin)

router.get("/forgot-password",userAuthCheck,profileController.loadForgotPassword)
router.post("/forgot-password",profileController.forgotEmailValid)
router.post("/verifying-forgetpass-otp",profileController.verifyOtp)
router.post("/send-otp",profileController.resendOtp)

router.get("/reset-password",userAuthCheck,profileController.loadResetPassword)
router.post("/reset-password",profileController.confirmPassword)

router.get("/shop",productController.loadShop)
router.get("/product-details/:id",productController.loadProductDetails)

router.get ("/profile",userAuth,profileController.loadProfile)
router.get ("/profile/edit",userAuth,profileController.loadEditProfile)
router.post ("/profile/edit",upload.single('profileImage'),profileController.updateProfile)

router.get("/profile/change-email",userAuth,profileController.loadChangeEmail)
router.post("/profile/change-email",userAuth,profileController.changeEmailValidation)
// router.get("/change-email-otp",userAuth,profileController.loadEmailVerifyOtp)
router.post("/verifying-changeEmail-otp",profileController.EmailVerifyOtp)
router.get("/reset-email",userAuth,profileController.loadResetEmail)
router.post("/reset-email",profileController.resetEmail)

router.get("/profile/change-password",userAuth,profileController.changePassword)
router.post("/profile/change-password",userAuth,profileController.changePasswordValid)
router.get("/verifying-changePassword-otp",userAuth,profileController.loadPasswordVerifyingOtp)
router.post("/changePassword-otp",profileController.PasswordVerifyingOtp)
router.get("/profile/reset-password",userAuth,profileController.loadresetPassword)
router.post("/profile/reset-password",userAuth,profileController.resetPassword) 
router.post('/upload-profile-pic/:id', upload.single('profileImage'),profileController.addProfile)


router.get("/addresses",userAuth,addressController.loadAddress)
router.get('/add-address',userAuth,addressController.loadAddAddress)
router.post('/add-address',userAuth,addressController.AddAddress)
router.get('/edit-address/:id',userAuth,addressController.loadEditAddress)
router.post('/edit-address',addressController.editAddress)
router.post("/delete-address",addressController.deleteAddress)
router.get("/cart-add-address",userAuth,addressController.loadcartAddAddress)
router.post("/cart-add-address",userAuth,addressController.cartAddAddress)

router.get("/wishlist",userAuth,wishlistController.loadwishlist)
router.post("/addToWishlist",wishlistController.addToWishlist)
router.post("/removeFromWishlist",wishlistController.removeProduct)

router.get("/cart",userAuth,cartController.loadcart)
router.post("/cart",cartController.procedToCheckOut)
router.post("/addToCart",cartController.addToCart)
router.post("/removeFromCart",cartController.removeProductCart)
router.get("/checkout",userAuth,cartController.loadCheckOut)

router.post("/apply-coupon",couponController.applyCoupon)

router.post('/placeOrder',orderController.placeOrder)
router.get("/orderSuccess",userAuth,orderController.loadOrderSuccess)
router.get("/orders",userAuth,orderController.loadOrders)
router.get('/order/details/:id',userAuth, orderController.viewOrderDetails);
router.post('/orders/cancel-item',orderController.cancelSingleProduct) 
router.post('/orders/cancel',orderController.cancelOrders)
router.patch('/orders/return',orderController.returnOrder)
router.patch('/orders/single-Product-Return',orderController.singleProductReturn)
router.post('/create-razorpay-order',orderController.razorpay)
router.get('/orderFailure',orderController.loadFailure)
router.get('/downloadInvoice',orderController.generateInvoice)

router.get('/wallet',userAuth,walletController.loadWallet)
router.post('/wallet/add',walletController.addAmountToWallet)
router.post("/wallet/create-order",userAuth,walletController.createRazorpayOrder)
router.post("/wallet/payment-success",userAuth,walletController.razorpayPaymentSuccess)

router.get('/logout',userAuth,userController.logout)

module.exports = router