const User = require("../../models/userSchema")
const env = require("dotenv").config()
const bcrypt = require("bcrypt")
const nodemailer = require("nodemailer")
const Product = require("../../models/productSchema")
const Category = require('../../models/categorySchema')
const Coupon = require('../../models/couponSchema')
const StatusCode = require('../../statusCode')

const pageNotFound = async (req, res) => {
    try {
        res.render("pageNotFound")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const loadHomePage = async (req, res) => {
  try {
    const user = req.session.user;

    const products = await Product.find({ isBlocked: false }).populate('category');
    const categorys = await Category.find({ status: "Listed" });

    const processedProducts = products.map(product => {
      const productOffer = product.offer || 0;
      const categoryOffer = product.category?.offer || 0;
      const bestOffer = Math.max(productOffer, categoryOffer);

      const regularPrice = product.regularPrice;
      const salePrice = Math.round(regularPrice - (regularPrice * bestOffer / 100));

      return {
        ...product._doc,
        bestOffer,
        salePrice,
        regularPrice,
      };
    });

    if (user) {
      const userData = await User.findById(user);
      return res.render("home", { user: userData, products: processedProducts, categorys, activePage: "home" });
    } else {
      return res.render("home", { user: null, products: processedProducts, categorys, activePage: "home" });
    }

  } catch (error) {
    console.log("homePage not found", error);
    res.status(500).send("Server error");
  }
};



const loadSignup = async (req, res) => {
    try {
        return res.render("signup", { message: null })
    } catch (error) {
        console.log('signup page is not loading', error)
        req.status(StatusCode.INTERNAL_SERVER_ERROR).send('Server Error')

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
            return res.status(StatusCode.BAD_REQUEST).json("email-error")
        }
        req.session.userOtp = otp
        req.session.userData = { name, phone, email, password, referalCode }

        res.render('signupOtp')
        console.log("OTP sent", otp)

    } catch (error) {
        console.error('signup error', error)
        res.status(StatusCode.NOT_FOUND).redirect('/pageNotFound')
    }
}


const loadShopping = async (req, res) => {
  try {
    const user = req.session.user;
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 12;

    const query = search
      ? { productName: { $regex: search, $options: "i" }, isBlocked: false }
      : { isBlocked: false };

    const productDocs = await Product.find(query)
      .populate('category') 
      .skip((page - 1) * limit)
      .limit(limit);

    const totalCount = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    const products = productDocs.map(product => {
      const productOffer = product.offer || 0;
      const categoryOffer = (product.category && typeof product.category.offer === 'number') ? product.category.offer : 0;

      const bestOffer = Math.max(productOffer, categoryOffer);

      console.log(`[${product.productName}] -> Product: ${productOffer}%, Category: ${categoryOffer}% → Best: ${bestOffer}%`);

      const salePrice = bestOffer > 0
        ? Math.round(product.regularPrice - (product.regularPrice * bestOffer / 100))
        : product.regularPrice;

      return {
        ...product._doc,
        bestOffer,
        salePrice
      };
    });

    return res.render("shop", {
      user,
      products,
      search,
      currentPage: page,
      totalPages,
      activePage: 'shop'
    });

  } catch (error) {
    console.log('Shopping page not loading', error);
    res.status(500).send('Server Error');
  }
};




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
                        restricted: true,
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
            res.status(StatusCode.OK).json({ success: true, redirectUrl: "/" });
        } else {
            res.status(StatusCode.BAD_REQUEST).json({
                success: false,
                message: "Invalid OTP, please try again",
            });
        }
    } catch (error) {
        console.error("Error Verifying OTP", error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "An error occurred" });
    }
};

const resendOtp = async (req, res) => {
    try {
        const { email } = req.session.userData
        if (!email) {
            return res.status(StatusCode.NOT_FOUND).json({ success: false, message: "Email not found" })
        }
        const newOtp = generateOtp()
        req.session.userOtp = newOtp
        const emailSent = await sendVerificationEmail(email, newOtp)
        if (emailSent) {
            console.log("Resend OTP:", newOtp)
            res.status(StatusCode.OK).json({ success: true, message: "OTP Resend successfully" })
        } else {
            res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "failed to resend OTP .please try again" })
        }
    } catch (error) {
        console.error("Error resending OTP ", error)
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error.please try again" })
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
        res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound")
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
        res.status(StatusCode.BAD_REQUEST).render('login', { message: "login failed.Please try again later" })
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
        res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound")
    }
}
const sample = async (req, res) => {
    try {

        res.send("haaai")
    } catch (error) {
        console.log('logout error', error)
        res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound")
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