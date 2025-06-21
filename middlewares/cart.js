const Cart = require('../models/cartSchema'); 

const cartCountMiddleware = async (req, res, next) => {
  try {
    let cartCount = 0;
    if (req.session && req.session.user) {
      const cart = await Cart.findOne({ userId: req.session.user });
      if (cart && cart.items) {
        cartCount = cart.items.length
      }
    }
    res.locals.cartCount = cartCount; 
    next();
  } catch (err) {
    console.error('Cart Count Middleware Error:', err);
    res.locals.cartCount = 0;
    next();
  }
};

module.exports = cartCountMiddleware;
