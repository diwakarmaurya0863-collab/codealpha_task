const express = require('express');
const router = express.Router();
const dbHelper = require('../db/database');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Feed (all or following)
router.get('/feed', optionalAuth, (req, res) => {
  try {
    const { type = 'all', tag, limit = 30, offset = 0 } = req.query;
    const currentUserId = req.user ? req.user.id : null;

    const posts = dbHelper.getFeedPosts({
      currentUserId,
      type,
      tag,
      limit: parseInt(limit, 10) || 30,
      offset: parseInt(offset, 10) || 0
    });

    return res.json({ posts });
  } catch (err) {
    console.error('Feed error:', err);
    return res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// Trending hashtags
router.get('/trending/tags', (req, res) => {
  try {
    const tags = dbHelper.getTrendingTags(6);
    return res.json({ tags });
  } catch (err) {
    console.error('Trending tags error:', err);
    return res.status(500).json({ error: 'Failed to fetch trending tags' });
  }
});

// Posts by a specific user
router.get('/user/:username', optionalAuth, (req, res) => {
  try {
    const { username } = req.params;
    const user = dbHelper.getUserByUsername(username);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const currentUserId = req.user ? req.user.id : null;
    const posts = dbHelper.getUserPosts(user.id, currentUserId);
    return res.json({ posts });
  } catch (err) {
    console.error('User posts error:', err);
    return res.status(500).json({ error: 'Failed to fetch user posts' });
  }
});

// Posts liked by a user
router.get('/user/:username/likes', optionalAuth, (req, res) => {
  try {
    const { username } = req.params;
    const user = dbHelper.getUserByUsername(username);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const currentUserId = req.user ? req.user.id : null;
    const posts = dbHelper.getUserLikedPosts(user.id, currentUserId);
    return res.json({ posts });
  } catch (err) {
    console.error('User liked posts error:', err);
    return res.status(500).json({ error: 'Failed to fetch user liked posts' });
  }
});

// Posts bookmarked by current user
router.get('/saved', requireAuth, (req, res) => {
  try {
    const posts = dbHelper.getUserBookmarkedPosts(req.user.id);
    return res.json({ posts });
  } catch (err) {
    console.error('Saved posts error:', err);
    return res.status(500).json({ error: 'Failed to fetch saved posts' });
  }
});

// Create a new post (supports multipart file upload OR JSON body with media_url)
router.post('/', requireAuth, upload.single('media'), (req, res) => {
  try {
    const content = req.body.content;
    let mediaUrl = req.body.media_url || '';

    if (req.file) {
      mediaUrl = `/uploads/${req.file.filename}`;
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Post content cannot be empty' });
    }

    if (content.trim().length > 500) {
      return res.status(400).json({ error: 'Post exceeds 500 characters limit' });
    }

    const post = dbHelper.createPost({
      user_id: req.user.id,
      content: content.trim(),
      media_url: mediaUrl
    });

    return res.status(201).json({
      message: 'Post created successfully',
      post
    });
  } catch (err) {
    console.error('Create post error:', err);
    return res.status(500).json({ error: 'Failed to create post' });
  }
});

// Get a single post
router.get('/:id', optionalAuth, (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post ID' });

    const currentUserId = req.user ? req.user.id : null;
    const post = dbHelper.getPostById(postId, currentUserId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const comments = dbHelper.getCommentsByPostId(postId, currentUserId);
    return res.json({ post: { ...post, comments } });
  } catch (err) {
    console.error('Get post error:', err);
    return res.status(500).json({ error: 'Failed to load post' });
  }
});

// Delete a post
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post ID' });

    const deleted = dbHelper.deletePost(postId, req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Post not found' });
    }

    return res.json({ message: 'Post deleted successfully', postId });
  } catch (err) {
    console.error('Delete post error:', err);
    if (err.message && err.message.includes('Unauthorized')) {
      return res.status(403).json({ error: 'Unauthorized to delete this post' });
    }
    return res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Toggle Like
router.post('/:id/like', requireAuth, (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post ID' });

    const result = dbHelper.toggleLike(req.user.id, postId);
    return res.json(result);
  } catch (err) {
    console.error('Toggle like error:', err);
    if (err.message && err.message.includes('not found')) {
      return res.status(404).json({ error: 'Post not found' });
    }
    return res.status(500).json({ error: 'Failed to like/unlike post' });
  }
});

// Get users who liked a post
router.get('/:id/likes', optionalAuth, (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post ID' });

    const currentUserId = req.user ? req.user.id : null;
    const users = dbHelper.getPostLikers(postId, currentUserId);
    return res.json({ users });
  } catch (err) {
    console.error('Get likers error:', err);
    return res.status(500).json({ error: 'Failed to load likes' });
  }
});

// Toggle Bookmark
router.post('/:id/bookmark', requireAuth, (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post ID' });

    const result = dbHelper.toggleBookmark(req.user.id, postId);
    return res.json(result);
  } catch (err) {
    console.error('Toggle bookmark error:', err);
    return res.status(500).json({ error: 'Failed to bookmark post' });
  }
});

// Get comments for a post
router.get('/:id/comments', optionalAuth, (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post ID' });

    const currentUserId = req.user ? req.user.id : null;
    const comments = dbHelper.getCommentsByPostId(postId, currentUserId);
    return res.json({ comments });
  } catch (err) {
    console.error('Get comments error:', err);
    return res.status(500).json({ error: 'Failed to load comments' });
  }
});

// Add comment to a post
router.post('/:id/comments', requireAuth, (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post ID' });

    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content cannot be empty' });
    }

    const comment = dbHelper.createComment({
      postId,
      userId: req.user.id,
      content
    });

    const commentsCount = dbHelper.getCommentsByPostId(postId).length;

    return res.status(201).json({
      message: 'Comment added successfully',
      comment,
      commentsCount
    });
  } catch (err) {
    console.error('Add comment error:', err);
    return res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Delete comment
router.delete('/comments/:id', requireAuth, (req, res) => {
  try {
    const commentId = parseInt(req.params.id, 10);
    if (isNaN(commentId)) return res.status(400).json({ error: 'Invalid comment ID' });

    const deleted = dbHelper.deleteComment(commentId, req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    return res.json({ message: 'Comment deleted successfully', commentId });
  } catch (err) {
    console.error('Delete comment error:', err);
    if (err.message && err.message.includes('Unauthorized')) {
      return res.status(403).json({ error: 'Unauthorized to delete this comment' });
    }
    return res.status(500).json({ error: 'Failed to delete comment' });
  }
});

module.exports = router;
