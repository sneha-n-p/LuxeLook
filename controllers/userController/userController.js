const User = require("../../models/userSchema")
const env = require("dotenv").config()
const bcrypt = require("bcrypt")
const nodemailer = require("nodemailer")
const Product = require("../../models/productSchema")
const Coupon = require('../../models/couponSchema')
const pageNotFound = async (req, res) => {
    try {

        res.render("pageNotFound")

    } catch (error) {

        res.redirect("/pageNotFound")

    }
}



const loadHomePage = async (req, res) => {
    try {
        const user = req.session.user
        if (user) {
            const products = await Product.find({ isBlocked: false })
            const userData = await User.findOne({ _id: user })
            res.render('home', { user: userData, products , activePage: 'home'  })
        } else {
            const products = await Product.find()
            return res.render('home', { user: null, products})
        }
    } catch (error) {
        console.log("homePage not found", error)
        res.status(500).send("server error")
    }
}


const loadSignup = async (req, res) => {
    try {

        return res.render("signup", { message: null })

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

        const { name, email, phone, password, Cpassword, referalCode } = req.body

        if (password !== Cpassword) {
            return res.render("signup", { message: "password do not match" })
        }
        const findUser = await User.findOne({ email })
        if (findUser) {
            return res.render("signup", { message: " User with this email already exist" })
        }

        const otp = generateOtp()
        const emailSent = await sendVerificationEmail(email, otp)
        if (!emailSent) {
            return res.json("email-error")
        }
        req.session.userOtp = otp
        req.session.userData = { name, phone, email, password, referalCode }

        res.render('signupOtp')
        console.log("OTP sent", otp)

    } catch (error) {
        console.error('signup error', error)
        res.redirect('/pageNotFound')
    }
}


const loadShopping = async (req, res) => {
    try {
        return res.render("shop",{user: req.session.user, activePage: 'shop' })
    } catch (error) {
        console.log('Shopping page not loading', error)
        res.status(500).send('Server Error')
    }
}



const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10)
        return passwordHash
    } catch (error) {
    }
}
const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    console.log(otp);
    if (otp === req.session.userOtp) {
      const user = req.session.userData;
      let availableCoupons = [];

      const passwordHash = await securePassword(user.password);

      const saveUserData = new User({
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: passwordHash,
        referredBy: user.referalCode || null,
        availableCoupons: [],
      });

      await saveUserData.save();

      if (user.referalCode) {
        const referrer = await User.findOne({ referalCode: user.referalCode });
        if (referrer) {
          const referrerCoupon = new Coupon({
            name: "REF" + Math.random().toString(36).substr(2, 8).toUpperCase(),
            offerPrice: 100,
            minimumPrice: 500,
            restricted : true,
            expiredOn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 
            isList: false, 
          });
          await referrerCoupon.save();

          if (!referrer.availableCoupons) referrer.availableCoupons = [];
          if (!referrer.redeemedUsers) referrer.redeemedUsers = [];
          referrer.availableCoupons.push(referrerCoupon._id);
          referrer.redeemedUsers.push(saveUserData._id); 
          await referrer.save();

          const refereeCoupon = new Coupon({
            name: "NEW" + Math.random().toString(36).substr(2, 8).toUpperCase(),
            offerPrice: 50,
            minimumPrice: 300,
            expiredOn: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), 
            isList: false,
          });
          await refereeCoupon.save();

          saveUserData.availableCoupons = [refereeCoupon._id];
          await saveUserData.save();
        }
      }

      req.session.user = saveUserData._id;
      req.session.userData = null;
      req.session.userOtp = null; 
      res.json({ success: true, redirectUrl: "/" });
    } else {
      res.json({
        success: false,
        message: "Invalid OTP, please try again",
      });
    }
  } catch (error) {
    console.error("Error Verifying OTP", error);
    res.status(500).json({ success: false, message: "An error occurred" });
  }
};

const resendOtp = async (req, res) => {
    try {
        const { email } = req.session.userData
        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found" })
        }
        const newOtp = generateOtp()
        req.session.userOtp = newOtp
        const emailSent = await sendVerificationEmail(email, newOtp)
        if (emailSent) {
            console.log("Resend OTP:", newOtp)
            res.status(200).json({ success: true, message: "OTP Resend successfully" })
        } else {
            res.status(500).json({ success: false, message: "failed to resend OTP .please try again" })
        }
    } catch (error) {
        console.error("Error resending OTP ", error)
        res.status(500).json({ success: false, message: "Internal server error.please try again" })
    }
}


const loadLogin = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.render('login', { message: null })
        } else {
            res.redirect("/")
        }
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const postLogin = async (req, res) => {
    try {
        const { email, password } = req.body
        const findUser = await User.findOne({ isAdmin: 0, email: email })
        if (!findUser) {
            return res.render('login', { message: "User not found" })
        }
        if (findUser.isBlocked) {
            return res.render("login", { message: "User blocked by admin" })
        }
        const passwordMatch = await bcrypt.compare(password, findUser.password)
        if (!passwordMatch) {
            return res.render("login", { message: "Incorrect password" })
        }
        req.session.user = findUser._id
        res.redirect('/')
    } catch (error) {
        console.error("login error:", error)
        res.render('login', { message: "login failed.Please try again later" })
    }
}

const logout = async (req, res) => {
    try {
        req.session.destroy((error) => {
            if (error) {
                console.log('Session destruction error', error)
                return res.redirect("/pageNotFound")
            }
            return res.redirect("/login")
        })
    } catch (error) {
        console.log('logout error', error)
        res.redirect("/pageNotFound")
    }
}
const sample = async (req, res) => {
    try {

        res.send("haaai")
    } catch (error) {
        console.log('logout error', error)
        res.redirect("/pageNotFound")
    }
}
module.exports = {
    loadHomePage,
    pageNotFound,
    loadShopping,
    loadSignup,
    postSignup,
    verifyOtp,
    resendOtp,
    loadLogin,
    postLogin,
    logout, 
    sample
} 