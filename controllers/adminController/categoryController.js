
const category = require('../../models/categorySchema')
const mongoose = require('mongoose')
const Product = require('../../models/productSchema')
const StatusCode = require('../../statusCode')

const categoryInfo = async (req, res) => {
  try {
    let search = ""
    if (req.query.search) {
      search = req.query.search
    }

    const page = parseInt(req.query.page) || 1
    const limit = 4
    const skip = (page - 1) * limit

    const Data = await category.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const totalCategories = await category.countDocuments()
    const totalPage = Math.ceil(totalCategories / limit)
    res.render('Category', {
      categories: Data,
      currentPage: page,
      totalPages: totalPage,
      totalCategory: totalCategories,
      search,


    })
  } catch (error) {
    console.error(error)
    res.status(StatusCode.BAD_REQUEST).redirect("/admin/pageError")
  }
}
const loadAddCategory = async (req, res) => {
  try {
    const categories = await category.find().sort({ createdAt: -1 });
    res.render("addCategory", { categories });
  } catch (error) {
    console.error(error);
    res.status(StatusCode.NOT_FOUND).redirect("/admin/pageError");
  }
};



const addCategory = async (req, res) => {
  const { name, description, offer, status } = req.body;

  try {
    console.log(req.body);
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
    console.error("Error adding category:", error)
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ error: "Internal Server Error" })
  }
};



const unlistCategory = async (req, res) => {
  try {
    let id = req.body.id
    const mongooseId = new mongoose.Types.ObjectId(id)
    console.log(mongooseId)
    const update = await category.updateOne({ _id: mongooseId }, { $set: { status: 'Unlisted' } })
    if (update) {
      if (req.session.category === id) {
        req.session.category = false
      }
      res.status(StatusCode.CREATED).json({ success: true })
    }
    else {
      console.error(error)
    }
  } catch (error) {
    console.error(error)
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
      console.error(error)
    }
  } catch (error) {
    console.error(error)
    res.status(StatusCode.NOT_FOUND).redirect("/admin/pageError")
  }
}
const loadEditCategory = async (req, res) => {
  try {
    const id = req.params.id
    const mongooseId = new mongoose.Types.ObjectId(id)
    const Category = await category.findById(mongooseId)
    console.log(Category)
    res.render("edit-category", { Category: Category })
  } catch (error) {
    res.status(StatusCode.NOT_FOUND).redirect("/admin/pageError")
  }
}

const editCategory = async (req, res) => {
  try {
    const id = req.params.id
    const { name, description, offer, status } = req.body
    const existingCategory = await category.findById(id);
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
    console.error("Edit category error:", error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ error: "Internal Server Error" });
  }
}

const addCategoryOffer = async (req, res) => {
  try {
    const { id, offer } = req.body;

    const updatedCategory = await category.findByIdAndUpdate(id, { offer }, { new: true });
    if (!updatedCategory) return res.status(StatusCode.NOT_FOUND).json({ success: false, message: 'Category not found' });

    const products = await Product.find({ category: id });

    for (const product of products) {
      const effectiveOffer = Math.max(product.offer || 0, offer);
      const salePrice = Math.round(product.regularPrice - (product.regularPrice * effectiveOffer) / 100);
      product.salePrice = salePrice;
      await product.save();
    }

    res.json({ success: true, message: "Category offer applied and products updated" });
  } catch (err) {
    console.error('Error in addCategoryOffer:', err);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Internal server error' });
  }
};


const removeCategoryOffer = async (req, res) => {
  try {
    const { id } = req.body;

    const Category = await category.findById(id);
    if (!Category) return res.status(StatusCode.NOT_FOUND).json({ success: false, message: 'Category not found' });

    Category.offer = 0;
    await Category.save();

    const products = await Product.find({ category: id });

    for (const product of products) {
      const productOffer = product.offer || 0;
      const salePrice = productOffer > 0
        ? Math.round(product.regularPrice - (product.regularPrice * productOffer) / 100)
        : product.regularPrice;
      product.salePrice = salePrice;
      await product.save();
    }

    res.json({ success: true, message: "Category offer removed and products updated" });
  } catch (error) {
    console.error('Error removing category offer:', error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Internal server error' });
  }
};


const editCategoryOffer = async (req, res) => {
  try {
    const { id, offer } = req.body;

    const updatedCategory = await category.findByIdAndUpdate(id, { offer }, { new: true });
    if (!updatedCategory) return res.status(StatusCode.NOT_FOUND).json({ success: false, message: 'Category not found' });

    const products = await Product.find({ category: id });

    for (const product of products) {
      const effectiveOffer = Math.max(product.offer || 0, offer);
      const salePrice = Math.round(product.regularPrice - (product.regularPrice * effectiveOffer) / 100);
      product.salePrice = salePrice;
      await product.save();
    }

    res.json({ success: true, message: "Category offer updated and products refreshed" });
  } catch (err) {
    console.error('Error in editCategoryOffer:', err);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Internal server error' });
  }
};


const getCategoryEdit = async (req, res) => {
  try {
    const Category = await category.findById(req.params.id);
    res.json({ offer: Category.offer });
  } catch (err) {
    console.log(err)
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


