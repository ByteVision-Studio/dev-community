// js/api.js
// Frontend-mock API + Auth (LocalStorage)
// Wechsel zu realem Backend: setze USE_MOCK = false und implementiere fetch-Aufrufe weiter unten.

const USE_MOCK = true;
const MOCK_PREFIX = "devcommunity_";

// helpers
async function hashPassword(password) {
    const enc = new TextEncoder();
    const data = enc.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function save(key, value) { localStorage.setItem(MOCK_PREFIX + key, JSON.stringify(value)) }
function load(key) { return JSON.parse(localStorage.getItem(MOCK_PREFIX + key) || 'null') }
function remove(key) { localStorage.removeItem(MOCK_PREFIX + key) }

// utility: read token
function readToken() {
    try {
        return JSON.parse(atob(localStorage.getItem(MOCK_PREFIX + 'token')));
    } catch (e) {
        return null;
    }
}
function writeToken(payload) {
    localStorage.setItem(MOCK_PREFIX + 'token', btoa(JSON.stringify(payload)));
}

// ---- MOCK IMPLEMENTATION ----
const MockAPI = {
    // Users stored as: [{username, email, passwordHash, bio, createdAt, profilePic}]
    async register({ username, password, email, bio }) {
        username = username.trim().toLowerCase();
        email = (email || '').trim().toLowerCase();
        if (!username || !password || !email) throw new Error('Benutzername, Passwort und Email sind erforderlich');
        const users = load('users') || [];
        if (users.find(u => u.username === username)) throw new Error('Benutzername existiert bereits');
        if (users.find(u => u.email === email)) throw new Error('Email wird bereits verwendet');
        const passwordHash = await hashPassword(password);
        const user = {
            username,
            email,
            passwordHash,
            bio: bio || '',
            createdAt: new Date().toISOString(),
            profilePic: null
        };
        users.push(user);
        save('users', users);
        const token = { username, iat: Date.now() };
        writeToken(token);
        return { user, token };
    },

    async login({ identifier, password }) {
        if (!identifier || !password) throw new Error('Benutzername/Email und Passwort erforderlich');
        const id = identifier.trim().toLowerCase();
        const users = load('users') || [];
        const user = users.find(u => u.username === id || u.email === id);
        if (!user) throw new Error('Benutzer nicht gefunden');
        const passwordHash = await hashPassword(password);
        if (passwordHash !== user.passwordHash) throw new Error('Falsches Passwort');
        const token = { username: user.username, iat: Date.now() };
        writeToken(token);
        return { user, token };
    },

    logout() {
        remove('token');
    },

    getCurrentUser() {
        const payload = readToken();
        if (!payload) return null;
        const users = load('users') || [];
        return users.find(u => u.username === payload.username) || null;
    },

    // in js/api.js — Im MockAPI-Objekt ergänzen:
    async deleteThread(id) {
        // robust: string/number tolerant
        const threads = this.getThreads();
        const idx = threads.findIndex(t => String(t.id) === String(id));
        if (idx === -1) throw new Error('Thread nicht gefunden');

        // require logged-in user
        const current = this.getCurrentUser();
        if (!current) throw new Error('Nicht authentifiziert');

        // only author can delete
        if (threads[idx].author !== current.username) {
            throw new Error('Nur der Ersteller kann diesen Thread löschen');
        }

        // remove thread
        threads.splice(idx, 1);
        save('threads', threads);
        return true;
    },

    // User update operations
    async updateUser(currentUsername, updates) {
        // updates: {username?, email?, bio?, profilePic?}
        currentUsername = currentUsername.trim().toLowerCase();
        const users = load('users') || [];
        const me = users.find(u => u.username === currentUsername);
        if (!me) throw new Error('Benutzer nicht gefunden');

        if (updates.username) {
            const newU = updates.username.trim().toLowerCase();
            if (!newU) throw new Error('Benutzername darf nicht leer sein');
            if (newU !== currentUsername && users.find(u => u.username === newU)) throw new Error('Benutzername bereits vergeben');
            me.username = newU;
        }
        if (updates.email) {
            const newE = updates.email.trim().toLowerCase();
            if (!newE) throw new Error('Email darf nicht leer sein');
            if (newE !== me.email && users.find(u => u.email === newE)) throw new Error('Email bereits verwendet');
            me.email = newE;
        }
        if ('bio' in updates) me.bio = updates.bio || '';
        if ('profilePic' in updates) me.profilePic = updates.profilePic || null;

        save('users', users);

        // update token to reflect username change
        writeToken({ username: me.username, iat: Date.now() });

        return me;
    },

    async changePassword(username, currentPassword, newPassword) {
        username = username.trim().toLowerCase();
        if (!currentPassword || !newPassword) throw new Error('Aktuelles und neues Passwort erforderlich');
        const users = load('users') || [];
        const me = users.find(u => u.username === username);
        if (!me) throw new Error('Benutzer nicht gefunden');
        const curHash = await hashPassword(currentPassword);
        if (curHash !== me.passwordHash) throw new Error('Aktuelles Passwort falsch');
        me.passwordHash = await hashPassword(newPassword);
        save('users', users);
        return true;
    },

    async deleteUser(username, password) {
        username = username.trim().toLowerCase();
        const users = load('users') || [];
        const meIdx = users.findIndex(u => u.username === username);
        if (meIdx === -1) throw new Error('Benutzer nicht gefunden');
        const me = users[meIdx];
        const pwHash = await hashPassword(password);
        if (pwHash !== me.passwordHash) throw new Error('Passwort stimmt nicht');
        users.splice(meIdx, 1);
        save('users', users);
        // remove token
        remove('token');
        // optionally remove user's threads
        let threads = load('threads') || [];
        threads = threads.filter(t => t.author !== username);
        save('threads', threads);
        return true;
    },

    // Threads
    getThreads() {
        return load('threads') || [];
    },

    getThread(id) {
        const threads = this.getThreads();
        return threads.find(t => String(t.id) === String(id));
    },

    createThread({ title, content, tag, author }) {
        const threads = this.getThreads();
        const thread = {
            id: Date.now().toString(),
            title,
            content,
            tag: tag || 'general',
            author,
            replies: [],
            createdAt: new Date().toISOString(),
            votes: 0
        };
        threads.unshift(thread);
        save('threads', threads);
        return thread;
    },

    createReply(threadId, { author, content }) {
        const threads = this.getThreads();
        const t = threads.find(x => String(x.id) === String(threadId));
        if (!t) throw new Error('Thread nicht gefunden');
        const reply = { id: Date.now().toString(), author, content, createdAt: new Date().toISOString(), votes: 0 };
        t.replies.push(reply);
        save('threads', threads);
        return reply;
    },

    voteThread(threadId, delta) {
        const threads = this.getThreads();
        const t = threads.find(x => String(x.id) === String(threadId));
        if (!t) throw new Error('Thread nicht gefunden');
        t.votes = (t.votes || 0) + delta;
        save('threads', threads);
        return t.votes;
    },

    // get user profile + posts
    getUserProfile(username) {
        username = (username || '').trim().toLowerCase();
        const users = load('users') || [];
        const user = users.find(u => u.username === username);
        const threads = this.getThreads().filter(t => t.author === username);
        return { user, posts: threads };
    }
};

// ---- REAL BACKEND STUB (Beispiel) ----
// Wenn du ein echtes Backend anbindest: setze USE_MOCK = false und implementiere diese Funktionen.
const BackendAPI = {
    baseUrl: '/api',
    async register(payload) {
        const res = await fetch(this.baseUrl + '/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        localStorage.setItem(MOCK_PREFIX + 'token', data.token);
        return data;
    },
    async login(payload) {
        const res = await fetch(this.baseUrl + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        localStorage.setItem(MOCK_PREFIX + 'token', data.token);
        return data;
    },
    logout() { localStorage.removeItem(MOCK_PREFIX + 'token') },
    // ...weitere Backend-Implementationen analog ...
};

// Export selecting implementation
const API = USE_MOCK ? MockAPI : BackendAPI;

// ================= CHAT SYSTEM =================

API.getMessages = function () {
    return JSON.parse(localStorage.getItem('messages') || '[]');
};

API.sendMessage = function (from, to, content) {
    const messages = API.getMessages();

    messages.push({
        id: Date.now().toString(),
        from,
        to,
        content,
        createdAt: new Date().toISOString()
    });

    localStorage.setItem('messages', JSON.stringify(messages));
};

API.getConversation = function (user1, user2) {
    const messages = API.getMessages();

    return messages.filter(m =>
        (m.from === user1 && m.to === user2) ||
        (m.from === user2 && m.to === user1)
    ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};