class WhatsAppClone {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.currentChat = null;
        this.chats = new Map();
        this.messages = new Map();
        this.typingTimeout = null;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuthStatus();
    }

    bindEvents() {
        // Auth form events
        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('register-form').addEventListener('submit', (e) => this.handleRegister(e));
        document.getElementById('show-register').addEventListener('click', (e) => this.showRegisterForm(e));
        document.getElementById('show-login').addEventListener('click', (e) => this.showLoginForm(e));
        document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());

        // Chat events
        document.getElementById('message-input').addEventListener('keypress', (e) => this.handleMessageInput(e));
        document.getElementById('message-input').addEventListener('input', () => this.handleTyping());
        document.getElementById('send-button').addEventListener('click', () => this.sendMessage());
        document.getElementById('chat-search').addEventListener('input', (e) => this.searchChats(e.target.value));
    }

    checkAuthStatus() {
        const token = localStorage.getItem('accessToken');
        if (token) {
            this.connectSocket(token);
            this.showMainInterface();
        } else {
            this.showAuthSection();
        }
    }

    showAuthSection() {
        document.getElementById('auth-section').classList.remove('hidden');
        document.getElementById('main-interface').classList.add('hidden');
    }

    showMainInterface() {
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('main-interface').classList.remove('hidden');
        this.loadUserProfile();
        this.loadChats();
    }

    showRegisterForm(e) {
        e.preventDefault();
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
    }

    showLoginForm(e) {
        e.preventDefault();
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const loginBtn = document.getElementById('login-btn');
        const errorDiv = document.getElementById('login-error');
        
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
        errorDiv.classList.add('hidden');

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    login: document.getElementById('login-email').value,
                    password: document.getElementById('login-password').value
                })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);
                this.currentUser = data.user;
                this.connectSocket(data.accessToken);
                this.showMainInterface();
            } else {
                this.showError(errorDiv, data.error || 'Login failed');
            }
        } catch (error) {
            this.showError(errorDiv, 'Network error. Please try again.');
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const registerBtn = document.getElementById('register-btn');
        const errorDiv = document.getElementById('register-error');
        
        registerBtn.disabled = true;
        registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
        errorDiv.classList.add('hidden');

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    firstName: document.getElementById('register-firstName').value,
                    lastName: document.getElementById('register-lastName').value,
                    username: document.getElementById('register-username').value,
                    email: document.getElementById('register-email').value,
                    password: document.getElementById('register-password').value
                })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);
                this.currentUser = data.user;
                this.connectSocket(data.accessToken);
                this.showMainInterface();
            } else {
                this.showError(errorDiv, data.error || 'Registration failed');
            }
        } catch (error) {
            this.showError(errorDiv, 'Network error. Please try again.');
        } finally {
            registerBtn.disabled = false;
            registerBtn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
        }
    }

    handleLogout() {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        this.currentUser = null;
        this.currentChat = null;
        this.chats.clear();
        this.messages.clear();
        
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.showAuthSection();
    }

    connectSocket(token) {
        this.socket = io({
            auth: {
                token: token
            }
        });

        this.socket.on('connect', () => {
            console.log('Connected to server');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });

        this.socket.on('new_message', (message) => {
            this.handleNewMessage(message);
        });

        this.socket.on('user_typing', (data) => {
            this.handleUserTyping(data);
        });

        this.socket.on('user_status_changed', (data) => {
            this.handleUserStatusChange(data);
        });

        this.socket.on('message_status_updated', (data) => {
            this.handleMessageStatusUpdate(data);
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
        });
    }

    async loadUserProfile() {
        try {
            const response = await this.makeAuthenticatedRequest('/api/auth/profile');
            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                this.updateUserUI();
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    updateUserUI() {
        const userAvatar = document.getElementById('user-avatar');
        const userName = document.getElementById('user-name');
        
        userAvatar.textContent = this.getInitials(this.currentUser.firstName, this.currentUser.lastName);
        userName.textContent = `${this.currentUser.firstName} ${this.currentUser.lastName}`;
    }

    async loadChats() {
        try {
            const response = await this.makeAuthenticatedRequest('/api/chats');
            if (response.ok) {
                const data = await response.json();
                this.renderChats(data.chats);
            }
        } catch (error) {
            console.error('Error loading chats:', error);
        }
    }

    renderChats(chats) {
        const chatList = document.getElementById('chat-list');
        chatList.innerHTML = '';

        if (chats.length === 0) {
            chatList.innerHTML = '<div class="loading">No chats yet. Start a conversation!</div>';
            return;
        }

        chats.forEach(membership => {
            const chat = membership.chat;
            this.chats.set(chat.id, chat);
            
            const chatItem = this.createChatItem(chat, membership);
            chatList.appendChild(chatItem);
        });
    }

    createChatItem(chat, membership) {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.chatId = chat.id;
        
        const chatName = this.getChatName(chat);
        const lastMessage = chat.messages && chat.messages[0] ? chat.messages[0] : null;
        const lastMessageText = lastMessage ? this.getMessagePreview(lastMessage) : 'No messages yet';
        const lastMessageTime = lastMessage ? this.formatTime(lastMessage.createdAt) : '';

        chatItem.innerHTML = `
            <div class="chat-avatar">${this.getChatInitials(chat)}</div>
            <div class="chat-info">
                <div class="chat-name">${chatName}</div>
                <div class="chat-last-message">${lastMessageText}</div>
            </div>
            <div class="chat-meta">
                <div class="chat-time">${lastMessageTime}</div>
            </div>
        `;

        chatItem.addEventListener('click', () => this.selectChat(chat));
        
        return chatItem;
    }

    getChatName(chat) {
        if (chat.type === 'direct') {
            // Find the other user in direct chat
            const otherMember = chat.chatMembers.find(member => member.user.id !== this.currentUser.id);
            return otherMember ? `${otherMember.user.firstName} ${otherMember.user.lastName}` : 'Unknown User';
        }
        return chat.name || 'Group Chat';
    }

    getChatInitials(chat) {
        if (chat.type === 'direct') {
            const otherMember = chat.chatMembers.find(member => member.user.id !== this.currentUser.id);
            return otherMember ? this.getInitials(otherMember.user.firstName, otherMember.user.lastName) : '?';
        }
        return chat.name ? chat.name.charAt(0).toUpperCase() : 'G';
    }

    getInitials(firstName, lastName) {
        return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }

    getMessagePreview(message) {
        if (message.type === 'text') {
            return message.content.length > 50 ? message.content.substring(0, 50) + '...' : message.content;
        }
        return `[${message.type.toUpperCase()}]`;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays < 7) {
            return date.toLocaleDateString([], { weekday: 'short' });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    }

    async selectChat(chat) {
        // Update UI
        document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
        document.querySelector(`[data-chat-id="${chat.id}"]`).classList.add('active');

        this.currentChat = chat;
        this.updateChatHeader();
        this.enableMessageInput();

        // Join chat room
        this.socket.emit('join_chat', { chatId: chat.id });

        // Load messages
        await this.loadMessages(chat.id);
    }

    updateChatHeader() {
        const chatName = this.getChatName(this.currentChat);
        const chatInitials = this.getChatInitials(this.currentChat);
        
        document.getElementById('current-chat-name').textContent = chatName;
        document.getElementById('current-chat-avatar').textContent = chatInitials;
        
        // Update status based on chat type
        if (this.currentChat.type === 'direct') {
            const otherMember = this.currentChat.chatMembers.find(member => member.user.id !== this.currentUser.id);
            const status = otherMember ? this.getStatusText(otherMember.user.status) : 'Unknown';
            document.getElementById('current-chat-status').textContent = status;
        } else {
            const memberCount = this.currentChat.chatMembers.length;
            document.getElementById('current-chat-status').textContent = `${memberCount} members`;
        }
    }

    getStatusText(status) {
        switch (status) {
            case 'online': return 'Online';
            case 'away': return 'Away';
            case 'offline': return 'Last seen recently';
            default: return 'Unknown';
        }
    }

    enableMessageInput() {
        const messageInput = document.getElementById('message-input');
        const sendButton = document.getElementById('send-button');
        
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.placeholder = 'Type a message...';
    }

    async loadMessages(chatId) {
        try {
            const response = await this.makeAuthenticatedRequest(`/api/messages/${chatId}`);
            if (response.ok) {
                const data = await response.json();
                this.renderMessages(data.messages);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }

    renderMessages(messages) {
        const messagesContainer = document.getElementById('messages-container');
        messagesContainer.innerHTML = '';

        if (messages.length === 0) {
            messagesContainer.innerHTML = '<div class="loading">No messages yet. Start the conversation!</div>';
            return;
        }

        messages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            messagesContainer.appendChild(messageElement);
        });

        this.scrollToBottom();
    }

    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.senderId === this.currentUser.id ? 'own' : ''}`;
        messageDiv.dataset.messageId = message.id;

        const isOwn = message.senderId === this.currentUser.id;
        const senderInitials = isOwn ? 
            this.getInitials(this.currentUser.firstName, this.currentUser.lastName) :
            this.getInitials(message.sender.firstName, message.sender.lastName);

        const messageTime = this.formatMessageTime(message.createdAt);
        const statusIcon = isOwn ? this.getMessageStatusIcon(message.status) : '';

        messageDiv.innerHTML = `
            <div class="message-avatar">${senderInitials}</div>
            <div class="message-content">
                <div class="message-text">${this.escapeHtml(message.content)}</div>
                <div class="message-meta">
                    <span>${messageTime}</span>
                    ${statusIcon}
                </div>
            </div>
        `;

        return messageDiv;
    }

    formatMessageTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    getMessageStatusIcon(status) {
        switch (status) {
            case 'sent': return '<i class="fas fa-check"></i>';
            case 'delivered': return '<i class="fas fa-check-double"></i>';
            case 'read': return '<i class="fas fa-check-double" style="color: #667eea;"></i>';
            default: return '';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    handleMessageInput(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    }

    handleTyping() {
        if (!this.currentChat) return;

        // Emit typing start
        this.socket.emit('typing_start', { chatId: this.currentChat.id });

        // Clear existing timeout
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        // Set timeout to stop typing
        this.typingTimeout = setTimeout(() => {
            this.socket.emit('typing_stop', { chatId: this.currentChat.id });
        }, 1000);
    }

    sendMessage() {
        const messageInput = document.getElementById('message-input');
        const content = messageInput.value.trim();

        if (!content || !this.currentChat) return;

        // Emit message
        this.socket.emit('send_message', {
            chatId: this.currentChat.id,
            content: content,
            type: 'text'
        });

        // Clear input
        messageInput.value = '';
        
        // Stop typing
        this.socket.emit('typing_stop', { chatId: this.currentChat.id });
    }

    handleNewMessage(message) {
        // Add message to current chat if it's the active one
        if (this.currentChat && message.chatId === this.currentChat.id) {
            const messageElement = this.createMessageElement(message);
            document.getElementById('messages-container').appendChild(messageElement);
            this.scrollToBottom();

            // Mark as read if not own message
            if (message.senderId !== this.currentUser.id) {
                this.socket.emit('message_read', {
                    messageId: message.id,
                    chatId: message.chatId
                });
            }
        }

        // Update chat list
        this.updateChatInList(message);
    }

    updateChatInList(message) {
        const chatItem = document.querySelector(`[data-chat-id="${message.chatId}"]`);
        if (chatItem) {
            const lastMessageEl = chatItem.querySelector('.chat-last-message');
            const timeEl = chatItem.querySelector('.chat-time');
            
            lastMessageEl.textContent = this.getMessagePreview(message);
            timeEl.textContent = this.formatTime(message.createdAt);

            // Move to top of list
            const chatList = document.getElementById('chat-list');
            chatList.insertBefore(chatItem, chatList.firstChild);
        }
    }

    handleUserTyping(data) {
        if (this.currentChat && data.chatId === this.currentChat.id && data.userId !== this.currentUser.id) {
            const typingIndicator = document.getElementById('typing-indicator');
            
            if (data.isTyping) {
                typingIndicator.textContent = 'Someone is typing...';
                typingIndicator.classList.remove('hidden');
            } else {
                typingIndicator.classList.add('hidden');
            }
        }
    }

    handleUserStatusChange(data) {
        // Update user status in chat header if it's a direct chat
        if (this.currentChat && this.currentChat.type === 'direct') {
            const otherMember = this.currentChat.chatMembers.find(member => member.user.id === data.userId);
            if (otherMember) {
                document.getElementById('current-chat-status').textContent = this.getStatusText(data.status);
            }
        }
    }

    handleMessageStatusUpdate(data) {
        const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
        if (messageElement) {
            const statusIcon = messageElement.querySelector('.message-meta i');
            if (statusIcon) {
                statusIcon.outerHTML = this.getMessageStatusIcon(data.status);
            }
        }
    }

    searchChats(query) {
        const chatItems = document.querySelectorAll('.chat-item');
        
        chatItems.forEach(item => {
            const chatName = item.querySelector('.chat-name').textContent.toLowerCase();
            const isVisible = chatName.includes(query.toLowerCase());
            item.style.display = isVisible ? 'flex' : 'none';
        });
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('messages-container');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async makeAuthenticatedRequest(url, options = {}) {
        const token = localStorage.getItem('accessToken');
        
        const defaultOptions = {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        const response = await fetch(url, { ...options, ...defaultOptions });

        // Handle token expiration
        if (response.status === 401) {
            await this.refreshToken();
            // Retry request with new token
            const newToken = localStorage.getItem('accessToken');
            defaultOptions.headers.Authorization = `Bearer ${newToken}`;
            return fetch(url, { ...options, ...defaultOptions });
        }

        return response;
    }

    async refreshToken() {
        const refreshToken = localStorage.getItem('refreshToken');
        
        try {
            const response = await fetch('/api/auth/refresh-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refreshToken })
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);
            } else {
                // Refresh failed, logout user
                this.handleLogout();
            }
        } catch (error) {
            console.error('Error refreshing token:', error);
            this.handleLogout();
        }
    }

    showError(element, message) {
        element.textContent = message;
        element.classList.remove('hidden');
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new WhatsAppClone();
});