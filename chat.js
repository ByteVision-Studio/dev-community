// chat.js

function initChatPage() {
  renderHeader(); // Header + Auth

  const userListEl = document.getElementById('userList');
  const chatMessagesEl = document.getElementById('chatMessages');
  const chatHeaderEl = document.getElementById('chatHeader');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');

  if (!userListEl || !chatMessagesEl || !chatForm) return;

  const currentUser = API.getCurrentUser();
  if (!currentUser) {
    showFlash('Bitte einloggen, um den Chat zu nutzen', 'error');
    setTimeout(() => location.href = 'login.html?returnTo=chat.html', 500);
    return;
  }

  let selectedUser = null; // User, mit dem aktuell gechattet wird

  // 1️⃣ Userliste laden
  const users = API.getUsers().filter(u => u.username !== currentUser.username);
  if (users.length === 0) {
    userListEl.innerHTML = '<div>Keine anderen Nutzer online</div>';
  } else {
    users.forEach(u => {
      const div = document.createElement('div');
      div.className = 'chat-user';
      div.textContent = u.username;
      div.addEventListener('click', () => {
        selectedUser = u.username;
        chatHeaderEl.textContent = 'Chat mit ' + u.username;
        loadMessages(selectedUser);
      });
      userListEl.appendChild(div);
    });
  }

  // 2️⃣ Nachrichten laden (Dummy API-Aufruf)
  function loadMessages(username) {
    chatMessagesEl.innerHTML = '';
    const messages = API.getMessages(username); // API-Funktion muss existieren
    messages.forEach(m => {
      const msgDiv = document.createElement('div');
      msgDiv.className = m.sender === currentUser.username ? 'chat-msg sent' : 'chat-msg received';
      msgDiv.textContent = m.content;
      chatMessagesEl.appendChild(msgDiv);
    });
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  // 3️⃣ Nachrichten senden
  chatForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!selectedUser) { showFlash('Bitte zuerst einen User auswählen', 'error'); return; }
    const content = chatInput.value.trim();
    if (!content) return;
    API.sendMessage(selectedUser, content);
    chatInput.value = '';
    loadMessages(selectedUser);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page === 'chat') {
    initChatPage();
  }
});