const express = require('express');
const router = express.Router();
const dbHelper = require('../db/database');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, (req, res) => {
  try {
    const notifications = dbHelper.getNotifications(req.user.id);
    return res.json({ notifications });
  } catch (err) {
    console.error('Notifications error:', err);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.put('/read', requireAuth, (req, res) => {
  try {
    const updatedCount = dbHelper.markNotificationsRead(req.user.id);
    return res.json({ success: true, updatedCount });
  } catch (err) {
    console.error('Mark read error:', err);
    return res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

router.get('/unread-count', requireAuth, (req, res) => {
  try {
    const count = dbHelper.getUnreadNotificationCount(req.user.id);
    return res.json({ count });
  } catch (err) {
    console.error('Unread count error:', err);
    return res.status(500).json({ error: 'Failed to get count' });
  }
});

module.exports = router;
