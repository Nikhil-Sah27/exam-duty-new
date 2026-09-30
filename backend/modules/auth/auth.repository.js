const User = require("./auth.model");

// Pure database operations — no logic, no transforms

const findUserByEmail = (email) => {
  return User.findOne({ email }).select("+password");
};

const createUser = (data) => {
  return User.create(data);
};

const findUserById = (id) => {
  return User.findById(id);
};

// Includes the normally-hidden reset-OTP fields (and password, so a new one can
// be saved on the same doc) for the forgot/reset-password flow.
const findUserByEmailForReset = (email) => {
  return User.findOne({ email }).select(
    "+password +resetOtpHash +resetOtpExpires +resetOtpAttempts",
  );
};

module.exports = {
  findUserByEmail,
  createUser,
  findUserById,
  findUserByEmailForReset,
};
