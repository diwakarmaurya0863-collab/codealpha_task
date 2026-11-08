const express = require('express');
const router = express.Router();
const dbHelper = require('../db/database');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Search users
router.get('/search', optionalAuth, (req, res) => {
  const query = req.query.q || '';
  if (!query.trim()) {
    return res.json({ users: [] });
  }
  const currentUserId = req.user ? req.user.id : null;
  const users = dbHelper.searchUsers(query, currentUserId, 15);
  return res.json({ users });
});

// Suggested users to follow
router.get('/suggested', optionalAuth, (req, res) => {
  const currentUserId = req.user ? req.user.id : null;
  const users = dbHelper.getSuggestedUsers(currentUserId, 5);
  return res.json({ users });
});

// Update Profile
router.put('/profile', requireAuth, (req, res) => {
  try {
    const { full_name, bio, location, website, avatar_url, banner_url } = req.body;
    
    if (full_name !== undefined && !full_name.trim()) {
      return res.status(400).json({ error: 'Full name cannot be empty' });
    }

    const updatedUser = dbHelper.updateUserProfile(req.user.id, {
      full_name: full_name ? full_name.trim() : undefined,
      bio: bio !== undefined ? bio.trim() : undefined,
      location: location !== undefined ? location.trim() : undefined,
      website: website !== undefined ? website.trim() : undefined,
      avatar_url: avatar_url !== undefined ? avatar_url.trim() : undefined,
      banner_url: banner_url !== undefined ? banner_url.trim() : undefined
    });

    const stats = dbHelper.getUserStats(req.user.id);
    return res.json({
      message: 'Profile updated successfully',
      user: { ...updatedUser, stats }
    });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Upload Avatar
router.post('/avatar', requireAuth, upload.single('avatar'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    const avatarUrl = `/uploads/${req.file.filename}`;
    const updatedUser = dbHelper.updateUserProfile(req.user.id, { avatar_url: avatarUrl });
    const stats = dbHelper.getUserStats(req.user.id);

    return res.json({
      message: 'Avatar uploaded successfully',
      avatarUrl,
      user: { ...updatedUser, stats }
    });
  } catch (err) {
    console.error('Upload avatar error:', err);
    return res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// Upload Banner
router.post('/banner', requireAuth, upload.single('banner'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    const bannerUrl = `/uploads/${req.file.filename}`;
    const updatedUser = dbHelper.updateUserProfile(req.user.id, { banner_url: bannerUrl });
    const stats = dbHelper.getUserStats(req.user.id);

    return res.json({
      message: 'Banner uploaded successfully',
      bannerUrl,
      user: { ...updatedUser, stats }
    });
  } catch (err) {
    console.error('Upload banner error:', err);
    return res.status(500).json({ error: 'Failed to upload banner' });
  }
});

// Get User Profile by Username
router.get('/:username', optionalAuth, (req, res) => {
  try {
    const { username } = req.params;
    const user = dbHelper.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: `User @${username} not found` });
    }

    const currentUserId = req.user ? req.user.id : null;
    const stats = dbHelper.getUserStats(user.id);
    const isFollow = currentUserId ? dbHelper.isFollowing(currentUserId, user.id) : false;
    const isSelf = currentUserId === user.id;

    return res.json({
      user: {
        ...user,
        stats,
        isFollowing: isFollow,
        isSelf
      }
    });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ error: 'Failed to load user profile' });
  }
});

// Follow / Unfollow User Toggle
router.post('/:id/follow', requireAuth, (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: 'You cannot follow yourself' });
    }

    const targetUser = dbHelper.getUserById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentlyFollowing = dbHelper.isFollowing(req.user.id, targetUserId);
    let isFollowingNow = false;

    if (currentlyFollowing) {
      dbHelper.unfollowUser(req.user.id, targetUserId);
      isFollowingNow = false;
    } else {
      dbHelper.followUser(req.user.id, targetUserId);
      isFollowingNow = true;
    }

    const targetStats = dbHelper.getUserStats(targetUserId);
    const currentUserStats = dbHelper.getUserStats(req.user.id);

    return res.json({
      success: true,
      isFollowing: isFollowingNow,
      targetStats,
      currentUserStats
    });
  } catch (err) {
    console.error('Follow toggle error:', err);
    return res.status(500).json({ error: 'Failed to update follow status' });
  }
});

// Get Followers of User
router.get('/:id/followers', optionalAuth, (req, res) => {
  const targetUserId = parseInt(req.params.id, 10);
  if (isNaN(targetUserId)) return res.status(400).json({ error: 'Invalid user ID' });

  const currentUserId = req.user ? req.user.id : null;
  const followers = dbHelper.getFollowers(targetUserId, currentUserId);
  return res.json({ followers });
});

// Get Following of User
router.get('/:id/following', optionalAuth, (req, res) => {
  const targetUserId = parseInt(req.params.id, 10);
  if (isNaN(targetUserId)) return res.status(400).json({ error: 'Invalid user ID' });

  const currentUserId = req.user ? req.user.id : null;
  const following = dbHelper.getFollowing(targetUserId, currentUserId);
  return res.json({ following });
});

module.exports = router;
