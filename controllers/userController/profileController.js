const User = require("../../models/userSchema")
const Address = require("../../models/addressSchema")
const Order = require("../../models/orderSchema")
const nodemailer = require("nodemailer")
const bcrypt = require("bcrypt")
const env = require("dotenv").config()
const session = require("express-session")
const path = require('path')
const fs = require('fs')
const StatusCode = require("../../statusCode")

function generateOtp() {
  console.log('otp')
  const digits = "1234567890"
  let otp = ""
  for (let i = 0; i < 6; i++) {
    otp += digits[Math.floor(Math.random() * 10)]
  }
  console.log(otp)
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
    console.log("Sending OTP to email:", otp);
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
    return passwordHash
  } catch (error) {
    console.error('hashPasswordError:', error)
  }
}

const loadForgotPassword = async (req, res) => {
  try {
    res.render("forgotPassword")
  } catch (error) {
    res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound")
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
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "Failed to send OTP,please try again" })
      }
    } else {
      res.render("forgotPassword", {
        message: "User with this email dose not exist"
      })
    }
  } catch (error) {
    res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound")
  }
}

const resendOtp = async (req, res) => {
  try {
    if (!req.session.email) {
      return res.status(StatusCode.NOT_FOUND).json({ success: false, message: "Email not found in session" })
    }
    console.log("hloooo")

    const email = req.session.email
    const newOtp = generateOtp()
    req.session.userOtp = newOtp
    console.log("newOtp:", newOtp)
    const emailSent = await sendVarificationEmail(email, newOtp)

    if (emailSent) {
      res.status(StatusCode.OK).json({ success: true, message: "OTP Resent successfully" })
    } else {
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "Failed to resend OTP. Please try again." })
    }

  } catch (error) {
    console.error("Error resending OTP ", error)
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error. Please try again." })
  }
}

const verifyOtp = async (req, res) => {
  const { otp } = req.body
  if (req.session.userOtp === otp) {
    res.status(StatusCode.OK).json({ success: true, redirectUrl: "/reset-password" })
  } else {
    return res.render('send-otp', { error: "Invalid OTP" })
  }
};

const loadResetPassword = async (req, res) => {
  try {
    res.render('reset-password', { message: "" })
  } catch (error) {
    res.status(StatusCode.NOT_FOUND).redirect('/pageNotFound')
  }
}

const confirmPassword = async (req, res) => {
  try {
    console.log(req.body)
    const { newPassword, confirmPassword } = req.body
    const email = req.session.email
    if (newPassword === confirmPassword) {
      const passwordHash = await securePassword(newPassword)
      console.log("passwordHash", passwordHash)

      await User.updateOne(
        { email: email },
        { $set: { password: passwordHash } }
      )
      res.status(StatusCode.OK).json({success:true,message :'Password Updated'})
    } else {
      res.render("reset-password", {success:false, message: ' password is not match' })
    }
  } catch (error) {
    res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound")
  }
}

const loadProfile = async (req, res) => {
  try {
    const userId = req.session.user
    const userData = await User.findById(userId).populate('availableCoupons')
    const orderData = await Order.find({ userId: userId }).sort({ createdOn: -1 }).limit(2)
    console.log('orderData:', userData)
    const addressData = await Address.findById(userId)
    res.render('profile', {
      user: userData,
      userAddress: addressData,
      latestOrders: orderData,
      activePage: 'profile',
      currentPath:'/profile'
    })
  } catch (error) {
    console.log('error:occur', error)
    res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound")
  }
}

const loadEditProfile = async (req, res) => {
  try {
    const userId = req.session.user
    const userData = await User.findById(userId)
    console.log('userId:', userId)

    res.render("edit-profile", { user: userData, activePage: 'edit-profile',currentPath:'/profile' })
  } catch (error) {
    console.log(error)
    res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound")
  }
}

const updateProfile = async (req, res) => {
  try {
    const userId = req.session.user
    const { firstName, lastName, phone, gender } = req.body

    const user = await User.findById(userId)

    user.firstName = firstName
    user.lastName = lastName
    user.phone = phone
    user.gender = gender

    if (req.body.croppedImage) {
      const base64Data = req.body.croppedImage.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const fileName = `profile_${Date.now()}.png`;
      const filePath = path.join(__dirname, '../public/uploads/profile', fileName);

      fs.writeFileSync(filePath, buffer);

      if (user.image) {
        const oldPath = path.join(__dirname, '../public', user.image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      user.image = '/uploads/profile/' + fileName;
    }
    await user.save()
    res.status(StatusCode.OK).json({ success: true })


  } catch (error) {
    console.log(error)
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: "server Error" })
  }
}

const loadChangeEmail = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      console.log("No user in session.");
      return res.redirect("/login");
    }

    const userData = await User.findById(userId);

    if (!userData) {
      console.log("No user found with ID:", userId);
      return res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound");
    }

    res.render("change-email", { user: userData, message: null, activePage: "change-email",currentPath:'/profile' });
  } catch (error) {
    console.error("Error loading change email page:", error);
    res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound");
  }
};

const changeEmailValidation = async (req, res) => {
  try {
    const { newEmail } = req.body;
    console.log(req.body);
    const userId = req.session.user;
    const userExist = await User.findById(userId);
    console.log('userExist:', userExist);

    if (userExist.email !== newEmail) {
      const otp = generateOtp();
      console.log("otp:", otp);

      const emailSent = await sendVarificationEmail(newEmail, otp);
      if (emailSent) {
        console.log('email sended')
        req.session.userOtp = otp;
        req.session.userData = req.body;
        req.session.email = newEmail;
        console.log("Email Sent:", newEmail);
        console.log("OTP:", otp);
        return res.render("change-email-otp");
      } else {
        res.status(StatusCode.OK).json("email-error");
      }
    } else {
      res.render("change-email", {
        user: userExist,
        message: "User with this email does not exist",
        activePage: "change-email",
        currentPath:'/profile'
      });
    }
  } catch (error) {
    console.error(error);
    res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound");
  }
};

// const loadEmailVerifyOtp = async (req, res) => {

//   try {
//     res.render("change-email-otp")
//   } catch (error) {
//     console.error(error)
//     res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound")
//   }
// }

const EmailVerifyOtp = async (req, res) => {
  const { otp } = req.body

  console.log("otp coming:", otp)
  console.log("req.session.userOtp:", req.session.userOtp)

  if (req.session.userOtp === otp) {
    const userId = req.session.user
    const userData = await User.findById(userId)
    const newEmail = req.session.email
    // if (userData === req.session.userData) {
    console.log('verified')
    userData.email = newEmail
    const saved = await userData.save()
    if (saved) {
      console.log('done')
      return res.json({ success: true, redirectUrl: '/profile' })
    }
    res.json({ success: true, redirectUrl: '/pageNotfound' })
    // }
  } else {
    return res.render('change-email-otp', { success: false, user: null, message: "Invalid OTP" })
  }
};

const loadResetEmail = async (req, res) => {
  try {
    res.render("reset-email")
  } catch (error) {
    console.error(error)
    res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound")
  }
}

const resetEmail = async (req, res) => {
  try {
    const { newEmail } = req.body;
    const userId = req.session.user;
    const user = await User.findById(userId);

    if (!user) return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "User not found" });

    if (newEmail === user.email) {
      return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "New email cannot be the same as the old email" });
    }


    const emailExists = await User.findOne({ email: newEmail });
    if (emailExists) {
      return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "Email is already in use" });
    }

    user.email = newEmail;
    await user.save();

    res.status(StatusCode.OK).json({ success: true });

  } catch (err) {
    console.error("Reset Email Error:", err);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal Server Error" });
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      console.log("No user in session.");
      return res.redirect("/login");
    }

    const userData = await User.findById(userId);

    if (!userData) {
      console.log("No user found with ID:", userId);
      return res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound");
    }

    res.render("change-password", { user: userData, message: null, activePage: "change-password",currentPath:'/profile' });
  } catch (error) {
    console.error("Error loading change email page:", error);
    res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound");
  }

}

const changePasswordValid = async (req, res) => {
  try {
    const { currentEmail } = req.body
    const userId = req.session.user
    const userExist = await User.findById(userId)
    console.log('userExist:', userExist)

    if (userExist.email === currentEmail) {
      const otp = generateOtp()
      const emailSent = await sendVarificationEmail(currentEmail, otp)
      if (emailSent) {

        req.session.userOtp = otp
        req.session.userDate = req.body
        req.session.email = currentEmail
        res.render("change-password-otp")
        console.log("OTP:", otp)
      } else {
        res.status(StatusCode.BAD_REQUEST).json({
          success: false,
          message: "Failed to send otp. please try again "
        })
      }
    } else {
      res.render("change-password", {
        user: userExist,
        message: "User with this email not exist",
        activePage: "change-password",
        currentPath:'/profile'
      })
    }
  } catch (error) {
    console.log("Error in cange password validation", error)
    res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound")
  }
}

const loadPasswordVerifyingOtp = async (req, res) => {
  try {
    res.render("change-password-otp")
  } catch (error) {
    console.error(error)
    res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound")
  }
}


const PasswordVerifyingOtp = async (req, res) => {
  const { otp } = req.body
  console.log("otp coming:", otp)
  console.log("req.session.userOtp:", req.session.userOtp)

  if (req.session.userOtp === otp) {
    res.status(StatusCode.OK).json({ success: true, redirectUrl: "/profile/reset-password" })
  } else {
    return res.status(StatusCode.BAD_REQUEST).json({ success: false, user: null, message: "Invalid OTP" })
  }
}


const loadresetPassword = async (req, res) => {
  try {
    res.render("profile-resetPassword", { message: null, activePage: "profile-resetPassword",currentPath:'/profile' })
  } catch (error) {
    console.error(error)
    res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound")
  }
}

const resetPassword = async (req, res) => {
  try {
    console.log(req.body)
    const { newPassword, confirmPassword } = req.body
    const userId = req.session.user
    const userData = await User.findById(userId)
    if (!userData) {
      return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "User not found" })
    } else {
      const isSame = await bcrypt.compare(newPassword, userData.password);
      if (isSame) {
        return res.status(StatusCode.BAD_REQUEST).json({
          success: false,
          message: "New Password cannot be the same as the old Password"
        });
      }
    }
    if (newPassword === confirmPassword) {
      const passwordHash = await securePassword(newPassword)
      console.log("passwordHash", passwordHash)
      await User.updateOne(
        { _id: userId },
        { $set: { password: passwordHash } }
      )
      res.status(StatusCode.OK).json({ success: true });

    } else {
      res.status(StatusCode.BAD_REQUEST).json({ success: false, message: 'Passwords do not match' });
    }

  } catch (error) {
    console.log('resetPassword', error)
    res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound")
  }
}

const addProfile = async (req, res) => {
  try {
    const userId = req.params.id
    const imagePath = `/uploads/${req.file.filename}`

    await User.findByIdAndUpdate(userId, { image: imagePath })

    res.status(StatusCode.OK).json({ success: true, imagePath })
  } catch (error) {
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Error uploading image' })
  }
}

module.exports = {
  loadForgotPassword,
  forgotEmailValid,
  resendOtp,
  verifyOtp,
  loadResetPassword,
  confirmPassword,
  loadProfile,
  loadEditProfile,
  updateProfile,
  loadChangeEmail,
  changeEmailValidation,
  // loadEmailVerifyOtp,
  EmailVerifyOtp,
  loadResetEmail,
  resetEmail,
  changePassword,
  changePasswordValid,
  loadPasswordVerifyingOtp,
  PasswordVerifyingOtp,
  loadresetPassword,
  resetPassword,
  addProfile,
  
}