
const category = require('../../models/categorySchema')
const mongoose = require('mongoose')


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
        res.redirect("/admin/pageError")
    }
}
const loadAddCategory = async (req, res) => {
    try {
        const categories = await category.find().sort({ createdAt: -1 });
        res.render("addCategory", { categories });
    } catch (error) {
        console.error(error);
        res.status(404).redirect("/admin/pageError");
    }
};



const addCategory = async (req, res) => {
  const { name, description, offer, offerPrice, status } = req.body;

  try {
    console.log(req.body);
    const existingCategory = await category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({ error: "Category already exists" });
    }

    const newCategory = new category({
      name,
      description,
      offer,
      offerPrice,
      status
    });

    await newCategory.save();

    return res.status(200).json({ success: true, message: "Category added successfully" });

  } catch (error) {
    console.error("Error adding category:", error);
    return res.status(500).json({ error: "Internal Server Error" });
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
            res.json({ success: true })
        }
        else {
            console.error(error)
        }
    } catch (error) {
        console.error(error)
        res.redirect("/pageError")
    }
}
const listCategory = async (req, res) => {
    try {
        let id = req.body.id
        const mongooseId = new mongoose.Types.ObjectId(id)
        const update = await category.updateOne({ _id: mongooseId }, { $set: { status: "Listed" } })
        if (update) {

            res.json({ success: true })
        } else {
            console.error(error)
        }
    } catch (error) {
        console.error(error)
        res.redirect("/pageError")
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
        res.redirect("/admin/pageError")
    }
}

const editCategory = async (req, res) => {
    try {
        const id = req.params.id
        const { name, description, offer, offerPrice, status } = req.body
        const existingCategory = await category.findById( id )

        if (!existingCategory) {
            return res.status(400).json({ error: "Category not exists. please Choose another name" })
        }
        const updateCategory = await category.findByIdAndUpdate(id, {
            name: name,
            description:description,
            offerPrice:offerPrice,
            offer:offer,
            status:status
        },{new:true})

        if(updateCategory){
            return res.status(200).json({ success: true, message: "Category updated successfully" });

        }else{
            res.status(404).json({error:"Category Not Found"})
        }
    } catch (error) {
res.status(500).json({error:"Internal Server Error"})
    }
}



module.exports = {
    categoryInfo,
    addCategory,
    loadAddCategory,
    unlistCategory,
    listCategory,
    loadEditCategory,
    editCategory
}