const express = require('express');
const router = express.Router();
const { registerBusiness, checkSlug } = require('../controllers/tenantController');

router.post('/register-business', registerBusiness);
router.get('/check-slug', checkSlug);

module.exports = router;
