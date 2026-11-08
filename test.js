/**
 * Pulse Platform Comprehensive Test Suite
 * Tests User Profiles, Posts, Comments, Like/Follow System, Notifications
 */

const assert = require('assert');
const bcrypt = require('bcryptjs');
const dbHelper = require('./db/database');

async function runTests() {
  console.log('🧪 Starting Pulse Social Media Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function it(name, fn) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  }

  async function itAsync(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  }

  // --- 1. USER PROFILE TESTS ---
  console.log('📦 1. User Profiles & Authentication');
  const testUsername = `tester_${Date.now()}`;
  const testEmail = `${testUsername}@example.com`;
  const rawPassword = 'SecretPassword123!';
  const password_hash = await bcrypt.hash(rawPassword, 10);

  let testUser;
  it('Creates a new user profile with bio and details', () => {
    testUser = dbHelper.createUser({
      username: testUsername,
      email: testEmail,
      password_hash,
      full_name: 'Test Engineer',
      bio: 'Testing software systems',
      location: 'New York',
      website: 'https://test.dev'
    });
    assert(testUser.id, 'User should have an ID');
    assert.strictEqual(testUser.username, testUsername);
    assert.strictEqual(testUser.bio, 'Testing software systems');
  });

  it('Retrieves user by username (case-insensitive)', () => {
    const user = dbHelper.getUserByUsername(testUsername.toUpperCase());
    assert(user, 'User should be found regardless of case');
    assert.strictEqual(user.id, testUser.id);
  });

  it('Verifies user credentials with bcrypt', async () => {
    const userWithAuth = dbHelper.getUserWithAuthByUsernameOrEmail(testUsername);
    const valid = await bcrypt.compare(rawPassword, userWithAuth.password_hash);
    const invalid = await bcrypt.compare('WrongPassword', userWithAuth.password_hash);
    assert.strictEqual(valid, true, 'Correct password must validate');
    assert.strictEqual(invalid, false, 'Wrong password must fail');
  });

  it('Updates user profile information', () => {
    const updated = dbHelper.updateUserProfile(testUser.id, {
      bio: 'Updated bio for testing',
      location: 'San Francisco, CA'
    });
    assert.strictEqual(updated.bio, 'Updated bio for testing');
    assert.strictEqual(updated.location, 'San Francisco, CA');
    assert.strictEqual(updated.full_name, 'Test Engineer'); // Unmodified field remains
  });

  it('Computes accurate user statistics (posts, followers, following)', () => {
    const stats = dbHelper.getUserStats(testUser.id);
    assert.strictEqual(typeof stats.postsCount, 'number');
    assert.strictEqual(typeof stats.followersCount, 'number');
    assert.strictEqual(typeof stats.followingCount, 'number');
  });

  // --- 2. FOLLOW / UNFOLLOW SYSTEM TESTS ---
  console.log('\n🤝 2. Follow & Relationship System');
  const targetUser = dbHelper.getUserByUsername('alex_coder');
  assert(targetUser, 'alex_coder seeded user must exist');

  it('Follows another user and creates follow relationship', () => {
    const initialFollowing = dbHelper.isFollowing(testUser.id, targetUser.id);
    assert.strictEqual(initialFollowing, false);

    dbHelper.followUser(testUser.id, targetUser.id);
    const isNowFollowing = dbHelper.isFollowing(testUser.id, targetUser.id);
    assert.strictEqual(isNowFollowing, true, 'User should now follow target');
  });

  it('Prevents following self with validation error', () => {
    assert.throws(() => {
      dbHelper.followUser(testUser.id, testUser.id);
    }, /Cannot follow yourself/);
  });

  it('Shows user in followers and following lists', () => {
    const followers = dbHelper.getFollowers(targetUser.id, testUser.id);
    const hasTesterInFollowers = followers.some(f => f.id === testUser.id);
    assert.strictEqual(hasTesterInFollowers, true, 'Target user followers must include testUser');

    const following = dbHelper.getFollowing(testUser.id, testUser.id);
    const isAlexInFollowing = following.some(f => f.id === targetUser.id);
    assert.strictEqual(isAlexInFollowing, true, 'testUser following must include Alex');
  });

  it('Unfollows target user and updates relationship status', () => {
    const unfollowed = dbHelper.unfollowUser(testUser.id, targetUser.id);
    assert.strictEqual(unfollowed, true);
    assert.strictEqual(dbHelper.isFollowing(testUser.id, targetUser.id), false);
  });

  // --- 3. POSTS & FEED SYSTEM TESTS ---
  console.log('\n📝 3. Posts & Feed System');
  let createdPost;
  it('Creates a new post with hashtags', () => {
    createdPost = dbHelper.createPost({
      user_id: testUser.id,
      content: 'Excited to announce our new update! #tech #launch',
      media_url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800'
    });
    assert(createdPost.id, 'Post must have an ID');
    assert.strictEqual(createdPost.author.id, testUser.id);
    assert.strictEqual(createdPost.likesCount, 0);
    assert.strictEqual(createdPost.commentsCount, 0);
  });

  it('Retrieves post by ID with author details', () => {
    const post = dbHelper.getPostById(createdPost.id, testUser.id);
    assert(post, 'Post should be found');
    assert.strictEqual(post.isOwner, true, 'Author is owner');
    assert.strictEqual(post.isLiked, false);
  });

  it('Filters feed by tag (#launch)', () => {
    const feed = dbHelper.getFeedPosts({ tag: 'launch' });
    assert(feed.length >= 1, 'Feed must contain post matching #launch');
    assert(feed[0].content.includes('#launch'));
  });

  // --- 4. LIKE & BOOKMARK SYSTEM TESTS ---
  console.log('\n❤️ 4. Like & Bookmark System');
  it('Toggles like on a post and increments like counter', () => {
    const likeResult = dbHelper.toggleLike(testUser.id, createdPost.id);
    assert.strictEqual(likeResult.liked, true);
    assert.strictEqual(likeResult.likesCount, 1);

    const postAfterLike = dbHelper.getPostById(createdPost.id, testUser.id);
    assert.strictEqual(postAfterLike.isLiked, true);
    assert.strictEqual(postAfterLike.likesCount, 1);
  });

  it('Toggles unlike on second call and decrements like counter', () => {
    const unlikeResult = dbHelper.toggleLike(testUser.id, createdPost.id);
    assert.strictEqual(unlikeResult.liked, false);
    assert.strictEqual(unlikeResult.likesCount, 0);

    const postAfterUnlike = dbHelper.getPostById(createdPost.id, testUser.id);
    assert.strictEqual(postAfterUnlike.isLiked, false);
    assert.strictEqual(postAfterUnlike.likesCount, 0);
  });

  it('Toggles bookmark on a post', () => {
    const bm1 = dbHelper.toggleBookmark(testUser.id, createdPost.id);
    assert.strictEqual(bm1.isBookmarked, true);

    const savedPosts = dbHelper.getUserBookmarkedPosts(testUser.id);
    assert(savedPosts.some(p => p.id === createdPost.id), 'Post must be in bookmarked list');

    const bm2 = dbHelper.toggleBookmark(testUser.id, createdPost.id);
    assert.strictEqual(bm2.isBookmarked, false);
  });

  // --- 5. COMMENTS SYSTEM TESTS ---
  console.log('\n💬 5. Comments System');
  let createdComment;
  it('Creates a comment on a post', () => {
    createdComment = dbHelper.createComment({
      postId: createdPost.id,
      userId: testUser.id,
      content: 'This is a test comment from testUser'
    });
    assert(createdComment.id, 'Comment should have an ID');
    assert.strictEqual(createdComment.content, 'This is a test comment from testUser');
    assert.strictEqual(createdComment.isOwner, true);
  });

  it('Lists all comments for a post', () => {
    const comments = dbHelper.getCommentsByPostId(createdPost.id, testUser.id);
    assert.strictEqual(comments.length, 1);
    assert.strictEqual(comments[0].id, createdComment.id);
  });

  it('Deletes comment by comment owner', () => {
    const deleted = dbHelper.deleteComment(createdComment.id, testUser.id);
    assert.strictEqual(deleted, true);

    const commentsAfter = dbHelper.getCommentsByPostId(createdPost.id);
    assert.strictEqual(commentsAfter.length, 0);
  });

  // --- 6. NOTIFICATIONS & SEARCH TESTS ---
  console.log('\n🔔 6. Notifications & Search');
  it('Creates notifications for user interactions', () => {
    dbHelper.createNotification({
      recipient_id: testUser.id,
      sender_id: targetUser.id,
      type: 'like',
      post_id: createdPost.id
    });
    const notifs = dbHelper.getNotifications(testUser.id);
    assert(notifs.length >= 1, 'User must have at least 1 notification');
    assert.strictEqual(notifs[0].type, 'like');

    const unreadCount = dbHelper.getUnreadNotificationCount(testUser.id);
    assert(unreadCount >= 1, 'Unread count should be >= 1');

    dbHelper.markNotificationsRead(testUser.id);
    const afterReadCount = dbHelper.getUnreadNotificationCount(testUser.id);
    assert.strictEqual(afterReadCount, 0, 'Unread count should be 0 after reading');
  });

  it('Searches users by username or full name', () => {
    const results = dbHelper.searchUsers('alex', testUser.id);
    assert(results.length >= 1, 'Search for alex should return results');
    assert.strictEqual(results[0].username, 'alex_coder');
  });

  it('Extracts trending hashtags from posts', () => {
    const trends = dbHelper.getTrendingTags();
    assert(Array.isArray(trends));
    assert(trends.length > 0);
    assert(trends.some(t => t.tag === 'tech' || t.tag === 'launch' || t.tag === 'webdev'));
  });

  // Clean up
  it('Deletes post cleanly', () => {
    const deleted = dbHelper.deletePost(createdPost.id, testUser.id);
    assert.strictEqual(deleted, true);
    assert.strictEqual(dbHelper.getPostById(createdPost.id), null);
  });

  console.log(`\n===========================================`);
  console.log(`🏁 Test Results: ${passed} passed, ${failed} failed`);
  console.log(`===========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test suite:', err);
  process.exit(1);
});
