const User = require('../../models/userSchema')
const Product = require('../../models/productSchema')
const Address = require('../../models/addressSchema')
const Order = require('../../models/orderSchema')
const StatusCode = require('../../statusCode')
const logger = require('../../helpers/logger')


const loadDashboard = async (req, res) => {
    try {
        if (req.session.admin) {
            const totalOrders = await Order.countDocuments();
            const totalProduct = await Product.countDocuments()
            const totalCustomers = await User.countDocuments({ isAdmin: false });
            const totalSalesAgg = await Order.aggregate([
                { $match: { status: "Delivered" } },
                { $group: { _id: null, total: { $sum: "$finalAmount" } } },
            ]);
            const totalSales = totalSalesAgg.length > 0 ? totalSalesAgg[0].total : 0;

            const orders = await Order.find({ status: "Delivered" });
            const recentOrders = await Order.find({}).sort({ createdOn: -1 }).limit(4).populate('userId')
            let productMap = {};

            orders.forEach((order) => {
                order.orderedItems.forEach((item) => {
                    if (item.status === "Delivered") {
                        productMap[item.product] =
                            (productMap[item.product] || 0) + item.quantity;
                    }
                });
            });


            const sortedProducts = Object.entries(productMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);


            const topProducts = await Promise.all(
                sortedProducts.map(async ([productId, soldCount]) => {
                    const product = await Product.findById(productId)
                        .populate('category')
                        .lean();

                    return {
                        productImage: product?.productImage[0] || 'Unknown',
                        Product: product?.productName || 'Unknown',
                        category: product?.category?.name || 'Unknown',
                        price: product?.regularPrice || 0,
                        soldCount,
                    };
                })
            );

            const salesByMonth = await Order.aggregate([
                { $match: { status: "Delivered" } },
                {
                    $group: {
                        _id: { $month: "$createdAt" },
                        total: { $sum: "$finalAmount" },
                    },
                },
                { $sort: { "_id": 1 } },
            ]);

            const monthNames = [
                "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
            ];
            const chartLabels = salesByMonth.map((s) => monthNames[s._id - 1]);
            const chartData = salesByMonth.map((s) => s.total);

            const salesData = await getSalesDataHelper("monthly")
            logger.debug('salesData:',salesData)
            const orderStatusCounts = await getOrderStatusCounts()

            res.render("dashboard", {
                totalSales,
                totalOrders,
                totalProduct,
                totalCustomers,
                topProducts,
                chartLabels,
                chartData,
                recentOrders,
                salesData: salesData.data,
                salesLabels: salesData.labels,
                orderStatusData: Object.values(orderStatusCounts),
                orderStatusLabels: Object.keys(orderStatusCounts),
            });
        }
    } catch (error) {
        logger.error(`Dashboard error: ${error}`);
        res.status(500).redirect("/admin/pageError");
    }
};

const getSalesData = async (req, res) => {
    try {
        const { period = "monthly" } = req.query

        const salesData = await getSalesDataHelper(period)
        res.status(StatusCode.OK).json(salesData)
    } catch (error) {
        logger.error( `Error in getSalesData API: ${error}`)
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" })
    }
}


const getSalesDataHelper = async (period = "yearly") => {
    try {
        const now = new Date()
        const labels = []
        const data = []

        if (period === "weekly") {

            for (let i = 6; i >= 0; i--) {
                const date = new Date(now)
                date.setDate(date.getDate() - i)

                const dayStart = new Date(date.setHours(0, 0, 0, 0))
                const dayEnd = new Date(date.setHours(23, 59, 59, 999))

                const dayOrders = await Order.find({
                    createdOn: { $gte: dayStart, $lte: dayEnd },
                    status: "Delivered",
                })

                const daySales = dayOrders.reduce((total, order) => total + order.finalAmount, 0)

                labels.push(date.toLocaleDateString("en-US", { weekday: "short" }))
                data.push(daySales)
            }
        } else if (period === "monthly") {

            for (let i = 5; i >= 0; i--) {
                const date = new Date(now)
                date.setMonth(date.getMonth() - i)

                const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
                const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)

                const monthOrders = await Order.find({
                    createdOn: { $gte: monthStart, $lte: monthEnd },
                    status: "Delivered",
                })

                const monthSales = monthOrders.reduce((total, order) => total + order.finalAmount, 0)

                labels.push(date.toLocaleDateString("en-US", { month: "short" }))
                data.push(monthSales)
            }
        } else if (period === "yearly") {

            for (let i = 4; i >= 0; i--) {
                const year = now.getFullYear() - i

                const yearStart = new Date(year, 0, 1)
                const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999)

                const yearOrders = await Order.find({
                    createdOn: { $gte: yearStart, $lte: yearEnd },
                    status: "Delivered",
                })

                const yearSales = yearOrders.reduce((total, order) => total + order.finalAmount, 0)

                labels.push(year.toString())
                data.push(yearSales)
            }
        }

        return { labels, data }
    } catch (error) {
        logger.error( `Error getting sales data: ${error}`)
        return { labels: [], data: [] }
    }
}


const getOrderStatusCounts = async () => {
    try {
        const statusCounts = {
            Delivered: 0,
            Pending: 0,
            Shipped: 0,
            Cancelled: 0,
            Returned: 0,
        }

        const orders = await Order.find()

        orders.forEach((order) => {
            if (order.status === "Delivered") statusCounts["Delivered"]++
            else if (order.status === "Pending") statusCounts["Pending"]++
            else if (order.status === "Shipped") statusCounts["Shipped"]++
            else if (order.status === "Cancelled") statusCounts["Cancelled"]++
            else if (order.status.includes("Return")) statusCounts["Returned"]++
        })

        return statusCounts
    } catch (error) {
        logger.error(`Error getting order status counts: ${error}`)
        return { Delivered: 0, Pending: 0, Shipped: 0, Cancelled: 0, Returned: 0 }
    }
}


const getTopSelling = async (req, res) => {
    try {
        const { type } = req.query
        logger.debug('type:',type)

        let topCategories
        let topProducts

        if (type === 'categories') {
            const Orders = await Order.find()
                .populate({
                    path: "orderedItems.product",
                    populate: { path: "category", select: "name" }
                });

            let categoryMap = {};

            Orders.forEach((order) => {
                order.orderedItems.forEach((item) => {
                    if (item.status === "Delivered" && item.product?.category) {
                        const categoryName = item.product.category.name;

                        if (!categoryMap[categoryName]) {
                            categoryMap[categoryName] = {
                                category: categoryName,
                                soldCount: 0,
                                totalSales: 0,
                                productSet: new Set(),
                            };
                        }

                        categoryMap[categoryName].soldCount += item.quantity;
                        categoryMap[categoryName].totalSales += item.price * item.quantity;
                        categoryMap[categoryName].productSet.add(item.product._id.toString());
                    }
                });
            });

            topCategories = Object.values(categoryMap).map(cat => ({
                category: cat.category,
                soldCount: cat.soldCount,
                totalSales: cat.totalSales,
                productCount: cat.productSet.size,
            }));

            topCategories = topCategories
                .sort((a, b) => b.soldCount - a.soldCount)
                .slice(0, 5);

            logger.debug('topCategories:',topCategories);
        } else {
            let productMap = {};
            const orders = await Order.find({ status: "Delivered" });

            orders.forEach((order) => {
                order.orderedItems.forEach((item) => {
                    if (item.status === "Delivered") {
                        productMap[item.product] =
                            (productMap[item.product] || 0) + item.quantity;
                    }
                });
            });


            const sortedProducts = Object.entries(productMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);


            topProducts = await Promise.all(
                sortedProducts.map(async ([productId, soldCount]) => {
                    const product = await Product.findById(productId)
                        .populate('category')
                        .lean();

                    return {
                        productImage: product?.productImage[0] || 'Unknown',
                        Product: product?.productName || 'Unknown',
                        category: product?.category?.name || 'Unknown',
                        price: product?.regularPrice || 0,
                        soldCount,
                    };
                })
            );

        }
        return res.status(StatusCode.OK).json({ success: true, topProducts, topCategories })


    } catch (error) {
        logger.error( `error in topselling datas fetching in admin: ${error}`)
    }
}



module.exports = {
    loadDashboard,
    getSalesDataHelper,
    getOrderStatusCounts,
    getSalesData,
    getTopSelling
}