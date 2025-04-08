const User = require("../models/userSchema")

const pageNotFound = async (req, res) => {
    try {

        res.render("pageNotFound")

    } catch (error) {

        res.redirect("/pageNotFound")

    }
}



const loadHomePage = async (req, res) => {
    try {
        const products = []
        return res.render("home", { products })

    } catch (error) {

        console.log("homePage not found")
        res.status(500).send("server error")

    }
}


const loadSignup = async (req, res) => {
    try {

        return res.render("signup")

    } catch (error) {

        console.log('signup page is not loading', error)
        req.status(500).send('Server Error')

    }
}

const postSignup = async(req,res)=>{
    const {name,email,password} = req.body
    try {
        const newUser = new User({name,email,password})
        await newUser.save()
        return res.redirect("/signup")
    } catch (error) {
        console.error("error for save user",error)
        res.status(500).send('Internal server error')
    }
}

const loadShopping = async (req, res) => {
    try {

        return res.render("shop")

    } catch (error) {

        console.log('Shopping page not loading', error)
        res.status(500).send('Server Error')

    }
}

module.exports = {
    loadHomePage,
    pageNotFound,
    loadShopping,
    loadSignup,
    postSignup
} 