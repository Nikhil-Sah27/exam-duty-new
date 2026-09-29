const service = require("./audit.service");
const catchAsync = require("../../shared/utils/catchAsync");

const list = catchAsync(async (req, res) => {
  const { action, entity, performedBy, from, to, page, limit } = req.query;
  const result = await service.list({ action, entity, performedBy, from, to, page, limit });
  res.status(200).json({
    success: true,
    count: result.items.length,
    total: result.total,
    page: result.page,
    pages: result.pages,
    data: result.items,
  });
});

module.exports = { list };
