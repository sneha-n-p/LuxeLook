const User = require("../../models/userSchema")
const Cart = require("../../models/cartSchema")
const Product = require("../../models/productSchema")
const Order = require("../../models/orderSchema")
const Address = require("../../models/addressSchema")
const mongoose = require('mongoose')



const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { addressId, paymentMethod, Total } = req.body;
        console.log(req.body);

        const addresss = await Address.findOne(
            { userId: userId, "address._id": addressId },
            { "address.$": 1 }
        );

        const addressData = addresss && addresss.address.length > 0 ? addresss.address[0] : null;
        console.log('addressData:', addressData);

        const cart = await Cart.findOne({ userId }).populate('items.productId');

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ message: 'Cart is empty.' });
        }

        const orderedItems = cart.items.map(item => ({
            product: item.productId._id,
            quantity: item.quantity,
            price: item.productId.salePrice,
            productName:item.productId.productName,
            productImage:item.productId.productImage[0]
        }));

        const totalPrice = orderedItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);

        const newOrder = new Order({
            orderedItems: orderedItems,
            userId:userId,
            totalPrice: totalPrice,
            discount: 0,
            finalAmount: totalPrice,
            address: [{
              addressType: addressData.addressType,
              name: addressData.name,
              city: addressData.city,
              streetAddress: addressData.streetAddress,
              apartment: addressData.apartment,
              state: addressData.state,
              pincode: addressData.pincode,
              phone: addressData.phone,
              altPhone: addressData.altPhone
          }],
            status: 'Pending',
            couponApplied: false
        });
        

        await newOrder.save();

        for (const item of orderedItems) {
            await Product.findByIdAndUpdate(item.product, {
                $inc: { quatity: -item.quantity }  
            });
        }

        await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

        res.redirect("/orderSuccess")

    } catch (error) {
        console.error('Error placing order:', error.message);
        res.status(500).json({ message: 'Something went wrong' });
    }
};



const loadOrderSuccess = async (req, res) => {
    try {
        const userId = req.session.user
        const user = await User.findById(userId)
        const cartData = await Cart.findOne({ userId: userId })
        const address = await Address.findOne({ userId: userId })
        res.render('orderSuccess')
    } catch (error) {
        console.error(error)
        res.redirect('/pageNotFound')
    }


}

const loadOrders = async(req,res)=>{
    try {
      let search = ""
      if (req.query.search) {
          search = req.query.search
      }
      let page = 1
      if (req.query.page) {
          page = req.query.page
      }
      const limit = 5
      const productData = await Product.find({
          isBlocked: false,
          $or: [
              { productName: { $regex: ".*" + search + ".*",$options: "i" } }
          ],
      })
          .limit(limit * 1)
          .skip((page - 1) * limit)
          .exec()

      const count = await Product.find({
          isBlocked: false,
          $or: [
              { productName: { $regex: ".*" + search + ".*",$options: "i" } }
          ],
      }).countDocuments()
      const totalPages = Math.ceil(count / limit);
        const userId = req.session.user
        const user = await User.findById(userId)
        const order = await Order.find({userId:userId}).populate("orderedItems.product").sort({ createdOn: -1 })
        console.log(order)
        res.render("orderDetails",{user,orders:order,totalPages,currentPage: page,search})
    } catch (error) {
        console.error(error)
res.redirect("/pageNotFound")
    }
}

const viewOrderDetails = async (req, res) => {
    try {
      const userId = req.session.user;
      const orderId = req.params.id;
  
      const order = await Order.findOne({ _id: orderId, userId }).populate("orderedItems.product");
      const user = await User.findById(userId);
      const address = await Address.find()
  
      if (!order) {
        return res.redirect("/pageNotFound");
      }
  
      res.render("orderDetailsView", { order, user });
    } catch (error) {
      console.log(error);
      res.redirect("/pageNotFound");
    }
  };


  const cancelSingleProduct = async (req, res) => {
    try {
      const { productId, orderId } = req.body;
        console.log(req.body)
      const order = await Order.findById(orderId).populate('orderedItems.product');
  
      if (!order) return res.status(404).json({ message: 'Order not found' });
  
      const itemToCancel = order.orderedItems.find(item =>
        item.product._id.toString() === productId
      );
  
      if (!itemToCancel) return res.status(404).json({ message: 'Product not found in order' });
  
      if (itemToCancel.status === 'Cancelled') {
        return res.status(400).json({ message: 'Product is already cancelled' });
      }
  
      const product = await Product.findById(productId);
      product.quatity += itemToCancel.quantity;
      await product.save();
  
      itemToCancel.status = 'Cancelled';
  
      order.totalPrice = order.orderedItems
        .filter(item => item.status !== 'Cancelled')
        .reduce((sum, item) => sum + item.price * item.quantity, 0);
  
      order.finalAmount = order.totalPrice;
  
      const allCancelled = order.orderedItems.every(item => item.status === 'Cancelled');
      if (allCancelled) order.status = 'Cancelled';
  
      await order.save();
  
      res.json({success:true, message: 'Product cancelled successfully' });
  
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  const cancelOrders   = async(req,res)=>{
    try {

      const {orderId} = req.body
      console.log(req.body)
      const order = await Order.findById(orderId)
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (order.status === 'Cancelled') {
        return res.status(400).json({ message: 'Product is already cancelled'});
      }
      for(let item of order.orderedItems){
        let product = await Product.findById(item.product)
        product.quatity += item.quantity
        await product.save()
      }
      for(let item of order.orderedItems){
        item.status = 'Cancelled',
        await order.save()
      }
      order.status =  'Cancelled'
      await order.save()
      return res.status(200).json({success:true})
    } catch (error) {
      console.error(error)
      return res.status(500).json({success:false,message:"internal server error"})
    }
  }

  const returnOrder = async (req, res) => {
    try {
      const { orderId, productId, reason } = req.body;
  
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
  
      const id = new mongoose.Types.ObjectId(productId);
      const productItem = order.orderedItems.find(item => item.product.equals(id));
  
      if (!productItem) {
        return res.status(404).json({ success: false, message: 'Product not found in order' });
      }
  
      productItem.returnReason = reason

      if(order.orderedItems.length>1){
        productItem.status = 'Return Request'
        await order.save();
        return  res.status(200).json({ success: true, message: 'Return request submitted successfully' });
      }
      productItem.status = 'Return Request'
      order.status = 'Return Request'
      await order.save();
      res.status(200).json({ success: true, message: 'Return request submitted successfully' });
  
    } catch (error) {
      console.error('Return request error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
  
  
  


module.exports = {
    placeOrder,
    loadOrderSuccess,
    loadOrders,
    viewOrderDetails,
    cancelSingleProduct,
    cancelOrders,
    returnOrder
}