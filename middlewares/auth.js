const User = require('../models/userSchema')


const userAuth = (req, res, next) => {
  console.log('User  session:', req.session.user);
  if (req.session.user) {
    User.findById(req.session.user)
      .then(data => {
        if (data && !data.isBlocked) {
          next();
        } else {
          console.log('User  is blocked or not found, redirecting to login');
          res.redirect('/login');
        }
      })
      .catch(error => {
        console.log('Error in user auth middleware', error);
        res.status(500).redirect('/pageNotFound');
      });
  } else {
    console.log('No user session, redirecting to login');
    res.redirect('/login');
  }
};

const userAuthCheck = (req, res, next) => {
  console.log('User  session:', req.session.user);
  if (!req.session.user) {
    next();
  }
  else {
    console.log('User session, redirecting to homePage');
    res.redirect('/');
  }
}

const adminAuthCheck = (req, res, next) => {
  console.log('User  session:', req.session.user);
  if (!req.session.admin) {
    next();
  } 
  else {
    console.log('No user session, redirecting to homePage');
    res.redirect('/admin/');
  }
}

const adminAuth = (req, res, next) => {
  console.log('Admin session:', req.session.admin);
  if(req.session.admin){
    next();
  }else{
    console.log('Admin not found, redirecting to admin login');
    res.redirect('/admin/login');
  }
};

module.exports = {
  userAuth,
  adminAuth,
  userAuthCheck,
  adminAuthCheck
}