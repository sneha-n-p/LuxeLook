const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const User = require("../../models/userSchema")
const Order = require("../../models/orderSchema")
const mongoose = require('mongoose')
const Wallet = require('../../models/walletSchema')
const Sale = require('../../models/saleSchema')
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const moment = require('moment');
const StatusCode = require("../../statusCode")
const logger = require('../../helpers/logger')


const getFilteredSales = async (reportType, startDate, endDate) => {
  let filter = {};

  logger.debug(`filter`)
  if (reportType === 'custom' && startDate && endDate) {
    filter.date = {
      $gte: moment(startDate).startOf('day').toDate(),
      $lte: moment(endDate).endOf('day').toDate()
    };
  } else if (reportType === 'daily') {
    filter.date = {
      $gte: moment().startOf('day').toDate(),
      $lte: moment().endOf('day').toDate()
    };
  } else if (reportType === 'weekly') {
    filter.date = {
      $gte: moment().startOf('week').toDate(),
      $lte: moment().endOf('week').toDate()
    };
  } else if (reportType === 'monthly') {
    filter.date = {
      $gte: moment().startOf('month').toDate(),
      $lte: moment().endOf('month').toDate()
    };
  } else if (reportType === 'yearly') {
    filter.date = {
      $gte: moment().startOf('year').toDate(),
      $lte: moment().endOf('year').toDate()
    };
  }

  const sales = await Sale.find(filter).populate('orderId');

  const formatted = sales.map(sale => ({
    date: moment(sale.date).format('YYYY-MM-DD'),
    orderId: sale.orderId?._id || 'Unknown',
    amount: sale.amount,
    discount: sale.discount,
    coupon: sale.coupon || 'N/A'
  }));

  return formatted;
};

const loadSalesPage = async (req, res) => {
  try {
    const { reportType, startDate, endDate } = req.query;
    let query = { status: 'Delivered' };

    const now = new Date();
    switch (reportType) {
      case 'daily':
        query.createdOn = {
          $gte: new Date(now.setHours(0, 0, 0, 0)),
          $lte: new Date(now.setHours(23, 59, 59, 999)),
        };
        break;
      case 'weekly':
        const startOfWeek = new Date(now);

        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        query.createdOn = {
          $gte: startOfWeek,
          $lte: now,
        };
        break;
      case 'monthly':
        query.createdOn = {
          $gte: new Date(now.getFullYear(), now.getMonth(), 1),
          $lte: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
        };
        break;
      case 'yearly':
        query.createdOn = {
          $gte: new Date(now.getFullYear(), 0, 1),
          $lte: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
        };
        break;
      case 'custom':
        if (!startDate || !endDate || new Date(startDate) > new Date(endDate)) {
          return res.status(StatusCode.NOT_FOUND).render('pageError', { message: 'Invalid date range' });
        }
        query.createdOn = {
          $gte: new Date(startDate),
          $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
        };
        break;
      default:
        query.createdOn = { $exists: true };
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const totalOrders = await Order.countDocuments(query);

    const orders = await Order.find(query)
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit);

    const totalPage = Math.ceil(totalOrders / limit);
    for (let order of orders) {
      let user = await User.findById(order.userId)
      order.userName = user.name
      order.save()
    }

    const totalSales = totalOrders;
    const totalAmount = orders.reduce((sum, order) => sum + (order.finalAmount || 0), 0);
    const totalDiscount = orders.reduce((sum, order) => sum + (order.discount || 0), 0);


    const salesData = { totalSales, totalAmount, totalDiscount, orders };
    const queryParams = new URLSearchParams(req.query).toString();

    res.render('salesReport', {
      salesData,
      queryParams,
      reportType: reportType || 'daily',
      currentPage: page,
      totalPage,
    });
  } catch (error) {
    logger.error('Error loading sales page:', error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).render('pageError', { message: 'Server Error' });
  }
};

const downloadPDF = async (req, res) => {
  try {
    logger.debug('orders.length', orders)
    const { reportType, startDate, endDate } = req.query;
    let query = { status: "Delivered" };

    const now = new Date();
    switch (reportType) {
      case "daily":
        query.createdOn = {
          $gte: new Date(now.setHours(0, 0, 0, 0)),
          $lte: new Date(now.setHours(23, 59, 59, 999)),
        };
        break;
      case "weekly":
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        query.createdOn = {
          $gte: new Date(weekStart.setHours(0, 0, 0, 0)),
          $lte: new Date(now.setHours(23, 59, 59, 999)),
        };
        break;
      case "monthly":
        query.createdOn = {
          $gte: new Date(now.getFullYear(), now.getMonth(), 1),
          $lte: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
        };
        break;
      case "yearly":
        query.createdOn = {
          $gte: new Date(now.getFullYear(), 0, 1),
          $lte: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
        };
        break;
      case "custom":
        if (!startDate || !endDate || new Date(startDate) > new Date(endDate)) {
          return res.status(400).send("Invalid date range");
        }
        query.createdOn = {
          $gte: new Date(startDate),
          $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
        };
        break;
      default:
        query.createdOn = { $exists: true };
    }

    const orders = await Order.find(query).sort({ createdOn: -1 });
    let salesData = []

    for (let order of orders) {
      const user = await User.findById(order.userId)
      salesData.push({
        userName: user.name,
        totalSales: orders.length,
        totalAmount: orders.reduce((sum, o) => sum + (o.finalAmount || 0), 0),
        totalDiscount: orders.reduce((sum, o) => sum + (o.discount || 0), 0),
        orders,
      })
    }

    logger.debug('salesData:', salesData)
    const pdfBuffer = await PDFDocument(salesData);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=sales-report.pdf");
    res.send(pdfBuffer);

  } catch (err) {
    logger.error(`PDF generation error: ${err}`);
    res.status(500).send("Error generating PDF");
  }
};

const downloadExcel = async (req, res) => {
  const { reportType, startDate, endDate } = req.query;
  const orders = getFilteredSales(reportType, startDate, endDate,);

  const salesData = {
    totalSales: orders.length,
    totalAmount: orders.reduce((sum, o) => sum + o.amount, 0),
    totalDiscount: orders.reduce((sum, o) => sum + o.discount, 0),
    orders
  };

  const excelBuffer = await ExcelJS(salesData);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="sales-report.xlsx"');
  res.send(excelBuffer);
};



module.exports = {
  loadSalesPage,
  downloadPDF,
  downloadExcel
}