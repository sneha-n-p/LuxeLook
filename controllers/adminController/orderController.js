
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Order = require("../../models/orderSchema");
const mongoose = require('mongoose');
const Wallet = require('../../models/walletSchema');
const StatusCode = require('../../statusCode');
const logger = require('../../helpers/logger')

const loadOrder = async (req, res) => {
    try {
        let search = "";
        if (req.query.search) {
            search = req.query.search;
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;

        const Data = await Order.find({})
            .populate("userId")
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit);
        const totalOrders = await Order.countDocuments();
        const totalPage = Math.ceil(totalOrders / limit);
        return res.render("orders", {
            orders: Data,
            currentPage: page,
            totalPages: totalPage,
            totalOrders: totalOrders,
            search
        });
    } catch (error) {
        logger.error(error);
        res.status(StatusCode.NOT_FOUND).redirect('/admin/pageError');
    }
};

const loadViewDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findById(orderId);
        return res.render('viewDetails', { order });
    } catch (error) {
        logger.error(error);
        res.status(StatusCode.NOT_FOUND).redirect('/admin/pageError');
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, newStatus } = req.body;

        const validStatuses = ['Pending', 'Shipped', 'Out For Delivery', 'Delivered'];

        if (!validStatuses.includes(newStatus)) {
            return res
                .status(StatusCode.BAD_REQUEST)
                .json({ success: false, message: 'Invalid status value' });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res
                .status(StatusCode.NOT_FOUND)
                .json({ success: false, message: 'Order not found' });
        }

        const currentIndex = validStatuses.indexOf(order.status);
        const newIndex = validStatuses.indexOf(newStatus);

        if (newIndex < currentIndex) {
            return res.status(StatusCode.BAD_REQUEST).json({
                success: false,
                message: 'Cannot revert to a previous status',
            });
        }

        if (newIndex > currentIndex + 1) {
            return res.status(StatusCode.BAD_REQUEST).json({
                success: false,
                message: 'Cannot skip to a later status directly',
            });
        }

        if (newStatus === 'Delivered') {
            if (!Array.isArray(order.orderedItems)) {
                return res
                    .status(StatusCode.BAD_REQUEST)
                    .json({ success: false, message: 'Invalid order items' });
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

        return res.json({
            success: true,
            message: 'Order status updated successfully',
        });
    } catch (error) {
        logger.error(`Update status error: ${error}`);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Internal server error',
        });
    }
};

const verifyRequest = async (req, res) => {
    try {
        const { orderId, action } = req.body;
        const order = await Order.findById(orderId).populate('orderedItems.product');
        if (!order) {
            return res.status(StatusCode.NOT_FOUND).json({ success: false, message: 'Order not found' });
        }

        if (!['Returned', 'Delivered'].includes(action)) {
            return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: 'Invalid action' });
        }
        logger.debug(`order:${order}`)

        order.orderedItems.forEach(item => {
            if (item.status !== 'Cancelled') {
                item.status = action;
                order.status = action

            }
        });

        if (action === 'Returned') {
            let totalRefund = 0;
            for (const item of order.orderedItems) {
                if (item.status === 'Returned') {
                    const product = await Product.findById(item.product);
                    if (product) {
                        const variant = product.variant.find(v => v.size === item.size);
                        if (variant) {
                            variant.quantity += item.quantity
                            product.quatity += item.quantity
                            await product.save();
                        }
                        if (item.status === 'Return Request') {
                            totalRefund += item.price
                        }
                    }
                }
            }

            const userId = order.userId;
            let wallet = await Wallet.findOne({ userId });

            const transaction = {
                type: 'credit',
                amount: order.finalAmount,
                description: `Refund for return of order ${order.orderId}`,
                date: new Date(),
                reason: 'Return'
            };

            if (!wallet) {
                wallet = new Wallet({
                    userId,
                    balance: order.finalAmount,
                    transactions: [transaction],
                    date: new Date(),
                });
            } else {
                wallet.balance += order.finalAmount;
                wallet.transactions.push(transaction);
            }

            await wallet.save();
        }

        order.status = action;
        await order.save();
        return res.status(StatusCode.OK).json({ success: true, message: `Return request ${action === 'Returned' ? 'accepted' : 'rejected'} successfully.` });
    } catch (error) {
        logger.error(`Return verification error: ${error}`);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Internal server error' });
    }
};

const verifySingleRequest = async (req, res) => {
    try {
        const { orderId, productId, action, size } = req.body
        const order = await Order.findById(orderId)
        const product = await Product.findById(productId)
        let itemTotal = 0
        let refundAmount = 0;

        order.orderedItems.forEach(items => {
            if (items.product.toString() === productId) {
                if (action === 'Delivered') {
                    if (items.status === 'Return Request') {
                        items.status = action
                        delete items.returnReason
                    }
                    order.status = action
                } else {
                    items.status = action
                    refundAmount = items.price
                    product.variant.forEach(item => {
                        if (item.size === items.size) {
                            item.quantity += items.quantity
                            product.quatity += items.quantity
                            itemTotal = items.quantity * items.price
                        }
                    })
                }
            }
        })
        if (action === 'Returned' && order.discount > 0) {
            const originalTotal = order.orderedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const discountAmount = order.discount
            const itemDiscountShare = (itemTotal / originalTotal) * discountAmount;
            refundAmount = itemTotal - itemDiscountShare;
            logger.debug('discountAmount:', order)
        }

        let wallet = await Wallet.findOne({ userId: order.userId })
        if (wallet) {
            wallet.balance += refundAmount
            const transaction = {
                amount: refundAmount,
                type: 'credit',
                description: `Refound amount of order ${order.orderId}`,
                reason: 'Return'
            }
            wallet.transactions.push(transaction)
        } else {
            const transaction = {
                amount: refundAmount,
                type: 'credit',
                description: `Refound amount of order ${order.orderId}`,
                reason: 'Return'
            }
            wallet = new Wallet({
                userId: order.userId,
                balance: refundAmount,
                transactions: [transaction],
                date: new Date()
            })
        }
        const activeProducts = order.orderedItems.filter(item => item.status !== 'Returned' && item.status !== 'Cancelled')
        if (activeProducts.length === 0) order.status = 'Returned'
        await wallet.save()
        await product.save()
        await order.save()
        return res.status(StatusCode.OK).json({ success: true })

    } catch (error) {
        logger.error(`error in return single product: ${error}`)
    }
}

module.exports = {
    loadOrder,
    loadViewDetails,
    updateOrderStatus,
    verifyRequest,
    verifySingleRequest
};