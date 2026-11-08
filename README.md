# ⚡ Pulse — Mini Social Media Platform

A modern, responsive, full-featured mini social media platform built with **Vanilla HTML/CSS/JavaScript**, **Express.js**, and an embedded **SQLite** relational database.

Designed to mirror key features of modern social platforms like X/Twitter and Threads with clean UI, responsive layout, real-time interactivity, and zero external frontend dependencies.

---

## 🚀 Features

### 👤 1. User Profiles
* **Profile Metadata:** Full name, `@username`, custom bio, location, website link, join date, profile avatar, and header banner image.
* **Live Statistics:** Dynamic counters for **Posts**, **Followers**, and **Following**.
* **Profile Tabs:** Filter between posts authored by the user and posts they have liked.
* **Profile Editing:** Built-in modal to edit bio, name, location, website, banner image, and upload/change avatars.
* **Followers / Following Modals:** Clickable followers and following counters that open an interactive modal with 1-click follow/unfollow buttons.

### 📝 2. Posts & Comments
* **Post Creation:** Rich post composer with character counter (500 chars limit), photo upload support (JPEG/PNG/GIF/WEBP), image URL support, and quick emoji insertion.
* **Feed Modes:**
  * **For You:** Global feed of all community posts.
  * **Following:** Curated feed strictly from creators you follow.
  * **Tag Filter:** Instant filtering when clicking any `#hashtag`.
* **Rich Text Parsing:** Automatic detection and clickable links for `#hashtags` and `@mentions`.
* **Media Lightbox:** Click any post photo to open high-resolution fullscreen lightbox view.
* **Post Deletion:** Post authors can delete their own posts with instant cascade cleanup.
* **Threaded Comments:**
  * Collapsible comments tray under every post with real-time comment count badge.
  * Instant comment posting with keyboard shortcut (`Enter` to submit).
  * Comment deletion by comment author or post owner.

### ❤️ 3. Like & Follow System
* **Like System:**
  * Interactive heart button with micro-burst animation and instant counter update.
  * Prevents duplicate likes using relational unique constraints (`UNIQUE(user_id, post_id)`).
  * Notification dispatched to the author when someone likes their post.
* **Follow System:**
  * 1-click Follow/Unfollow toggle available on profiles, search results, modal lists, and the "Who to follow" sidebar.
  * Prevents self-following.
  * Instant updates to follower and following counts across the UI.
  * Follow notifications dispatched automatically.

### 🌟 4. Extra Polish & Enhancements
* **Dark / Light Theme Toggle:** Beautiful dark mode by default with instant toggle to high-contrast light mode and `localStorage` persistence.
* **1-Click Demo Account Switcher:** Evaluator / test toolbar in the sidebar to switch between 5 seeded demo accounts (`alex_coder`, `sarah_designs`, `marcus_tech`, `elena_travels`, `david_dev`) without typing passwords.
* **Live Search & Explore:** Debounced instant search for users by username or full name with interactive dropdown preview.
* **Trending Hashtags:** Aggregated trending tags widget derived dynamically from post contents.
* **Bookmarks / Saved Posts:** Save posts to a personal reading list with 1-click ribbon bookmark toggle.
* **Notifications Center:** Activity feed for likes, comments, and new followers with an unread badge indicator.
* **Toast Notification System:** Non-blocking floating status alerts.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, CSS3 (CSS Variables, Flexbox, Grid, Animations), Vanilla JavaScript (ES6+ SPA) |
| **Backend** | Express.js (Node.js REST API) |
| **Database** | SQLite via Node's native `node:sqlite` (zero compilation or native build dependencies) |
| **Security & Auth** | JSON Web Tokens (JWT), `bcryptjs` password hashing |
| **File Handling** | `multer` for local multipart image uploads |

---

## 📁 Project Structure

```text
codealpha_task/
├── db/
│   ├── database.js          # SQLite connection, schema migrations, and query helpers
│   ├── seed.js              # Database seeder with realistic users, posts, comments & follows
│   └── social.db            # SQLite database file (created automatically)
├── middleware/
│   ├── auth.js              # JWT verification and optional authentication middlewares
│   └── upload.js            # Multer disk storage and image file validation
├── routes/
│   ├── auth.js              # /api/auth (register, login, me, demo-login, demo-users)
│   ├── users.js             # /api/users (profile, update, follow/unfollow, followers, search)
│   ├── posts.js             # /api/posts (feed, create, delete, likes, comments, saved, trends)
│   └── notifications.js     # /api/notifications (list, mark-read, unread-count)
├── public/
│   ├── index.html           # Single-page application shell
│   ├── css/
│   │   └── styles.css       # Full CSS styling (Dark/Light themes, responsive design)
│   └── js/
│       ├── api.js           # REST API client & JWT token manager
│       └── app.js           # UI logic, state management, modal controllers, feeds
├── uploads/                 # Storage for user-uploaded avatars and post media
├── server.js                # Express application entrypoint
├── test.js                  # Automated test suite (22 tests covering all features)
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
* **Node.js** (v20 or higher recommended, tested on v25)
* **npm**

### 1. Installation
Clone the repository and install dependencies:
```bash
npm install
```

### 2. Seed Database
Pre-populate the SQLite database with 5 demo users, rich sample posts, realistic comments, likes, and follow relationships:
```bash
npm run seed
```

### 3. Start the Server
Launch the application:
```bash
npm start
```
The server will start at:
👉 **`http://localhost:3000`**

Open this URL in any modern browser to use the application!

---

## 🔑 Demo Accounts

Use the **"⚡ Quick Demo Login"** widget on the right sidebar to test different accounts with one click, or log in manually:

| Username | Full Name | Default Password | Role |
|---|---|---|---|
| `alex_coder` | Alex Rivera | `password123` | Full-stack Developer |
| `sarah_designs` | Sarah Chen | `password123` | UI/UX Designer |
| `marcus_tech` | Marcus Vance | `password123` | AI Researcher |
| `elena_travels` | Elena Rostova | `password123` | Photographer & Nomad |
| `david_dev` | David Kim | `password123` | Frontend Engineer |

*You can also create completely new accounts anytime using the **Sign Up** tab.*

---

## 🧪 Automated Testing

An automated test suite tests all core models, relational queries, authentication, like/follow counters, notifications, and cascade operations:

```bash
npm test
```

### Test Coverage Summary:
* ✔ **User Profiles & Authentication:** Registration, password hashing verification, username lookup, bio/metadata update, stats calculations.
* ✔ **Follow & Relationship System:** Follow creation, duplicate prevention, self-follow guard, follower/following lists, unfollow.
* ✔ **Posts & Feed:** Post creation, hashtag filters, feed generation ("all" vs "following"), post deletion.
* ✔ **Likes & Bookmarks:** Like toggle, like counter accuracy, bookmark toggle.
* ✔ **Comments:** Adding comments, listing comments, comment deletion.
* ✔ **Notifications & Search:** Generation of like/comment/follow alerts, unread counts, user search, trending hashtags.

---

## 📡 API Reference

### Auth
* `POST /api/auth/register` — Create user account (`username`, `email`, `password`, `full_name`, `bio`)
* `POST /api/auth/login` — Log in with credentials (`identifier`, `password`)
* `POST /api/auth/demo-login` — 1-click test login (`username`)
* `GET /api/auth/me` — Get current logged-in user profile & stats (Bearer token)
* `GET /api/auth/demo-users` — List seeded test accounts

### Users & Profiles
* `GET /api/users/:username` — Get user profile, follower counts, and `isFollowing` status
* `PUT /api/users/profile` — Update user profile details
* `POST /api/users/avatar` — Upload avatar image
* `POST /api/users/:id/follow` — Follow or unfollow a user
* `GET /api/users/:id/followers` — List users following this account
* `GET /api/users/:id/following` — List accounts followed by this user
* `GET /api/users/search?q=:query` — Search users by name or handle
* `GET /api/users/suggested` — Suggested accounts to follow

### Posts & Comments
* `GET /api/posts/feed?type=all|following&tag=:tag` — Paginated post stream
* `POST /api/posts` — Create a new post (supports multipart file or JSON with `media_url`)
* `GET /api/posts/:id` — Get single post with comments
* `DELETE /api/posts/:id` — Delete post (author only)
* `POST /api/posts/:id/like` — Toggle like/unlike on post
* `POST /api/posts/:id/bookmark` — Toggle save/bookmark on post
* `GET /api/posts/saved` — Get current user's bookmarked posts
* `GET /api/posts/:id/comments` — Get comments for post
* `POST /api/posts/:id/comments` — Post a new comment
* `DELETE /api/posts/comments/:id` — Delete a comment (author only)
* `GET /api/posts/trending/tags` — Trending hashtag list

### Notifications
* `GET /api/notifications` — Get user notifications
* `PUT /api/notifications/read` — Mark notifications as read
* `GET /api/notifications/unread-count` — Count of unread alerts

---

## 📄 License
ISC
