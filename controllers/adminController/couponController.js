const User = require('../../models/userSchema')
const Product = require('../../models/productSchema')
const Order = require("../../models/orderSchema")
const mongoose = require('mongoose')
const Coupon = require('../../models/couponSchema')
const Wallet = require('../../models/walletSchema')
const moment = require('moment')
const StatusCode = require('../../statusCode')
const logger = require('../../helpers/logger')


const loadCoupon = async (req, res) => {
  try {
    let search = ""
    if (req.query.search) {
      search = req.query.search
    }

    const page = parseInt(req.query.page) || 1
    const limit = 4
    const skip = (page - 1) * limit

    const findCoupons = await Coupon.find({})
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit)

    const totalCoupons = await Coupon.countDocuments()
    const totalPages = Math.ceil(totalCoupons / limit)
    res.render('coupons', {
      coupons: findCoupons,
      totalPages,
      currentPage: page,
      search
    })
  } catch (error) {
    logger.error( `coupon pageee:${error}`)
    res.status(StatusCode.NOT_FOUND).redirect('/admin/pageError')
  }
}

const createCoupon = async (req, res) => {
  try {
    const { couponName, startDate, endDate, offerPrice, minimumPrice } = req.body;

    const existingCoupon = await Coupon.findOne({
      name: { $regex: new RegExp(`^${couponName}$`, 'i') }
    });

    if (existingCoupon) {
      return res.json({
        success: false,
        message: 'Coupon name already exists. Please use a different name.'
      });
    }

    const newCoupon = new Coupon({
      name: couponName.trim(),
      createdOn: new Date(startDate + 'T00:00:00'),
      expiredOn: new Date(endDate + 'T00:00:00'),
      offerPrice: parseInt(offerPrice),
      minimumPrice: parseInt(minimumPrice)
    });

    await newCoupon.save();

    return res.json({
      success: true,
      message: 'Coupon created successfully.'
    });

  } catch (error) {
    logger.error(`Error creating coupon: ${error}`);
    res.status(500).json({
      success: false,
      message: 'An error occurred while creating the coupon.'
    });
  }
};


const loadEditCoupon = async (req, res) => {
  try {
    const id = req.params.id;
    const findCoupon = await Coupon.findById(id);
    if (!findCoupon) {
      return res.status(StatusCode.NOT_FOUND).redirect("/admin/pageerror");
    }

    const formattedCouponData = {
      ...findCoupon._doc,
      createdOn: findCoupon.createdOn ? moment(findCoupon.createdOn).format('YYYY-MM-DD') : '',
      expiredOn: findCoupon.expiredOn ? moment(findCoupon.expiredOn).format('YYYY-MM-DD') : ''
    };
    res.render("edit-coupon", {
      findCoupon: formattedCouponData,
    });
  } catch (error) {
    logger.error( `edit coupon error:${error}`);
    res.status(StatusCode.NOT_FOUND).redirect("/admin/pageerror");
  }
};

const updateCoupon = async (req, res) => {
  try {
    const { couponId, couponName, startDate, endDate, offerPrice, minimumPrice } = req.body;
    const objectId = new mongoose.Types.ObjectId(couponId);
    const selectedCoupon = await Coupon.findById(objectId);

    if (!selectedCoupon) {
      return res.status(StatusCode.NOT_FOUND).send("Coupon not found");
    }

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    

    const updatedCoupon = await Coupon.updateOne(
      { _id: objectId },
      {
        $set: {
          name: couponName,
          createdOn: startDateObj,
          expiredOn: endDateObj,
          offerPrice: parseInt(offerPrice),
          minimumPrice: parseInt(minimumPrice)
        }
      }
    );

    if (updatedCoupon.modifiedCount > 0) {
      res.send("Coupon updated successfully");
    } else {
      res.status(StatusCode.INTERNAL_SERVER_ERROR).send("Coupon update failed");
    }
  } catch (error) {
    logger.error( `Update coupon error: ${error}`);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).send("Server error");
  }
};

const listCoupon = async (req, res) => {
  try {
    let id = req.body.id
    const mongooseId = new mongoose.Types.ObjectId(id)
    const update = await Coupon.updateOne({ _id: mongooseId }, { $set: { islist: "true" } })
    if (update) {

      res.json({ success: true })
    } else {
      logger.error(error)
    }
  } catch (error) {
    logger.error(error)
    res.status(StatusCode.NOT_FOUND).redirect("/admin/pageError")
  }
}

const unlistCoupon = async (req, res) => {
  try {
    let id = req.body.id
    const mongooseId = new mongoose.Types.ObjectId(id)
    const update = await Coupon.updateOne({ _id: mongooseId }, { $set: { islist: "false" } })
    if (update) {
      if (req.session.coupon === id) {
        req.session.coupon = false
      }
      res.status(StatusCode.OK).json({ success: true })
    }
    else {
      logger.error(error)
    }
  } catch (error) {
    logger.error(error)
    res.status(StatusCode.NOT_FOUND).redirect("/admin/pageError")
  }
}

module.exports = {
  loadCoupon,
  createCoupon,
  loadEditCoupon,
  updateCoupon,
  listCoupon,
  unlistCoupon
}