// Allows a request only if header X-MC-Key matches MC_API_KEY in .env.
// MC1 sends this key; normal website users never see it.
const crypto = require('crypto');

module.exports = (req, res, next) => {
  const expected = process.env.MC_API_KEY || '';
  if (expected.length < 32) {
    return res.status(503).json({ message: 'MC_API_KEY is missing or too short in .env' });
  }
  const got = Buffer.from(req.get('X-MC-Key') || '');
  const want = Buffer.from(expected);
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) {
    return res.status(401).json({ message: 'Invalid MC key.' });
  }
  next();
};
