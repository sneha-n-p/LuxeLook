const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const User = require("../../models/userSchema")
const fs = require("fs")
const path = require("path")
const sharp = require("sharp")
const mongoose = require("mongoose")


const productInfo = async (req, res) => {
  try{
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
      .limit(limit)

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
    res.status(404).redirect("/admin/pageError");
  }
};

const addproduct = async (req, res) => {
  try {
    console.log("Request received at /admin/addProducts")
    console.log("Form Data:", req.body)
    console.log("Uploaded Files:", req.files)

    const {
      name,
      description,
      category,
      offer,
      price,
      salesPrice,
      Stock,
      Size,
      croppedImage
    } = req.body

    // console.log('Variants received:', variants)

    if (!name || !description || !price || !salesPrice || !category) {
      return res.status(500).json({ success: false, message: "All fields are required." })
    }

    const categoryDoc = await Category.findOne({ name: category })
    if (!categoryDoc || !mongoose.Types.ObjectId.isValid(categoryDoc._id)) {
      return res.status(500).json({ success: false, message: "Invalid category." })
    }

    let imagesPaths = req.files.map((file, i) => {
      const fileName = `product-${Date.now()}-${i}-${file.originalname.replace(/\s+/g, "-")}.webp`;
      const outputPath = path.join(__dirname, "../../public/uploads/products", fileName);

      try {
        sharp(file.path)
          .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
          .toFormat("webp")
          .toFile(outputPath);
      } catch (err) {
        console.error("Image processing error:", err);
      }

      return `/uploads/products/${fileName}`;
    });


    console.log(imagesPaths);



    const newProduct = new Product({
      productName: name,
      description,
      quatity: Stock,
      size: Size,
      category: categoryDoc._id,
      offer: 0,
      regularPrice: parseFloat(price),
      salePrice: parseFloat(salesPrice),
      productImage: imagesPaths
      // variants: parsedVariants
    })

    await newProduct.save()
    console.log("Product saved successfully!")
    return res.status(200).json({ success: true, message: 'Product added successfully',url:"/admin/products" })
  } catch (error) {
    console.error("Error adding product:", error)
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
    res.redirect("/pageNotFound")
  }
}


const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer, imageIndex } = req.body

    const product = await Product.findById(productIdToServer)
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" })
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
    res.json({ success: true, message: "Image deleted successfully" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: "Server error" })
  }
}

const postProduct = async (req, res) => {
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
      salesPrice,
      Size,
      Stock,
      existingImage1,
      existingImage2,
      existingImage3,
      existingImage4
    } = req.body;

    if (!name || !description || !category || !price || !Size || !Stock) {
      return res.status(400).json({ success: false, message: 'All required fields must be provided' });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
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

    if (filteredImages.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one image is required' });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        productName: name,
        description,
        category,
        offer: offer ? parseFloat(offer) : 0,
        regularPrice: parseFloat(price),
        salePrice: salesPrice ? parseFloat(salesPrice) : parseFloat(price),
        size: Size,
        quatity: parseInt(Stock),
        productImage: filteredImages
      },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, message: 'Product updated successfully', product: updatedProduct });
  } catch (error) {
    console.error('Error updating product:', error);
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: `File upload error: ${error.message}` });
    }
    if (error.message.includes('Only JPEG/PNG images are allowed')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Failed to update product' });
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
      return res.json({ success: true, message: "Product blocked successfully" })
    } else {
      return res.json({ success: false, message: "Error occurred while blocking product. Please try again." })
    }
  } catch (error) {
    console.error("Error blocking product:", error)
    res.status(404).redirect("/pageError")
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
      return res.json({ success: true, message: "Product blocked successfully" })
    } else {
      return res.json({ success: false, message: "Error occurred while blocking product. Please try again." })
    }
  } catch (error) {
    console.error("Error blocking product:", error)
    res.status(500).redirect("/pageerror")
  }
}

const addProductOffer = async(req,res)=>{
  try {
    const { id, offer } = req.body;

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const category = await Category.findOne({ name: product.category });
    const categoryOffer = category?.offer || 0;

    const finalOffer = Math.max(offer, categoryOffer);
    const discount = product.regularPrice * (finalOffer / 100);
    const salePrice = Math.round(product.regularPrice - discount);

    product.offer = finalOffer;
    product.salePrice = salePrice;

    await product.save();

    res.json({ success: true, finalOffer, salePrice });
  } catch (err) {
    console.error('Error in addProductOffer:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}

const getProductEdit = async(req,res)=>{
  try {
    const product = await Product.findById(req.params.id);
    res.json({ offer: product.offer });
  } catch (err) {
      console.log(err)
    res.status(500).json({ error: 'Server error' });
  }
}
const editProductOffer = async(req,res)=>{
 try {
    const { id, offer: newOffer } = req.body;

    const product = await Product.findById(id).populate('category')

    if (!product) {
      return res.json({ success: false, message: "Product not found" });
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
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}
const removeProductOffer = async(req,res)=>{
  try {
    const productId = req.body.id;
    const product = await Product.findById(productId);
    if (!product) return res.json({ success: false, message: 'Product not found' });

    const category = await Category.findById(product.category)

    let appliedOffer = 0;
    let salePrice = product.regularPrice;

    // if (category && category.offer > 0) {
    //   appliedOffer = category.offer;
    //   salePrice = Math.round(product.regularPrice - (product.regularPrice * appliedOffer) / 100);
    // }

    await Product.findByIdAndUpdate(productId, {
      offer: appliedOffer,
      salePrice: appliedOffer > 0 ? salePrice : product.regularPrice,
    });

    res.json({ success: true, message: 'Product offer removed', finalOffer: appliedOffer, salePrice });
  } catch (error) {
    console.error('Error removing product offer:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

module.exports = {
  productInfo,
  loadAddProduct,
  addproduct,
  editProduct,
  deleteSingleImage,
  postProduct,
  unblockProduct,
  blockProduct,
  addProductOffer,
  editProductOffer,
  removeProductOffer,
  getProductEdit
}