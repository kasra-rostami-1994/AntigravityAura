/**
 * Aura Social Platform — Client Application
 * Handles: Auth, Dashboard, Feed, Posts, Settings, Admin Portal
 */

document.addEventListener('DOMContentLoaded', () => {

  const API = 'https://kasrarostami.ir/api';
  const TOKEN_KEY = 'aura_jwt_token';
  const THEME_KEY = 'aura_theme_pref';

  // ===================================================
  // HELPERS
  // ===================================================
  const getToken = () => localStorage.getItem(TOKEN_KEY);
  const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
  const clearToken = () => localStorage.removeItem(TOKEN_KEY);

  function authHeaders() {
    return { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' };
  }

  function timeAgo(date) {
    const now = new Date();
    const diff = Math.floor((now - new Date(date)) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatDate(date) {
    if (!date) return '–';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ===================================================
  // TOAST
  // ===================================================
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = {
      success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
      error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
    document.getElementById('toastContainer').appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'fadeOutToast 0.3s ease-out forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  // ===================================================
  // STATE
  // ===================================================
  let currentUser = null;
  let selectedAvatar = '🚀';
  let settingsSelectedAvatar = null;
  let feedImageData = null;
  let dashImageData = null;

  // ===================================================
  // AUTH CARD: TAB SWITCHER & MORPHING
  // ===================================================
  const authCard = document.getElementById('authCard');
  const tabLogin = document.getElementById('tabLogin');
  const tabSignup = document.getElementById('tabSignup');

  function updateCardHeight() {
    if (!authCard || authCard.style.display === 'none') return;
    const isSignup = authCard.classList.contains('show-signup');
    const activeView = isSignup ? authCard.querySelector('.signup-view') : authCard.querySelector('.login-view');
    if (!activeView) return;
    const tabH = authCard.querySelector('.tab-switcher')?.offsetHeight || 0;
    authCard.style.height = `${tabH + activeView.scrollHeight + 68}px`;
  }

  function switchToTab(tab) {
    if (tab === 'signup') {
      authCard.classList.add('show-signup');
      tabLogin.classList.remove('active');
      tabSignup.classList.add('active');
    } else {
      authCard.classList.remove('show-signup');
      tabSignup.classList.remove('active');
      tabLogin.classList.add('active');
    }
    requestAnimationFrame(updateCardHeight);
  }

  tabLogin?.addEventListener('click', () => switchToTab('login'));
  tabSignup?.addEventListener('click', () => switchToTab('signup'));
  setTimeout(updateCardHeight, 60);
  window.addEventListener('resize', updateCardHeight);

  // ===================================================
  // PASSWORD VISIBILITY TOGGLES
  // ===================================================
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      const eyeIcon = btn.querySelector('.eye-icon');
      if (eyeIcon) {
        eyeIcon.innerHTML = isHidden
          ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
          : '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>';
      }
    });
  });

  // ===================================================
  // SIGNUP AVATAR SELECTOR
  // ===================================================
  document.getElementById('avatarGrid')?.querySelectorAll('.avatar-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.getElementById('avatarGrid').querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedAvatar = opt.dataset.avatar;
    });
  });

  // ===================================================
  // PASSWORD STRENGTH METER (signup)
  // ===================================================
  const signupPasswordInput = document.getElementById('signupPassword');
  if (signupPasswordInput) {
    signupPasswordInput.addEventListener('input', () => {
      const val = signupPasswordInput.value;
      const hasLen = val.length >= 8;
      const hasUL = /[a-z]/.test(val) && /[A-Z]/.test(val);
      const hasNum = /\d/.test(val);
      const hasSym = /[^a-zA-Z0-9]/.test(val);

      document.getElementById('checkLength').classList.toggle('valid', hasLen);
      document.getElementById('checkUpper').classList.toggle('valid', hasUL);
      document.getElementById('checkNumber').classList.toggle('valid', hasNum);
      document.getElementById('checkSymbol').classList.toggle('valid', hasSym);

      const score = [hasLen, hasUL, hasNum, hasSym].filter(Boolean).length;
      const pct = score * 25;
      const bar = document.getElementById('strengthBar');
      const txt = document.getElementById('strengthText');
      bar.style.width = `${pct}%`;
      const levels = [['', 'var(--error)'], ['Weak', 'var(--error)'], ['Fair', 'var(--warning)'], ['Good', 'var(--warning)'], ['Strong', 'var(--success)']];
      bar.style.backgroundColor = levels[score][1];
      txt.textContent = levels[score][0];
      txt.style.color = levels[score][1];
      updateCardHeight();
    });
  }

  // Settings password strength meter
  document.getElementById('newPasswordInput')?.addEventListener('input', () => {
    const val = document.getElementById('newPasswordInput').value;
    const score = [val.length >= 8, /[a-z]/.test(val) && /[A-Z]/.test(val), /\d/.test(val), /[^a-zA-Z0-9]/.test(val)].filter(Boolean).length;
    const pct = score * 25;
    const bar = document.getElementById('settingsStrengthBar');
    const txt = document.getElementById('settingsStrengthText');
    if (!bar || !txt) return;
    bar.style.width = `${pct}%`;
    const levels = [['–', 'var(--error)'], ['Weak', 'var(--error)'], ['Fair', 'var(--warning)'], ['Good', 'var(--warning)'], ['Strong', 'var(--success)']];
    bar.style.backgroundColor = levels[score][1];
    txt.textContent = levels[score][0];
    txt.style.color = levels[score][1];
  });

  // ===================================================
  // REGISTER
  // ===================================================
  document.getElementById('signupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirmPassword').value;
    const agreed = document.getElementById('agreeTerms').checked;

    if (!name) return showToast('Please enter your full name', 'error');
    if (!email || !/\S+@\S+\.\S+/.test(email)) return showToast('Invalid email address', 'error');
    if (password.length < 8) return showToast('Password must be 8+ characters', 'error');
    if (password !== confirm) return showToast('Passwords do not match', 'error');
    if (!agreed) return showToast('Please agree to the Terms of Service', 'error');

    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, avatar: selectedAvatar })
      });
      const data = await res.json();
      if (!res.ok || !data.success) return showToast(data.message || 'Registration failed', 'error');
      setToken(data.token);
      currentUser = data.user;
      showToast('Account created! Welcome to Aura 🎉', 'success');
      routeByRole(currentUser);
    } catch {
      showToast('Cannot connect to server. Is MongoDB running?', 'error');
    }
  });

  // ===================================================
  // LOGIN
  // ===================================================
  document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailOrUsername = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!emailOrUsername || !password) return showToast('Please enter your credentials', 'error');

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrUsername, password })
      });
      const data = await res.json();
      if (!res.ok || !data.success) return showToast(data.message || 'Login failed', 'error');
      setToken(data.token);
      currentUser = data.user;
      showToast(data.message, 'success');
      routeByRole(currentUser);
    } catch {
      showToast('Cannot connect to server. Is MongoDB running?', 'error');
    }
  });

  // ===================================================
  // SESSION RESTORE
  // ===================================================
  async function fetchCurrentUser() {
    if (!getToken()) return;
    try {
      const res = await fetch(`${API}/auth/me`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok && data.success) {
        currentUser = data.user;
        routeByRole(currentUser);
      } else {
        clearToken();
      }
    } catch { /* server offline */ }
  }

  // ===================================================
  // NAVIGATION & VIEW ROUTING
  // ===================================================
  function showView(viewId) {
    ['dashboardContainer', 'feedContainer', 'settingsContainer', 'adminDashboardContainer', 'authCard'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    const target = document.getElementById(viewId);
    if (target) target.style.display = 'block';

    // Update nav tab state
    document.querySelectorAll('.nav-tab').forEach(tab => {
      const view = tab.dataset.view;
      const matches = (view === 'home' && viewId === 'dashboardContainer')
        || (view === 'feed' && viewId === 'feedContainer')
        || (view === 'settings' && viewId === 'settingsContainer');
      tab.classList.toggle('active', matches);
    });
  }

  function routeByRole(user) {
    document.getElementById('appNav').style.display = 'flex';
    document.getElementById('headerLogoutBtn').style.display = 'flex';

    if (user.role === 'Super Admin' || user.role === 'Admin') {
      showView('adminDashboardContainer');
      renderAdminDashboard(user);
      // Admins can still access feed via nav
    } else {
      showView('dashboardContainer');
      renderUserDashboard(user);
    }
  }

  // Nav tabs click
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (!currentUser) return;
      const view = tab.dataset.view;
      if (view === 'home') {
        if (currentUser.role === 'Super Admin' || currentUser.role === 'Admin') {
          showView('adminDashboardContainer');
        } else {
          showView('dashboardContainer');
        }
      } else if (view === 'feed') {
        showView('feedContainer');
        loadFeed();
        updateFeedCompose();
      } else if (view === 'settings') {
        showView('settingsContainer');
        initSettings();
      }
    });
  });

  // Logo → home
  document.getElementById('logoLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentUser) routeByRole(currentUser);
  });

  // Header logout
  document.getElementById('headerLogoutBtn')?.addEventListener('click', logout);
  document.getElementById('adminLogoutBtn')?.addEventListener('click', logout);

  function logout() {
    clearToken();
    currentUser = null;
    document.getElementById('appNav').style.display = 'none';
    document.getElementById('headerLogoutBtn').style.display = 'none';
    showView('authCard');
    updateCardHeight();
    feedImageData = null;
    dashImageData = null;
    showToast('Signed out successfully', 'info');
  }

  // ===================================================
  // USER DASHBOARD
  // ===================================================
  async function renderUserDashboard(user) {
    showView('dashboardContainer');

    document.getElementById('dashAvatar').textContent = user.avatar || '🚀';
    document.getElementById('composeAvatar').textContent = user.avatar || '🚀';
    document.getElementById('dashUserName').textContent = user.name;
    document.getElementById('dashUsername').textContent = `@${user.username || user.email.split('@')[0]}`;
    document.getElementById('dashUserEmail').textContent = user.email;
    document.getElementById('dashRoleBadge').textContent = user.role || 'Member';
    document.getElementById('dashUserBio').textContent = user.bio || 'Exploring new horizons in tech & design.';
    document.getElementById('dashStatusPill').textContent = user.status || 'Active 🟢';
    document.getElementById('dashMongoId').textContent = user.id ? String(user.id).substring(0, 18) + '...' : '–';
    document.getElementById('dashLoginCount').textContent = user.loginCount || 1;
    document.getElementById('dashMemberSince').textContent = formatDate(user.createdAt).split(',')[0].split(' ').slice(0,2).join(' ');
    document.getElementById('dashLastLogin').textContent = user.lastLogin ? timeAgo(user.lastLogin) : '–';

    // Activity timeline
    const timeline = document.getElementById('dashActivityList');
    if (timeline && user.activities) {
      timeline.innerHTML = user.activities.slice(0, 6).map(act => `
        <li class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <span>${act.title}</span>
            <span class="timeline-time">${timeAgo(act.timestamp)}</span>
          </div>
        </li>
      `).join('');
    }

    // Fetch post count + own posts
    try {
      const res = await fetch(`${API}/posts/user/${user.id}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) {
        document.getElementById('dashPostCount').textContent = data.posts.length;
        renderDashUserPosts(data.posts);
      }
    } catch { /* offline */ }
  }

  function renderDashUserPosts(posts) {
    const list = document.getElementById('dashUserPostsList');
    if (!list) return;
    if (posts.length === 0) {
      list.innerHTML = '<div class="empty-state">No posts yet. Share something!</div>';
      return;
    }
    list.innerHTML = posts.map(p => `
      <div class="mini-post-card" data-post-id="${p.id}">
        ${p.imageData ? `<img class="mini-post-image" src="${p.imageData}" alt="Post image" data-lightbox="${p.imageData}">` : ''}
        <p class="mini-post-text">${escapeHtml(p.text)}</p>
        <div class="mini-post-footer">
          <span class="mini-post-time">${timeAgo(p.createdAt)}</span>
          <span style="color:var(--text-muted);font-size:0.73rem;">❤️ ${p.likes}</span>
          <button class="mini-post-delete" data-post-id="${p.id}">Delete</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.mini-post-delete').forEach(btn => {
      btn.addEventListener('click', () => deletePost(btn.dataset.postId, () => renderUserDashboard(currentUser)));
    });
    list.querySelectorAll('[data-lightbox]').forEach(img => {
      img.addEventListener('click', () => openLightbox(img.dataset.lightbox));
    });
  }

  // Edit profile modal
  document.getElementById('openEditProfileBtn')?.addEventListener('click', () => {
    if (!currentUser) return;
    document.getElementById('editNameInput').value = currentUser.name;
    document.getElementById('editBioInput').value = currentUser.bio || '';
    document.getElementById('editStatusSelect').value = currentUser.status || 'Active 🟢';
    document.getElementById('editProfileModal').classList.add('active');
  });

  document.getElementById('closeEditProfileModal')?.addEventListener('click', () => document.getElementById('editProfileModal').classList.remove('active'));
  document.getElementById('editProfileModal')?.addEventListener('click', (e) => { if (e.target === document.getElementById('editProfileModal')) document.getElementById('editProfileModal').classList.remove('active'); });
  document.getElementById('cancelEditProfileBtn')?.addEventListener('click', () => document.getElementById('editProfileModal').classList.remove('active'));

  document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('editNameInput').value.trim();
    const bio = document.getElementById('editBioInput').value.trim();
    const status = document.getElementById('editStatusSelect').value;

    if (!name) return showToast('Name cannot be empty', 'error');

    try {
      const res = await fetch(`${API}/user/profile`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ name, bio, status })
      });
      const data = await res.json();
      if (!res.ok || !data.success) return showToast(data.message, 'error');
      currentUser = data.user;
      document.getElementById('editProfileModal').classList.remove('active');
      renderUserDashboard(currentUser);
      showToast('Profile updated!', 'success');
    } catch {
      showToast('Error updating profile', 'error');
    }
  });

  // Dashboard compose post
  document.getElementById('dashComposeText')?.addEventListener('input', () => {
    const len = document.getElementById('dashComposeText').value.length;
    const cc = document.getElementById('dashCharCount');
    cc.textContent = `${len}/500`;
    cc.className = `char-count ${len > 450 ? 'near-limit' : ''} ${len >= 500 ? 'at-limit' : ''}`;
  });

  document.getElementById('dashImageInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return showToast('Image must be under 3MB', 'error');
    const reader = new FileReader();
    reader.onload = (ev) => {
      dashImageData = ev.target.result;
      document.getElementById('dashPreviewImg').src = dashImageData;
      document.getElementById('dashImagePreview').style.display = 'block';
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('dashRemoveImage')?.addEventListener('click', () => {
    dashImageData = null;
    document.getElementById('dashImagePreview').style.display = 'none';
    document.getElementById('dashImageInput').value = '';
  });

  document.getElementById('dashPostBtn')?.addEventListener('click', async () => {
    const text = document.getElementById('dashComposeText').value.trim();
    if (!text) return showToast('Write something first!', 'error');
    await createPost(text, dashImageData);
    document.getElementById('dashComposeText').value = '';
    dashImageData = null;
    document.getElementById('dashImagePreview').style.display = 'none';
    document.getElementById('dashImageInput').value = '';
    document.getElementById('dashCharCount').textContent = '0/500';
    renderUserDashboard(currentUser);
  });

  document.getElementById('goToFeedBtn')?.addEventListener('click', () => {
    document.querySelector('[data-view="feed"]')?.click();
  });

  // ===================================================
  // FEED
  // ===================================================
  function updateFeedCompose() {
    if (!currentUser) return;
    document.getElementById('feedComposeAvatar').textContent = currentUser.avatar || '🚀';
    document.getElementById('sidebarAvatar').textContent = currentUser.avatar || '🚀';
    document.getElementById('sidebarName').textContent = currentUser.name;
    document.getElementById('sidebarUname').textContent = `@${currentUser.username || currentUser.email.split('@')[0]}`;
    document.getElementById('sidebarLoginCount').textContent = currentUser.loginCount || 1;
  }

  document.getElementById('feedPostText')?.addEventListener('input', () => {
    const len = document.getElementById('feedPostText').value.length;
    const cc = document.getElementById('feedCharCount');
    cc.textContent = `${len}/500`;
    cc.className = `char-count ${len > 450 ? 'near-limit' : ''} ${len >= 500 ? 'at-limit' : ''}`;
  });

  document.getElementById('feedImageInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return showToast('Image must be under 3MB', 'error');
    const reader = new FileReader();
    reader.onload = (ev) => {
      feedImageData = ev.target.result;
      document.getElementById('feedPreviewImg').src = feedImageData;
      document.getElementById('feedImagePreview').style.display = 'block';
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('feedRemoveImage')?.addEventListener('click', () => {
    feedImageData = null;
    document.getElementById('feedImagePreview').style.display = 'none';
    document.getElementById('feedImageInput').value = '';
  });

  document.getElementById('feedPostBtn')?.addEventListener('click', async () => {
    const text = document.getElementById('feedPostText').value.trim();
    if (!text) return showToast('Write something first!', 'error');
    const ok = await createPost(text, feedImageData);
    if (ok) {
      document.getElementById('feedPostText').value = '';
      feedImageData = null;
      document.getElementById('feedImagePreview').style.display = 'none';
      document.getElementById('feedImageInput').value = '';
      document.getElementById('feedCharCount').textContent = '0/500';
      loadFeed();
    }
  });

  async function createPost(text, imageData) {
    try {
      const res = await fetch(`${API}/posts`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ text, imageData: imageData || null })
      });
      const data = await res.json();
      if (!res.ok || !data.success) { showToast(data.message || 'Failed to post', 'error'); return false; }
      showToast('Post published! ✨', 'success');
      return true;
    } catch {
      showToast('Error publishing post', 'error');
      return false;
    }
  }

  async function loadFeed() {
    const stream = document.getElementById('feedPostsStream');
    if (!stream) return;
    stream.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><span>Loading feed...</span></div>';

    try {
      const res = await fetch(`${API}/posts/feed`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok || !data.success) { stream.innerHTML = '<div class="loading-spinner">Failed to load feed.</div>'; return; }

      document.getElementById('sidebarPostCount').textContent = data.posts.filter(p => p.authorId?.toString() === currentUser?.id?.toString()).length;

      if (data.posts.length === 0) {
        stream.innerHTML = '<div class="empty-state" style="padding:40px;">No posts yet. Be the first to post!</div>';
        return;
      }

      stream.innerHTML = data.posts.map(p => renderPostCard(p)).join('');
      bindPostCardEvents(stream);
    } catch {
      stream.innerHTML = '<div class="loading-spinner">Cannot reach server.</div>';
    }
  }

  function renderPostCard(post) {
    const isOwn = currentUser && post.authorId?.toString() === currentUser.id?.toString();
    return `
      <div class="post-card" data-post-id="${post.id}">
        <div class="post-card-header">
          <div class="post-author-avatar" data-user-id="${post.authorId}" title="View profile">${post.authorAvatar || '🚀'}</div>
          <div class="post-author-info">
            <span class="post-author-name" data-user-id="${post.authorId}">${escapeHtml(post.authorName)}</span>
            <div class="post-author-handle">@${post.authorUsername || '–'}</div>
          </div>
          <span class="post-timestamp">${timeAgo(post.createdAt)}</span>
        </div>
        <p class="post-text">${escapeHtml(post.text)}</p>
        ${post.imageData ? `<img class="post-image" src="${post.imageData}" alt="Post image" data-lightbox="${post.imageData}">` : ''}
        <div class="post-actions">
          <button class="post-action-btn like-action ${post.likedByMe ? 'liked' : ''}" data-post-id="${post.id}" data-liked="${post.likedByMe}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="${post.likedByMe ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span class="like-count">${post.likes}</span>
          </button>
          ${isOwn ? `<button class="post-action-btn delete-action" data-post-id="${post.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            Delete
          </button>` : ''}
        </div>
      </div>
    `;
  }

  function bindPostCardEvents(container) {
    // Like
    container.querySelectorAll('.like-action').forEach(btn => {
      btn.addEventListener('click', async () => {
        const postId = btn.dataset.postId;
        try {
          const res = await fetch(`${API}/posts/${postId}/like`, { method: 'PUT', headers: authHeaders() });
          const data = await res.json();
          if (!res.ok || !data.success) return;
          btn.querySelector('.like-count').textContent = data.likes;
          btn.dataset.liked = data.liked;
          btn.classList.toggle('liked', data.liked);
          btn.querySelector('svg').setAttribute('fill', data.liked ? 'currentColor' : 'none');
        } catch { /* offline */ }
      });
    });

    // Delete
    container.querySelectorAll('.delete-action').forEach(btn => {
      btn.addEventListener('click', () => deletePost(btn.dataset.postId, loadFeed));
    });

    // Author click → profile modal
    container.querySelectorAll('.post-author-avatar, .post-author-name').forEach(el => {
      el.addEventListener('click', () => openUserProfile(el.dataset.userId));
    });

    // Image lightbox
    container.querySelectorAll('[data-lightbox]').forEach(img => {
      img.addEventListener('click', () => openLightbox(img.dataset.lightbox));
    });
  }

  async function deletePost(postId, onSuccess) {
    if (!confirm('Delete this post permanently?')) return;
    try {
      const res = await fetch(`${API}/posts/${postId}`, { method: 'DELETE', headers: authHeaders() });
      const data = await res.json();
      if (!res.ok || !data.success) return showToast(data.message, 'error');
      showToast('Post deleted', 'success');
      if (onSuccess) onSuccess();
    } catch {
      showToast('Error deleting post', 'error');
    }
  }

  // ===================================================
  // USER PROFILE MODAL
  // ===================================================
  async function openUserProfile(userId) {
    if (!userId) return;
    const modal = document.getElementById('userProfileModal');
    modal.classList.add('active');

    document.getElementById('modalUserName').textContent = '...';
    document.getElementById('modalUserPosts').innerHTML = '<div class="loading-spinner" style="padding:16px 0;"><div class="spinner"></div></div>';

    try {
      const res = await fetch(`${API}/users/${userId}/profile`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok || !data.success) { modal.classList.remove('active'); showToast('Profile not found', 'error'); return; }

      const p = data.profile;
      document.getElementById('modalUserAvatar').textContent = p.avatar || '🚀';
      document.getElementById('modalUserName').textContent = p.name;
      document.getElementById('modalUserUsername').textContent = `@${p.username || '–'}`;
      document.getElementById('modalUserBio').textContent = p.bio || '–';
      document.getElementById('modalUserStatus').textContent = p.status || 'Active 🟢';
      document.getElementById('modalUserJoined').textContent = `Joined ${formatDate(p.createdAt)}`;
      document.getElementById('modalPostCount').textContent = p.postCount || 0;

      const roleEl = document.getElementById('modalUserRole');
      roleEl.textContent = p.role;
      roleEl.className = `badge ${p.role === 'Super Admin' ? 'badge-super-admin' : p.role === 'Admin' ? 'badge-admin' : 'badge-member'}`;

      if (p.recentPosts && p.recentPosts.length > 0) {
        const postsEl = document.getElementById('modalUserPosts');
        postsEl.innerHTML = p.recentPosts.map(post => `
          <div style="padding:10px 0;border-bottom:1px solid var(--border-color);">
            ${post.imageData ? `<img src="${post.imageData}" style="max-width:100%;max-height:100px;object-fit:cover;border-radius:8px;margin-bottom:6px;display:block;" alt="Post">` : ''}
            <p style="font-size:0.82rem;color:var(--text-primary);margin-bottom:4px;white-space:pre-wrap;">${escapeHtml(post.text)}</p>
            <span style="font-size:0.72rem;color:var(--text-muted);">${timeAgo(post.createdAt)} · ❤️ ${post.likes}</span>
          </div>
        `).join('');
      } else {
        document.getElementById('modalUserPosts').innerHTML = '<div class="empty-state" style="padding:12px 0;">No posts yet.</div>';
      }
    } catch {
      modal.classList.remove('active');
      showToast('Error loading profile', 'error');
    }
  }

  document.getElementById('closeUserProfileModal')?.addEventListener('click', () => document.getElementById('userProfileModal').classList.remove('active'));
  document.getElementById('userProfileModal')?.addEventListener('click', (e) => { if (e.target === document.getElementById('userProfileModal')) document.getElementById('userProfileModal').classList.remove('active'); });

  // ===================================================
  // IMAGE LIGHTBOX
  // ===================================================
  function openLightbox(src) {
    document.getElementById('lightboxImg').src = src;
    document.getElementById('imageLightbox').classList.add('active');
  }
  document.getElementById('imageLightbox')?.addEventListener('click', () => document.getElementById('imageLightbox').classList.remove('active'));

  // ===================================================
  // SETTINGS PANEL
  // ===================================================
  function initSettings() {
    if (!currentUser) return;
    document.getElementById('settingsNameInput').value = currentUser.name;
    document.getElementById('settingsBioInput').value = currentUser.bio || '';
    document.getElementById('settingsStatusSelect').value = currentUser.status || 'Active 🟢';
    settingsSelectedAvatar = currentUser.avatar;

    // Highlight current avatar
    document.getElementById('settingsAvatarGrid').querySelectorAll('.avatar-option').forEach(opt => {
      opt.classList.toggle('selected', opt.dataset.avatar === currentUser.avatar);
    });
  }

  document.getElementById('settingsAvatarGrid')?.querySelectorAll('.avatar-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.getElementById('settingsAvatarGrid').querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      settingsSelectedAvatar = opt.dataset.avatar;
    });
  });

  document.getElementById('saveProfileSettingsBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('settingsNameInput').value.trim();
    const bio = document.getElementById('settingsBioInput').value.trim();
    const status = document.getElementById('settingsStatusSelect').value;
    const avatar = settingsSelectedAvatar || currentUser?.avatar;

    if (!name) return showToast('Name cannot be empty', 'error');

    try {
      const res = await fetch(`${API}/user/profile`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ name, bio, status, avatar })
      });
      const data = await res.json();
      if (!res.ok || !data.success) return showToast(data.message, 'error');
      currentUser = data.user;
      showToast('Profile updated successfully!', 'success');
    } catch {
      showToast('Error updating profile', 'error');
    }
  });

  document.getElementById('changePasswordBtn')?.addEventListener('click', async () => {
    const current = document.getElementById('currentPasswordInput').value;
    const newPwd = document.getElementById('newPasswordInput').value;
    const confirm = document.getElementById('confirmNewPasswordInput').value;

    if (!current) return showToast('Enter your current password', 'error');
    if (newPwd.length < 8) return showToast('New password must be 8+ characters', 'error');
    if (newPwd !== confirm) return showToast('Passwords do not match', 'error');

    try {
      const res = await fetch(`${API}/user/change-password`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ currentPassword: current, newPassword: newPwd })
      });
      const data = await res.json();
      if (!res.ok || !data.success) return showToast(data.message, 'error');
      document.getElementById('currentPasswordInput').value = '';
      document.getElementById('newPasswordInput').value = '';
      document.getElementById('confirmNewPasswordInput').value = '';
      document.getElementById('settingsStrengthBar').style.width = '0%';
      document.getElementById('settingsStrengthText').textContent = '–';
      showToast('Password changed! 🔒', 'success');
    } catch {
      showToast('Error changing password', 'error');
    }
  });

  // ===================================================
  // ADMIN PORTAL
  // ===================================================
  let allAdminUsers = [];

  function renderAdminDashboard(user) {
    document.getElementById('adminAvatar').textContent = user.avatar || '👑';
    document.getElementById('adminUserName').textContent = user.name;
    document.getElementById('adminUserEmail').textContent = user.email || `username: ${user.username}`;
    const badge = document.getElementById('adminRoleBadge');
    badge.textContent = user.role === 'Super Admin' ? '👑 Super Admin' : '🛡️ Admin';
    badge.className = `badge ${user.role === 'Super Admin' ? 'badge-super-admin' : 'badge-admin'}`;
    fetchAdminUsers();
  }

  async function fetchAdminUsers() {
    try {
      const res = await fetch(`${API}/admin/users`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok || !data.success) return showToast(data.message, 'error');
      allAdminUsers = data.users;
      renderAdminTable();

      // fetch post count
      const postsRes = await fetch(`${API}/posts/feed`, { headers: authHeaders() });
      const postsData = await postsRes.json();
      if (postsData.success) document.getElementById('metricTotalPosts').textContent = postsData.total;
    } catch {
      showToast('Cannot connect to Admin API', 'error');
    }
  }

  function renderAdminTable() {
    const searchTerm = document.getElementById('adminSearchInput')?.value.toLowerCase() || '';
    const roleFilter = document.getElementById('adminRoleFilter')?.value || 'ALL';

    const filtered = allAdminUsers.filter(u => {
      const matchSearch = u.name.toLowerCase().includes(searchTerm) || u.email.toLowerCase().includes(searchTerm) || (u.username && u.username.includes(searchTerm));
      const matchRole = roleFilter === 'ALL' || (roleFilter === 'ADMIN' && (u.role === 'Admin' || u.role === 'Super Admin')) || (roleFilter === 'MEMBER' && u.role === 'Member');
      return matchSearch && matchRole;
    });

    document.getElementById('metricTotalUsers').textContent = allAdminUsers.length;
    document.getElementById('metricTotalAdmins').textContent = allAdminUsers.filter(u => u.role === 'Admin' || u.role === 'Super Admin').length;
    document.getElementById('metricTotalMembers').textContent = allAdminUsers.filter(u => u.role === 'Member').length;

    const tbody = document.getElementById('adminUsersTbody');
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px;">No users found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(u => {
      const isSuper = u.role === 'Super Admin';
      const isAdmin = u.role === 'Admin';
      const roleBadge = isSuper ? 'badge-super-admin' : isAdmin ? 'badge-admin' : 'badge-member';
      return `
        <tr>
          <td>
            <div class="user-cell">
              <div class="user-avatar-sm">${u.avatar || '🚀'}</div>
              <div>
                <strong style="display:block;font-size:0.85rem;">${escapeHtml(u.name)}</strong>
                <span style="font-size:0.7rem;color:var(--text-muted);font-family:monospace;">@${u.username || '–'}</span>
              </div>
            </div>
          </td>
          <td style="font-size:0.83rem;">${escapeHtml(u.email)}</td>
          <td><span class="badge ${roleBadge}">${u.role}</span></td>
          <td><span class="status-pill" style="font-size:0.72rem;">${u.status || 'Active 🟢'}</span></td>
          <td style="color:var(--text-secondary);font-size:0.8rem;">${formatDate(u.createdAt)}</td>
          <td>
            <div class="btn-action-group">
              ${!isSuper ? `
                <button class="btn-act ${isAdmin ? 'btn-demote' : 'btn-promote'}" data-action="promote" data-id="${u.id}" data-role="${u.role}">
                  ${isAdmin ? 'Demote' : 'Promote'}
                </button>
                <button class="btn-act" data-action="edit" data-id="${u.id}">Edit</button>
                <button class="btn-act btn-delete" data-action="delete" data-id="${u.id}" data-name="${escapeHtml(u.name)}">Delete</button>
              ` : '<span style="font-size:0.73rem;color:var(--warning);font-weight:700;">System Owner</span>'}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const { action, id, role, name } = btn.dataset;
        if (action === 'promote') toggleRole(id, role === 'Admin' ? 'Member' : 'Admin');
        else if (action === 'edit') openAdminEditModal(id);
        else if (action === 'delete') adminDeleteUser(id, name);
      });
    });
  }

  document.getElementById('adminSearchInput')?.addEventListener('input', renderAdminTable);
  document.getElementById('adminRoleFilter')?.addEventListener('change', renderAdminTable);

  async function toggleRole(userId, newRole) {
    try {
      const res = await fetch(`${API}/admin/users/${userId}/promote`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (!res.ok || !data.success) return showToast(data.message, 'error');
      showToast(data.message, 'success');
      fetchAdminUsers();
    } catch { showToast('Error updating role', 'error'); }
  }

  function openAdminEditModal(userId) {
    const u = allAdminUsers.find(u => u.id === userId);
    if (!u) return;
    document.getElementById('editUserId').value = u.id;
    document.getElementById('adminModalName').value = u.name;
    document.getElementById('adminModalEmail').value = u.email;
    document.getElementById('adminModalRole').value = u.role;
    document.getElementById('adminModalStatus').value = u.status || 'Active 🟢';
    document.getElementById('adminModalBio').value = u.bio || '';
    document.getElementById('adminEditModal').classList.add('active');
  }

  document.getElementById('closeAdminEditModal')?.addEventListener('click', () => document.getElementById('adminEditModal').classList.remove('active'));
  document.getElementById('adminEditModal')?.addEventListener('click', (e) => { if (e.target === document.getElementById('adminEditModal')) document.getElementById('adminEditModal').classList.remove('active'); });

  document.getElementById('adminEditUserForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('editUserId').value;
    const payload = {
      name: document.getElementById('adminModalName').value.trim(),
      email: document.getElementById('adminModalEmail').value.trim(),
      role: document.getElementById('adminModalRole').value,
      status: document.getElementById('adminModalStatus').value,
      bio: document.getElementById('adminModalBio').value.trim()
    };

    try {
      const res = await fetch(`${API}/admin/users/${userId}`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) return showToast(data.message, 'error');
      showToast(data.message, 'success');
      document.getElementById('adminEditModal').classList.remove('active');
      fetchAdminUsers();
    } catch { showToast('Error saving user', 'error'); }
  });

  async function adminDeleteUser(userId, userName) {
    if (!confirm(`Permanently delete user "${userName}" and all their posts?`)) return;
    try {
      const res = await fetch(`${API}/admin/users/${userId}`, { method: 'DELETE', headers: authHeaders() });
      const data = await res.json();
      if (!res.ok || !data.success) return showToast(data.message, 'error');
      showToast(data.message, 'success');
      fetchAdminUsers();
    } catch { showToast('Error deleting user', 'error'); }
  }

  // ===================================================
  // FORGOT PASSWORD MODAL
  // ===================================================
  let resetEmail = '';
  document.getElementById('openForgotModal')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('forgotModal').classList.add('active');
    showForgotStep(1);
  });
  document.getElementById('closeForgotModal')?.addEventListener('click', () => document.getElementById('forgotModal').classList.remove('active'));
  document.getElementById('forgotModal')?.addEventListener('click', (e) => { if (e.target === document.getElementById('forgotModal')) document.getElementById('forgotModal').classList.remove('active'); });

  function showForgotStep(n) {
    [1, 2, 3].forEach(i => {
      const el = document.getElementById(`modalStep${i}`);
      if (el) el.style.display = i === n ? 'block' : 'none';
    });
  }

  document.getElementById('forgotStep1Form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    resetEmail = document.getElementById('forgotEmail').value.trim().toLowerCase();
    showToast(`Code sent to ${resetEmail}! (Hint: 1234)`, 'info');
    showForgotStep(2);
  });

  const otpBoxes = document.querySelectorAll('.otp-box');
  otpBoxes.forEach((box, i) => {
    box.addEventListener('input', () => {
      if (box.value.length === 1 && i < otpBoxes.length - 1) otpBoxes[i + 1].focus();
    });
  });

  document.getElementById('forgotStep2Form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    showToast('Code verified!', 'success');
    showForgotStep(3);
  });

  document.getElementById('forgotStep3Form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPass = document.getElementById('newPassword').value;
    if (newPass.length < 8) return showToast('Password must be 8+ characters', 'error');
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, newPassword: newPass })
      });
      const data = await res.json();
      if (!res.ok || !data.success) return showToast(data.message, 'error');
      showToast('Password reset! Please sign in.', 'success');
      document.getElementById('forgotModal').classList.remove('active');
      switchToTab('login');
    } catch {
      showToast('Error resetting password', 'error');
    }
  });

  // ===================================================
  // THEME TOGGLE
  // ===================================================
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    document.getElementById('themeIconSun').style.display = theme === 'dark' ? 'none' : 'block';
    document.getElementById('themeIconMoon').style.display = theme === 'dark' ? 'block' : 'none';
  }
  setTheme(localStorage.getItem(THEME_KEY) || 'dark');
  document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
    setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  // ===================================================
  // UTILS
  // ===================================================
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ===================================================
  // BOOT
  // ===================================================
  fetchCurrentUser();

});
