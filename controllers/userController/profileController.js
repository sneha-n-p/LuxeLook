const User = require("../../models/userSchema")
const nodemailer = require("nodemailer")
const bcrypt = require("bcrypt")
const env = require("dotenv").config()
const session = require("express-session")



function generateOtp() {
  const digits = "1234567890"
  let otp = ""
  for (let i = 0; i < 6; i++) {
    otp += digits[Math.floor(Math.random() * 10)]
  }
  return otp
}





const sendVarificationEmail = async (email, otp) => {
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
    });

    const mailOptions = {
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "OTP for reset your password",
      text: `Your OTP is ${otp}`,
      html: `<b><h4>Your OTP: ${otp}</h4></b>`
    };

    const info = await transporter.sendMail(mailOptions);
    return true;

  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
};

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10)
    console.log()
    return passwordHash
  } catch (error) {
    console.error('hashPasswordError:', error)
  }
}




const loadForgotPassword = async (req, res) => {
  try {
    res.render("forgotPassword")
  } catch (error) {
    res.redirect("/pageNotFound")
  }
}


const forgotEmailValid = async (req, res) => {
  try {
    const { email } = req.body
    const findUser = await User.findOne({ email })
    if (findUser) {
      const otp = generateOtp()
      console.log('otp:', otp)
      const emailSent = await sendVarificationEmail(email)
      if (emailSent) {
        req.session.userOtp = otp
        req.session.email = email
        res.render('sent-otp')
      } else {
        res.json({ success: false, message: "FAiled to send OTP,please try again" })
      }
    } else {
      res.render("forgotPassword", {
        message: "User with this email dose not exist"
      })
    }
  } catch (error) {
    res.redirect("/pageNotFound")
  }
}


const resendOtp = async (req, res) => {
  try {
    if (!req.session.email) {
      return res.status(400).json({ success: false, message: "Email not found in session" })
    }

    const email = req.session.email
    const newOtp = generateOtp()
    req.session.userOtp = newOtp
    console.log("newOtp:", newOtp)
    const emailSent = await sendVarificationEmail(email, newOtp)

    if (emailSent) {
      res.status(200).json({ success: true, message: "OTP Resent successfully" })
    } else {
      res.status(500).json({ success: false, message: "Failed to resend OTP. Please try again." })
    }

  } catch (error) {
    console.error("Error resending OTP ", error)
    res.status(500).json({ success: false, message: "Internal server error. Please try again." })
  }
}



const verifyOtp = async (req, res) => {
  const { otp } = req.body

  console.log("otp coming:", otp)
  console.log("req.session.userOtp:", req.session.userOtp)

  if (req.session.userOtp === otp) {
    res.json({ success: true, redirectUrl: "/reset-password" })
  } else {
    return res.render('send-otp', { error: "Invalid OTP" })
  }
};

const loadResetPassword = async (req, res) => {
  try {
    res.render('reset-password',{message:""})
  } catch (error) {
    res.redirect('/pageNotFound')
  }
}


const confirmPassword = async (req, res) => {
  try {
    console.log(req.body)
    const { newPassword, confirmPassword } = req.body
    const email = req.session.email
    if (newPassword === confirmPassword) {
      const passwordHash = await securePassword(newPassword)
      console.log("passwordHash",passwordHash)
      await User.updateOne(
        { email: email },
        { $set: { password: passwordHash } }
      )
      res.redirect("/login")
    } else {
      res.render("reset-password", {message: ' password is not match'})
    }

  } catch (error) {
    res.redirect("/pageNotFound")
  }
}


module.exports = {
  loadForgotPassword,
  forgotEmailValid,
  resendOtp,
  verifyOtp,
  loadResetPassword,
  confirmPassword

}