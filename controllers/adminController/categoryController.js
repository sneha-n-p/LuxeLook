
const category = require('../../models/categorySchema')
const mongoose = require('mongoose')
const Product = require('../../models/productSchema')
const StatusCode = require('../../statusCode')
const logger = require('../../helpers/logger')

const categoryInfo = async (req, res) => {
  try {
    let search = req.query.search ? req.query.search.trim() : "";
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    let query = {};

    if (search) {
      query = {
        name: { $regex: search, $options: "i" },
      };
    }

    let Data, totalCategories, totalPage;

    if (search) {
      Data = await category.find(query).sort({ createdAt: -1 });
      totalCategories = Data.length;
      totalPage = 1; 
    } else {
      Data = await category
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      totalCategories = await category.countDocuments(query);
      totalPage = Math.ceil(totalCategories / limit);
    }

    logger.debug(`Data:${Data}`)

    res.render("Category", {
      categories: Data,
      currentPage: page,
      totalPages: totalPage,
      totalCategory: totalCategories,
      search,
    });
  } catch (error) {
    logger.error(error);
    res.status(StatusCode.BAD_REQUEST).redirect("/admin/pageError");
  }
};


const loadAddCategory = async (req, res) => {
  try {
    const categories = await category.find().sort({ createdAt: -1 });
    res.render("addCategory", { categories });
  } catch (error) {
    logger.error(error);
    res.status(StatusCode.NOT_FOUND).redirect("/admin/pageError");
  }
};

const addCategory = async (req, res) => {
  try {
    const { name, description, offer, status } = req.body;
    const Tname = name.trim()
    const existingCategory = await category.findOne({ name: { $regex: new RegExp(`^${Tname}$`, 'i') } });
    if (existingCategory) {
      return res.status(StatusCode.BAD_REQUEST).json({ error: "Category already exists" });
    }

    const newCategory = new category({
      name,
      description,
      offer,
      status
    });

    await newCategory.save()
    return res.status(StatusCode.CREATED).json({ success: true, message: "Category added successfully" })

  } catch (error) {
    logger.error(`Error adding category: ${error}`)
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ error: "Internal Server Error" })
  }
};

const unlistCategory = async (req, res) => {
  try {
    let id = req.body.id
    const mongooseId = new mongoose.Types.ObjectId(id)
    const update = await category.updateOne({ _id: mongooseId }, { $set: { status: 'Unlisted' } })
    if (update) {
      if (req.session.category === id) {
        req.session.category = false
      }
      res.status(StatusCode.CREATED).json({ success: true })
    }
    else {
      logger.error(error)
    }
  } catch (error) {
    logger.error(error)
    res.status(StatusCode.NOT_FOUND).redirect("/admin/pageError")
  }
}

const listCategory = async (req, res) => {
  try {
    let id = req.body.id
    const mongooseId = new mongoose.Types.ObjectId(id)
    const update = await category.updateOne({ _id: mongooseId }, { $set: { status: "Listed" } })
    if (update) {

      res.status(StatusCode.CREATED).json({ success: true })
    } else {
      logger.error(error)
    }
  } catch (error) {
    logger.error(error)
    res.status(StatusCode.NOT_FOUND).redirect("/admin/pageError")
  }
}

const loadEditCategory = async (req, res) => {
  try {
    const id = req.params.id
console.log(id)
    const mongooseId = new mongoose.Types.ObjectId(id)

    const Category = await category.findById(mongooseId)
    res.render("edit-category", { Category: Category })
  } catch (error) {
    logger.error(error)
    res.status(StatusCode.NOT_FOUND).redirect("/admin/pageError")
  }
}

const editCategory = async (req, res) => {
  try {
    const id = req.params.id
    const { name, description, offer, status } = req.body
    const existingCategory = await category.findById(id);
    const products = await Product.find({category:id})

    if (!existingCategory) {
      return res.status(StatusCode.BAD_REQUEST).json({ error: "Category does not exist" });
    }


    const trimmedName = name.trim().toLowerCase();
    const duplicate = await category.findOne({
      _id: { $ne: id },
      name: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
    });

    if (duplicate) {
      return res.status(StatusCode.BAD_REQUEST).json({ error: "Category name already exists" });
    }
    
    let newCategoryOffer =  Number(offer)
      let previousCategoryOffer = existingCategory.offer||0
      for(let product of products){
        let availableProductOffer  = product.productOffer || 0
        let PreviousAddedOffer = Math.max(previousCategoryOffer,availableProductOffer)

        product.variant = product.variant.map(item=>{
          const restoreAmount = (item.salePrice /(1-(PreviousAddedOffer/100)))
          const roundAmount = Math.round(restoreAmount)
          return {...item,salePrice:roundAmount}
        })

        let bestOffer = Math.max(availableProductOffer,newCategoryOffer)
        product.variant = product.variant.map(item=>{
          const appliedAmound = item.salePrice - (item.salePrice*bestOffer/100)
          const roundAmound = Math.round(appliedAmound)
          return {...item,salePrice:roundAmound}
        })
        product.offer = bestOffer 
        await product.save()
      }
    const updateCategory = await category.findByIdAndUpdate(id, {
      name: name.trim(),
      description: description.trim(),
      offer: offer || null,
      status
    }, { new: true });
    if (updateCategory) {
      return res.status(StatusCode.OK).json({ success: true, message: "Category updated successfully" });
    } else {
      res.status(StatusCode.BAD_REQUEST).json({ error: "Failed to update category" });
    }
  } catch (error) {
    logger.error(`Edit category error: ${error}`);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ error: "Internal Server Error" });
  }
}

const addCategoryOffer = async (req, res) => {
  try {
    let { id, offer } = req.body;
    offer = offer > 0 ? offer : 0;

    const updatedCategory = await category.findByIdAndUpdate(id, { offer }, { new: true });

    if (!updatedCategory) {
      return res.status(StatusCode.NOT_FOUND).json({
        success: false,
        message: 'Category not found'
      });
    }

    const products = await Product.find({ category: id });

    for (const product of products) {
      const productOffer = product.productOffer || 0;
      let bestOffer = Math.max(productOffer, offer);
      product.offer = bestOffer;
      logger.debug('bestOffer',bestOffer)
    
      if(productOffer<offer){
        if (Array.isArray(product.variant)) {
          product.variant = product.variant.map(variants => {
            const restoreAmount = Math.round(variants.salePrice / (1 - productOffer / 100));
            const variantDiscount = Math.round( restoreAmount - (restoreAmount * (offer / 100)));
            return {
              ...variants.toObject(),
              salePrice: variantDiscount,
            };
          });
        }
      }
      await product.save();
    }

    res.json({
      success: true,
      message: "Category offer applied. Products and variants updated."
    });

  } catch (err) {
    logger.error(`Error in addCategoryOffer: ${err}`);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const removeCategoryOffer = async (req, res) => {
  try {
    const { id } = req.body;

    const Category = await category.findById(id);
    if (!Category) {
      return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: 'Category not found' });
    }

    const categoryOffer = Category.offer || 0;

    const products = await Product.find({ category: id });

    for (const product of products) {
      const productOffer = product.productOffer || 0;
      const categoryWasUsed = categoryOffer > productOffer;


      if (Array.isArray(product.variant)) {
        const updatedVariants = product.variant.map((variant, i) => {
          const currentPrice = variant.salePrice || 0;
          let originalPrice = currentPrice;
          let finalSalePrice = currentPrice;

          if (categoryWasUsed && categoryOffer > 0) {
            originalPrice = Math.round(currentPrice / (1 - categoryOffer / 100));
            finalSalePrice = productOffer > 0
              ? Math.round(originalPrice - (originalPrice * productOffer / 100))
              : originalPrice;


          } else {
            finalSalePrice = productOffer > 0
              ? Math.round(product.regularPrice - (product.regularPrice * productOffer / 100))
              : product.regularPrice;
          }

          return {
            ...variant.toObject(),
            salePrice: finalSalePrice,
          };
        });

        product.variant = updatedVariants;
        product.markModified("variant");
        product.offer = product.productOffer || 0
        await product.save();
      }
    }

    Category.offer = 0;
    await Category.save();

    res.json({
      success: true,
      message: 'Category offer removed and variants updated correctly.',
    });
  } catch (error) {
    logger.error(`Error removing category offer:${error}`);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Internal server error' });
  }
};

const editCategoryOffer = async (req, res) => {
  try {
    const { id, offer } = req.body;
    logger.debug('req.body',req.body)

    // const updatedCategory = await category.findByIdAndUpdate(id, { offer }, { new: true });
    // if (!updatedCategory) return res.status(StatusCode.NOT_FOUND).json({ success: false, message: 'Category not found' });

    const Category = await category.findById(id)
    if (!Category) return res.status(StatusCode.NOT_FOUND).json({ success: false, message: 'Category not found' });


    const products = await Product.find({ category: id });

    let previousCategoryOffer = Category.offer || 0
    logger.debug('previousCategoryOffer',previousCategoryOffer)

    for (const product of products) {
      let productOffer = product.productOffer || 0

      let restoreOffer = Math.max(previousCategoryOffer, productOffer)
      product.variant = product.variant.map(item => {
        const originalPrice = (item.salePrice / (1 - (restoreOffer / 100)));
        return { ...item, salePrice: originalPrice }
      })

      let bestOffer = Math.max(productOffer, offer)
      product.variant = product.variant.map(item => {
        logger.debug('item.salePrice:',item.salePrice)
        const newSalePrice = Math.round(item.salePrice - (item.salePrice * (bestOffer / 100)));
        logger.debug('newSalePrice:',newSalePrice)
        return { ...item, salePrice: newSalePrice }
      })
      product.offer = bestOffer
      await product.save();

    }

    Category.offer = offer
    await Category.save()

    res.json({ success: true, message: "Category offer updated and products refreshed" });
  } catch (err) {
    logger.error(`Error in editCategoryOffer ${err}`);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Internal server error' });
  }
};

const getCategoryEdit = async (req, res) => {
  try {
    const Category = await category.findById(req.params.id);
    res.json({ offer: Category.offer });
  } catch (err) {
    logger.error(err)
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ error: 'Server error' });
  }
}

module.exports = {
  categoryInfo,
  addCategory,
  loadAddCategory,
  unlistCategory,
  listCategory,
  loadEditCategory,
  editCategory,
  addCategoryOffer,
  removeCategoryOffer,
  editCategoryOffer,
  getCategoryEdit
}


