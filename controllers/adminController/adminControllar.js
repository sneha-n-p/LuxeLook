const User = require('../../models/userSchema')
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")


const pageError = async (req, res) => {
    res.render('admin-Error')
}


const loadLogin = async (req, res) => {
    try {
        if (req.session.admin) {
            return res.redirect('/admin/dashboard')
        }
        res.render('admin-login', { message: null })
    } catch (error) {
        console.error(error)
    }
}

const postLogin = async (req, res) => {
    try {
        const { email, password } = req.body
        const admin = await User.findOne({ email, isAdmin: true })
        if (admin) {
            const passwordMatch = bcrypt.compare(password, admin.password)
            if (passwordMatch) {
                req.session.admin = true
                return res.redirect("/admin")
            } else {
                console.log('done')
                return res.redirect('/admin/login')
            }
        } else {
            return res.redirect('/admin/login')
        }
    } catch (error) {
        console.log('login error', error)
        return res.redirect("/admin/pageError")

    }
}
const loadDashboard = async (req, res) => {
    try {
        if (req.session.admin) {
            res.render('dashboard')
        }
    } catch (error) {
        res.redirect('/pageError')
    }
}

const logout = async (req, res) => {
    try {
        req.session.destroy(err => {
            if (err) {
                console.log("Error destroy session", err)
                return res.redirect("/pageError")
            }
            res.redirect("/admin/login")
        })
    } catch (error) {
        console.log("unexpected error during logout", error)
        res.redirect("/pageError")
    }
}



module.exports = {
    loadLogin,
    postLogin,
    loadDashboard,
    pageError,
    logout
}