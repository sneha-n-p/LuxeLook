const User = require('../../models/userSchema')
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")
const StatusCode = require('../../statusCode')


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
        console.error(error)
    }
}

const postLogin = async (req, res) => {
    try {
        const { email, password } = req.body
        const admin = await User.findOne({ email: email, isAdmin: true })
        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password)
            if (!passwordMatch) {
                console.log('done')
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
        console.log('login error', error)
        return res.status(StatusCode.NOT_FOUND).redirect("/admin/pageError")

    }
}
const loadDashboard = async (req, res) => {
    try {
        if (req.session.admin) {
            res.render('dashboard')
        }
    } catch (error) {
        res.status(StatusCode.NOT_FOUND).redirect('/admin/pageError')
    }
}

const logout = async (req, res) => {
    try {
        req.session.destroy(err => {
            if (err) {
                console.log("Error destroy session", err)
                return res.status(StatusCode.NOT_FOUND).redirect("/admin/pageError")
            }
            res.redirect("/admin/login")
        })
    } catch (error) {
        console.log("unexpected error during logout", error)
        res.status(StatusCode.NOT_FOUND).redirect("/admin/pageError")
    }
}



module.exports = {
    loadLogin,
    postLogin,
    loadDashboard,
    pageError,
    logout
}