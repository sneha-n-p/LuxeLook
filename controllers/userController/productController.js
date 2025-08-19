const User = require("../../models/userSchema")
const env = require("dotenv").config()
const Product = require("../../models/productSchema")
const category = require("../../models/categorySchema")
const Category = require("../../models/categorySchema")
const StatusCode = require("../../statusCode")



const loadShop = async (req, res) => {
  console.log('Reached Shop');
  try {
    let search = req.query.search || "";
    let sort = req.query.sort || "";
    let page = parseInt(req.query.page) || 1;
    let selectCategory = req.query.selectCategory || ''
    const priceFilter = req.query.priceFilter || "";
    console.log('selected category is:', selectCategory)
    console.log('priceFilter:',priceFilter)
    const limit = 8;

    const query = {
      isBlocked: false,
      $or: [
        { productName: { $regex: ".*" + search + ".*", $options: "i" } }
      ]
    };


    if (selectCategory) {
      const categoryDetails = await Category.findOne({ name: selectCategory });
      if (categoryDetails) {
        query.category = categoryDetails._id;
      }
    }

    let sortOption = {};
    if (sort === "price-asc") {
      sortOption = { 'variant.salePrice': 1 };
    } else if (sort === "price-desc") {
      sortOption = { 'variant.salePrice': -1 };
    } else if (sort === "name-asc") {
      sortOption = { productName: 1 };
    } else if (sort === "name-desc") {
      sortOption = { productName: -1 };
    }


    if (priceFilter === "lt-500") {
  query['variant.salePrice'] = { $lt: 500 };
} else if (priceFilter === "lt-1000") {
  query['variant.salePrice'] = { $lt: 1000 };
} else if (priceFilter === "gt-1000") {
  query['variant.salePrice'] = { $gt: 1000 };
}



    const productData = await Product.find(query)
      .sort(sortOption)
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

      

    const count = await Product.find(query).countDocuments();
    const totalPages = Math.ceil(count / limit);

    const categories = await Category.find({ status: "Listed" });


    if (req.session.user) {
      const user = await User.findById(req.session.user);
      res.render("shop", {
        products: productData,
        user,
        totalPages,
        categories,
        currentPage: page,
        search,
        selectCategory,
        sort,
        priceFilter,
        activePage: 'shop'
      });
    } else {
      res.render("shop", {
        products: productData,
        user: null,
        totalPages,
        categories,
        selectCategory,
        currentPage: page,
        search,
        sort,
        priceFilter,
        activePage: 'shop'
      });
    }
  } catch (error) {
    console.error(error);
    res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound");
  }
};

const loadProductDetails = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound");
    }

    const recommendedProducts = await Product.find({
      _id: { $ne: product._id },
      category: product.category
    }).limit(4);

    const sizeMap = {};
    product.variant.forEach(variant => {
      sizeMap[variant.size] = variant.quantity;
    });

    if (req.session.user) {
      const id = req.session.user;
      const user = await User.findById(id);
      return res.render('productDetails', {
        product,
        recommendedProducts,
        user,
        activePage: 'productDetails',
        sizeMap
      });
    } else {
      return res.render('productDetails', {
        product,
        recommendedProducts,
        user: null,
        activePage: 'productDetails',
        sizeMap
      });
    }
  } catch (error) {
    console.error(error);
    res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound");
  }
};

module.exports = {
  loadShop,
  loadProductDetails
}
