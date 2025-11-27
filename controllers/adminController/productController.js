const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const User = require("../../models/userSchema")
const fs = require("fs")
const path = require("path")
const sharp = require("sharp")
const mongoose = require("mongoose")
const StatusCode = require("../../statusCode")
const cloudinary = require('../../dbConfig/cloudinary')
const logger = require('../../helpers/logger')


const productInfo = async (req, res) => {
  try {
    let search = req.query.search ? req.query.search.trim() : "";
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    // Build search query
    let query = {};
    if (search) {
      query = {
        productName: { $regex: search, $options: "i" }, // case-insensitive search
      };
    }

    let Data, totalProducts, totalPage;

    // ✅ If search is active → show all results (no pagination)
    if (search) {
      Data = await Product.find(query).sort({ createdAt: -1 }).populate("category");
      totalProducts = Data.length;
      totalPage = 1;
    } else {
      // ✅ Otherwise use pagination
      Data = await Product.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("category");
      totalProducts = await Product.countDocuments(query);
      totalPage = Math.ceil(totalProducts / limit);
    }
    
    res.render("product", {
      products: Data,
      currentPage: page,
      totalPages: totalPage,
      totalproducts: totalProducts,
      search, // ✅ Keep search term in input
    });
  } catch (error) {
    logger.error(error);
    res.redirect("/admin/pageError");
  }
};


const loadAddProduct = async (req, res) => {
  try {
    const categories = await Category.find();
    res.render("addProduct", { categories });
  } catch (error) {
    logger.error(error);
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
      variantSize,
      variantSalePrice,
      variantQuantity
    } = req.body;
    let errors = {};

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

    const existingProduct = await Product.findOne({productName:{ $regex: new RegExp(`^${ProductName.trim()}$`, "i") }})
    if(existingProduct){
       return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: "Product Name is Already Existing, Try Another Name"
      });
    }

    let stock = 0
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
    logger.error(errors)
    if (Object.keys(errors).length > 0) {
      logger.error(`Error in validation : ${errors}`)
      return res.status(StatusCode.BAD_REQUEST).json({
  success: false,
  message: "Validation errors occurred",
  errors,
  formData: req.body,
  categories: await Category.find()
});
    }

    const categoryDoc = await Category.findOne({ name: category });

    let bestOffer = Math.max(categoryDoc.offer, offer)
    if (Array.isArray(variants)) {
      variants = variants.map(item => {
        let varinatAppliedDiscount = Math.round(item.salePrice - (item.salePrice * (bestOffer / 100)))
        return {
          ...item,
          salePrice: varinatAppliedDiscount
        }
      })
    }

    if (!categoryDoc || !mongoose.Types.ObjectId.isValid(categoryDoc._id)) {
  errors.category = "Invalid category";
  return res.status(StatusCode.BAD_REQUEST).json({
    success: false,
    message: "Invalid category",
    errors,
    formData: req.body,
    categories: await Category.find()
  });
}

    let imagesPaths = req.files.map((image)=>image.path)

    if (imagesPaths.length === 0) {
      errors.image1 = "At least one image is required";
    }

    if (Object.keys(errors).length > 0) {
  return res.status(StatusCode.BAD_REQUEST).json({
    success: false,
    message: "Image validation failed",
    errors,
    formData: req.body,
    categories: await Category.find()
  });
}
let Description = description.trim()
    const newProduct = new Product({
      productName: ProductName,
      description:Description,
      productOffer: offer,
      quatity: stock,
      size: variants.map(v => v.size),
      category: categoryDoc._id,
      offer: parseFloat(bestOffer) || 0,
      regularPrice: parseFloat(price),
      productImage: imagesPaths,
      variant: variants
    });

    await newProduct.save();
return res.status(StatusCode.OK).json({ success: true, message: 'Product added successfully', url: "/admin/products" });  } catch (error) {
    logger.error(`Error adding product: ${error}`);
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).render("addProduct", {
      message: "Failed to add product. Please try again.",
      errors:{},
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
    logger.error(error)
    res.redirect("/admin/pageError")
  }
}

function getPublicIdFromUrl(imageUrl) {
  const parts = imageUrl.split("/");
  const fileName = parts.pop();        // myimage.jpg
  const folder = parts.slice(parts.indexOf("upload") + 2).join("/"); 
  return folder.replace(`/${fileName}`, "") + "/" + fileName.split(".")[0];
}
const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer, imageIndex } = req.body;

    const product = await Product.findById(productIdToServer);
    if (!product) {
      return res.status(StatusCode.NOT_FOUND).json({
        success: false,
        message: "Product not found"
      });
    }

    const imageUrl = product.productImage[imageIndex];

    //  Remove from array
    product.productImage.splice(imageIndex, 1);

    // Fill with empty strings
    while (product.productImage.length < 4) {
      product.productImage.push("");
    }

    //  Delete from Cloudinary
    if (imageUrl) {
      const publicId = getPublicIdFromUrl(imageUrl);

      await cloudinary.uploader.destroy(publicId, (error, result) => {
        if (error) {
          console.log("Cloudinary delete error:", error);
        } else {
          console.log("Cloudinary delete result:", result);
        }
      });
    }

    await product.save();

    res.status(StatusCode.OK).json({
      success: true,
      message: "Image deleted successfully"
    });
  } catch (error) {
    logger.error(error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Server error"
    });
  }
};


const postEditProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: "Invalid product ID"
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(StatusCode.NOT_FOUND).json({
        success: false,
        message: "Product not found"
      });
    }

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

    const findCategory = await Category.findById(category);

    if (!name || !description || !category || !price || !variantSize || !variantQuantity) {
      return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: "All required fields must be provided"
      });
    }

    if(variantPrice == 0 || variantSize == ''){
       return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: "Varients are required"
      });
    }

    const existingProduct = await Product.findOne({productName:{ $regex: new RegExp(`^${name.trim()}$`, "i") }})
    if(existingProduct  && existingProduct._id.toString() !== productId){
       return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: "Product Name is Already Existing, Try Another Name"
      });
    }
    
    const clean = description.trim();

    if (clean.length === 0) {
      return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: "Description cannot be empty"
      });
    }

    if (clean.length < 5) {
      return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: "Description must be at least 5 characters long"
      });
    }

    if (clean.length > 300) {
      return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: "Description cannot exceed 300 characters"
      });
    }

    const allowedPattern = /^[A-Za-z0-9 ,.()\-]+$/;
    if (!allowedPattern.test(clean)) {
      return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: "Description contains invalid characters"
      });
    }

    const numberOnlyPattern = /^[0-9]+$/;
    if (numberOnlyPattern.test(clean)) {
      return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: "Description cannot contain only numbers"
      });
    }

    const fileMap = {};
    if (req.files && Object.keys(req.files).length> 0) {
      for(let img in req.files){
        console.log(req.files[img])
        fileMap[img] = req.files[img][0].path
      }
    }

    console.log('fileMap',fileMap)
    console.log(req.files)

    //  CLOUDINARY IMAGE HANDLING
    let finalImages = [existingImage1, existingImage2, existingImage3, existingImage4];

    for (let i = 1; i <= 4; i++) {
      const fieldName = `image${i}`;

      if (fileMap[fieldName]) {
        const file = fileMap[fieldName];
        finalImages[i - 1] = file
      }
    }

    finalImages = finalImages.filter(img => img);

    if (finalImages.length === 0) {
      return res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: "At least one image is required"
      });
    }

    //  VARIANT PROCESSING
    
    let variant = [];
    let stock = 0;

    for (let i = 0; i < variantSize.length; i++) {
      const obj = {
        size: variantSize[i],
        salePrice: Number(variantPrice[i]),
        quantity: Number(variantQuantity[i])
      };
      stock += Number(variantQuantity[i]);
      variant.push(obj);
    }

    let parseOffer = Number(offer);
    let parseCategoryOffer = Number(findCategory.offer) || 0;

    let previousProductOffer = product.productOffer || 0;
    let previousBestOffer = Math.max(previousProductOffer, parseCategoryOffer);

    variant = variant.map(item => {
      const originalPrice = item.salePrice / (1 - previousBestOffer / 100);
      item.salePrice = Math.round(originalPrice);
      return item;
    });

    let bestOffer = Math.max(parseOffer, parseCategoryOffer);

    variant = variant.map(item => {
      const discounted = item.salePrice * (1 - bestOffer / 100);
      item.salePrice = Math.round(discounted);
      return item;
    });

    //  UPDATE PRODUCT IN DB
    let Description = description.trim()
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        productName: name,
        description:Description,
        category,
        productOffer: parseFloat(offer) || 0,
        offer: bestOffer || 0,
        regularPrice: parseFloat(price),
        size: variantSize,
        variant: variant,
        quatity: stock,
        productImage: finalImages
      },
      { new: true }
    );

    return res.json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct
    });

  } catch (error) {
    logger.error("Error updating product:", error);
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update product",
      error: error.message
    });
  }
};



const blockProduct = async (req, res) => {
  try {
    const { id } = req.body
    const isProduct = await Product.findOne({ _id: id })

    if (!isProduct) {
      return res.json({ success: false, message: "Product not found. Try again." })
    }
    const blocked = await Product.findByIdAndUpdate(id, { isBlocked: true }, { new: true })

    if (blocked) {
      return res.status(StatusCode.OK).json({ success: true, message: "Product blocked successfully" })
    } else {
      return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "Error occurred while blocking product. Please try again." })
    }
  } catch (error) {
    logger.error(`Error blocking product: ${error}`)
    res.status(StatusCode.NOT_FOUND).redirect("/admin/pageError")
  }
}

const unblockProduct = async (req, res) => {
  try {
    const id = req.body.id
    const isProduct = await Product.findOne({ _id: id })
    logger.debug(`Found Product: ${isProduct}`)

    if (!isProduct) {
      return res.json({ success: false, message: "Product not found. Try again." })
    }
    const blocked = await Product.findByIdAndUpdate(id, { isBlocked: false }, { new: true })

    if (blocked) {
      return res.status(StatusCode.OK).json({ success: true, message: "Product blocked successfully" })
    } else {
      return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "Error occurred while blocking product. Please try again." })
    }
  } catch (error) {
    logger.error(`Error blocking product: ${error}`)
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
    logger.debug('product:',product)

    const category = await Category.findById(product.category);
    const categoryOffer = category.offer

    const finalOffer = Math.max(offer, categoryOffer);
    product.offer = finalOffer;

    product.productOffer = offer;

    if (categoryOffer < offer) {
      product.variant = product.variant.map(variant => {
        const restoreAmount = Math.round(variant.salePrice / (1 - categoryOffer / 100))
        const variantDiscount = restoreAmount - (restoreAmount * (offer / 100));
        return {
          ...variant,
          salePrice: variantDiscount
        };
      });
    }

    await product.save();
    logger.debug('product:',product)
    res.status(StatusCode.CREATED).json({
      success: true,
      message: "Product offer applied.", finalOffer, salePrice: product.variant[0].salePrice
    });


  } catch (err) {
    logger.error(`Error in addProductOffer: ${err}`);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Internal Server Error' });
  }
};

const getProductEdit = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    res.json({ offer: product.offer });
  } catch (err) {
    logger.error(err)
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ error: 'Server error' });
  }
}

const editProductOffer = async (req, res) => {
  try {
    const { id, offer: newOffer } = req.body;

    const product = await Product.findById(id).populate('category');
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const previousOffer = product.productOffer || 0;
    const categoryOffer = product.category.offer || 0;

    const restoreOffer = Math.max(categoryOffer, previousOffer);
    product.variant = product.variant.map(item => {
      const originalPrice = item.salePrice / (1 - (restoreOffer / 100));
      const roundPrice = Math.round(originalPrice)
      return { ...item, salePrice: roundPrice };
    });

    const bestOffer = Math.max(categoryOffer, newOffer);
    product.variant = product.variant.map(item => {
      const newSalePrice = Math.round(item.salePrice - (item.salePrice * (bestOffer / 100)));
      return { ...item, salePrice: newSalePrice };
    });

    product.offer = bestOffer;
    product.productOffer = newOffer;

    await product.save();

    res.json({
      success: true,
      finalOffer: bestOffer,
      message: 'Offer updated successfully'
    });

  } catch (error) {
    logger.error(`Offer update error: ${error}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const removeProductOffer = async (req, res) => {
  try {
    const productId = req.body.id;
    const product = await Product.findById(productId);
    if (!product) {
      return res.json({ success: false, message: 'Product not found' });
    }

    const category = await Category.findById(product.category);
    const productOffer = product.productOffer || 0;
    const categoryOffer = category?.offer || 0;
    const bestOffer = categoryOffer;

    let appliedOffer = 0;

    if (productOffer > categoryOffer) {
      appliedOffer = productOffer;

      product.variant = product.variant.map(variant => {
        const originalPrice = Math.round(variant.salePrice / (1 - (appliedOffer / 100)));
        return {
          ...variant,
          salePrice: originalPrice
        };
      });

      if (categoryOffer > 0) {
        product.variant = product.variant.map(variant => {
          const discounted = Math.round(variant.salePrice * (1 - (categoryOffer / 100)));
          return {
            ...variant,
            salePrice: discounted
          };
        });
      }
    }

    product.offer = bestOffer;
    product.productOffer = 0;

    await product.save();

    res.status(StatusCode.OK).json({
      success: true,
      message: 'Product offer removed',
      finalOffer: bestOffer
    });
  } catch (error) {
    logger.error(`Error removing product offer: ${error}`);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


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