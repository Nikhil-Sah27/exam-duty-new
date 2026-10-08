const AppError = require("../utils/AppError");

const errorHandler = (err, req, res, next) => {
  // Mongoose validation error → 400
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    err = new AppError(messages.join(", "), 400);
  }

  // Mongoose duplicate key → 409
  if (err.code === 11000) {
    // `college` scopes most unique indexes (MULTI_COLLEGE_PLAN.md) — not news to the user.
    const fields = Object.keys(err.keyPattern).filter((f) => f !== "college");
    const values = err.keyValue || {};
    let message;
    if (fields.includes("examRoom") && fields.includes("role")) {
      // Duty's one-live-duty-per-slot index: another claim on the same slot
      // committed first (concurrent clicks). Phrased for the teacher who lost.
      message = "This duty was just taken by someone else — please choose another";
    } else if (fields.includes("roomNumber") && fields.includes("building")) {
      message = `Room number "${values.roomNumber}" already exists in this building`;
    } else if (fields.includes("name")) {
      message = `"${values.name}" already exists`;
    } else if (fields.includes("code")) {
      message = `Code "${values.code}" is already in use`;
    } else if (fields.includes("email")) {
      message = `"${values.email}" already has a Proctavo account`;
    } else {
      message = `${fields.join(", ")} already exists`;
    }
    err = new AppError(message, 409);
  }

  // Mongoose bad ObjectId → 400
  if (err.name === "CastError") {
    err = new AppError(`Invalid ${err.path}: ${err.value}`, 400);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    ...(err.details !== undefined && { details: err.details }),
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = errorHandler;
