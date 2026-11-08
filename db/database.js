const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'social.db');

// Ensure db directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

// Enable foreign keys and WAL mode for better concurrency
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      bio TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      banner_url TEXT DEFAULT '',
      location TEXT DEFAULT '',
      website TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS followers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(follower_id, following_id)
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      media_url TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL, -- 'like', 'comment', 'follow'
      post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
    CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
    CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
    CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
    CREATE INDEX IF NOT EXISTS idx_followers_follower ON followers(follower_id);
    CREATE INDEX IF NOT EXISTS idx_followers_following ON followers(following_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
  `);
}

// Initialize tables on load
initDatabase();

// --- Query Helpers ---

// User Operations
function createUser({ username, email, password_hash, full_name, bio = '', avatar_url = '', banner_url = '', location = '', website = '' }) {
  const stmt = db.prepare(`
    INSERT INTO users (username, email, password_hash, full_name, bio, avatar_url, banner_url, location, website)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const res = stmt.run(username, email, password_hash, full_name, bio, avatar_url, banner_url, location, website);
  return getUserById(res.lastInsertRowid);
}

function getUserById(id) {
  const stmt = db.prepare('SELECT id, username, email, full_name, bio, avatar_url, banner_url, location, website, created_at FROM users WHERE id = ?');
  return stmt.get(id);
}

function getUserByUsername(username) {
  const stmt = db.prepare('SELECT id, username, email, full_name, bio, avatar_url, banner_url, location, website, created_at FROM users WHERE username = ?');
  return stmt.get(username);
}

function getUserWithAuthByUsernameOrEmail(identifier) {
  const stmt = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?');
  return stmt.get(identifier, identifier);
}

function updateUserProfile(id, { full_name, bio, location, website, avatar_url, banner_url }) {
  const current = getUserById(id);
  if (!current) return null;

  const stmt = db.prepare(`
    UPDATE users
    SET full_name = ?, bio = ?, location = ?, website = ?, avatar_url = ?, banner_url = ?
    WHERE id = ?
  `);
  stmt.run(
    full_name !== undefined ? full_name : current.full_name,
    bio !== undefined ? bio : current.bio,
    location !== undefined ? location : current.location,
    website !== undefined ? website : current.website,
    avatar_url !== undefined ? avatar_url : current.avatar_url,
    banner_url !== undefined ? banner_url : current.banner_url,
    id
  );
  return getUserById(id);
}

function getUserStats(userId) {
  const postsCount = db.prepare('SELECT COUNT(*) as count FROM posts WHERE user_id = ?').get(userId)?.count || 0;
  const followersCount = db.prepare('SELECT COUNT(*) as count FROM followers WHERE following_id = ?').get(userId)?.count || 0;
  const followingCount = db.prepare('SELECT COUNT(*) as count FROM followers WHERE follower_id = ?').get(userId)?.count || 0;
  return { postsCount, followersCount, followingCount };
}

function isFollowing(followerId, followingId) {
  if (!followerId || !followingId || followerId === followingId) return false;
  const row = db.prepare('SELECT id FROM followers WHERE follower_id = ? AND following_id = ?').get(followerId, followingId);
  return !!row;
}

function followUser(followerId, followingId) {
  if (followerId === followingId) throw new Error('Cannot follow yourself');
  try {
    const stmt = db.prepare('INSERT INTO followers (follower_id, following_id) VALUES (?, ?)');
    stmt.run(followerId, followingId);
    
    // Create notification
    createNotification({
      recipient_id: followingId,
      sender_id: followerId,
      type: 'follow'
    });
    return true;
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return true; // Already following
    }
    throw err;
  }
}

function unfollowUser(followerId, followingId) {
  const stmt = db.prepare('DELETE FROM followers WHERE follower_id = ? AND following_id = ?');
  const res = stmt.run(followerId, followingId);
  return res.changes > 0;
}

function getFollowers(userId, currentUserId = null) {
  const stmt = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.avatar_url, u.bio
    FROM followers f
    JOIN users u ON f.follower_id = u.id
    WHERE f.following_id = ?
    ORDER BY f.created_at DESC
  `);
  const followers = stmt.all(userId);
  return followers.map(u => ({
    ...u,
    isFollowing: currentUserId ? isFollowing(currentUserId, u.id) : false,
    isSelf: currentUserId === u.id
  }));
}

function getFollowing(userId, currentUserId = null) {
  const stmt = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.avatar_url, u.bio
    FROM followers f
    JOIN users u ON f.following_id = u.id
    WHERE f.follower_id = ?
    ORDER BY f.created_at DESC
  `);
  const following = stmt.all(userId);
  return following.map(u => ({
    ...u,
    isFollowing: currentUserId ? isFollowing(currentUserId, u.id) : false,
    isSelf: currentUserId === u.id
  }));
}

function searchUsers(query, currentUserId = null, limit = 10) {
  const q = `%${query.trim()}%`;
  const stmt = db.prepare(`
    SELECT id, username, full_name, avatar_url, bio
    FROM users
    WHERE username LIKE ? OR full_name LIKE ?
    ORDER BY (username LIKE ?) DESC, full_name ASC
    LIMIT ?
  `);
  const users = stmt.all(q, q, `${query}%`, limit);
  return users.map(u => ({
    ...u,
    isFollowing: currentUserId ? isFollowing(currentUserId, u.id) : false,
    isSelf: currentUserId === u.id
  }));
}

function getSuggestedUsers(currentUserId, limit = 5) {
  let stmt;
  let users;
  if (currentUserId) {
    stmt = db.prepare(`
      SELECT u.id, u.username, u.full_name, u.avatar_url, u.bio,
             (SELECT COUNT(*) FROM followers WHERE following_id = u.id) as follower_count
      FROM users u
      WHERE u.id != ?
        AND u.id NOT IN (SELECT following_id FROM followers WHERE follower_id = ?)
      ORDER BY follower_count DESC, u.created_at DESC
      LIMIT ?
    `);
    users = stmt.all(currentUserId, currentUserId, limit);
  } else {
    stmt = db.prepare(`
      SELECT u.id, u.username, u.full_name, u.avatar_url, u.bio,
             (SELECT COUNT(*) FROM followers WHERE following_id = u.id) as follower_count
      FROM users u
      ORDER BY follower_count DESC, u.created_at DESC
      LIMIT ?
    `);
    users = stmt.all(limit);
  }
  return users.map(u => ({
    ...u,
    isFollowing: false,
    isSelf: false
  }));
}

// Post Operations
function createPost({ user_id, content, media_url = '' }) {
  const stmt = db.prepare(`
    INSERT INTO posts (user_id, content, media_url)
    VALUES (?, ?, ?)
  `);
  const res = stmt.run(user_id, content.trim(), media_url || '');
  return getPostById(res.lastInsertRowid, user_id);
}

function getPostById(postId, currentUserId = null) {
  const stmt = db.prepare(`
    SELECT 
      p.id, p.content, p.media_url, p.created_at, p.updated_at,
      u.id as author_id, u.username, u.full_name, u.avatar_url,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.id = ?
  `);
  const post = stmt.get(postId);
  if (!post) return null;

  return formatPostRow(post, currentUserId);
}

function formatPostRow(post, currentUserId) {
  const isLiked = currentUserId ? !!db.prepare('SELECT id FROM likes WHERE post_id = ? AND user_id = ?').get(post.id, currentUserId) : false;
  const isBookmarked = currentUserId ? !!db.prepare('SELECT id FROM bookmarks WHERE post_id = ? AND user_id = ?').get(post.id, currentUserId) : false;

  return {
    id: post.id,
    content: post.content,
    mediaUrl: post.media_url,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
    author: {
      id: post.author_id,
      username: post.username,
      fullName: post.full_name,
      avatarUrl: post.avatar_url
    },
    likesCount: Number(post.likes_count),
    commentsCount: Number(post.comments_count),
    isLiked,
    isBookmarked,
    isOwner: currentUserId === post.author_id
  };
}

function getFeedPosts({ currentUserId = null, type = 'all', tag = null, limit = 30, offset = 0 } = {}) {
  let query = `
    SELECT 
      p.id, p.content, p.media_url, p.created_at, p.updated_at,
      u.id as author_id, u.username, u.full_name, u.avatar_url,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count
    FROM posts p
    JOIN users u ON p.user_id = u.id
  `;

  const params = [];
  const whereClauses = [];

  if (type === 'following' && currentUserId) {
    whereClauses.push(`p.user_id IN (SELECT following_id FROM followers WHERE follower_id = ?)`);
    params.push(currentUserId);
  }

  if (tag) {
    whereClauses.push(`p.content LIKE ?`);
    params.push(`%#${tag.replace('#', '')}%`);
  }

  if (whereClauses.length > 0) {
    query += ` WHERE ` + whereClauses.join(' AND ');
  }

  query += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const stmt = db.prepare(query);
  const rows = stmt.all(...params);

  return rows.map(r => formatPostRow(r, currentUserId));
}

function getUserPosts(targetUserId, currentUserId = null, limit = 30, offset = 0) {
  const stmt = db.prepare(`
    SELECT 
      p.id, p.content, p.media_url, p.created_at, p.updated_at,
      u.id as author_id, u.username, u.full_name, u.avatar_url,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.user_id = ?
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `);
  const rows = stmt.all(targetUserId, limit, offset);
  return rows.map(r => formatPostRow(r, currentUserId));
}

function getUserLikedPosts(targetUserId, currentUserId = null, limit = 30, offset = 0) {
  const stmt = db.prepare(`
    SELECT 
      p.id, p.content, p.media_url, p.created_at, p.updated_at,
      u.id as author_id, u.username, u.full_name, u.avatar_url,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count
    FROM likes l
    JOIN posts p ON l.post_id = p.id
    JOIN users u ON p.user_id = u.id
    WHERE l.user_id = ?
    ORDER BY l.created_at DESC
    LIMIT ? OFFSET ?
  `);
  const rows = stmt.all(targetUserId, limit, offset);
  return rows.map(r => formatPostRow(r, currentUserId));
}

function getUserBookmarkedPosts(userId, limit = 30, offset = 0) {
  const stmt = db.prepare(`
    SELECT 
      p.id, p.content, p.media_url, p.created_at, p.updated_at,
      u.id as author_id, u.username, u.full_name, u.avatar_url,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count
    FROM bookmarks b
    JOIN posts p ON b.post_id = p.id
    JOIN users u ON p.user_id = u.id
    WHERE b.user_id = ?
    ORDER BY b.created_at DESC
    LIMIT ? OFFSET ?
  `);
  const rows = stmt.all(userId, limit, offset);
  return rows.map(r => formatPostRow(r, userId));
}

function deletePost(postId, userId) {
  const post = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(postId);
  if (!post) return false;
  if (post.user_id !== userId) {
    throw new Error('Unauthorized to delete this post');
  }
  const stmt = db.prepare('DELETE FROM posts WHERE id = ?');
  const res = stmt.run(postId);
  return res.changes > 0;
}

// Like Operations
function toggleLike(userId, postId) {
  const post = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(postId);
  if (!post) throw new Error('Post not found');

  const existing = db.prepare('SELECT id FROM likes WHERE user_id = ? AND post_id = ?').get(userId, postId);
  let isLiked = false;

  if (existing) {
    db.prepare('DELETE FROM likes WHERE id = ?').run(existing.id);
    isLiked = false;
  } else {
    db.prepare('INSERT INTO likes (user_id, post_id) VALUES (?, ?)').run(userId, postId);
    isLiked = true;

    // Create notification for post owner if not self
    if (post.user_id !== userId) {
      createNotification({
        recipient_id: post.user_id,
        sender_id: userId,
        type: 'like',
        post_id: postId
      });
    }
  }

  const countRow = db.prepare('SELECT COUNT(*) as count FROM likes WHERE post_id = ?').get(postId);
  return {
    liked: isLiked,
    likesCount: Number(countRow.count)
  };
}

function getPostLikers(postId, currentUserId = null) {
  const stmt = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.avatar_url, u.bio
    FROM likes l
    JOIN users u ON l.user_id = u.id
    WHERE l.post_id = ?
    ORDER BY l.created_at DESC
  `);
  const users = stmt.all(postId);
  return users.map(u => ({
    ...u,
    isFollowing: currentUserId ? isFollowing(currentUserId, u.id) : false,
    isSelf: currentUserId === u.id
  }));
}

// Bookmark Operations
function toggleBookmark(userId, postId) {
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
  if (!post) throw new Error('Post not found');

  const existing = db.prepare('SELECT id FROM bookmarks WHERE user_id = ? AND post_id = ?').get(userId, postId);
  let isBookmarked = false;

  if (existing) {
    db.prepare('DELETE FROM bookmarks WHERE id = ?').run(existing.id);
    isBookmarked = false;
  } else {
    db.prepare('INSERT INTO bookmarks (user_id, post_id) VALUES (?, ?)').run(userId, postId);
    isBookmarked = true;
  }

  return { isBookmarked };
}

// Comment Operations
function createComment({ postId, userId, content }) {
  const post = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(postId);
  if (!post) throw new Error('Post not found');

  const trimmed = content.trim();
  if (!trimmed) throw new Error('Comment content cannot be empty');

  const stmt = db.prepare('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)');
  const res = stmt.run(postId, userId, trimmed);

  // Notify post owner if not self
  if (post.user_id !== userId) {
    createNotification({
      recipient_id: post.user_id,
      sender_id: userId,
      type: 'comment',
      post_id: postId
    });
  }

  return getCommentById(res.lastInsertRowid, userId);
}

function getCommentById(commentId, currentUserId = null) {
  const stmt = db.prepare(`
    SELECT 
      c.id, c.post_id, c.content, c.created_at,
      u.id as author_id, u.username, u.full_name, u.avatar_url
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.id = ?
  `);
  const c = stmt.get(commentId);
  if (!c) return null;

  return {
    id: c.id,
    postId: c.post_id,
    content: c.content,
    createdAt: c.created_at,
    author: {
      id: c.author_id,
      username: c.username,
      fullName: c.full_name,
      avatarUrl: c.avatar_url
    },
    isOwner: currentUserId === c.author_id
  };
}

function getCommentsByPostId(postId, currentUserId = null) {
  const stmt = db.prepare(`
    SELECT 
      c.id, c.post_id, c.content, c.created_at,
      u.id as author_id, u.username, u.full_name, u.avatar_url
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `);
  const rows = stmt.all(postId);
  return rows.map(c => ({
    id: c.id,
    postId: c.post_id,
    content: c.content,
    createdAt: c.created_at,
    author: {
      id: c.author_id,
      username: c.username,
      fullName: c.full_name,
      avatarUrl: c.avatar_url
    },
    isOwner: currentUserId === c.author_id
  }));
}

function deleteComment(commentId, userId) {
  const comment = db.prepare(`
    SELECT c.user_id as comment_author, p.user_id as post_author
    FROM comments c
    JOIN posts p ON c.post_id = p.id
    WHERE c.id = ?
  `).get(commentId);

  if (!comment) return false;
  if (comment.comment_author !== userId && comment.post_author !== userId) {
    throw new Error('Unauthorized to delete this comment');
  }

  const stmt = db.prepare('DELETE FROM comments WHERE id = ?');
  const res = stmt.run(commentId);
  return res.changes > 0;
}

// Notification Operations
function createNotification({ recipient_id, sender_id, type, post_id = null }) {
  if (recipient_id === sender_id) return null; // Don't notify self
  const stmt = db.prepare(`
    INSERT INTO notifications (recipient_id, sender_id, type, post_id)
    VALUES (?, ?, ?, ?)
  `);
  return stmt.run(recipient_id, sender_id, type, post_id);
}

function getNotifications(userId, limit = 20) {
  const stmt = db.prepare(`
    SELECT 
      n.id, n.type, n.post_id, n.is_read, n.created_at,
      u.id as sender_id, u.username as sender_username, u.full_name as sender_name, u.avatar_url as sender_avatar,
      p.content as post_content
    FROM notifications n
    JOIN users u ON n.sender_id = u.id
    LEFT JOIN posts p ON n.post_id = p.id
    WHERE n.recipient_id = ?
    ORDER BY n.created_at DESC
    LIMIT ?
  `);
  return stmt.all(userId, limit);
}

function markNotificationsRead(userId) {
  const stmt = db.prepare('UPDATE notifications SET is_read = 1 WHERE recipient_id = ? AND is_read = 0');
  const res = stmt.run(userId);
  return res.changes;
}

function getUnreadNotificationCount(userId) {
  const row = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE recipient_id = ? AND is_read = 0').get(userId);
  return row ? row.count : 0;
}

// Trending hashtags extractor
function getTrendingTags(limit = 6) {
  const rows = db.prepare('SELECT content FROM posts ORDER BY created_at DESC LIMIT 100').all();
  const counts = {};
  const tagRegex = /#([a-zA-Z0-9_]+)/g;

  for (const row of rows) {
    let match;
    while ((match = tagRegex.exec(row.content)) !== null) {
      const tag = match[1].toLowerCase();
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}

module.exports = {
  db,
  initDatabase,
  createUser,
  getUserById,
  getUserByUsername,
  getUserWithAuthByUsernameOrEmail,
  updateUserProfile,
  getUserStats,
  isFollowing,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  searchUsers,
  getSuggestedUsers,
  createPost,
  getPostById,
  getFeedPosts,
  getUserPosts,
  getUserLikedPosts,
  getUserBookmarkedPosts,
  deletePost,
  toggleLike,
  getPostLikers,
  toggleBookmark,
  createComment,
  getCommentById,
  getCommentsByPostId,
  deleteComment,
  createNotification,
  getNotifications,
  markNotificationsRead,
  getUnreadNotificationCount,
  getTrendingTags
};
