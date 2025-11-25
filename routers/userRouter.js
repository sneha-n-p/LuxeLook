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
const User = require('../models/userSchema')


//user Controller//


router.get("/pageNotFound",userController.pageNotFound)
router.get("/",userController.loadHomePage)
router.get("/signup",userAuthCheck,userController.loadSignup)
router.post("/signup",userController.postSignup)
router.post("/signup/verify-otp",userController.verifyOtp)
router.post("/signup/resend-otp",userController.resendOtp)
router.post("/sample",userController.sample)
router.get('/login',userAuthCheck,userController.loadLogin)
router.post('/login',userController.postLogin)
router.get('/logout',userAuth,userController.logout)


//google Auth//

router.get("/auth/google",passport.authenticate('google',{scope:['profile','email']}))
router.get(
  '/auth/google/callback',
  (req, res, next) => {
    passport.authenticate('google', async (err, user) => {
      if (err) {
        console.log('Google login error:', err);

        // If user is blocked
        if (err.message === 'User Blocked By Admin') {
          return res.redirect('/login?error=User+Blocked+By+Admin');
        }
        return res.redirect('/signup?error=Something+went+wrong');
      }

      if (!user) {
        return res.redirect('/signup?error=Google+login+failed');
      }

      req.session.user = user._id;
      res.redirect('/');
    })(req, res, next);
  }
);


//login forgotpassword
router.get("/login/forgot-password",userAuthCheck,profileController.loadForgotPassword)
router.post("/login/forgot-password",profileController.forgotEmailValid)
router.post("/login/verifying-forgetpass-otp",profileController.verifyOtp)
router.post("/login/send-otp",profileController.resendOtp)
router.get("/login/reset-password",userAuthCheck,profileController.loadResetPassword)
router.post("/login/reset-password",profileController.confirmPassword)

//profile Controller//

router.get ("/profile",userAuth,profileController.loadProfile)
router.get ("/profile/edit",userAuth,profileController.loadEditProfile)
router.post ("/profile/edit",upload.single('profileImage'),profileController.updateProfile)

router.get("/profile/change-email",userAuth,profileController.loadChangeEmail)
router.post("/profile/change-email",userAuth,profileController.loadResetEmail)
router.get("/profile/reset-email",userAuth,profileController.loadEmailVerify)
router.post("/profile/reset-email",userAuth,profileController.changeEmailValidation)
router.get("/change-email-otp",userAuth,profileController.loadEmailVerifyOtp)
router.post("/profile/verifying-changeEmail-otp",profileController.EmailVerifyOtp)

router.get("/profile/change-password",userAuth,profileController.changePassword)
router.post("/profile/change-password",userAuth,profileController.changePasswordValid)
router.get("/profile/changePassword-otp",userAuth,profileController.loadPasswordVerifyingOtp)
router.post("/profile/changePassword-otp",profileController.PasswordVerifyingOtp)
router.get("/profile/reset-password",userAuth,profileController.loadresetPassword)
router.post("/profile/reset-password",userAuth,profileController.resetPassword) 
router.post('/profile/upload-profile-pic/:id', upload.single('profileImage'),profileController.addProfile)

//product Controller//

router.get("/shop",productController.loadShop)
router.get("/shop/product-details/:id",productController.loadProductDetails)

//address Controller//

router.get("/addresses",userAuth,addressController.loadAddress)
router.get('/addresses/add-address',userAuth,addressController.loadAddAddress)
router.post('/addresses/add-address',userAuth,addressController.AddAddress)
router.get('/addresses/edit-address/:id',userAuth,addressController.loadEditAddress)
router.post('/addresses/edit-address',addressController.editAddress)
router.post("/addresses/delete-address",addressController.deleteAddress)

//wishlist Controller//

router.get("/wishlist",userAuth,wishlistController.loadwishlist)
router.post("/wishlist/addToWishlist",wishlistController.addToWishlist)
router.post("/wishlist/removeFromWishlist",wishlistController.removeProduct)

//cart Controller//

router.get("/cart",userAuth,cartController.loadcart)
router.post("/cart",cartController.procedToCheckOut)
router.patch('/cart/Quantity',cartController.changeCartQuantity)
router.post("/cart/addToCart",cartController.addToCart)
router.post("/cart/removeFromCart",cartController.removeProductCart)
router.get("/cart/checkout",userAuth,cartController.loadCheckOut)
router.get("/cart/add-address",userAuth,addressController.loadcartAddAddress)
router.post("/cart/add-address",userAuth,addressController.cartAddAddress)

//coupon Controller//
router.post("/apply-coupon",couponController.applyCoupon)

//order Controller//

router.post('/placeOrder',orderController.placeOrder)
router.get("/orderSuccess",userAuth,orderController.loadOrderSuccess)

router.get("/orders",userAuth,orderController.loadOrders)
router.get('/orders/details/:id',userAuth, orderController.viewOrderDetails);
router.post('/orders/cancel-item',orderController.cancelSingleProduct) 
router.post('/orders/cancel',orderController.cancelOrders)
router.patch('/orders/return',orderController.returnOrder)
router.patch('/orders/single-Product-Return',orderController.singleProductReturn)
router.post('/orders/create-razorpay-order',orderController.razorpay)
router.get('/orders/orderFailure',orderController.loadFailure)
router.get('/orders/retry-Checkout',orderController.loadRetryCheckout)
router.post('/orders/retry-PlaceOrder',orderController.loadRetryPlaceOrder)
router.get('/orders/downloadInvoice',orderController.generateInvoice)

//wallet Controller//

router.get('/wallet',userAuth,walletController.loadWallet)
router.post('/wallet/add',walletController.addAmountToWallet)
router.post("/wallet/create-order",userAuth,walletController.createRazorpayOrder)
router.post("/wallet/payment-success",userAuth,walletController.razorpayPaymentSuccess)


module.exports = router