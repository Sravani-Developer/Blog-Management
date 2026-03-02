const User = require("../models/User");

module.exports = async (req, res, next) => {
  res.locals.currentUser = null;

  if (!req.session || !req.session.userId) {
    return next();
  }

  try {
    const user = await User.findById(req.session.userId).select("name email role");
    if (user) {
      res.locals.currentUser = user;
    }
    return next();
  } catch (err) {
    return next(err);
  }
};
