/**
 * Pulse API Client
 * Handles HTTP requests, JWT token management, and REST endpoints.
 */

const API = (() => {
  const TOKEN_KEY = 'pulse_token';
  const BASE_URL = '/api';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  async function request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const token = getToken();

    const headers = options.headers || {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    options.headers = headers;

    try {
      const response = await fetch(url, options);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // If 401 and we had a token, it might be expired
        if (response.status === 401 && token && !endpoint.includes('/auth/login')) {
          setToken(null);
        }
        throw new Error(data.error || `HTTP ${response.status}: Request failed`);
      }

      return data;
    } catch (err) {
      throw err;
    }
  }

  return {
    getToken,
    setToken,
    hasToken: () => !!getToken(),

    // Generic HTTP helpers
    get: (endpoint) => request(endpoint, { method: 'GET' }),
    post: (endpoint, body) => request(endpoint, { method: 'POST', body }),
    put: (endpoint, body) => request(endpoint, { method: 'PUT', body }),
    delete: (endpoint) => request(endpoint, { method: 'DELETE' }),

    // Auth endpoints
    auth: {
      register: (userData) => request('/auth/register', { method: 'POST', body: userData }),
      login: (identifier, password) => request('/auth/login', { method: 'POST', body: { identifier, password } }),
      demoLogin: (username) => request('/auth/demo-login', { method: 'POST', body: { username } }),
      me: () => request('/auth/me', { method: 'GET' }),
      getDemoUsers: () => request('/auth/demo-users', { method: 'GET' })
    },

    // Posts endpoints
    posts: {
      getFeed: (type = 'all', tag = null) => {
        let qs = `?type=${type}`;
        if (tag) qs += `&tag=${encodeURIComponent(tag)}`;
        return request(`/posts/feed${qs}`, { method: 'GET' });
      },
      getTrendingTags: () => request('/posts/trending/tags', { method: 'GET' }),
      getUserPosts: (username) => request(`/posts/user/${username}`, { method: 'GET' }),
      getUserLikes: (username) => request(`/posts/user/${username}/likes`, { method: 'GET' }),
      getSaved: () => request('/posts/saved', { method: 'GET' }),
      getById: (id) => request(`/posts/${id}`, { method: 'GET' }),
      create: (formDataOrObj) => request('/posts', { method: 'POST', body: formDataOrObj }),
      delete: (id) => request(`/posts/${id}`, { method: 'DELETE' }),
      toggleLike: (id) => request(`/posts/${id}/like`, { method: 'POST' }),
      getLikers: (id) => request(`/posts/${id}/likes`, { method: 'GET' }),
      toggleBookmark: (id) => request(`/posts/${id}/bookmark`, { method: 'POST' }),
      getComments: (id) => request(`/posts/${id}/comments`, { method: 'GET' }),
      addComment: (id, content) => request(`/posts/${id}/comments`, { method: 'POST', body: { content } }),
      deleteComment: (id) => request(`/posts/comments/${id}`, { method: 'DELETE' })
    },

    // Users endpoints
    users: {
      getProfile: (username) => request(`/users/${username}`, { method: 'GET' }),
      updateProfile: (data) => request('/users/profile', { method: 'PUT', body: data }),
      uploadAvatar: (formData) => request('/users/avatar', { method: 'POST', body: formData }),
      uploadBanner: (formData) => request('/users/banner', { method: 'POST', body: formData }),
      toggleFollow: (userId) => request(`/users/${userId}/follow`, { method: 'POST' }),
      getFollowers: (userId) => request(`/users/${userId}/followers`, { method: 'GET' }),
      getFollowing: (userId) => request(`/users/${userId}/following`, { method: 'GET' }),
      search: (q) => request(`/users/search?q=${encodeURIComponent(q)}`, { method: 'GET' }),
      getSuggested: () => request('/users/suggested', { method: 'GET' })
    },

    // Notifications endpoints
    notifications: {
      getAll: () => request('/notifications', { method: 'GET' }),
      markRead: () => request('/notifications/read', { method: 'PUT' }),
      getUnreadCount: () => request('/notifications/unread-count', { method: 'GET' })
    }
  };
})();
