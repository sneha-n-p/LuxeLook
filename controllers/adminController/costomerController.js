const User = require("../../models/userSchema")
const mongoose = require('mongoose')
const StatusCode = require('../../statusCode')


const customerInfo = async (req, res) => {
    try {
        let search = ""
        if (req.query.search) {
            search = req.query.search
        }
        let page = 1
        if (req.query.page) {
            page = req.query.page
        }
        const limit = 6
        const userData = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } }
            ],
        })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec()

        const count = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } }
            ],
        }).countDocuments()
        const totalPages = Math.ceil(count / limit);
        res.render('users', { users: userData, currentPage: page, totalUsers: count, totalPages, search });
    } catch (error) {
        console.error(error)
    }
}

const userBlocked = async (req, res) => {
    try {
        let id = req.body.id
        const mongooseId = new mongoose.Types.ObjectId(id)
        console.log(mongooseId)
        const update = await User.updateOne({ _id: mongooseId }, { $set: { isBlocked: true } })
        if (update) {
            if (req.session.user === id) {
                req.session.user = false
            }
            res.status(StatusCode.OK).json({ success: true })
        }
        else {
            console.error(error)
        }
    } catch (error) {
        console.error(error)
        res.status(StatusCode.NOT_FOUND).redirect("/admin/pageError")
    }
}

const userUnblocked = async (req, res) => {
    try {
        let id = req.body.id
        const mongooseId = new mongoose.Types.ObjectId(id)
        const update = await User.updateOne({ _id: mongooseId }, { $set: { isBlocked: false } })
        if (update) {

            res.status(StatusCode.OK).json({ success: true })
        } else {
            console.error(error)
        }
    } catch (error) {
        console.error(error)
        res.status(StatusCode.NOT_FOUND).redirect("/admin/pageError")
    }
}

module.exports = {
    customerInfo,
    userBlocked,
    userUnblocked
}