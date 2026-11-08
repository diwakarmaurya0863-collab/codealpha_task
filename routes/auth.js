const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const dbHelper = require('../db/database');
const { generateToken, requireAuth } = require('../middleware/auth');

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, full_name, bio } = req.body;

    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ error: 'Username, email, full name, and password are required' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      return res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = dbHelper.getUserByUsername(cleanUsername);
    if (existingUser) {
      return res.status(409).json({ error: 'Username is already taken' });
    }

    const existingEmail = dbHelper.getUserWithAuthByUsernameOrEmail(cleanEmail);
    if (existingEmail) {
      return res.status(409).json({ error: 'Email is already registered' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Generate avatar using Dicebear / SVG based on username
    const avatar_url = `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`;

    const newUser = dbHelper.createUser({
      username: cleanUsername,
      email: cleanEmail,
      password_hash,
      full_name: full_name.trim(),
      bio: bio ? bio.trim() : 'Hello, I am new to Pulse!',
      avatar_url
    });

    const token = generateToken(newUser);
    const stats = dbHelper.getUserStats(newUser.id);

    return res.status(201).json({
      message: 'Registration successful',
      token,
      user: { ...newUser, stats }
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/email and password are required' });
    }

    const user = dbHelper.getUserWithAuthByUsernameOrEmail(identifier.trim().toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid username/email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username/email or password' });
    }

    const safeUser = dbHelper.getUserById(user.id);
    const token = generateToken(safeUser);
    const stats = dbHelper.getUserStats(safeUser.id);

    return res.json({
      message: 'Login successful',
      token,
      user: { ...safeUser, stats }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
});

// Quick Demo Login (switches to any seeded account for effortless testing)
router.post('/demo-login', async (req, res) => {
  try {
    const { username } = req.body;
    const targetUsername = (username || 'alex_coder').toLowerCase();

    const user = dbHelper.getUserByUsername(targetUsername);
    if (!user) {
      return res.status(404).json({ error: `Demo user ${targetUsername} not found` });
    }

    const token = generateToken(user);
    const stats = dbHelper.getUserStats(user.id);

    return res.json({
      message: `Logged in as @${user.username}`,
      token,
      user: { ...user, stats }
    });
  } catch (err) {
    console.error('Demo login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Current User Profile & Stats
router.get('/me', requireAuth, (req, res) => {
  const stats = dbHelper.getUserStats(req.user.id);
  const unreadCount = dbHelper.getUnreadNotificationCount(req.user.id);
  return res.json({
    user: {
      ...req.user,
      stats,
      unreadNotifications: unreadCount
    }
  });
});

// Get Demo Users for Easy Switching
router.get('/demo-users', (req, res) => {
  const users = [
    { username: 'alex_coder', fullName: 'Alex Rivera', role: 'Full-stack Developer' },
    { username: 'sarah_designs', fullName: 'Sarah Chen', role: 'UI/UX Designer' },
    { username: 'marcus_tech', fullName: 'Marcus Vance', role: 'AI Researcher' },
    { username: 'elena_travels', fullName: 'Elena Rostova', role: 'Photographer & Nomad' },
    { username: 'david_dev', fullName: 'David Kim', role: 'Frontend Engineer' }
  ];

  const fullList = users.map(u => {
    const user = dbHelper.getUserByUsername(u.username);
    return user ? { ...user, role: u.role } : null;
  }).filter(Boolean);

  return res.json({ demoUsers: fullList });
});

module.exports = router;
