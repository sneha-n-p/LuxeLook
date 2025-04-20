const express = require("express")
const router = express.Router()
const userController = require("../controllers/userController/userController")
const passport  = require('../dbConfig/passport')
const profileController = require("../controllers/userController/profileController")
const productController = require("../controllers/userController/productController")
const {userAuth,userAuthCheck} = require('../middlewares/auth')



router.get("/pageNotFound",userAuth,userController.pageNotFound)
router.get("/",userAuth,userController.loadHomePage)

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


router.get("/shop",userAuth,productController.loadShop)
router.get("/product-details/:id",userAuth,productController.loadProductDetails)

router.get('/logout',userAuth,userController.logout)

module.exports = router