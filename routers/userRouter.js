const express = require("express")
const router = express.Router()
const userController = require("../controllers/userController")


router.get("/pageNotFound",userController.pageNotFound)
router.get("/",userController.loadHomePage)

router.get("/signup",userController.loadSignup)
router.post("/signup",userController.postSignup)

router.post("/verify-otp",userController.verifyOtp)
router.post("/resend-otp",userController.resendOtp)



module.exports = router