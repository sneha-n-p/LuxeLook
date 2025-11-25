const User = require('../../models/userSchema')
const Order = require('../../models/orderSchema')
const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")
const StatusCode = require('../../statusCode')
const logger = require('../../helpers/logger')



const pageError = async (req, res) => {
    res.render('pageError')
}

const loadLogin = async (req, res) => {
    try {
        if (req.session.admin) {
            return res.redirect('/admin/dashboard')
        }
        message = req.session.message || null
        req.session.message = null
        res.render('admin-login', { message })
    } catch (error) {
        logger.error(error)
    }
}

const postLogin = async (req, res) => {
    try {
        const { email, password } = req.body
        const admin = await User.findOne({ email: email, isAdmin: true })
        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password)
            if (!passwordMatch) {
                req.session.message = 'invalid credentials'
                return res.redirect('/admin/login')
            } else {
                req.session.admin = true
                return res.redirect("/admin")
            }
        } else {
            return res.redirect('/admin/login')
        }
    } catch (error) {
        logger.error(`login error ${error}`)
        return res.status(StatusCode.NOT_FOUND).redirect("/admin/pageError")

    }
}
const logout = async (req, res) => {
    try {
        req.session.admin = null
        res.redirect("/admin/login")
    } catch (error) {
        logger.error(`unexpected error during logout ${error}`)
        res.status(StatusCode.NOT_FOUND).redirect("/admin/pageError")
    }
}

module.exports = {
    loadLogin,
    postLogin,
    pageError,
    logout,
}