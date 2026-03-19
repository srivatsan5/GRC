const express = require('express')
const RiskController = require('../controllers/riskController')
const riskController = new RiskController()
const router = express.Router()

router.get('/risks', riskController.list)
router.post('/risks', riskController.create)
router.get('/risks/:id', riskController.get)
router.put('/risks/:id', riskController.update)
router.delete('/risks/:id', riskController.delete)

module.exports = router
