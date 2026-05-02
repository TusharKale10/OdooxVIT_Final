const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { HttpError } = require('../middlewares/error');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase();
    const safeExt = /^\.(png|jpe?g|webp|gif|svg)$/.test(ext) ? ext : '.png';
    const name = `u${req.user?.id || 0}_${Date.now()}_${Math.floor(Math.random() * 1e6)}${safeExt}`;
    cb(null, name);
  },
});

const fileFilter = (_req, file, cb) => {
  if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(file.mimetype)) {
    return cb(new HttpError(400, 'Only image uploads are allowed'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 4 * 1024 * 1024 },  // 4 MB
});

exports.middleware = upload.single('file');

exports.handle = (req, res) => {
  if (!req.file) throw new HttpError(400, 'No file uploaded');
  // Public URL — backend serves /uploads as static
  const url = `/uploads/${req.file.filename}`;
  res.status(201).json({ url, filename: req.file.filename, size: req.file.size });
};

exports.UPLOAD_DIR = UPLOAD_DIR;
