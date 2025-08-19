const Address = require("../../models/addressSchema")
const User = require("../../models/userSchema")
const env = require("dotenv").config()
const mongoose = require('mongoose');
const StatusCode = require("../../statusCode");

const loadAddress = async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1;
        const limit = 3;
        const skip = (page - 1) * limit;

        const userId = req.session.user;
        const userData = await User.findById(userId);

        const addressData = await Address.findOne({ userId: userId });

        let addresses = [];
        let totalAddresses = 0;

        if (addressData) {
            addresses = addressData.address.slice(skip, skip + limit)
            totalAddresses = addressData.address.length;
        }

        const totalPages = Math.ceil(totalAddresses / limit);

        res.render("address", {
            user: userData,
            addresses,
            currentPage: page,
            totalPages,
            activePage: 'address',
            currentPath:'/addresses'
        });

    } catch (error) {
        console.error(error);
        res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound");
    }
};

const loadAddAddress = async (req, res) => {
    try {
        const user = req.session.user
        res.render("add-address", { user: user, activePage: 'add-address',currentPath:'/addresses' })
    } catch (error) {
        console.error(error)
        res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound")
    }
}

const AddAddress = async (req, res) => {
    try {
        const userId = req.session.user
        const userData = await User.findById(userId)
        const { addressType, name, state, streetAddress, apartment, city, pincode, phone, altPhone, isDefault } = req.body
        const userAddress = await Address.findOne({ userId: userData._id })
        console.log(req.body)
        if (!userAddress) {
            const NewAddress = new Address({
                userId: userData._id,
                address: [{ addressType, name, streetAddress, apartment, city, state, pincode, phone, altPhone, isDefault }]
            })
            await NewAddress.save()
        } else {
            if (isDefault == true) {
                for (let address of userAddress.address) {
                    address.isDefault = false
                }
            }
            userAddress.address.push({ addressType, name, streetAddress, apartment, city, state, pincode, phone, altPhone, isDefault })
            await userAddress.save()
        }
        res.redirect("/addresses")
    } catch (error) {
        console.error(error)

        res.status(StatusCode.NOT_FOUND).redirect('/pageNotFound')
    }
}

const loadEditAddress = async (req, res) => {
    try {
        const id = req.params.id
        const userId = req.session.user
        const userData = await User.findById(userId)
        const addressData = await Address.findOne({ userId: userId })
        const addressId = new mongoose.Types.ObjectId(id)
        for (let add of addressData.address) {
            if (add._id.equals(addressId)) {
                res.render("edit-Address", { user: userData, address: add, activePage: " edit-addresses",currentPath:'/addresses' })
            }
        }
        console.log(addressId)

    } catch (error) {
        console.error(error)
        res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound")

    }
}

const editAddress = async (req, res) => {
    try {
        const { addressId, addressType, name, state, streetAddress, apartment, city, pincode, phone, altPhone } = req.body;
        const userId = req.session.user;
        console.log(req.body)
        const done = await Address.updateOne(
            { "userId": userId, "address._id": addressId },
            {
                $set: {
                    "address.$.name": name,
                    "address.$.streetAddress": streetAddress,
                    "address.$.apartment": apartment,
                    "address.$.city": city,
                    "address.$.state": state,
                    "address.$.pincode": pincode,
                    "address.$.phone": phone,
                    "address.$.altPhone": altPhone,
                    "address.$.addressType": addressType
                }
            }
        );
        if (done) {
            return res.status(StatusCode.OK).json({ success: true });
        }
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: 'server errorrrrrrrrr' });

    } catch (error) {
        console.error(error)
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "Server Error" });
    }
}

const deleteAddress = async (req, res) => {
    try {
        const userId = req.session.user
        const { addressId } = req.body

        const userAddress = await Address.findOne({ userId: userId })
        if (userAddress) {
            userAddress.address = userAddress.address.filter(item => item._id.toString() !== addressId)
            await userAddress.save()
        }
        return res.status(StatusCode.OK).json({ success: true });

    } catch (error) {
        console.error(error)
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "Server Error" })
    }
}

const loadcartAddAddress = async (req, res) => {
    try {
        const user = req.session.user
        res.render("cartAdd-address", { user: user, activePage: 'cartAdd-address',currentPath:'/addresses' })
    } catch (error) {
        console.error(error)
        res.status(StatusCode.NOT_FOUND).redirect("/pageNotFound")
    }
}

const cartAddAddress = async (req, res) => {
    try {
        const userId = req.session.user
        const userData = await User.findById(userId)
        const { addressType, name, state, streetAddress, apartment, city, pincode, phone, altPhone, isDefault } = req.body
        const userAddress = await Address.findOne({ userId: userData._id })
        console.log(req.body)
        if (!userAddress) {
            const NewAddress = new Address({
                userId: userData._id,
                address: [{ addressType, name, streetAddress, apartment, city, state, pincode, phone, altPhone, isDefault }]
            })
            await NewAddress.save()
        } else {
            if (isDefault == true) {
                for (let address of userAddress.address) {
                    address.isDefault = false
                }
            }
            userAddress.address.push({ addressType, name, streetAddress, apartment, city, state, pincode, phone, altPhone, isDefault })
            await userAddress.save()
        }
        res.redirect("/checkout")
    } catch (error) {
        console.error(error)

        res.status(StatusCode.NOT_FOUND).redirect('/pageNotFound')
    }
}

module.exports = {
    loadAddress,
    loadAddAddress,
    AddAddress,
    editAddress,
    loadEditAddress,
    deleteAddress,
    loadcartAddAddress,
    cartAddAddress
}