const User = require('../../models/userSchema')
const Product = require('../../models/productSchema')
const Order = require("../../models/orderSchema")
const mongoose = require('mongoose')


const loadOrder = async (req, res) => {
    try {
        let search = ""
        if (req.query.search) {
            search = req.query.search
        }

        const page = parseInt(req.query.page) || 1
        const limit = 4
        const skip = (page - 1) * limit

        const Data = await Order.find({}).populate("userId")
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit)
        console.log("data:", Data)
        const totalOrders = await Order.countDocuments()
        const totalPage = Math.ceil(totalOrders / limit)
        return res.render("orders", {
            orders: Data,
            currentPage: page,
            totalPages: totalPage,
            totalOrders: totalOrders,
            search
        })
    } catch (error) {
        console.error(error)
        res.redirect('/pageNotFound')
    }
}
const loadViewDetails = async (req, res) => {
    try {
        const orderId = req.params.id
        const order = await Order.findById(orderId)
        console.log("order:", order)
        return res.render('viewDetails', { order })
    } catch (error) {
        console.error(error)
        res.redirect('/pageNotFound')
    }
}

const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, newStatus } = req.body;

        if (!['Pending', 'Shipped', 'Out For Delivery', 'Delivered'].includes(newStatus)) {
            return res.status(400).json({ success: false, message: 'Invalid status value' });
        }

        const order = await Order.findOne({ orderId });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (newStatus === 'Delivered') {
            if (!order.orderedItems || !Array.isArray(order.orderedItems)) {
                return res.status(500).json({ success: false, message: 'Invalid order items' });
            }
            order.orderedItems.forEach((item) => {
                item.status = 'Delivered';
            });
            order.markModified('orderedItems'); // Ensure Mongoose detects array changes
        }

        order.status = newStatus;
        await order.save();

        return res.json({ success: true, message: 'Order status updated successfully' });
    } catch (error) {
        console.error('Update status error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const verifyRequest = async (req, res) => {
    try {
        const { orderId, productId, action } = req.body
        const order = await Order.findById(orderId)
        const id = new mongoose.Types.ObjectId(productId);
        const productItem = order.orderedItems.find(item => item.product.equals(id));
        if (order.orderedItems.length > 1) {
            productItem.status = action
            await order.save();
            return res.status(200).json({ success: true, message: 'Status submitted successfully' });
        }
        productItem.status = action
        order.status = action
        await order.save();
        res.status(200).json({ success: true, message: 'Status submitted successfully' });
        console.log(req.body)
    } catch (error) {
        console.log(error)
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

module.exports = {
    loadOrder,
    loadViewDetails,
    updateOrderStatus,
    verifyRequest
}