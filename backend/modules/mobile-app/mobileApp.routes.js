const express = require("express");
const mobileAppController = require("./mobileApp.controller");

const router = express.Router();

// Public on purpose: teachers download the app before they've signed in. Nothing
// here touches the database, so there's no college to scope.
router.get("/", mobileAppController.getInfo);
router.get("/android", mobileAppController.downloadAndroid);

module.exports = router;
