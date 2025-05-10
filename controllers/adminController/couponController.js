const User = require('../../models/userSchema')
const Product = require('../../models/productSchema')
const Order = require("../../models/orderSchema")
const mongoose = require('mongoose')
const Coupon = require('../../models/couponSchema')
const Wallet = require('../../models/walletSchema')
const moment = require('moment')


const loadCoupon = async(req,res)=>{
    try {
        const findCoupons = await Coupon.find({})
        res.render('coupons',{coupons :findCoupons})
    } catch (error) {
        console.error('coupon pageee:',error)
        res.redirect('/pageError')
    }
}

const createCoupon = async(req,res)=>{
    try {
        const data = {
            couponName : req.body.couponName,
            startDate : new Date(req.body.startDate+'T00:00:00'),
            endDate : new Date(req.body.endDate+"T00:00:00"),
            offerPrice:parseInt(req.body.offerPrice),
            minimumPrice:parseInt(req.body.minimumPrice)
        }
        console.log(data.startDate)
        const newCoupon = new Coupon({
            name:data.couponName,
            createdOn:data.startDate,
            expiredOn:data.endDate,
            offerPrice:data.offerPrice,
            minimumPrice:data.minimumPrice
        })
        await newCoupon.save()
        return res.redirect("/admin/coupons")
    } catch (error) {
        console.error('coupon pageee:',error)
        res.redirect("/pageError")
    }
}

const loadEditCoupon = async (req, res) => {
  try {
    const id = req.params.id;
    const findCoupon = await Coupon.findById(id);
    if (!findCoupon) {
      return res.redirect("/admin/pageerror");
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
    console.log("edit coupon error:", error);
    res.redirect("/admin/pageerror");
  }
};

const updateCoupon = async (req, res) => {
  try {
    const { couponId, couponName, startDate, endDate, offerPrice, minimumPrice } = req.body;
    const objectId = new mongoose.Types.ObjectId(couponId);
    const selectedCoupon = await Coupon.findById(objectId);
    
    if (!selectedCoupon) {
      return res.status(404).send("Coupon not found");
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
      res.status(500).send("Coupon update failed");
    }
  } catch (error) {
    console.error("Update coupon error:", error);
    res.status(500).send("Server error");
  }
};

const listCategory = async(req,res)=>{
try {
        let id = req.body.id
        const mongooseId = new mongoose.Types.ObjectId(id)
        const update = await Coupon.updateOne({ _id: mongooseId }, { $set: { islist:"true" } })
        if (update) {

            res.json({ success: true })
        } else {
            console.error(error)
        }
    } catch (error) {
        console.error(error)
        res.redirect("/pageError")
    }
}

const unlistCategory = async(req,res)=>{
 try {
        let id = req.body.id
        const mongooseId = new mongoose.Types.ObjectId(id)
        console.log(mongooseId)
        const update = await Coupon.updateOne({ _id: mongooseId }, { $set: { islist:"false" } })
        if (update) {
            if (req.session.coupon === id) {
                req.session.coupon = false
            }
            res.json({ success: true })
        }
        else {
            console.error(error)
        }
    } catch (error) {
        console.error(error)
        res.redirect("/pageError")
    }
}


module.exports = {
    loadCoupon,
    createCoupon,
    loadEditCoupon,
    updateCoupon,
    listCategory,
    unlistCategory
}