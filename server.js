/**
 * AuraAuth — Express REST API Backend
 * MongoDB: Users, Posts, Admin Management, Social Features
 */


require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
const MONGO_URI = process.env.MONGO_URI;

app.use(cors());
app.use(express.json({ limit: '10mb' })); // allow base64 image payloads
app.use(express.static(path.join(__dirname)));

// ==========================================
// 1. MongoDB Schemas & Models
// ==========================================

const ActivitySchema = new mongoose.Schema({
  title: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  avatar: { type: String, default: '🚀' },
  bio: { type: String, default: 'Exploring new horizons in tech & design.' },
  status: { type: String, default: 'Active 🟢' },
  role: { type: String, default: 'Member' },
  loginCount: { type: Number, default: 1 },
  lastLogin: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  activities: [ActivitySchema]
});

const PostSchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true },
  authorAvatar: { type: String, default: '🚀' },
  authorUsername: { type: String, required: true },
  text: { type: String, required: true, maxlength: 500 },
  imageData: { type: String, default: null }, // base64 encoded image
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Post = mongoose.model('Post', PostSchema);

// Connect to MongoDB & seed Super Admin
// serverSelectionTimeoutMS: fail fast (8s) instead of hanging until Vercel's
// own function timeout kills the request with an unhelpful 504.
mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 })
  .then(async () => {
    console.log('✅ Connected successfully to MongoDB Atlas');
    await seedSuperAdmin();
  })
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err.name, '-', err.message);
    console.log('⚠️ Check your MongoDB Atlas URI, username, password, or IP whitelist.');
  });

async function seedSuperAdmin() {
  try {
    const adminUsername = 'rkasra18';
    const adminEmail = 'rkasra18@admin.com';
    const adminPassword = 'K920771018!';

    let admin = await User.findOne({
      $or: [{ username: adminUsername }, { email: adminEmail }]
    });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    if (!admin) {
      admin = new User({
        name: 'Kasra',
        username: adminUsername,
        email: adminEmail,
        password: hashedPassword,
        avatar: '👑',
        role: 'Super Admin',
        bio: 'Platform Super Administrator with full system management permissions.',
        status: 'Active 🟢',
        activities: [{ title: 'Super Admin account seeded', timestamp: new Date() }]
      });
      await admin.save();
      console.log('👑 Super Admin account created/verified.');
    } else {
      admin.role = 'Super Admin';
      admin.username = adminUsername;
      admin.password = hashedPassword;
      admin.avatar = '👑';
      await admin.save();
      console.log('👑 Super Admin credentials verified (username "rkasra18")');
    }
  } catch (err) {
    console.error('Error seeding Super Admin:', err.message);
  }
}

// ==========================================
// 2. Middleware
// ==========================================

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Authentication token required.' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
    req.userId = decoded.userId;
    next();
  });
}

async function authenticateAdmin(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    if (!user || (user.role !== 'Super Admin' && user.role !== 'Admin')) {
      return res.status(403).json({ success: false, message: 'Access denied. Admin privileges required.' });
    }
    req.adminUser = user;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function sanitizeUser(user) {
  return {
    id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    bio: user.bio,
    status: user.status,
    role: user.role,
    loginCount: user.loginCount,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    activities: user.activities
  };
}

function sanitizePost(post, requestingUserId) {
  return {
    id: post._id,
    authorId: post.authorId,
    authorName: post.authorName,
    authorAvatar: post.authorAvatar,
    authorUsername: post.authorUsername,
    text: post.text,
    imageData: post.imageData || null,
    likes: post.likes.length,
    likedByMe: requestingUserId ? post.likes.some(id => id.toString() === requestingUserId.toString()) : false,
    createdAt: post.createdAt
  };
}

// ==========================================
// 3. Auth Routes
// ==========================================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, avatar } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

    // ensure unique username
    let username = baseUsername;
    let counter = 1;
    while (await User.findOne({ username })) {
      username = baseUsername + counter++;
    }

    const newUser = new User({
      name,
      email: email.toLowerCase(),
      username,
      password: hashedPassword,
      avatar: avatar || '🚀',
      role: 'Member',
      activities: [{ title: 'Account registered successfully', timestamp: new Date() }]
    });

    await newUser.save();
    const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: sanitizeUser(newUser)
    });
  } catch (error) {
    console.error('Register Error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    if (!emailOrUsername || !password) {
      return res.status(400).json({ success: false, message: 'Please provide credentials.' });
    }

    const query = emailOrUsername.toLowerCase().trim();
    const user = await User.findOne({
      $or: [{ email: query }, { username: query }]
    });

    if (!user) return res.status(400).json({ success: false, message: 'Invalid credentials. User not found.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Invalid credentials. Password incorrect.' });

    user.loginCount += 1;
    user.lastLogin = new Date();
    user.activities.unshift({ title: 'Logged in to session', timestamp: new Date() });
    if (user.activities.length > 15) user.activities.pop();
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

app.put('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const { name, bio, status, avatar } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (name) user.name = name.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (status) user.status = status;
    if (avatar) user.avatar = avatar;

    user.activities.unshift({ title: 'Updated profile settings', timestamp: new Date() });
    if (user.activities.length > 15) user.activities.pop();
    await user.save();

    res.json({ success: true, message: 'Profile updated!', user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Change password (requires current password)
app.put('/api/user/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both current and new password required.' });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Current password is incorrect.' });

    if (newPassword.length < 8) return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.activities.unshift({ title: 'Password changed successfully', timestamp: new Date() });
    await user.save();

    res.json({ success: true, message: 'Password updated successfully!' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) return res.status(400).json({ success: false, message: 'Email and new password required.' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, message: 'No account found with this email.' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.activities.unshift({ title: 'Password reset via email', timestamp: new Date() });
    await user.save();

    res.json({ success: true, message: 'Password updated in MongoDB!' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Get a user's public profile
app.get('/api/users/:id/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const postCount = await Post.countDocuments({ authorId: user._id });
    const recentPosts = await Post.find({ authorId: user._id })
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      profile: {
        id: user._id,
        name: user.name,
        username: user.username,
        avatar: user.avatar,
        bio: user.bio,
        status: user.status,
        role: user.role,
        createdAt: user.createdAt,
        postCount,
        recentPosts: recentPosts.map(p => sanitizePost(p, req.userId))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// 4. Posts Routes
// ==========================================

// Create post
app.post('/api/posts', authenticateToken, async (req, res) => {
  try {
    const { text, imageData } = req.body;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Post text is required.' });
    }
    if (text.length > 500) {
      return res.status(400).json({ success: false, message: 'Post text exceeds 500 characters.' });
    }

    const author = await User.findById(req.userId);
    if (!author) return res.status(404).json({ success: false, message: 'Author not found.' });

    const post = new Post({
      authorId: author._id,
      authorName: author.name,
      authorAvatar: author.avatar,
      authorUsername: author.username || author.email.split('@')[0],
      text: text.trim(),
      imageData: imageData || null,
      likes: []
    });

    await post.save();

    // Log activity
    author.activities.unshift({ title: 'Published a new post', timestamp: new Date() });
    if (author.activities.length > 15) author.activities.pop();
    await author.save();

    res.status(201).json({
      success: true,
      message: 'Post published!',
      post: sanitizePost(post, req.userId)
    });
  } catch (error) {
    console.error('Post create error:', error);
    res.status(500).json({ success: false, message: 'Server error creating post.' });
  }
});

// Get global feed (all posts, paginated)
app.get('/api/posts/feed', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments();

    res.json({
      success: true,
      posts: posts.map(p => sanitizePost(p, req.userId)),
      page,
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error fetching feed.' });
  }
});

// Get posts by user
app.get('/api/posts/user/:userId', authenticateToken, async (req, res) => {
  try {
    const posts = await Post.find({ authorId: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      success: true,
      posts: posts.map(p => sanitizePost(p, req.userId))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Like / Unlike a post
app.put('/api/posts/:id/like', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    const userId = mongoose.Types.ObjectId.createFromHexString(req.userId.toString());
    const alreadyLiked = post.likes.some(id => id.toString() === req.userId.toString());

    if (alreadyLiked) {
      post.likes = post.likes.filter(id => id.toString() !== req.userId.toString());
    } else {
      post.likes.push(userId);
    }

    await post.save();

    res.json({
      success: true,
      liked: !alreadyLiked,
      likes: post.likes.length
    });
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Delete post (own post, or admin)
app.delete('/api/posts/:id', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    const user = await User.findById(req.userId);
    const isOwner = post.authorId.toString() === req.userId.toString();
    const isAdmin = user && (user.role === 'Super Admin' || user.role === 'Admin');

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this post.' });
    }

    await Post.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Post deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// 5. Admin Routes
// ==========================================

app.get('/api/admin/users', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ success: true, users: users.map(u => sanitizeUser(u)) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

app.put('/api/admin/users/:id', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const { name, email, role, status, bio, avatar } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (user.role === 'Super Admin' && req.adminUser.role !== 'Super Admin') {
      return res.status(403).json({ success: false, message: 'Cannot modify Super Admin account.' });
    }

    if (name) user.name = name.trim();
    if (email) user.email = email.toLowerCase().trim();
    if (role && ['Member', 'Admin', 'Super Admin'].includes(role)) user.role = role;
    if (status) user.status = status;
    if (bio !== undefined) user.bio = bio.trim();
    if (avatar) user.avatar = avatar;

    user.activities.unshift({ title: `Updated by Admin (${req.adminUser.name})`, timestamp: new Date() });
    await user.save();

    res.json({ success: true, message: `User ${user.name} updated!`, user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

app.put('/api/admin/users/:id/promote', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (user.role === 'Super Admin') {
      return res.status(400).json({ success: false, message: 'Cannot alter Super Admin role.' });
    }

    user.role = role === 'Admin' ? 'Admin' : 'Member';
    user.activities.unshift({ title: `Role changed to ${user.role} by ${req.adminUser.name}`, timestamp: new Date() });
    await user.save();

    res.json({ success: true, message: `${user.name} is now ${user.role}!`, user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (user.role === 'Super Admin') {
      return res.status(400).json({ success: false, message: 'Super Admin cannot be deleted.' });
    }

    await User.findByIdAndDelete(req.params.id);
    await Post.deleteMany({ authorId: req.params.id }); // also delete their posts
    res.json({ success: true, message: `User ${user.name} and their posts deleted.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// SPA Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Only start a persistent listener when run directly (local dev / traditional host).
// On Vercel, this file is required by api/index.js and the app is exported instead.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 AuraAuth Server listening on http://localhost:${PORT}`);
  });
}

module.exports = app;