const bcrypt = require('bcryptjs');
const dbHelper = require('./database');

async function seed() {
  console.log('🌱 Seeding database...');

  // Clear existing data to allow fresh seed
  dbHelper.db.exec(`
    DELETE FROM notifications;
    DELETE FROM bookmarks;
    DELETE FROM comments;
    DELETE FROM likes;
    DELETE FROM posts;
    DELETE FROM followers;
    DELETE FROM users;
  `);

  const saltRounds = 10;
  const defaultPassword = 'password123';
  const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);

  // 1. Create Users
  const usersData = [
    {
      username: 'alex_coder',
      email: 'alex@example.com',
      password_hash: passwordHash,
      full_name: 'Alex Rivera',
      bio: 'Full-stack developer & open-source enthusiast. Building modern web apps with Node & JS 🚀',
      avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
      banner_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop&q=80',
      location: 'San Francisco, CA',
      website: 'https://github.com/alexrivera'
    },
    {
      username: 'sarah_designs',
      email: 'sarah@example.com',
      password_hash: passwordHash,
      full_name: 'Sarah Chen',
      bio: 'Product Designer & Design Systems enthusiast ✨ Creating delightful digital experiences with typography and color.',
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
      banner_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1000&auto=format&fit=crop&q=80',
      location: 'New York, NY',
      website: 'https://sarahchen.design'
    },
    {
      username: 'marcus_tech',
      email: 'marcus@example.com',
      password_hash: passwordHash,
      full_name: 'Marcus Vance',
      bio: 'AI researcher, tech blogger, coffee fanatic ☕ Exploring generative AI and distributed architectures.',
      avatar_url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&auto=format&fit=crop&q=80',
      banner_url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1000&auto=format&fit=crop&q=80',
      location: 'Austin, TX',
      website: 'https://marcustech.blog'
    },
    {
      username: 'elena_travels',
      email: 'elena@example.com',
      password_hash: passwordHash,
      full_name: 'Elena Rostova',
      bio: 'Photographer & digital nomad 🌍 Capturing hidden gems and sunset horizons across 30+ countries 📸',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      banner_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1000&auto=format&fit=crop&q=80',
      location: 'Lisbon, Portugal',
      website: 'https://elenarostova.photo'
    },
    {
      username: 'david_dev',
      email: 'david@example.com',
      password_hash: passwordHash,
      full_name: 'David Kim',
      bio: 'Frontend engineer | CSS animations & Canvas art lover | Passionate about building fast web interfaces ⚡',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
      banner_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1000&auto=format&fit=crop&q=80',
      location: 'Seattle, WA',
      website: 'https://davidkim.dev'
    }
  ];

  const createdUsers = [];
  for (const u of usersData) {
    const user = dbHelper.createUser(u);
    createdUsers.push(user);
    console.log(`  ✓ Created user: @${user.username}`);
  }

  // 2. Create Follow Relationships
  // alex_coder follows sarah_designs, marcus_tech, elena_travels
  dbHelper.followUser(createdUsers[0].id, createdUsers[1].id);
  dbHelper.followUser(createdUsers[0].id, createdUsers[2].id);
  dbHelper.followUser(createdUsers[0].id, createdUsers[3].id);

  // sarah_designs follows alex_coder, david_dev
  dbHelper.followUser(createdUsers[1].id, createdUsers[0].id);
  dbHelper.followUser(createdUsers[1].id, createdUsers[4].id);

  // marcus_tech follows alex_coder, elena_travels
  dbHelper.followUser(createdUsers[2].id, createdUsers[0].id);
  dbHelper.followUser(createdUsers[2].id, createdUsers[3].id);

  // elena_travels follows sarah_designs, david_dev
  dbHelper.followUser(createdUsers[3].id, createdUsers[1].id);
  dbHelper.followUser(createdUsers[3].id, createdUsers[4].id);

  // david_dev follows alex_coder, sarah_designs, marcus_tech
  dbHelper.followUser(createdUsers[4].id, createdUsers[0].id);
  dbHelper.followUser(createdUsers[4].id, createdUsers[1].id);
  dbHelper.followUser(createdUsers[4].id, createdUsers[2].id);

  console.log('  ✓ Created follow relationships');

  // 3. Create Posts
  const postsData = [
    {
      user_id: createdUsers[0].id, // alex_coder
      content: 'Just deployed the new version of our real-time social platform! 🚀 Built with Express.js, SQLite, and vanilla modern JS. Loving how snappy lightweight architectures can be. What tech stack are you working with this week? #webdev #javascript #coding',
      media_url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=900&auto=format&fit=crop&q=80'
    },
    {
      user_id: createdUsers[1].id, // sarah_designs
      content: 'Clean typography, ample negative space, and subtle micro-interactions transform good apps into great experiences ✨ Spending my Sunday refining a new dark mode color palette. #design #uiux #minimalism',
      media_url: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=900&auto=format&fit=crop&q=80'
    },
    {
      user_id: createdUsers[2].id, // marcus_tech
      content: 'The pace of AI development is mind-boggling. We are shifting from simple text completion to multi-agent reasoning systems that can orchestrate complex workflows across entire codebases. What is your favorite recent breakthrough? #ai #machinelearning #tech',
      media_url: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=900&auto=format&fit=crop&q=80'
    },
    {
      user_id: createdUsers[3].id, // elena_travels
      content: 'Golden hour overlooking the coast of Algarve. Sometimes taking a step back from screens and soaking in natural beauty gives you the best creative reboot 🌅✨ #travel #photography #wanderlust',
      media_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&auto=format&fit=crop&q=80'
    },
    {
      user_id: createdUsers[4].id, // david_dev
      content: 'Pro tip for frontend devs: CSS grid + subgrid make complex card layouts effortless without messy hacky flex nesting. Combined with container queries, responsive design has never been in a better spot! 💡 #frontend #css #webdev',
      media_url: ''
    },
    {
      user_id: createdUsers[0].id, // alex_coder
      content: 'Remember: premature optimization is the root of all evil, but clean architecture and readable code pay dividends from day one. Keep it simple, test early, and iterate fast. 🛠️ #programming #quotes',
      media_url: ''
    }
  ];

  const createdPosts = [];
  for (const p of postsData) {
    const post = dbHelper.createPost(p);
    createdPosts.push(post);
  }
  console.log(`  ✓ Created ${createdPosts.length} posts`);

  // 4. Create Comments
  const commentsData = [
    {
      postId: createdPosts[0].id,
      userId: createdUsers[1].id, // sarah_designs
      content: 'The UI is super sleek! Love the smooth transitions and contrast in dark mode.'
    },
    {
      postId: createdPosts[0].id,
      userId: createdUsers[4].id, // david_dev
      content: 'Vanilla JS with a clean backend is truly underrated. Ultra fast load times!'
    },
    {
      postId: createdPosts[1].id,
      userId: createdUsers[0].id, // alex_coder
      content: 'Dark mode looks stunning Sarah! Especially love the accent highlights.'
    },
    {
      postId: createdPosts[2].id,
      userId: createdUsers[0].id, // alex_coder
      content: 'Agentic workflows with tool calling are changing everything. Excited to see where this goes!'
    },
    {
      postId: createdPosts[3].id,
      userId: createdUsers[1].id, // sarah_designs
      content: 'Incredible shot Elena! The lighting is magical 💛'
    }
  ];

  for (const c of commentsData) {
    dbHelper.createComment(c);
  }
  console.log(`  ✓ Created ${commentsData.length} comments`);

  // 5. Create Likes
  dbHelper.toggleLike(createdUsers[1].id, createdPosts[0].id); // sarah likes alex post 0
  dbHelper.toggleLike(createdUsers[2].id, createdPosts[0].id); // marcus likes alex post 0
  dbHelper.toggleLike(createdUsers[3].id, createdPosts[0].id); // elena likes alex post 0
  dbHelper.toggleLike(createdUsers[4].id, createdPosts[0].id); // david likes alex post 0

  dbHelper.toggleLike(createdUsers[0].id, createdPosts[1].id); // alex likes sarah post 1
  dbHelper.toggleLike(createdUsers[4].id, createdPosts[1].id); // david likes sarah post 1

  dbHelper.toggleLike(createdUsers[0].id, createdPosts[2].id); // alex likes marcus post 2
  dbHelper.toggleLike(createdUsers[1].id, createdPosts[2].id); // sarah likes marcus post 2

  dbHelper.toggleLike(createdUsers[0].id, createdPosts[3].id); // alex likes elena post 3
  dbHelper.toggleLike(createdUsers[1].id, createdPosts[3].id); // sarah likes elena post 3
  dbHelper.toggleLike(createdUsers[2].id, createdPosts[3].id); // marcus likes elena post 3

  console.log('  ✓ Created sample likes');

  console.log('🎉 Seeding completed successfully!');
}

if (require.main === module) {
  seed().catch(err => {
    console.error('Error seeding database:', err);
    process.exit(1);
  });
}

module.exports = seed;
