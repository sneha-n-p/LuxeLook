const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const User = require("../../models/userSchema")
const fs = require("fs")
const path = require("path")
const sharp = require("sharp")
const mongoose = require("mongoose")
const StatusCode = require("../../statusCode")


const productInfo = async (req, res) => {
  try {
    let search = ""
    if (req.query.search) {
      search = req.query.search
    }

    const page = parseInt(req.query.page) || 1
    const limit = 4
    const skip = (page - 1) * limit

    const Data = await Product.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit).populate('category')

    const totalProducts = await Product.countDocuments()
    const totalPage = Math.ceil(totalProducts / limit)
    res.render('product', {
      products: Data,
      currentPage: page,
      totalPages: totalPage,
      totalproducts: totalProducts,
      search

    })
  } catch (error) {
    console.error(error)
    res.redirect("/admin/pageError")
  }
}


const loadAddProduct = async (req, res) => {
  try {
    const categories = await Category.find();
    res.render("addProduct", { categories });
  } catch (error) {
    console.error(error);
    res.status(StatusCode.NOT_FOUND).redirect("/admin/pageError");
  }
};

const addproduct = async (req, res) => {
  try {
    const {
      ProductName,
      description,
      category,
      offer,
      price,
      // salesPrice,
      variantSize,
      variantSalePrice,
      variantQuantity
    } = req.body;
    const errors = {};

    // Validation 
    if (!ProductName || !/^[A-Za-z ]+$/.test(ProductName)) {
      errors.name = "Product name is required and should contain only alphabetsDefaulters alphabets and spaces";
    }

    if (!description || !/^[A-Za-z ]+$/.test(description)) {
      errors.description = "Description is required and should contain only alphabets and spaces";
    }

    if (!category) {
      errors.category = "Product category is required";
    }

    if (!price || isNaN(price) || Number(price) <= 0) {
      errors.price = "Enter a valid price greater than 0";
    }

    // if (!salesPrice || isNaN(salesPrice) || Number(salesPrice) <= 0) {
    //   errors.salesPrice = "Enter a valid sales price greater than 0";
    // }

    // if (price && salesPrice && parseFloat(price) <= parseFloat(salesPrice)) {
    //   errors.price = "Regular price must be greater than sales price";
    // }

    let stock  =0
    let variants = [];
    if (Array.isArray(variantSize)) {
      for (let i = 0; i < variantSize.length; i++) {
        if (!variantSize[i]) {
          errors[`variantSize${i}`] = "Size is required";
        }
        if (!variantSalePrice[i] || isNaN(variantSalePrice[i]) || Number(variantSalePrice[i]) <= 0) {
          errors[`variantSalePrice${i}`] = "Enter a valid sale price greater than 0";
        }
        if (!variantQuantity[i] || isNaN(variantQuantity[i]) || Number(variantQuantity[i]) < 0) {
          errors[`variantQuantity${i}`] = "Enter a valid non-negative quantity";
        }
        if (variantSize[i]) {
          variants.push({
            size: variantSize[i],
            salePrice: parseFloat(variantSalePrice[i]),
            quantity: parseInt(variantQuantity[i]),
          });
          stock += parseInt(variantQuantity[i])
        }
      }
    } else if (variantSize) {
      if (!variantSize) {
        errors.variantSize = "Size is required";
      }
      if (!variantSalePrice || isNaN(variantSalePrice) || Number(variantSalePrice) <= 0) {
        errors.variantSalePrice = "Enter a valid sale price greater than 0";
      }
      if (!variantQuantity || isNaN(variantQuantity) || Number(variantQuantity) < 0) {
        errors.variantQuantity = "Enter a valid non-negative quantity";
      }
      variants.push({
        size: variantSize,
        salePrice: parseFloat(variantSalePrice),
        quantity: parseInt(variantQuantity),
      });
    }
    console.log(errors)
    if (Object.keys(errors).length > 0) {
      console.log('Error in validation')
      return res.status(StatusCode.BAD_REQUEST).render("addProduct", {
        message: "Validation errors occurred",
        errors,
        categories: await Category.find(),
        formData: req.body
      });
    }

    const categoryDoc = await Category.findOne({ name: category });
    if (!categoryDoc || !mongoose.Types.ObjectId.isValid(categoryDoc._id)) {
      console.log('Error in category')
      errors.category = "Invalid category";
      return res.status(StatusCode.BAD_REQUEST).render("addProduct", {
        message: "Invalid category",
        errors,
        categories: await Category.find(),
        formData: req.body
      });
    }

    let imagesPaths = [];

    for (let i = 1; i <= 4; i++) {
      const file = req.files.find(f => f.fieldname === `image${i}`);
      if (file) {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(file.mimetype)) {
          errors[i] = "Only JPG, JPEG, and PNG images are allowed";
        } else {
          const fileName = `product-${Date.now()}-${i}-${file.originalname.replace(/\s+/g, "-")}.webp`;
          const outputPath = path.join(__dirname, "../../public/uploads/products", fileName);

          try {
            await sharp(file.path)
              .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
              .toFormat("webp")
              .toFile(outputPath);

            imagesPaths.push(`/uploads/products/${fileName}`);
          } catch (err) {
            console.error("Image processing error:", err);
            errors[i] = "Failed to process image";
          }
        }
      }
    }



    if (imagesPaths.length === 0) {
      errors.image1 = "At least one image is required";
    }

    if (Object.keys(errors).length > 0) {
      console.log('Erroreed')
      console.log(errors)
      return res.status(StatusCode.BAD_REQUEST).render("addProduct", {
        message: "Validation errors occurred",
        errors,
        categories: await Category.find(),
        formData: req.body
      });
    }
    const newProduct = new Product({
      productName: ProductName,
      description,
      quatity: stock,
      size: variants.map(v => v.size),
      category: categoryDoc._id,
      offer: parseFloat(offer) || 0,
      regularPrice: parseFloat(price),
      // salePrice: parseFloat(salesPrice),
      productImage: imagesPaths,
      variant: variants
    });

    await newProduct.save();
    console.log("Product saved successfully!");
    return res.status(StatusCode.OK).json({ success: true, message: 'Product added successfully', url: "/admin/products" });
  } catch (error) {
    console.error("Error adding product:", error);
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).render("addProduct", {
      message: "Failed to add product. Please try again.",
      errors: {},
      categories: await Category.find(),
      formData: req.body
    });
  }

}

const editProduct = async (req, res) => {
  try {
    const id = req.params.id
    const product = await Product.findById(id).populate('category');
    const categories = await Category.find();
    res.render("editProduct", { categories, product })
  } catch (error) {
    console.error(error)
    res.redirect("/admin/pageError")
  }
}


const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer, imageIndex } = req.body

    const product = await Product.findById(productIdToServer)
    if (!product) {
      return res.status(StatusCode.NOT_FOUND).json({ success: false, message: "Product not found" })
    }

    product.productImage.splice(imageIndex, 1)

    while (product.productImage.length < 4) {
      product.productImage.push("")
    }

    if (imageNameToServer) {
      const imagePath = path.join(__dirname, "../../public", imageNameToServer)
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath)
      }
    }

    await product.save()
    res.status(StatusCode.OK).json({ success: true, message: "Image deleted successfully" })
  } catch (error) {
    console.error(error)
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "Server error" })
  }
}

const postEditProduct = async (req, res) => { 
  try {
    console.log('Received body:', req.body);
    console.log('Received files:', req.files);

    const productId = req.params.id;
    const {
      name,
      description,
      category,
      offer,
      price,
      variantSize,
      variantPrice,
      variantQuantity,
      existingImage1,
      existingImage2,
      existingImage3,
      existingImage4
    } = req.body;

    if (!name || !description || !category || !price || !variantSize || !variantQuantity) {
      return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: 'All required fields must be provided' });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: 'Invalid product ID' });
    }

    const images = [];
    for (let i = 1; i <= 4; i++) {
      if (req.files[`image${i}`]) {
        images[i - 1] = `/uploads/${req.files[`image${i}`][0].filename}`;
      } else if (req.body[`existingImage${i}`]) {
        images[i - 1] = req.body[`existingImage${i}`];
      } else {
        images[i - 1] = null;
      }
    }

    const filteredImages = images.filter(img => img !== null);

    const variant = []
    let stock = 0
    const addVariant = async()=>{
      for(i=0;i<variantSize.length;i++){
        let obj = {
          size : variantSize[i],
          salePrice : Number(variantPrice[i]),
          quantity : Number(variantQuantity[i])
        }
        stock+=Number(variantQuantity[i])
        variant.push(obj)
      }
    }
    addVariant()

    if (filteredImages.length === 0) {
      return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: 'At least one image is required' });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        productName: name,
        description,
        category,
        offer: offer ? parseFloat(offer) : 0,
        regularPrice: parseFloat(price),
        // salePrice: salesPrice ? parseFloat(salesPrice) : parseFloat(price),
        size: variantSize,
        variant : variant,
        quatity: stock,
        productImage: filteredImages
      },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(StatusCode.NOT_FOUND).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, message: 'Product updated successfully', product: updatedProduct });
  } catch (error) {
    console.error('Error updating product:', error);
    if (error instanceof multer.MulterError) {
      return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: `File upload error: ${error.message}` });
    }
    if (error.message.includes('Only JPEG/PNG images are allowed')) {
      return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: error.message });
    }
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to update product' });
  }
}

const blockProduct = async (req, res) => {
  try {
    const { id } = req.body
    console.log("Product ID:", id)

    const isProduct = await Product.findOne({ _id: id })
    console.log("Found Product:", isProduct)

    if (!isProduct) {
      return res.json({ success: false, message: "Product not found. Try again." })
    }

    console.log("Blocking product...")
    const blocked = await Product.findByIdAndUpdate(id, { isBlocked: true }, { new: true })

    if (blocked) {
      return res.status(StatusCode.OK).json({ success: true, message: "Product blocked successfully" })
    } else {
      return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "Error occurred while blocking product. Please try again." })
    }
  } catch (error) {
    console.error("Error blocking product:", error)
    res.status(StatusCode.NOT_FOUND).redirect("/admin/pageError")
  }
}

const unblockProduct = async (req, res) => {
  try {
    const id = req.body.id
    console.log("Product ID:", id)

    const isProduct = await Product.findOne({ _id: id })
    console.log("Found Product:", isProduct)

    if (!isProduct) {
      return res.json({ success: false, message: "Product not found. Try again." })
    }

    console.log("Blocking product...")
    const blocked = await Product.findByIdAndUpdate(id, { isBlocked: false }, { new: true })

    if (blocked) {
      return res.status(StatusCode.OK).json({ success: true, message: "Product blocked successfully" })
    } else {
      return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "Error occurred while blocking product. Please try again." })
    }
  } catch (error) {
    console.error("Error blocking product:", error)
    res.status(StatusCode.NOT_FOUND).redirect("/admin/pageError")
  }
}

const addProductOffer = async (req, res) => {
  try {
    const { id, offer } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(StatusCode.NOT_FOUND).json({ success: false, message: 'Product not found' });
    }

    const category = await Category.findById(product.category);
    const categoryOffer = category?.offer || 0;

    const finalOffer = Math.max(offer, categoryOffer);

    const discount = product.regularPrice * (finalOffer / 100);
    const newSalePrice = Math.round(product.regularPrice - discount);
    product.offer = finalOffer;
    // product.regularPrice = newSalePrice;

    product.variant = product.variant.map(variant => {
      const variantDiscount = variant.salePrice * (finalOffer / 100);
      const updatedSalePrice = Math.round(variant.salePrice - variantDiscount);
      return {
        ...variant,
        salePrice: updatedSalePrice
      };
    });

    await product.save();

    res.status(StatusCode.CREATED).json({
      success: true,
      finalOffer,
      salePrice: newSalePrice,
      message: 'Offer applied successfully to product and variants'
    });

  } catch (err) {
    console.error('Error in addProductOffer:', err);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Internal Server Error' });
  }
};


const getProductEdit = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    res.json({ offer: product.offer });
  } catch (err) {
    console.log(err)
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ error: 'Server error' });
  }
}
const editProductOffer = async (req, res) => {
  try {
    const { id, offer: newOffer } = req.body;

    const product = await Product.findById(id).populate('category')

    if (!product) {
      return res.status(StatusCode.NOT_FOUND).json({ success: false, message: "Product not found" });
    }

    const categoryOffer = product.category.offer || 0;
    const effectiveOffer = Math.max(categoryOffer, newOffer);
    const salePrice = Math.round(product.regularPrice - (product.regularPrice * effectiveOffer) / 100);

    product.offer = newOffer;
    product.salePrice = salePrice;

    await product.save();

    res.json({
      success: true,
      finalOffer: effectiveOffer,
      salePrice: salePrice,
      message: 'Offer updated successfully'
    });

  } catch (error) {
    console.error("Offer update error:", error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error" });
  }
}
const removeProductOffer = async (req, res) => {
  try {
    const productId = req.body.id;
    const product = await Product.findById(productId);
    if (!product) return res.json({ success: false, message: 'Product not found' });

    const category = await Category.findById(product.category)

    let appliedOffer = product.offer;
    let salePrice = product.regularPrice;

    await Product.findByIdAndUpdate(productId, {
      offer: 0,
      regularPrice:salePrice / (1 - (appliedOffer / 100)),
    });

    product.variant = product.variant.map(variant => {
  const originalPrice = Math.round(variant.salePrice / (1 - (appliedOffer / 100)));
  return {
    ...variant,
    salePrice: originalPrice
  };
});

product.save()

    res.status(StatusCode.OK).json({ success: true, message: 'Product offer removed', finalOffer: appliedOffer, salePrice });
  } catch (error) {
    console.error('Error removing product offer:', error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Internal server error' });
  }
}

module.exports = {
  productInfo,
  loadAddProduct,
  addproduct,
  editProduct,
  deleteSingleImage,
  postEditProduct,
  unblockProduct,
  blockProduct,
  addProductOffer,
  editProductOffer,
  removeProductOffer,
  getProductEdit
}