const service = require("./report.service");
const catchAsync = require("../../shared/utils/catchAsync");

const responsiveness = catchAsync(async (req, res) => {
  const data = await service.getResponsiveness();
  res.status(200).json({ success: true, data });
});

module.exports = { responsiveness };
