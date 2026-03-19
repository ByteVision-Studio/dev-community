function requireAuth() {
    let user = API.getCurrentUser ? API.getCurrentUser() : null;

    // Fallback, falls getCurrentUser aus irgendeinem Grund noch nicht greift
    if (!user) {
        try {
            const tokenRaw = localStorage.getItem('devcommunity_token');
            if (tokenRaw) {
                const token = JSON.parse(atob(tokenRaw));
                const users = JSON.parse(localStorage.getItem('devcommunity_users') || '[]');
                user = users.find(u => u.username === token.username) || null;
            }
        } catch (e) {
            user = null;
        }
    }

    // aktuelle Seite sauber ermitteln
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // erlaubte Seiten ohne Login
    const publicPages = ['login.html', 'register.html'];

    // wenn KEIN user und NICHT auf login/register
    if (!user && !publicPages.includes(currentPage)) {
        const fullPath = currentPage + window.location.search;

        // wichtig: verhindern von redirect-loop
        if (currentPage !== 'login.html') {
            window.location.href = 'login.html?returnTo=' + encodeURIComponent(fullPath);
        }

        return false;
    }

    return true;
}

// js/app.js

function $(sel) { return document.querySelector(sel) }
function $all(sel) { return Array.from(document.querySelectorAll(sel)) }

function showFlash(msg, type = 'success') {
    const container = document.getElementById('flash-container');
    if (!container) return;
    container.innerHTML = `<div class="flash ${type}">${msg}</div>`;
    setTimeout(() => { if (container) container.innerHTML = '' }, 3500);
}

// small util to prevent HTML injection
function escapeHtml(unsafe) {
    return (unsafe || '')
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// file -> base64
function fileToBase64(file) {
    return new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(file);
    });
}

/* Header */
function renderHeader() {
    const header = document.getElementById('app-header');
    if (!header) return;
    const user = API.getCurrentUser ? API.getCurrentUser() : null;
    header.innerHTML = `
    <div class="container nav">
      <a class="logo" href="index.html">DevCommunity</a>
      <div class="nav-right" style="display:flex;align-items:center;gap:12px">
        <a href="index.html">Home</a>
        <a href="new.html">Neues Thema</a>
        <a href="chat.html">Chat</a>
        <div id="auth-area"></div>
      </div>
    </div>
  `;
    const authArea = document.getElementById('auth-area');
    if (user) {
        // avatar with initials
        const initials = (user.username && user.username[0]) ? user.username[0].toUpperCase() : '?';
        const avatarHtml = user.profilePic ? `<img src="${user.profilePic}" alt="avatar" style="width:34px;height:34px;border-radius:8px;object-fit:cover;"/>` : `<div style="width:34px;height:34px;border-radius:8px;background:#2563eb;color:white;display:flex;align-items:center;justify-content:center;font-weight:600">${initials}</div>`;
        authArea.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px">
        <a href="profile.html?user=${encodeURIComponent(user.username)}" title="Profil" style="display:flex;gap:8px;align-items:center;text-decoration:none;color:inherit">
          ${avatarHtml}
          <div style="font-weight:600;color:#0f172a">${escapeHtml(user.username)}</div>
        </a>
        <button class="btn secondary" id="logoutBtn">Logout</button>
      </div>
    `;
        $('#logoutBtn').addEventListener('click', () => {
            API.logout();
            showFlash('Du wurdest ausgeloggt', 'success');
            renderHeader();
            setTimeout(() => location.href = 'index.html', 300);
        });
    } else {
        authArea.innerHTML = `
      <a class="btn" href="login.html">Login</a>
      <a class="btn" href="register.html">Register</a>
    `;
    }
}

/* INDEX, NEW, THREAD omitted here for brevity — keep previous implementations */
// Ersetze die initIndexPage()-Implementierung mit dieser Version:
function initIndexPage() {
    renderHeader();
    const params = new URLSearchParams(location.search);
    const q = params.get('q') || '';
    const list = $('#threadList');
    if (!list) return;
    let threads = API.getThreads() || [];
    if (q) threads = threads.filter(t => (t.title + t.content + t.tag).toLowerCase().includes(q.toLowerCase()));
    list.innerHTML = '';
    if (threads.length === 0) {
        list.innerHTML = `<div class="card">Keine Threads. Sei der Erste: <a href="new.html">Neues Thema erstellen</a></div>`;
        return;
    }

    const currentUser = API.getCurrentUser ? API.getCurrentUser() : null;

    threads.forEach(t => {
        const el = document.createElement('div'); el.className = 'card';
        // card inner
        el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div style="flex:1">
          <h2 style="margin:0 0 8px 0"><a href="thread.html?id=${encodeURIComponent(t.id)}" style="color:var(--text);text-decoration:none">${escapeHtml(t.title)}</a></h2>
          <div class="thread-meta">
            <small>von <a href="profile.html?user=${encodeURIComponent(t.author)}">${escapeHtml(t.author)}</a></small>
            <small>· ${new Date(t.createdAt).toLocaleString()}</small>
            <small>· ${t.replies.length} Antworten</small>
            <small>· Votes: ${t.votes || 0}</small>
          </div>
          <p class="thread-excerpt" style="margin-top:10px">${escapeHtml(t.content.slice(0, 200))}${t.content.length > 200 ? '…' : ''}</p>
          <div style="margin-top:10px"><span class="tag">${escapeHtml(t.tag)}</span></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
          <a class="btn" href="thread.html?id=${encodeURIComponent(t.id)}">Ansehen</a>
          ${currentUser && currentUser.username === t.author ? `<button class="btn" data-delete-id="${encodeURIComponent(t.id)}" style="background:#ef4444">Löschen</button>` : ''}
        </div>
      </div>
    `;
        list.appendChild(el);

        // attach delete handler (if present)
        const delBtn = el.querySelector('[data-delete-id]');
        if (delBtn) {
            delBtn.addEventListener('click', async (e) => {
                const id = delBtn.getAttribute('data-delete-id');
                if (!confirm('Möchtest du diesen Thread wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;
                try {
                    await API.deleteThread(id);
                    showFlash('Thread gelöscht', 'success');
                    // Entferne Element aus DOM
                    el.remove();
                } catch (err) {
                    showFlash(err.message || 'Fehler beim Löschen', 'error');
                    console.error(err);
                }
            });
        }

    });
}

function initNewPage() {
    renderHeader();
    const form = $('#threadForm');
    if (!form) return;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = API.getCurrentUser ? API.getCurrentUser() : null;
        if (!user) {
            showFlash('Du musst dich einloggen um ein Thema zu erstellen', 'error');
            setTimeout(() => location.href = 'login.html?returnTo=new.html', 700);
            return;
        }
        const data = {
            title: form.title.value.trim(),
            content: form.content.value.trim(),
            tag: form.tag.value.trim() || 'general',
            author: user.username
        };
        if (!data.title || !data.content) { showFlash('Titel und Inhalt sind erforderlich', 'error'); return; }
        const thread = API.createThread(data);
        showFlash('Thread erstellt', 'success');
        location.href = 'thread.html?id=' + thread.id;
    });
}

function initThreadPage() {
    renderHeader();
    const id = new URLSearchParams(location.search).get('id');
    const thread = API.getThread(id);
    const container = $('#threadContainer');
    if (!container) return;
    if (!thread) { container.innerHTML = '<div class="card">Thread nicht gefunden</div>'; return; }
    container.innerHTML = `
    <div class="card">
      <h1>${escapeHtml(thread.title)}</h1>
      <div class="thread-meta"><small>von <a href="profile.html?user=${thread.author}">${escapeHtml(thread.author)}</a></small> · <small>${new Date(thread.createdAt).toLocaleString()}</small> · <small>Votes: <span id="threadVotes">${thread.votes || 0}</span></small></div>
      <div style="margin-top:12px;">${escapeHtml(thread.content).replace(/\n/g, '<br>')}</div>
      <div style="margin-top:14px"><button class="btn" id="voteUp">▲ Upvote</button> <button class="btn secondary" id="voteDown">▼ Downvote</button></div>
    </div>
    <h3>Antworten</h3>
    <div id="repliesArea"></div>
    <div class="card">
      <h3>Antwort schreiben</h3>
      <form id="replyForm">
        <input type="text" name="author" id="replyAuthor" class="input" placeholder="Dein Benutzername (wird von Auth überschrieben wenn eingeloggt)"/>
        <textarea name="content" id="replyContent" class="input" placeholder="Antwort (Markdown supported later)"></textarea>
        <div class="row"><button class="btn">Antwort posten</button> <button type="button" id="cancelReply" class="btn secondary">Abbrechen</button></div>
      </form>
    </div>
  `;

    // render replies
    function renderReplies() {
        const area = $('#repliesArea'); area.innerHTML = '';
        thread.replies.forEach(r => {
            const d = document.createElement('div'); d.className = 'reply';
            d.innerHTML = `<div style="display:flex;justify-content:space-between"><strong>${escapeHtml(r.author)}</strong><small>${new Date(r.createdAt).toLocaleString()}</small></div><div style="margin-top:8px">${escapeHtml(r.content).replace(/\n/g, '<br>')}</div>`;
            area.appendChild(d);
        });
    }
    renderReplies();

    // voting
    $('#voteUp').addEventListener('click', () => {
        API.voteThread(thread.id, 1);
        $('#threadVotes').textContent = API.getThread(thread.id).votes;
    });
    $('#voteDown').addEventListener('click', () => {
        API.voteThread(thread.id, -1);
        $('#threadVotes').textContent = API.getThread(thread.id).votes;
    });

    // reply submit
    $('#replyForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const user = API.getCurrentUser ? API.getCurrentUser() : null;
        const authorField = $('#replyAuthor');
        const content = $('#replyContent').value.trim();
        if (!content) { showFlash('Antwort darf nicht leer sein', 'error'); return; }
        let author = authorField.value.trim() || 'anonym';
        if (user) author = user.username;
        API.createReply(thread.id, { author, content });
        showFlash('Antwort gepostet', 'success');
        setTimeout(() => location.reload(), 200);
    });

    $('#cancelReply').addEventListener('click', () => {
        $('#replyAuthor').value = ''; $('#replyContent').value = '';
    });
}

/* PROFILE PAGE */
function initProfilePage() {
    renderHeader();
    const username = new URLSearchParams(location.search).get('user');
    const box = $('#profileBox');
    if (!box) return;
    const data = API.getUserProfile(username);
    if (!data.user) { box.innerHTML = `<div class="card">Nutzer nicht gefunden</div>`; return; }

    const currentUser = API.getCurrentUser ? API.getCurrentUser() : null;
    const isOwn = currentUser && currentUser.username === data.user.username;

    // profile header
    box.innerHTML = `
    <div class="card profile" style="justify-content:space-between;align-items:flex-start">
      <div style="display:flex;gap:18px;align-items:center">
        <div class="avatar" id="avatarDisplay">${data.user.profilePic ? `<img src="${data.user.profilePic}" alt="avatar" style="width:60px;height:60px;border-radius:50%;object-fit:cover">` : (data.user.username[0] || '').toUpperCase()}</div>
        <div>
          <h2 id="profileName">${escapeHtml(data.user.username)}</h2>
          <small>Registriert: ${new Date(data.user.createdAt).toLocaleDateString()}</small>
          <small style="display:block;margin-top:6px">${data.posts.length} Threads</small>
          <p style="margin-top:8px" id="profileBio">${escapeHtml(data.user.bio || '')}</p>
        </div>
      </div>
      <div id="profileActions"></div>
    </div>
    <h3 style="margin-top:18px">Threads</h3>
    <div id="userThreads"></div>
  `;

    if (isOwn) {
        $('#profileActions').innerHTML = `<a class="btn" href="#" id="editProfileBtn">Profil bearbeiten</a>`;
        $('#editProfileBtn').addEventListener('click', (e) => {
            e.preventDefault();
            showProfileEditForm(data.user);
        });
    } else {
        $('#profileActions').innerHTML = `<a class="btn" href="index.html">Nach Threads suchen</a>`;
    }

    const list = $('#userThreads');
    data.posts.forEach(p => {
        const el = document.createElement('div'); el.className = 'card';
        el.innerHTML = `<a href="thread.html?id=${p.id}" style="color:var(--text)">${escapeHtml(p.title)}</a><div class="thread-meta"><small>${new Date(p.createdAt).toLocaleString()}</small></div>`;
        list.appendChild(el);
    });
}

function showProfileEditForm(user) {
    // show form in a modal-like card inserted after header
    const box = document.getElementById('profileBox');
    const editHtml = document.createElement('div');
    editHtml.className = 'card';
    editHtml.innerHTML = `
    <h3>Profil bearbeiten</h3>
    <form id="profileEditForm">
      <label>Profilbild (PNG/JPG)</label>
      <input type="file" id="profilePicInput" accept="image/*" />
      <div style="display:flex;gap:12px">
        <div style="flex:1">
          <label>Benutzername</label>
          <input class="input" name="username" value="${escapeHtml(user.username)}" required />
        </div>
        <div style="flex:1">
          <label>Email</label>
          <input class="input" name="email" type="email" value="${escapeHtml(user.email)}" required />
        </div>
      </div>
      <label>Bio</label>
      <textarea class="input" name="bio">${escapeHtml(user.bio || '')}</textarea>
      <div class="row" style="justify-content:flex-end;margin-top:6px">
        <button class="btn" id="saveProfileBtn">Speichern</button>
        <button type="button" class="btn secondary" id="cancelEditBtn">Abbrechen</button>
      </div>
    </form>

    <hr style="margin:18px 0;border:none;border-top:1px solid var(--border)">

    <h4>Passwort ändern</h4>
    <form id="passwordChangeForm">
      <input class="input" name="currentPassword" type="password" placeholder="Aktuelles Passwort" required />
      <input class="input" name="newPassword" type="password" placeholder="Neues Passwort" required />
      <div class="row" style="justify-content:flex-end">
        <button class="btn">Passwort ändern</button>
      </div>
    </form>

    <hr style="margin:18px 0;border:none;border-top:1px solid var(--border)">

    <h4>Konto löschen</h4>
    <p class="text-muted">Konto unwiderruflich löschen. Alle Threads werden entfernt.</p>
    <form id="deleteAccountForm">
      <input class="input" name="confirmPassword" type="password" placeholder="Passwort zur Bestätigung" required />
      <div style="display:flex;justify-content:flex-end;gap:8px">
        <button type="button" class="btn secondary" id="cancelDelete">Abbrechen</button>
        <button class="btn danger" id="deleteAccountBtn">Konto löschen</button>
      </div>
    </form>
  `;
    box.prepend(editHtml);

    // cancel edit
    $('#cancelEditBtn').addEventListener('click', () => editHtml.remove());

    // profile pic preview & save
    let selectedBase64 = null;
    $('#profilePicInput').addEventListener('change', async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
            selectedBase64 = await fileToBase64(f);
            // show preview
            $('#avatarDisplay').innerHTML = `<img src="${selectedBase64}" alt="avatar" style="width:60px;height:60px;border-radius:50%;object-fit:cover">`;
        } catch (err) {
            console.error(err);
            showFlash('Fehler beim Lesen des Bildes', 'error');
        }
    });

    $('#profileEditForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const newUsername = form.username.value.trim();
        const newEmail = form.email.value.trim();
        const newBio = form.bio.value.trim();
        try {
            const current = API.getCurrentUser();
            const updated = await API.updateUser(current.username, { username: newUsername, email: newEmail, bio: newBio, profilePic: selectedBase64 || current.profilePic || null });
            showFlash('Profil aktualisiert', 'success');
            // re-render header and profile box
            renderHeader();
            setTimeout(() => location.href = 'profile.html?user=' + encodeURIComponent(updated.username), 300);
        } catch (err) {
            showFlash(err.message || 'Fehler beim Aktualisieren', 'error');
        }
    });

    // password change
    $('#passwordChangeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const current = API.getCurrentUser();
        const curPw = e.target.currentPassword.value;
        const newPw = e.target.newPassword.value;
        try {
            await API.changePassword(current.username, curPw, newPw);
            showFlash('Passwort geändert', 'success');
            e.target.reset();
        } catch (err) {
            showFlash(err.message || 'Fehler beim Ändern des Passworts', 'error');
        }
    });

    // delete account
    $('#cancelDelete').addEventListener('click', () => {
        // remove the whole edit card
        editHtml.remove();
    });

    $('#deleteAccountBtn').addEventListener('click', async (ev) => {
        ev.preventDefault();
        const pw = $('#deleteAccountForm input[name="confirmPassword"]').value;
        if (!confirm('Möchtest du dein Konto wirklich löschen? Diese Aktion ist unwiderruflich.')) return;
        try {
            const current = API.getCurrentUser();
            await API.deleteUser(current.username, pw);
            showFlash('Konto gelöscht', 'success');
            renderHeader();
            setTimeout(() => location.href = 'index.html', 400);
        } catch (err) {
            showFlash(err.message || 'Fehler beim Löschen des Kontos', 'error');
        }
    });
}

/* AUTH PAGES: Login / Register */
function initLoginPage() {
    renderHeader();
    const form = $('#loginForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identifier = form.identifier.value.trim();
        const password = form.password.value;
        try {
            await API.login({ identifier, password });
            showFlash('Erfolgreich eingeloggt', 'success');
            const params = new URLSearchParams(location.search);
            let returnTo = params.get('returnTo');

            // fallback
            if (!returnTo || returnTo === 'login.html') {
                returnTo = 'index.html';
            }

            // WICHTIG: absoluter redirect
            setTimeout(() => {
                window.location.href = returnTo;
            }, 500);
        } catch (err) {
            showFlash(err.message || 'Fehler beim Login', 'error');
        }
    });
}

function initRegisterPage() {
    renderHeader();
    const form = $('#registerForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = form.username.value.trim();
        const email = form.email.value.trim();
        const password = form.password.value;
        const bio = form.bio.value.trim();
        if (!username || !password || !email) { showFlash('Benutzername, Email & Passwort sind erforderlich', 'error'); return; }
        try {
            await API.register({ username, password, email, bio });
            showFlash('Account erstellt & eingeloggt', 'success');
            setTimeout(() => location.href = 'index.html', 500);
        } catch (err) {
            showFlash(err.message || 'Fehler bei Registrierung', 'error');
        }
    });
}

function initPage() {
    const page = document.body.dataset.page;

    // erst login/register initialisieren
    if (page === 'login') {
        renderHeader();
        initLoginPage();
        return;
    }

    if (page === 'register') {
        renderHeader();
        initRegisterPage();
        return;
    }

    // dann Auth check für ALLE anderen Seiten
    if (!requireAuth()) return;

    renderHeader();

    if (page === 'index') initIndexPage();
    if (page === 'new') initNewPage();
    if (page === 'thread') initThreadPage();
    if (page === 'profile') initProfilePage();

}

document.addEventListener('DOMContentLoaded', () => {
    try { initPage(); } catch (e) { console.error(e) }
});