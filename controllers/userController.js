const User = require("../models/userSchema")
const env = require("dotenv").config()
const bcrypt = require("bcrypt")
const nodemailer = require("nodemailer")

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
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString()
}
async function sendVerificationEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        })

        const info = await transporter.sendMail({
            from: process.env.NODEMAIL_EMAIL,
            to: email,
            subject: "verify your account",
            text: `your OTP is ${otp}`,
            html: `<b>Your OTP:${otp}</b>`

        })
        return info.accepted.length > 0
    } catch (error) {
        console.error("Error sending email ", error)
        return false
    }
}

const postSignup = async (req, res) => {
    try {

        const { name, email, phone, password, Cpassword } = req.body

        if (password !== Cpassword) {
            return res.render("signup", { message: "password do not match" })
        }
        const findUser = await User.findOne({ email })
        if (findUser) {
            return res.render("signup", { message: "email already exist" })
        }
        const otp = generateOtp()
        const emailSent = await sendVerificationEmail(email, otp)
        if (!emailSent) {
            return res.json("email-error")
        }
        req.session.userOtp = otp
        req.session.userData = { name, phone, email, password }

        res.render('signupOtp')
        console.log("OTP sent", otp)

    } catch (error) {
        console.error('signup error', error)
        res.redirect('/pageNotFound')
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

const securePassword = async(password)=>{
    try {
        const passwordHash = await bcrypt.hash(password,10)
        return passwordHash 
    } catch (error) {
        
    }
}
const verifyOtp = async(req,res)=>{
    try {
        const {otp} = req.body
        console.log(otp)
        if(otp===req.session.userOtp){
            const user = req.session.userData
            const passwordHash = await securePassword(user.password)
            const saveUserData = new User({
                name:user.name,
                email:user.email,
                phone:user.phone,
                password:passwordHash
            })
            await saveUserData.save()
            req.session.user = saveUserData._id
            res.json({success:true,redirectUrl:"/"})
        }else{
            res.json({
                success: false,message:"invaied OTP,please try again"
              });
        }
    } catch (error) {
        console.error("Error Verifing OTP",error)
        res.status(500).json({success:false,message:"An error occure"})
    }
}

const resendOtp = async(req,res)=>{
    try {
        const {email} = req.session.userData
        if(!email){
            return res.status(400).json({success:false,message:"Email not found"})
        }
        const newOtp =generateOtp()
        req.session.userOtp = newOtp
        const emailSent = await sendVerificationEmail(email,newOtp)
        if(emailSent){
            console.log("Resend OTP:",newOtp)
            res.status(200).json({success:true,message:"OTP Resend successfully"})
        }else{
            res.status(500).json({success:false,message:"failed to resend OTP .please try again"})
        }
    } catch (error) {
        console.error("Error resending OTP ",error)
        res.status(500).json({success:false,message:"Internal server error.please try again"})
    }
}

module.exports = {
    loadHomePage,
    pageNotFound,
    loadShopping,
    loadSignup,
    postSignup,
    verifyOtp,
    resendOtp
} 