const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid"); 

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueId = uuidv4().slice(0, 8);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  },
});

const upload = multer({ storage: storage });
module.exports = upload;
