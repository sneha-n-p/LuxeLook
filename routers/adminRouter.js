const express = require('express')
const router = express.Router()
const adminControllar = require('../controllers/adminController/adminControllar')
const customerController = require("../controllers/adminController/costomerController")
const categoryController = require("../controllers/adminController/categoryController")
const productController = require("../controllers/adminController/productController")
const orderController = require('../controllers/adminController/orderController')
const couponController = require('../controllers/adminController/couponController')
const salesRepoartController = require("../controllers/adminController/salesReportController")
const dashboardController = require('../controllers/adminController/dashboardController')
const upload = require("../helpers/multer")
const { adminAuth, adminAuthCheck } = require('../middlewares/auth')


//admin controller//

router.get("/login", adminAuthCheck, adminControllar.loadLogin)
router.post('/login', adminControllar.postLogin)
router.get('/pageError', adminControllar.pageError)
router.post("/logout", adminControllar.logout)

//customer Controller//

router.get("/users", adminAuth, customerController.customerInfo)
router.patch("/users/blockUser", adminAuth, customerController.userBlocked)
router.patch("/users/UnblockUser", adminAuth, customerController.userUnblocked)

//category Controller//

router.get("/categories", adminAuth, categoryController.categoryInfo)
router.get("/categories/add-category", categoryController.loadAddCategory)
router.post("/categories/add-category", categoryController.addCategory)
router.patch("/categories/list-category", adminAuth, categoryController.listCategory)
router.patch("/categories/Unlist-category", adminAuth, categoryController.unlistCategory)
router.get("/categories/edit-category/:id", categoryController.loadEditCategory)
router.patch("/categories/edit-category/:id", categoryController.editCategory)
router.post('/categories/add-category-offer', categoryController.addCategoryOffer)
router.post('/categories/remove-category-offer', categoryController.removeCategoryOffer)
router.get('/categories/get-category-offer/:id', adminAuth, categoryController.getCategoryEdit)
router.patch('/categories/edit-category-offer', categoryController.editCategoryOffer)

//product Controller//

router.get("/Products", adminAuth, productController.productInfo)
  .get("/Products/add-product", adminAuth, productController.loadAddProduct)
  .post("/Products/add-product", upload.any(), productController.addproduct)
  .get("/Products/edit-product/:id", adminAuth, productController.editProduct)
  .post('/Products/edit-product/:id', upload.fields([
    { name: 'image1' }, { name: 'image2' }, { name: 'image3' }, { name: 'image4' }
  ]), productController.postEditProduct)
  .post('/Products/blockProduct', productController.blockProduct)
  .post('/Products/unblockProduct', productController.unblockProduct)
  .post("/Products/deleteImage", productController.deleteSingleImage)
  .post('/Products/add-product-offer', productController.addProductOffer)
  .post('/Products/remove-product-offer', productController.removeProductOffer)
  .get('/Products/get-product-offer/:id', adminAuth, productController.getProductEdit)
  .patch('/Products/edit-product-offer', productController.editProductOffer)

//order Controller//

router.get('/orders', adminAuth, orderController.loadOrder)
router.get("/orders/orderDetails/:id", adminAuth, orderController.loadViewDetails)
router.post('/orders/update-order-status', orderController.updateOrderStatus)
router.patch('/orders/verify-return', orderController.verifyRequest)
router.patch('/orders/verify-single-return', orderController.verifySingleRequest)

//coupon Controller//

router.get("/Coupons", adminAuth, couponController.loadCoupon)
router.post("/Coupons/createCoupon", adminAuth, couponController.createCoupon)
router.get('/Coupons/editCoupon/:id', adminAuth, couponController.loadEditCoupon)
router.patch("/Coupons/updateCoupon", adminAuth, couponController.updateCoupon)
router.patch("/Coupons/list-Coupon", adminAuth, couponController.listCoupon)
router.patch("/Coupons/Unlist-Coupon", adminAuth, couponController.unlistCoupon)

//salesRepoart Controller//

router.get("/sales", adminAuth, salesRepoartController.loadSalesPage)
router.get('/sales/download/pdf', adminAuth, salesRepoartController.downloadPDF)
router.get('/sales/download/excel', adminAuth, salesRepoartController.downloadExcel)

//dashboard Condroller

router.get('/', adminAuth, dashboardController.loadDashboard)
router.get("/api/sales-data", adminAuth, dashboardController.getSalesData)
router.get("/api/top-selling", adminAuth, dashboardController.getTopSelling)


module.exports = router