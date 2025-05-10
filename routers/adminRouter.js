const express =require('express')
const router = express.Router()
const adminControllar = require('../controllers/adminController/adminControllar')
const customerController = require("../controllers/adminController/costomerController")
const categoryController =require("../controllers/adminController/categoryController")
const productController = require("../controllers/adminController/productController")
const orderController = require('../controllers/adminController/orderController')
const couponController = require('../controllers/adminController/couponController')
const upload = require("../helpers/multer")
const {adminAuth,adminAuthCheck} = require('../middlewares/auth')



router.get("/login",adminAuthCheck,adminControllar.loadLogin)
router.post('/login',adminControllar.postLogin)

router.get('/',adminAuth,adminControllar.loadDashboard)
router.get('/pageError',adminControllar.pageError)
router.get("/logout",adminControllar.logout)

router.get("/users",adminAuth,customerController.customerInfo)
router.patch("/blockUser",adminAuth,customerController.userBlocked)
router.patch("/UnblockUser",adminAuth,customerController.userUnblocked)

router.get("/categories",adminAuth,categoryController.categoryInfo)
router.get("/add-category",adminAuth,categoryController.loadAddCategory)
router.post("/add-category",categoryController.addCategory)
router.patch("/list-category",adminAuth,categoryController.listCategory)
router.patch("/Unlist-category",adminAuth,categoryController.unlistCategory)
router.get("/edit-category/:id",adminAuth,categoryController.loadEditCategory)
router.post("/edit-category/:id",categoryController.editCategory)
router.post('/add-category-offer',categoryController.addCategoryOffer)
router.post('/remove-category-offer',categoryController.removeCategoryOffer)
router.get('/get-category-offer/:id',categoryController.getCategoryEdit);
router.patch('/edit-category-offer',categoryController.editCategoryOffer)

router.get("/Products",adminAuth,productController.productInfo)
router.get("/add-product",adminAuth,productController.loadAddProduct)
router.post("/add-product",upload.any(),productController.addproduct)
router.get("/edit-product/:id",adminAuth,productController.editProduct)
router.post('/edit-product/:id', upload.fields([
  { name: 'image1' }, { name: 'image2' }, { name: 'image3' }, { name: 'image4' }
]), productController.postProduct);
router.post('/blockProduct',productController.blockProduct)
router.post('/unblockProduct',productController.unblockProduct)
router.post("/deleteImage",productController.deleteSingleImage)
router.post('/add-product-offer',productController.addProductOffer)
router.post('/remove-product-offer',productController.removeProductOffer)
router.get('/get-product-offer/:id',productController.getProductEdit);
router.patch('/edit-product-offer',productController.editProductOffer)

router.get('/orders',adminAuth,orderController.loadOrder)
router.get("/orderDetails/:id",adminAuth,orderController.loadViewDetails)
router.post('/update-order-status', orderController.updateOrderStatus)
router.patch('/verify-return',orderController.verifyRequest)

router.get("/Coupons",adminAuth,couponController.loadCoupon)
router.post("/createCoupon",adminAuth,couponController.createCoupon)
router.get('/editCoupon/:id',adminAuth,couponController.loadEditCoupon)
router.patch("/updateCoupon",adminAuth,couponController.updateCoupon)
router.patch("/list-Coupon",adminAuth,couponController.listCategory)
router.patch("/Unlist-Coupon",adminAuth,couponController.unlistCategory)


module.exports = router