const express = require("express")
const router = express.Router()
const userController = require("../controllers/userController")


router.get("/pageNotFound",userController.pageNotFound)
router.get("/",userController.loadHomePage)

router.get("/signup",userController.loadSignup)
router.post("/signup",userController.postSignup)



module.exports = router