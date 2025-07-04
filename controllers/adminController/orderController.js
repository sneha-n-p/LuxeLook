const User = require('../../models/userSchema')
const Product = require('../../models/productSchema')
const Order = require("../../models/orderSchema")
const mongoose = require('mongoose')
const Wallet = require('../../models/walletSchema')
const StatusCode = require('../../statusCode')

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
        res.status(StatusCode.NOT_FOUND).redirect('/admin/pageError')
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
        res.status(StatusCode.NOT_FOUND).redirect('/admin/pageError')
    }
}

const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, newStatus } = req.body;
        console.log(req.body)

        if (!['Pending', 'Shipped', 'Out For Delivery', 'Delivered'].includes(newStatus)) {
            return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: 'Invalid status value' });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(StatusCode.NOT_FOUND).json({ success: false, message: 'Order not found' });
        }

        if (newStatus === 'Delivered') {
            if (!order.orderedItems || !Array.isArray(order.orderedItems)) {
                return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: 'Invalid order items' });
            }
            order.orderedItems.forEach((item) => {
                if (item.status !== 'Cancelled') {
                    item.status = 'Delivered';
                }
            });
            order.markModified('orderedItems');
        }

        order.status = newStatus;
        await order.save();

        return res.json({ success: true, message: 'Order status updated successfully' });
    } catch (error) {
        console.error('Update status error:', error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Internal server error' });
    }
};


const verifyRequest = async (req, res) => {
    try {
        const { orderId, productId, action } = req.body;
        console.log('Request received');

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(StatusCode.NOT_FOUND).json({ success: false, message: 'Order not found' });
        }

        const id = new mongoose.Types.ObjectId(productId);
        let productItem;
        let itemFound = false;

        order.orderedItems = order.orderedItems.map(item => {
            if (item.product.equals(id)) {
                item.status = action;
                productItem = item;
                itemFound = true;
            }
            return item;
        });

        if (!itemFound) {
            return res.status(StatusCode.NOT_FOUND).json({ success: false, message: 'Product not found in order' });
        }

        if (order.orderedItems.length === 1) {
            order.status = action;
        }

        if (action === 'Returned') {
            const product = await Product.findById(id)
            console.log("productItem:", productItem)
            let total = product.quatity + productItem.quantity
            product.quatity = total
            await product.save()
            const userId = order.userId;
            let wallet = await Wallet.findOne({ userId });

            const refundAmount = productItem.price * productItem.quantity;
            const transaction = {
                type: 'credit',
                amount: refundAmount,
                description: `Refund of ${orderId}`,
                date: new Date(),
                reason: 'Return'
            };

            if (!wallet) {
                wallet = new Wallet({
                    userId,
                    balance: refundAmount,
                    transactions: [transaction],
                    date: new Date(),
                });
            } else {
                wallet.balance += refundAmount;
                wallet.transactions.push(transaction);
            }

            await wallet.save();
        }

        await order.save();
        return res.status(StatusCode.OK).json({ success: true, message: `Return request ${action === 'Returned' ? 'accepted' : 'rejected'} successfully.` });
    } catch (error) {
        console.error('Return verification error:', error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    loadOrder,
    loadViewDetails,
    updateOrderStatus,
    verifyRequest
}