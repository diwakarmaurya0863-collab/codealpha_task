/**
 * Pulse — Main Application Controller
 * Vanilla JavaScript SPA implementation
 */

const App = (() => {
  // State
  const state = {
    currentUser: null,
    currentView: 'feed',
    feedType: 'all',
    filterTag: null,
    selectedMediaFile: null,
    selectedMediaUrl: null,
    profileUser: null,
    profileTab: 'posts',
    theme: localStorage.getItem('pulse_theme') || 'dark',
    activeModal: null,
    searchDebounceTimer: null
  };

  // ==========================================
  // INITIALIZATION
  // ==========================================
  async function init() {
    applyTheme(state.theme);
    setupEventListeners();

    // Check authentication
    if (API.hasToken()) {
      try {
        const data = await API.auth.me();
        state.currentUser = data.user;
      } catch (err) {
        console.warn('Session expired or invalid, clearing token:', err);
        API.setToken(null);
        state.currentUser = null;
      }
    }

    // If no user is logged in, default to alex_coder for effortless demo experience
    if (!state.currentUser) {
      try {
        const demoRes = await API.auth.demoLogin('alex_coder');
        API.setToken(demoRes.token);
        state.currentUser = demoRes.user;
        showToast('Logged in as demo user @alex_coder', 'success');
      } catch (e) {
        console.warn('Could not auto-login demo account:', e);
      }
    }

    updateAuthUI();
    loadDemoAccountsWidget();
    loadSuggestedUsersWidget();
    loadTrendingTagsWidget();
    loadFeed();

    // Poll unread notifications periodically if logged in
    if (state.currentUser) {
      updateNotificationBadge();
      setInterval(updateNotificationBadge, 30000);
    }
  }

  function setupEventListeners() {
    // Post input character counter & resize
    const postInput = document.getElementById('post-input');
    if (postInput) {
      postInput.addEventListener('input', () => {
        const count = postInput.value.length;
        const counter = document.getElementById('char-counter');
        if (counter) {
          counter.textContent = `${count} / 500`;
          counter.className = 'char-counter';
          if (count > 450) counter.classList.add('warning');
          if (count >= 500) counter.classList.add('danger');
        }
      });
    }

    // Close search dropdown on click outside
    document.addEventListener('click', (e) => {
      const searchWidget = document.querySelector('.search-widget');
      const dropdown = document.getElementById('search-dropdown');
      if (searchWidget && dropdown && !searchWidget.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });

    // Close modal on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.activeModal) {
        closeModal(state.activeModal);
      }
    });
  }

  // ==========================================
  // THEME MANAGEMENT
  // ==========================================
  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pulse_theme', theme);
  }

  function toggleTheme() {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    showToast(`Switched to ${nextTheme} theme`, 'success');
  }

  // ==========================================
  // AUTH UI & STATE
  // ==========================================
  function updateAuthUI() {
    const isAuth = !!state.currentUser;

    document.querySelectorAll('.auth-only').forEach(el => {
      el.style.display = isAuth ? '' : 'none';
    });
    document.querySelectorAll('.guest-only').forEach(el => {
      el.style.display = isAuth ? 'none' : '';
    });

    if (isAuth) {
      const avatarEl = document.getElementById('sidebar-user-avatar');
      const nameEl = document.getElementById('sidebar-user-name');
      const handleEl = document.getElementById('sidebar-user-handle');
      const creatorAvatarEl = document.getElementById('creator-avatar');

      if (avatarEl) avatarEl.src = state.currentUser.avatar_url || getDefaultAvatar(state.currentUser.username);
      if (nameEl) nameEl.textContent = state.currentUser.full_name;
      if (handleEl) handleEl.textContent = `@${state.currentUser.username}`;
      if (creatorAvatarEl) creatorAvatarEl.src = state.currentUser.avatar_url || getDefaultAvatar(state.currentUser.username);
    }
  }

  async function loginAsDemo(username) {
    try {
      const res = await API.auth.demoLogin(username);
      API.setToken(res.token);
      state.currentUser = res.user;
      updateAuthUI();
      closeModal('modal-auth');
      showToast(`Switched account to @${res.user.username}`, 'success');
      loadSuggestedUsersWidget();
      loadFeed();
      updateNotificationBadge();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function logout() {
    API.setToken(null);
    state.currentUser = null;
    updateAuthUI();
    showToast('Logged out successfully', 'success');
    loadSuggestedUsersWidget();
    loadFeed();
  }

  // ==========================================
  // NAVIGATION & ROUTING
  // ==========================================
  function navigateTo(viewName, params = {}) {
    // Hide all views
    document.querySelectorAll('.page-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    state.currentView = viewName;

    // Reset title
    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');
    subtitleEl.textContent = '';

    if (viewName === 'feed') {
      titleEl.textContent = 'Home';
      document.getElementById('view-feed').classList.add('active');
      document.getElementById('nav-feed').classList.add('active');
      loadFeed();
    } else if (viewName === 'my-profile') {
      if (!state.currentUser) return openAuthModal('login');
      loadProfile(state.currentUser.username);
    } else if (viewName === 'profile') {
      loadProfile(params.username);
    } else if (viewName === 'notifications') {
      titleEl.textContent = 'Notifications';
      document.getElementById('view-notifications').classList.add('active');
      const navNotif = document.getElementById('nav-notifications');
      if (navNotif) navNotif.classList.add('active');
      loadNotifications();
    } else if (viewName === 'saved') {
      titleEl.textContent = 'Saved Posts';
      document.getElementById('view-saved').classList.add('active');
      const navSaved = document.getElementById('nav-saved');
      if (navSaved) navSaved.classList.add('active');
      loadSavedPosts();
    } else if (viewName === 'explore') {
      titleEl.textContent = 'Explore';
      document.getElementById('view-explore').classList.add('active');
      document.getElementById('nav-explore').classList.add('active');
      loadExplore();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function focusPostCreator() {
    navigateTo('feed');
    const input = document.getElementById('post-input');
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ==========================================
  // POSTS & FEED
  // ==========================================
  function switchFeedTab(type) {
    state.feedType = type;
    document.getElementById('tab-for-you').classList.toggle('active', type === 'all');
    const tabFollowing = document.getElementById('tab-following');
    if (tabFollowing) tabFollowing.classList.toggle('active', type === 'following');
    loadFeed();
  }

  function setTagFilter(tag) {
    state.filterTag = tag.replace('#', '');
    const banner = document.getElementById('tag-filter-banner');
    const tagLabel = document.getElementById('current-filter-tag');
    if (banner && tagLabel) {
      tagLabel.textContent = `#${state.filterTag}`;
      banner.style.display = 'flex';
    }
    navigateTo('feed');
    loadFeed();
  }

  function clearTagFilter() {
    state.filterTag = null;
    const banner = document.getElementById('tag-filter-banner');
    if (banner) banner.style.display = 'none';
    loadFeed();
  }

  async function loadFeed() {
    const container = document.getElementById('posts-container');
    if (!container) return;

    container.innerHTML = `
      <div class="empty-state">
        <p>Loading posts...</p>
      </div>
    `;

    try {
      const res = await API.posts.getFeed(state.feedType, state.filterTag);
      const posts = res.posts || [];

      if (posts.length === 0) {
        const isFollowingFeed = state.feedType === 'following';
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">${isFollowingFeed ? '👥' : '📝'}</div>
            <div class="empty-state-title">${isFollowingFeed ? 'No posts from people you follow' : 'No posts found'}</div>
            <p>${isFollowingFeed ? 'Follow more creators from the sidebar to see their posts here!' : 'Be the first to share your thoughts!'}</p>
          </div>
        `;
        return;
      }

      container.innerHTML = posts.map(post => renderPostCard(post)).join('');
    } catch (err) {
      container.innerHTML = `
        <div class="empty-state">
          <p style="color: var(--danger);">Failed to load posts: ${escapeHtml(err.message)}</p>
          <button class="btn btn-sm btn-outline" style="margin-top: 10px;" onclick="App.loadFeed()">Retry</button>
        </div>
      `;
    }
  }

  function renderPostCard(post) {
    const author = post.author || {};
    const formattedTime = formatTimeAgo(post.createdAt);
    const parsedContent = formatPostContent(post.content);
    const likedClass = post.isLiked ? 'liked' : '';
    const bookmarkedClass = post.isBookmarked ? 'bookmarked' : '';

    return `
      <article class="post-card" id="post-${post.id}">
        <div class="post-main">
          <div class="post-avatar-col">
            <img src="${escapeHtml(author.avatarUrl || getDefaultAvatar(author.username))}" 
                 alt="${escapeHtml(author.username)}" 
                 class="avatar avatar-md"
                 onclick="App.navigateTo('profile', { username: '${escapeHtml(author.username)}' })"
                 style="cursor: pointer;">
          </div>
          <div class="post-content-col">
            <div class="post-header">
              <div class="post-user-info">
                <span class="post-author-name" onclick="App.navigateTo('profile', { username: '${escapeHtml(author.username)}' })">
                  ${escapeHtml(author.fullName || author.username)}
                </span>
                <span class="post-author-handle" onclick="App.navigateTo('profile', { username: '${escapeHtml(author.username)}' })">
                  @${escapeHtml(author.username)}
                </span>
                <span class="post-dot">·</span>
                <span class="post-time">${formattedTime}</span>
              </div>
              ${post.isOwner ? `
                <div class="post-actions-menu">
                  <button class="btn-icon" onclick="App.deletePost(${post.id})" title="Delete post">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              ` : ''}
            </div>

            <div class="post-text">${parsedContent}</div>

            ${post.mediaUrl ? `
              <div class="post-media" onclick="App.openLightbox('${escapeHtml(post.mediaUrl)}')">
                <img src="${escapeHtml(post.mediaUrl)}" alt="Post image" loading="lazy">
              </div>
            ` : ''}

            <div class="post-actions-bar">
              <!-- Comment Toggle -->
              <button class="action-btn btn-comment" onclick="App.toggleComments(${post.id})">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span id="comment-count-${post.id}">${post.commentsCount || 0}</span>
              </button>

              <!-- Like Toggle -->
              <button class="action-btn btn-like ${likedClass}" id="like-btn-${post.id}" onclick="App.toggleLike(${post.id})">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                <span id="like-count-${post.id}">${post.likesCount || 0}</span>
              </button>

              <!-- Bookmark Toggle -->
              <button class="action-btn btn-bookmark ${bookmarkedClass}" id="bookmark-btn-${post.id}" onclick="App.toggleBookmark(${post.id})" title="Save post">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                </svg>
              </button>

              <!-- Share / Copy Link -->
              <button class="action-btn" onclick="App.copyPostLink(${post.id})" title="Copy link to post">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="18" cy="5" r="3"></circle>
                  <circle cx="6" cy="12" r="3"></circle>
                  <circle cx="18" cy="19" r="3"></circle>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                </svg>
              </button>
            </div>

            <!-- Inline Comments Section (hidden by default) -->
            <div class="comments-section" id="comments-section-${post.id}" style="display: none;">
              <div class="comment-input-box auth-only">
                <img src="${escapeHtml(state.currentUser?.avatar_url || getDefaultAvatar(state.currentUser?.username || 'user'))}" class="avatar avatar-sm" alt="avatar">
                <input type="text" id="comment-input-${post.id}" placeholder="Write a comment..." onkeydown="if(event.key === 'Enter') App.submitComment(${post.id})">
                <button class="btn btn-primary btn-sm" onclick="App.submitComment(${post.id})">Reply</button>
              </div>
              <div class="comments-list" id="comments-list-${post.id}">
                <p style="color: var(--text-muted); font-size: 0.85rem;">Loading comments...</p>
              </div>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  // ==========================================
  // POST CREATION & INTERACTIONS
  // ==========================================
  function handleImageSelected(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file', 'error');
      return;
    }

    state.selectedMediaFile = file;
    state.selectedMediaUrl = null;

    const reader = new FileReader();
    reader.onload = (event) => {
      const previewBox = document.getElementById('media-preview-container');
      const previewImg = document.getElementById('media-preview-img');
      previewImg.src = event.target.result;
      previewBox.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  function promptImageUrl() {
    const url = prompt('Enter public image URL (JPEG, PNG, WEBP):');
    if (!url || !url.trim()) return;

    state.selectedMediaUrl = url.trim();
    state.selectedMediaFile = null;

    const previewBox = document.getElementById('media-preview-container');
    const previewImg = document.getElementById('media-preview-img');
    previewImg.src = state.selectedMediaUrl;
    previewBox.style.display = 'block';
  }

  function removeSelectedMedia() {
    state.selectedMediaFile = null;
    state.selectedMediaUrl = null;
    const fileInput = document.getElementById('post-file-input');
    if (fileInput) fileInput.value = '';
    const previewBox = document.getElementById('media-preview-container');
    if (previewBox) previewBox.style.display = 'none';
  }

  function insertEmoji(emoji) {
    const input = document.getElementById('post-input');
    if (input) {
      input.value += emoji;
      input.dispatchEvent(new Event('input'));
      input.focus();
    }
  }

  async function submitPost() {
    if (!state.currentUser) return openAuthModal('login');

    const input = document.getElementById('post-input');
    const content = input ? input.value.trim() : '';

    if (!content) {
      showToast('Post content cannot be empty', 'error');
      return;
    }

    const btnSubmit = document.getElementById('btn-submit-post');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Posting...';

    try {
      let result;
      if (state.selectedMediaFile) {
        const formData = new FormData();
        formData.append('content', content);
        formData.append('media', state.selectedMediaFile);
        result = await API.posts.create(formData);
      } else {
        result = await API.posts.create({
          content,
          media_url: state.selectedMediaUrl || ''
        });
      }

      showToast('Post published successfully! 🚀', 'success');

      // Clear input
      input.value = '';
      document.getElementById('char-counter').textContent = '0 / 500';
      removeSelectedMedia();

      // Refresh feed and trending tags
      loadFeed();
      loadTrendingTagsWidget();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Post';
    }
  }

  async function deletePost(postId) {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      await API.posts.delete(postId);
      showToast('Post deleted', 'success');

      const card = document.getElementById(`post-${postId}`);
      if (card) {
        card.style.opacity = '0';
        card.style.transform = 'scale(0.95)';
        setTimeout(() => card.remove(), 200);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function toggleLike(postId) {
    if (!state.currentUser) return openAuthModal('login');

    const btn = document.getElementById(`like-btn-${postId}`);
    const countEl = document.getElementById(`like-count-${postId}`);

    try {
      const res = await API.posts.toggleLike(postId);
      if (res.liked) {
        btn.classList.add('liked');
      } else {
        btn.classList.remove('liked');
      }
      countEl.textContent = res.likesCount;
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function toggleBookmark(postId) {
    if (!state.currentUser) return openAuthModal('login');

    const btn = document.getElementById(`bookmark-btn-${postId}`);
    try {
      const res = await API.posts.toggleBookmark(postId);
      if (res.isBookmarked) {
        btn.classList.add('bookmarked');
        showToast('Saved to bookmarks', 'success');
      } else {
        btn.classList.remove('bookmarked');
        showToast('Removed from bookmarks', 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function copyPostLink(postId) {
    const url = `${window.location.origin}/#post-${postId}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast('Link copied to clipboard! 📋', 'success');
    }).catch(() => {
      showToast('Post link: ' + url, 'success');
    });
  }

  // ==========================================
  // COMMENTS
  // ==========================================
  async function toggleComments(postId) {
    const tray = document.getElementById(`comments-section-${postId}`);
    if (!tray) return;

    if (tray.style.display === 'none') {
      tray.style.display = 'block';
      loadComments(postId);
    } else {
      tray.style.display = 'none';
    }
  }

  async function loadComments(postId) {
    const listEl = document.getElementById(`comments-list-${postId}`);
    if (!listEl) return;

    try {
      const res = await API.posts.getComments(postId);
      const comments = res.comments || [];

      if (comments.length === 0) {
        listEl.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; padding: 0.5rem 0;">No comments yet. Start the conversation!</p>`;
        return;
      }

      listEl.innerHTML = comments.map(c => `
        <div class="comment-item" id="comment-${c.id}">
          <img src="${escapeHtml(c.author.avatarUrl || getDefaultAvatar(c.author.username))}" 
               alt="${escapeHtml(c.author.username)}" 
               class="avatar avatar-sm"
               onclick="App.navigateTo('profile', { username: '${escapeHtml(c.author.username)}' })"
               style="cursor: pointer;">
          <div class="comment-body">
            <div class="comment-header">
              <span class="comment-author" onclick="App.navigateTo('profile', { username: '${escapeHtml(c.author.username)}' })">
                ${escapeHtml(c.author.fullName || c.author.username)}
              </span>
              <span class="comment-time">${formatTimeAgo(c.createdAt)}</span>
            </div>
            <div class="comment-text">${escapeHtml(c.content)}</div>
          </div>
          ${c.isOwner ? `
            <button class="comment-delete-btn" onclick="App.deleteComment(${postId}, ${c.id})" title="Delete comment">✕</button>
          ` : ''}
        </div>
      `).join('');
    } catch (err) {
      listEl.innerHTML = `<p style="color: var(--danger); font-size: 0.85rem;">Failed to load comments</p>`;
    }
  }

  async function submitComment(postId) {
    if (!state.currentUser) return openAuthModal('login');

    const input = document.getElementById(`comment-input-${postId}`);
    const content = input ? input.value.trim() : '';

    if (!content) return;

    try {
      const res = await API.posts.addComment(postId, content);
      input.value = '';

      // Update count
      const countEl = document.getElementById(`comment-count-${postId}`);
      if (countEl) countEl.textContent = res.commentsCount;

      loadComments(postId);
      showToast('Comment posted', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function deleteComment(postId, commentId) {
    if (!confirm('Delete this comment?')) return;

    try {
      await API.posts.deleteComment(commentId);
      showToast('Comment deleted', 'success');

      // Update count
      const countEl = document.getElementById(`comment-count-${postId}`);
      if (countEl) {
        const cur = parseInt(countEl.textContent, 10) || 1;
        countEl.textContent = Math.max(0, cur - 1);
      }

      const item = document.getElementById(`comment-${commentId}`);
      if (item) item.remove();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ==========================================
  // USER PROFILES & FOLLOW SYSTEM
  // ==========================================
  async function loadProfile(username) {
    // Hide all views, show profile
    document.querySelectorAll('.page-view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-profile').classList.add('active');
    state.currentView = 'profile';

    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');

    try {
      const res = await API.users.getProfile(username);
      const user = res.user;
      state.profileUser = user;

      titleEl.textContent = user.full_name || user.username;
      subtitleEl.textContent = `${user.stats?.postsCount || 0} posts`;

      // Set banner & avatar
      const bannerImg = document.getElementById('profile-banner-img');
      bannerImg.src = user.banner_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop&q=80';

      const avatarImg = document.getElementById('profile-avatar-img');
      avatarImg.src = user.avatar_url || getDefaultAvatar(user.username);

      document.getElementById('profile-full-name').textContent = user.full_name;
      document.getElementById('profile-handle').textContent = `@${user.username}`;
      document.getElementById('profile-bio').textContent = user.bio || 'No bio provided yet.';

      // Location
      const locWrap = document.getElementById('profile-location-wrap');
      if (user.location) {
        locWrap.style.display = 'inline-flex';
        document.getElementById('profile-location').textContent = user.location;
      } else {
        locWrap.style.display = 'none';
      }

      // Website
      const webWrap = document.getElementById('profile-website-wrap');
      if (user.website) {
        webWrap.style.display = 'inline-flex';
        webWrap.href = user.website.startsWith('http') ? user.website : `https://${user.website}`;
        document.getElementById('profile-website').textContent = user.website.replace(/^https?:\/\//, '');
      } else {
        webWrap.style.display = 'none';
      }

      // Joined date
      document.getElementById('profile-joined').textContent = `Joined ${formatDate(user.created_at)}`;

      // Stats
      document.getElementById('profile-following-count').textContent = user.stats?.followingCount || 0;
      document.getElementById('profile-followers-count').textContent = user.stats?.followersCount || 0;
      document.getElementById('profile-posts-count').textContent = user.stats?.postsCount || 0;

      // Action Button (Edit Profile vs Follow / Following)
      const actionContainer = document.getElementById('profile-action-btn-container');
      if (user.isSelf) {
        actionContainer.innerHTML = `
          <button class="btn btn-outline" onclick="App.openEditProfileModal()">Edit Profile</button>
        `;
      } else {
        const isFollowing = user.isFollowing;
        actionContainer.innerHTML = `
          <button class="btn ${isFollowing ? 'btn-following' : 'btn-follow'}" 
                  id="profile-follow-btn" 
                  onclick="App.toggleFollowUser(${user.id})">
            ${isFollowing ? 'Following' : 'Follow'}
          </button>
        `;
      }

      // Load Profile Posts
      switchProfileTab('posts');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function switchProfileTab(tab) {
    state.profileTab = tab;
    document.getElementById('profile-tab-posts').classList.toggle('active', tab === 'posts');
    document.getElementById('profile-tab-likes').classList.toggle('active', tab === 'likes');
    loadProfilePosts();
  }

  async function loadProfilePosts() {
    if (!state.profileUser) return;
    const container = document.getElementById('profile-posts-container');
    container.innerHTML = `<div class="empty-state"><p>Loading posts...</p></div>`;

    try {
      let res;
      if (state.profileTab === 'posts') {
        res = await API.posts.getUserPosts(state.profileUser.username);
      } else {
        res = await API.posts.getUserLikes(state.profileUser.username);
      }

      const posts = res.posts || [];
      if (posts.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📭</div>
            <div class="empty-state-title">No ${state.profileTab} yet</div>
            <p>When @${escapeHtml(state.profileUser.username)} shares or likes posts, they will appear here.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = posts.map(p => renderPostCard(p)).join('');
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p style="color: var(--danger);">${escapeHtml(err.message)}</p></div>`;
    }
  }

  async function toggleFollowUser(targetUserId) {
    if (!state.currentUser) return openAuthModal('login');

    try {
      const res = await API.users.toggleFollow(targetUserId);

      // Update follow button on profile page if open
      const profileBtn = document.getElementById('profile-follow-btn');
      if (profileBtn) {
        profileBtn.className = `btn ${res.isFollowing ? 'btn-following' : 'btn-follow'}`;
        profileBtn.textContent = res.isFollowing ? 'Following' : 'Follow';
      }

      // Update profile counters if viewing profile
      if (state.profileUser && state.profileUser.id === targetUserId) {
        document.getElementById('profile-followers-count').textContent = res.targetStats.followersCount;
      }

      // Update current user cached stats
      if (state.currentUser) {
        state.currentUser.stats = res.currentUserStats;
      }

      showToast(res.isFollowing ? 'Followed user' : 'Unfollowed user', 'success');

      // Refresh sidebar recommendations
      loadSuggestedUsersWidget();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ==========================================
  // FOLLOWERS / FOLLOWING MODAL
  // ==========================================
  async function openFollowModal(type) {
    if (!state.profileUser) return;
    const title = type === 'followers' ? 'Followers' : 'Following';
    document.getElementById('users-modal-title').textContent = title;

    const container = document.getElementById('modal-users-container');
    container.innerHTML = `<p style="color: var(--text-muted); padding: 1rem;">Loading...</p>`;
    openModal('modal-users-list');

    try {
      const res = type === 'followers' 
        ? await API.users.getFollowers(state.profileUser.id)
        : await API.users.getFollowing(state.profileUser.id);

      const list = res.followers || res.following || [];
      if (list.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>No ${type} yet</p></div>`;
        return;
      }

      container.innerHTML = list.map(u => `
        <div class="user-item-row" style="padding: 0.5rem 0;">
          <div class="user-item-meta" onclick="App.closeModal('modal-users-list'); App.navigateTo('profile', { username: '${escapeHtml(u.username)}' });">
            <img src="${escapeHtml(u.avatar_url || getDefaultAvatar(u.username))}" class="avatar avatar-md" alt="${escapeHtml(u.username)}">
            <div class="user-item-text">
              <span class="user-item-name">${escapeHtml(u.full_name || u.username)}</span>
              <span class="user-item-handle">@${escapeHtml(u.username)}</span>
            </div>
          </div>
          ${!u.isSelf ? `
            <button class="btn btn-sm ${u.isFollowing ? 'btn-following' : 'btn-follow'}" 
                    onclick="App.toggleFollowFromModal(this, ${u.id})">
              ${u.isFollowing ? 'Following' : 'Follow'}
            </button>
          ` : ''}
        </div>
      `).join('');
    } catch (err) {
      container.innerHTML = `<p style="color: var(--danger); padding: 1rem;">Failed to load ${type}</p>`;
    }
  }

  async function toggleFollowFromModal(buttonEl, userId) {
    if (!state.currentUser) return openAuthModal('login');
    try {
      const res = await API.users.toggleFollow(userId);
      buttonEl.className = `btn btn-sm ${res.isFollowing ? 'btn-following' : 'btn-follow'}`;
      buttonEl.textContent = res.isFollowing ? 'Following' : 'Follow';

      if (state.profileUser) {
        // Refresh profile stats
        const profileRes = await API.users.getProfile(state.profileUser.username);
        state.profileUser = profileRes.user;
        document.getElementById('profile-following-count').textContent = state.profileUser.stats.followingCount;
        document.getElementById('profile-followers-count').textContent = state.profileUser.stats.followersCount;
      }
      loadSuggestedUsersWidget();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ==========================================
  // PROFILE EDITING
  // ==========================================
  function openEditProfileModal() {
    if (!state.currentUser) return;
    document.getElementById('edit-fullname').value = state.currentUser.full_name || '';
    document.getElementById('edit-bio').value = state.currentUser.bio || '';
    document.getElementById('edit-location').value = state.currentUser.location || '';
    document.getElementById('edit-website').value = state.currentUser.website || '';
    document.getElementById('edit-avatar-url').value = state.currentUser.avatar_url || '';
    document.getElementById('edit-banner-url').value = state.currentUser.banner_url || '';
    document.getElementById('edit-avatar-preview').src = state.currentUser.avatar_url || getDefaultAvatar(state.currentUser.username);

    openModal('modal-edit-profile');
  }

  async function handleProfileUpdate(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-profile');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const full_name = document.getElementById('edit-fullname').value;
    const bio = document.getElementById('edit-bio').value;
    const location = document.getElementById('edit-location').value;
    const website = document.getElementById('edit-website').value;
    const avatar_url = document.getElementById('edit-avatar-url').value;
    const banner_url = document.getElementById('edit-banner-url').value;

    try {
      const res = await API.users.updateProfile({
        full_name,
        bio,
        location,
        website,
        avatar_url,
        banner_url
      });

      state.currentUser = res.user;
      updateAuthUI();
      closeModal('modal-edit-profile');
      showToast('Profile updated successfully!', 'success');

      // Refresh profile view if currently open
      if (state.currentView === 'profile' && state.profileUser?.id === state.currentUser.id) {
        loadProfile(state.currentUser.username);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Changes';
    }
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      showToast('Uploading avatar...', 'success');
      const res = await API.users.uploadAvatar(formData);
      state.currentUser = res.user;
      document.getElementById('edit-avatar-preview').src = res.avatarUrl;
      document.getElementById('edit-avatar-url').value = res.avatarUrl;
      updateAuthUI();
      showToast('Avatar uploaded successfully!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ==========================================
  // SIDEBAR WIDGETS (DEMO, WHO TO FOLLOW, TRENDS)
  // ==========================================
  async function loadDemoAccountsWidget() {
    const box = document.getElementById('demo-accounts-box');
    if (!box) return;

    try {
      const res = await API.auth.getDemoUsers();
      const demoUsers = res.demoUsers || [];

      box.innerHTML = demoUsers.map(u => `
        <div class="demo-account-chip" onclick="App.loginAsDemo('${escapeHtml(u.username)}')">
          <div class="demo-chip-user">
            <img src="${escapeHtml(u.avatar_url || getDefaultAvatar(u.username))}" class="avatar avatar-sm" alt="${escapeHtml(u.username)}">
            <div>
              <div class="demo-chip-name">${escapeHtml(u.full_name)}</div>
              <div class="demo-chip-role">@${escapeHtml(u.username)} · ${escapeHtml(u.role || '')}</div>
            </div>
          </div>
          <span style="font-size: 0.75rem; color: var(--accent-primary); font-weight: 700;">Login →</span>
        </div>
      `).join('');
    } catch (e) {
      console.warn('Could not load demo accounts:', e);
    }
  }

  async function loadSuggestedUsersWidget() {
    const box = document.getElementById('suggested-users-box');
    if (!box) return;

    try {
      const res = await API.users.getSuggested();
      const users = res.users || [];

      if (users.length === 0) {
        box.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No new suggestions right now.</p>`;
        return;
      }

      box.innerHTML = users.map(u => `
        <div class="user-item-row">
          <div class="user-item-meta" onclick="App.navigateTo('profile', { username: '${escapeHtml(u.username)}' })">
            <img src="${escapeHtml(u.avatar_url || getDefaultAvatar(u.username))}" class="avatar avatar-sm" alt="${escapeHtml(u.username)}">
            <div class="user-item-text">
              <span class="user-item-name">${escapeHtml(u.full_name || u.username)}</span>
              <span class="user-item-handle">@${escapeHtml(u.username)}</span>
            </div>
          </div>
          <button class="btn btn-follow btn-sm" onclick="App.toggleFollowUser(${u.id})">Follow</button>
        </div>
      `).join('');
    } catch (e) {
      console.warn('Could not load suggested users:', e);
    }
  }

  async function loadTrendingTagsWidget() {
    const box = document.getElementById('trending-tags-box');
    if (!box) return;

    try {
      const res = await API.posts.getTrendingTags();
      const tags = res.tags || [];

      if (tags.length === 0) {
        box.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No trending tags yet.</p>`;
        return;
      }

      box.innerHTML = tags.map(t => `
        <div class="trending-tag-item" onclick="App.setTagFilter('${escapeHtml(t.tag)}')">
          <span class="trending-tag-name">#${escapeHtml(t.tag)}</span>
          <span class="trending-tag-count">${t.count} posts</span>
        </div>
      `).join('');
    } catch (e) {
      console.warn('Could not load trending tags:', e);
    }
  }

  // ==========================================
  // SEARCH & EXPLORE
  // ==========================================
  function handleLiveSearch(e) {
    const query = e.target.value.trim();
    const dropdown = document.getElementById('search-dropdown');

    clearTimeout(state.searchDebounceTimer);
    if (!query) {
      dropdown.style.display = 'none';
      return;
    }

    state.searchDebounceTimer = setTimeout(async () => {
      try {
        const res = await API.users.search(query);
        const users = res.users || [];

        if (users.length === 0) {
          dropdown.innerHTML = `<div style="padding: 0.75rem 1rem; color: var(--text-muted); font-size: 0.85rem;">No users found for "${escapeHtml(query)}"</div>`;
        } else {
          dropdown.innerHTML = users.map(u => `
            <div class="search-result-item" onclick="App.navigateTo('profile', { username: '${escapeHtml(u.username)}' }); document.getElementById('search-dropdown').style.display = 'none';">
              <img src="${escapeHtml(u.avatar_url || getDefaultAvatar(u.username))}" class="avatar avatar-sm" alt="${escapeHtml(u.username)}">
              <div>
                <div style="font-weight: 700; font-size: 0.88rem;">${escapeHtml(u.full_name || u.username)}</div>
                <div style="font-size: 0.78rem; color: var(--text-muted);">@${escapeHtml(u.username)}</div>
              </div>
            </div>
          `).join('');
        }
        dropdown.style.display = 'block';
      } catch (err) {
        dropdown.style.display = 'none';
      }
    }, 250);
  }

  function showSearchResults() {
    const input = document.getElementById('sidebar-search-input');
    if (input && input.value.trim()) {
      handleLiveSearch({ target: input });
    }
  }

  async function loadExplore() {
    const container = document.getElementById('explore-results-container');
    container.innerHTML = `
      <div style="padding: 1.5rem;">
        <h3 style="margin-bottom: 1rem; font-size: 1.1rem;">Popular Creators</h3>
        <div id="explore-creators-list" class="suggested-users-list"></div>
      </div>
    `;

    try {
      const res = await API.users.getSuggested();
      const creatorsList = document.getElementById('explore-creators-list');
      if (creatorsList && res.users) {
        creatorsList.innerHTML = res.users.map(u => `
          <div class="card widget-card" style="margin-bottom: 0.75rem;">
            <div class="user-item-row">
              <div class="user-item-meta" onclick="App.navigateTo('profile', { username: '${escapeHtml(u.username)}' })">
                <img src="${escapeHtml(u.avatar_url || getDefaultAvatar(u.username))}" class="avatar avatar-md" alt="${escapeHtml(u.username)}">
                <div class="user-item-text">
                  <span class="user-item-name">${escapeHtml(u.full_name || u.username)}</span>
                  <span class="user-item-handle">@${escapeHtml(u.username)}</span>
                  <span style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">${escapeHtml(u.bio || '')}</span>
                </div>
              </div>
              <button class="btn btn-follow btn-sm" onclick="App.toggleFollowUser(${u.id})">Follow</button>
            </div>
          </div>
        `).join('');
      }
    } catch (e) {
      console.warn(e);
    }
  }

  function handleExploreSearch(e) {
    const query = e.target.value.trim();
    if (!query) return loadExplore();

    clearTimeout(state.searchDebounceTimer);
    state.searchDebounceTimer = setTimeout(async () => {
      const container = document.getElementById('explore-results-container');
      try {
        const res = await API.users.search(query);
        const users = res.users || [];

        if (users.length === 0) {
          container.innerHTML = `<div class="empty-state"><p>No users matching "${escapeHtml(query)}"</p></div>`;
          return;
        }

        container.innerHTML = users.map(u => `
          <div class="card widget-card" style="margin: 0.75rem 1.25rem;">
            <div class="user-item-row">
              <div class="user-item-meta" onclick="App.navigateTo('profile', { username: '${escapeHtml(u.username)}' })">
                <img src="${escapeHtml(u.avatar_url || getDefaultAvatar(u.username))}" class="avatar avatar-md" alt="${escapeHtml(u.username)}">
                <div class="user-item-text">
                  <span class="user-item-name">${escapeHtml(u.full_name || u.username)}</span>
                  <span class="user-item-handle">@${escapeHtml(u.username)}</span>
                  <span style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">${escapeHtml(u.bio || '')}</span>
                </div>
              </div>
              ${!u.isSelf ? `
                <button class="btn ${u.isFollowing ? 'btn-following' : 'btn-follow'} btn-sm" onclick="App.toggleFollowUser(${u.id})">
                  ${u.isFollowing ? 'Following' : 'Follow'}
                </button>
              ` : ''}
            </div>
          </div>
        `).join('');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }, 300);
  }

  // ==========================================
  // NOTIFICATIONS
  // ==========================================
  async function updateNotificationBadge() {
    if (!state.currentUser) return;
    try {
      const res = await API.notifications.getUnreadCount();
      const badge = document.getElementById('unread-badge');
      if (badge) {
        if (res.count > 0) {
          badge.textContent = res.count > 99 ? '99+' : res.count;
          badge.style.display = 'block';
        } else {
          badge.style.display = 'none';
        }
      }
    } catch (e) {
      console.warn(e);
    }
  }

  async function loadNotifications() {
    const container = document.getElementById('notifications-container');
    container.innerHTML = `<div class="empty-state"><p>Loading notifications...</p></div>`;

    try {
      const res = await API.notifications.getAll();
      const list = res.notifications || [];

      if (list.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🔔</div>
            <div class="empty-state-title">No notifications yet</div>
            <p>When someone likes your posts, comments, or follows you, you'll see it here.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = list.map(n => {
        let iconSvg = '';
        let actionText = '';
        let typeClass = n.type;

        if (n.type === 'like') {
          iconSvg = `❤️`;
          actionText = `liked your post: "${escapeHtml(n.post_content ? n.post_content.substring(0, 50) + '...' : 'post')}"`;
        } else if (n.type === 'comment') {
          iconSvg = `💬`;
          actionText = `commented on your post`;
        } else if (n.type === 'follow') {
          iconSvg = `👤`;
          actionText = `started following you`;
        }

        return `
          <div class="notification-item ${n.is_read ? '' : 'unread'}" onclick="App.navigateTo('profile', { username: '${escapeHtml(n.sender_username)}' })" style="cursor: pointer;">
            <div class="notification-icon-col ${typeClass}">
              <span>${iconSvg}</span>
            </div>
            <div class="notification-content">
              <div class="notification-text">
                <strong>${escapeHtml(n.sender_name || n.sender_username)}</strong> (@${escapeHtml(n.sender_username)}) ${actionText}
              </div>
              <div class="notification-time">${formatTimeAgo(n.created_at)}</div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p style="color: var(--danger);">${escapeHtml(err.message)}</p></div>`;
    }
  }

  async function markAllNotificationsRead() {
    try {
      await API.notifications.markRead();
      const badge = document.getElementById('unread-badge');
      if (badge) badge.style.display = 'none';

      document.querySelectorAll('.notification-item.unread').forEach(el => {
        el.classList.remove('unread');
      });
      showToast('All notifications marked as read', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ==========================================
  // SAVED POSTS (BOOKMARKS)
  // ==========================================
  async function loadSavedPosts() {
    const container = document.getElementById('saved-posts-container');
    container.innerHTML = `<div class="empty-state"><p>Loading saved posts...</p></div>`;

    try {
      const res = await API.posts.getSaved();
      const posts = res.posts || [];

      if (posts.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🔖</div>
            <div class="empty-state-title">No saved posts yet</div>
            <p>Save posts by clicking the bookmark icon on any post to read them later!</p>
          </div>
        `;
        return;
      }

      container.innerHTML = posts.map(p => renderPostCard(p)).join('');
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p style="color: var(--danger);">${escapeHtml(err.message)}</p></div>`;
    }
  }

  // ==========================================
  // MODALS & AUTH FORMS
  // ==========================================
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'flex';
      state.activeModal = modalId;
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
      if (state.activeModal === modalId) state.activeModal = null;
    }
  }

  function openAuthModal(tab = 'login') {
    switchAuthTab(tab);
    openModal('modal-auth');
  }

  function switchAuthTab(tab) {
    const isLogin = tab === 'login';
    document.getElementById('auth-tab-login').classList.toggle('active', isLogin);
    document.getElementById('auth-tab-register').classList.toggle('active', !isLogin);
    document.getElementById('form-login').style.display = isLogin ? 'block' : 'none';
    document.getElementById('form-register').style.display = isLogin ? 'none' : 'block';
    document.getElementById('auth-modal-title').textContent = isLogin ? 'Log In to Pulse' : 'Join Pulse Today';

    const loginErr = document.getElementById('login-error');
    const regErr = document.getElementById('reg-error');
    if (loginErr) loginErr.style.display = 'none';
    if (regErr) regErr.style.display = 'none';
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    const identifier = document.getElementById('login-identifier').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');

    try {
      const res = await API.auth.login(identifier, password);
      API.setToken(res.token);
      state.currentUser = res.user;
      updateAuthUI();
      closeModal('modal-auth');
      showToast(`Welcome back, @${res.user.username}!`, 'success');
      loadSuggestedUsersWidget();
      loadFeed();
      updateNotificationBadge();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  }

  async function handleRegisterSubmit(e) {
    e.preventDefault();
    const full_name = document.getElementById('reg-fullname').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const bio = document.getElementById('reg-bio').value.trim();
    const errEl = document.getElementById('reg-error');

    try {
      const res = await API.auth.register({ full_name, username, email, password, bio });
      API.setToken(res.token);
      state.currentUser = res.user;
      updateAuthUI();
      closeModal('modal-auth');
      showToast(`Account created! Welcome to Pulse, @${res.user.username}! 🎉`, 'success');
      loadSuggestedUsersWidget();
      loadFeed();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  }

  function openDemoSwitcherModal() {
    openAuthModal('login');
  }

  // ==========================================
  // LIGHTBOX & TOASTS
  // ==========================================
  function openLightbox(imgUrl) {
    const lightbox = document.getElementById('modal-lightbox');
    const img = document.getElementById('lightbox-img');
    img.src = imgUrl;
    lightbox.style.display = 'flex';
  }

  function closeLightbox() {
    const lightbox = document.getElementById('modal-lightbox');
    if (lightbox) lightbox.style.display = 'none';
  }

  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✓' : '⚠️'}</span>
      <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ==========================================
  // HELPERS
  // ==========================================
  function formatPostContent(text) {
    if (!text) return '';
    let escaped = escapeHtml(text);

    // Replace hashtags: #tag -> clickable link
    escaped = escaped.replace(/#([a-zA-Z0-9_]+)/g, '<span class="post-tag" onclick="App.setTagFilter(\'$1\'); event.stopPropagation();">#$1</span>');

    // Replace mentions: @username -> clickable link
    escaped = escaped.replace(/@([a-zA-Z0-9_]+)/g, '<span class="post-tag" onclick="App.navigateTo(\'profile\', { username: \'$1\' }); event.stopPropagation();">@$1</span>');

    return escaped;
  }

  function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Recently';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function getDefaultAvatar(username) {
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username || 'pulse')}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Public API exposed to window
  return {
    init,
    toggleTheme,
    navigateTo,
    focusPostCreator,
    switchFeedTab,
    setTagFilter,
    clearTagFilter,
    loadFeed,
    handleImageSelected,
    promptImageUrl,
    removeSelectedMedia,
    insertEmoji,
    submitPost,
    deletePost,
    toggleLike,
    toggleBookmark,
    copyPostLink,
    toggleComments,
    submitComment,
    deleteComment,
    loadProfile,
    switchProfileTab,
    toggleFollowUser,
    openFollowModal,
    toggleFollowFromModal,
    openEditProfileModal,
    handleProfileUpdate,
    handleAvatarUpload,
    handleLiveSearch,
    showSearchResults,
    handleExploreSearch,
    loadNotifications,
    markAllNotificationsRead,
    openModal,
    closeModal,
    openAuthModal,
    switchAuthTab,
    handleLoginSubmit,
    handleRegisterSubmit,
    openDemoSwitcherModal,
    loginAsDemo,
    logout,
    openLightbox,
    closeLightbox
  };
})();

// Bootstrap app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
