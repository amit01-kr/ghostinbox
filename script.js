
        /**
         * Ghost-Inbox Application
         * Using Mail.tm API for real temporary email functionality
         */
        class GhostInbox {
            constructor() {
                this.emailAddress = "";
                this.messages = [];
                this.countdown = 15 * 60; // 15 minutes in seconds
                this.theme = localStorage.getItem('ghost-inbox-theme') || 'dark';
                this.mailTmApiUrl = "https://api.mail.tm";
                this.token = null;
                this.accountId = null;
                this.password = null;
                this.domains = [];
                this.lastCheckTime = 0;
                this.messageCheckInterval = null;
                
                this.init();
            }
            
            async init() {
                // Set initial theme
                document.documentElement.setAttribute('data-theme', this.theme);
                document.getElementById('theme-toggle').innerHTML = this.theme === 'dark' 
                    ? '<i class="fas fa-sun"></i>' 
                    : '<i class="fas fa-moon"></i>';
                
                // Bind event listeners
                this.bindEvents();
                
                // Check API status first
                await this.checkApiStatus();
                
                // Get available domains
                await this.getAvailableDomains();
                
                // Generate email address
                await this.generateEmailAddress();
                
                // Start countdown
                this.startCountdown();
            }
            
            bindEvents() {
                // Theme toggle
                document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());
                
                // Copy button
                document.getElementById('copy-button').addEventListener('click', () => this.copyEmailAddress());
                
                // Delete and generate new button
                document.getElementById('delete-button').addEventListener('click', () => this.regenerateEmailAddress());
                
                // Refresh inbox button
                document.getElementById('refresh-button').addEventListener('click', () => {
                    const button = document.getElementById('refresh-button');
                    button.innerHTML = '<i class="fas fa-sync-alt fa-spin mr-2"></i> Refreshing...';
                    button.disabled = true;
                    
                    this.fetchMessages().finally(() => {
                        button.innerHTML = '<i class="fas fa-sync-alt mr-2"></i> Refresh Inbox';
                        button.disabled = false;
                    });
                });
                
                // Clear inbox button
                document.getElementById('clear-inbox-button').addEventListener('click', () => this.clearInbox());
                
                // Modal close button
                document.getElementById('close-modal').addEventListener('click', () => this.hideMessageModal());
                
                // Close modal when clicking outside
                document.getElementById('message-modal').addEventListener('click', (e) => {
                    if (e.target === document.getElementById('message-modal')) {
                        this.hideMessageModal();
                    }
                });
                
                // Escape key to close modal
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && document.getElementById('message-modal').style.display === 'flex') {
                        this.hideMessageModal();
                    }
                });
            }
            
            async checkApiStatus() {
                const statusEl = document.getElementById('api-status');
                statusEl.innerHTML = `<span class="spinner" style="width: 12px; height: 12px; margin-right: 5px;"></span>Checking API...`;
                
                try {
                    const response = await fetch(`${this.mailTmApiUrl}`);
                    if (response.ok) {
                        statusEl.innerHTML = `<span class="status-badge-dot"></span>System Online`;
                    } else {
                        statusEl.innerHTML = `<span class="status-badge-dot" style="background-color: #ff5252;"></span>API Limited`;
                    }
                } catch (error) {
                    console.error('Error checking Mail.tm API status:', error);
                    statusEl.innerHTML = `<span class="status-badge-dot" style="background-color: #ff5252;"></span>API Unavailable`;
                }
            }
            
            async getAvailableDomains() {
                try {
                    const response = await fetch(`${this.mailTmApiUrl}/domains`);
                    if (!response.ok) {
                        throw new Error('Failed to fetch domains');
                    }
                    
                    const data = await response.json();
                    if (data && data['hydra:member'] && data['hydra:member'].length > 0) {
                        this.domains = data['hydra:member'];
                    } else {
                        // Fallback domains if API doesn't return any
                        this.domains = [{ domain: 'mail.tm' }];
                    }
                } catch (error) {
                    console.error('Error fetching domains:', error);
                    // Fallback domains if API call fails
                    this.domains = [{ domain: 'mail.tm' }];
                }
            }
            
            generateRandomString(length) {
                const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
                let result = '';
                
                for (let i = 0; i < length; i++) {
                    result += characters.charAt(Math.floor(Math.random() * characters.length));
                }
                
                return result;
            }
            
            async generateEmailAddress() {
                const emailAddressEl = document.getElementById('email-address');
                emailAddressEl.innerHTML = '<span class="spinner"></span>Generating...';
                
                // Clear any existing interval
                if (this.messageCheckInterval) {
                    clearInterval(this.messageCheckInterval);
                }
                
                // Reset state
                this.token = null;
                this.accountId = null;
                this.messages = [];
                
                try {
                    // Generate random username and password
                    const username = this.generateRandomString(8);
                    this.password = this.generateRandomString(12);
                    
                    // Select a random domain from available domains
                    const domain = this.domains.length > 0 
                        ? this.domains[Math.floor(Math.random() * this.domains.length)].domain 
                        : 'mail.tm';
                    
                    this.emailAddress = `${username}@${domain}`;
                    
                    // Register the email account
                    const accountResponse = await fetch(`${this.mailTmApiUrl}/accounts`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            address: this.emailAddress,
                            password: this.password
                        })
                    });
                    
                    if (!accountResponse.ok) {
                        throw new Error('Failed to create email account');
                    }
                    
                    const accountData = await accountResponse.json();
                    this.accountId = accountData.id;
                    
                    // Get auth token
                    const tokenResponse = await fetch(`${this.mailTmApiUrl}/token`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            address: this.emailAddress,
                            password: this.password
                        })
                    });
                    
                    if (!tokenResponse.ok) {
                        throw new Error('Failed to get authentication token');
                    }
                    
                    const tokenData = await tokenResponse.json();
                    this.token = tokenData.token;
                    
                    // Update UI with the new email address
                    emailAddressEl.textContent = this.emailAddress;
                    emailAddressEl.classList.add('glow-effect');
                    
                    setTimeout(() => {
                        emailAddressEl.classList.remove('glow-effect');
                    }, 2000);
                    
                    // Enable buttons
                    document.getElementById('copy-button').disabled = false;
                    document.getElementById('delete-button').disabled = false;
                    document.getElementById('refresh-button').disabled = false;
                    document.getElementById('clear-inbox-button').disabled = false;
                    
                    // Set interval to fetch messages every 10 seconds
                    this.messageCheckInterval = setInterval(() => this.fetchMessages(), 10000);
                    
                    // Fetch initial messages (will be empty for new account)
                    await this.fetchMessages();
                    
                } catch (error) {
                    console.error('Error generating email address:', error);
                    emailAddressEl.innerHTML = 'Error creating email. <button class="text-blue-400 underline" onclick="window.ghostInbox.generateEmailAddress()">Try again</button>';
                }
            }
            
            async regenerateEmailAddress() {
                const deleteButton = document.getElementById('delete-button');
                deleteButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Creating New';
                deleteButton.disabled = true;
                
                // Clear existing interval
                if (this.messageCheckInterval) {
                    clearInterval(this.messageCheckInterval);
                }
                
                // Reset countdown
                this.countdown = 15 * 60;
                
                // Generate new email
                await this.generateEmailAddress();
                
                // Restore button
                deleteButton.innerHTML = '<i class="fas fa-trash-alt mr-2"></i> Delete & Generate New';
                deleteButton.disabled = false;
            }
            
            copyEmailAddress() {
                if (!this.emailAddress) return;
                
                navigator.clipboard.writeText(this.emailAddress).then(() => {
                    const copyButton = document.getElementById('copy-button');
                    const originalText = copyButton.innerHTML;
                    
                    copyButton.innerHTML = '<i class="fas fa-check mr-2"></i> Copied!';
                    
                    setTimeout(() => {
                        copyButton.innerHTML = originalText;
                    }, 2000);
                    
                    const alert = document.getElementById('copy-alert');
                    alert.classList.add('show');
                    
                    setTimeout(() => {
                        alert.classList.remove('show');
                    }, 3000);
                });
            }
            
            startCountdown() {
                const timerEl = document.getElementById('timer');
                const timerTextEl = document.getElementById('timer-text');
                const timerCircle = document.getElementById('timer-circle');
                
                const updateTimer = () => {
                    if (this.countdown <= 0) {
                        // Time's up - regenerate email
                        this.regenerateEmailAddress();
                        return;
                    }
                    
                    const minutes = Math.floor(this.countdown / 60);
                    const seconds = this.countdown % 60;
                    const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                    const progress = (this.countdown / (15 * 60)) * 100;
                    
                    timerEl.textContent = formattedTime;
                    timerTextEl.textContent = this.countdown >= 60 
                        ? `${minutes} minute${minutes !== 1 ? 's' : ''}` 
                        : `${seconds} second${seconds !== 1 ? 's' : ''}`;
                    
                    timerCircle.style.setProperty('--progress', `${progress}%`);
                    
                    if (this.countdown <= 30) {
                        timerEl.classList.add('text-red-500');
                        timerTextEl.classList.add('text-red-500');
                        timerTextEl.classList.remove('text-green-400');
                    } else {
                        timerEl.classList.remove('text-red-500');
                        timerTextEl.classList.remove('text-red-500');
                        timerTextEl.classList.add('text-green-400');
                    }
                    
                    this.countdown--;
                };
                
                updateTimer();
                setInterval(updateTimer, 1000);
            }
            
            async fetchMessages() {
                if (!this.token || !this.emailAddress) {
                    return;
                }
                
                const messagesContainer = document.getElementById('messages-container');
                const emptyInbox = document.getElementById('empty-inbox');
                
                try {
                    // Only fetch messages if we have a valid token
                    const response = await fetch(`${this.mailTmApiUrl}/messages`, {
                        headers: {
                            'Authorization': `Bearer ${this.token}`
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error('Failed to fetch messages');
                    }
                    
                    const data = await response.json();
                    
                    if (data && data['hydra:member']) {
                        this.messages = data['hydra:member'];
                        this.renderMessages();
                    }
                    
                } catch (error) {
                    console.error('Error fetching messages:', error);
                    messagesContainer.innerHTML = `
                        <div class="api-error">
                            <i class="fas fa-exclamation-circle text-red-400 text-xl mb-2"></i>
                            <p>Error fetching messages. Please try refreshing.</p>
                        </div>
                    `;
                }
            }
            
            async getMessageContent(messageId) {
                if (!this.token || !messageId) {
                    return null;
                }
                
                try {
                    // Fetch the complete message
                    const response = await fetch(`${this.mailTmApiUrl}/messages/${messageId}`, {
                        headers: {
                            'Authorization': `Bearer ${this.token}`
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error('Failed to fetch message content');
                    }
                    
                    const data = await response.json();
                    
                    // Mark message as seen
                    await fetch(`${this.mailTmApiUrl}/messages/${messageId}/seen`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${this.token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    return data;
                    
                } catch (error) {
                    console.error('Error fetching message content:', error);
                    return null;
                }
            }
            
            isVerificationMessage(message) {
                if (!message) return false;
                
                const verificationKeywords = ['verify', 'verification', 'confirm', 'code', 'activate', 'validate', 'otp', 'one-time', 'passcode'];
                const subject = message.subject ? message.subject.toLowerCase() : '';
                const intro = message.intro ? message.intro.toLowerCase() : '';
                
                return verificationKeywords.some(keyword =>
                    subject.includes(keyword) || intro.includes(keyword)
                );
            }
            
            extractVerificationCode(text) {
                if (!text) return null;
                
                // Common verification code patterns
                const patterns = [
                    /verify.*?(\d{4,8})/i,
                    /verification code.*?(\d{4,8})/i,
                    /code.*?(\d{4,8})/i,
                    /verification code[:\s]+([A-Z0-9]{4,8})/i,
                    /one-time code[:\s]+([A-Z0-9]{4,8})/i,
                    /OTP[:\s]+([A-Z0-9]{4,8})/i,
                    /passcode[:\s]+([A-Z0-9]{4,8})/i
                ];
                
                for (const pattern of patterns) {
                    const match = text.match(pattern);
                    if (match && match[1]) {
                        return match[1];
                    }
                }
                
                return null;
            }
            
            renderMessages() {
                const messagesContainer = document.getElementById('messages-container');
                const emptyInbox = document.getElementById('empty-inbox');
                const messageCount = document.getElementById('message-count');
                
                // Update message count
                messageCount.innerHTML = `
                    <span class="status-badge-dot"></span>
                    <span>${this.messages.length} message${this.messages.length !== 1 ? 's' : ''}</span>
                `;
                
                if (this.messages.length === 0) {
                    messagesContainer.innerHTML = '';
                    emptyInbox.style.display = 'flex';
                    document.getElementById('clear-inbox-button').disabled = true;
                    return;
                }
                
                emptyInbox.style.display = 'none';
                messagesContainer.innerHTML = '';
                document.getElementById('clear-inbox-button').disabled = false;
                
                // Sort messages - newest first
                const sortedMessages = [...this.messages].sort((a, b) => {
                    return new Date(b.createdAt) - new Date(a.createdAt);
                });
                
                sortedMessages.forEach((message) => {
                    // Format date and time
                    const date = new Date(message.createdAt);
                    const now = new Date();
                    const isToday = date.toDateString() === now.toDateString();
                    const dateString = isToday ? 'Today' : date.toLocaleDateString();
                    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    
                    // Limit subject length
                    const subject = message.subject && message.subject.length > 40 
                        ? message.subject.substring(0, 40) + '...' 
                        : (message.subject || 'No Subject');
                    
                    // Check if this is a verification message using metadata or content analysis
                    const isVerification = this.isVerificationMessage(message);
                    
                    // Create message intro text
                    const intro = message.intro || 'No preview available';
                    
                    const messageEl = document.createElement('div');
                    messageEl.className = `inbox-message p-4 mb-3 rounded-lg fade-in ${isVerification ? 'inbox-message-verification' : 'inbox-message-link'}`;
                    messageEl.innerHTML = `
                        <div class="flex justify-between items-start mb-2">
                            <div class="flex items-center">
                                <div class="message-subject">${subject}</div>
                                ${isVerification ? '<span class="verification-badge ml-2"><i class="fas fa-key text-xs"></i> Verification</span>' : ''}
                            </div>
                            <div class="message-time">${dateString} ${timeString}</div>
                        </div>
                        <div class="text-sm mb-2">From: <span class="font-semibold">${message.from.address}</span></div>
                        <div class="text-sm mb-3">${intro.substring(0, 100)}${intro.length > 100 ? '...' : ''}</div>
                        <div class="flex justify-between">
                            <button class="view-message bg-blue-500 hover:bg-blue-600 text-white rounded px-4 py-1 text-sm flex items-center">
                                <i class="fas fa-eye mr-1"></i> View
                            </button>
                            <button class="delete-message bg-red-500 hover:bg-red-600 text-white rounded px-4 py-1 text-sm flex items-center">
                                <i class="fas fa-trash-alt mr-1"></i> Delete
                            </button>
                        </div>
                    `;
                    
                    // Add event listeners
                    messageEl.querySelector('.view-message').addEventListener('click', () => {
                        this.showMessageModal(message, isVerification);
                    });
                    
                    messageEl.querySelector('.delete-message').addEventListener('click', () => {
                        this.deleteMessage(message.id);
                    });
                    
                    messagesContainer.appendChild(messageEl);
                });
            }
            
            async showMessageModal(messageBasic, isVerification = false) {
                const modal = document.getElementById('message-modal');
                const modalSubject = document.getElementById('modal-subject');
                const modalFrom = document.getElementById('modal-from');
                const modalDate = document.getElementById('modal-date');
                const modalBody = document.getElementById('modal-body');
                
                // Set initial loading state
                modalSubject.textContent = messageBasic.subject || 'No Subject';
                modalFrom.textContent = messageBasic.from ? messageBasic.from.address : 'Unknown Sender';
                modalDate.textContent = new Date(messageBasic.createdAt).toLocaleString();
                modalBody.innerHTML = '<div class="api-loading"><span class="spinner" style="border-top-color: #333;"></span>Loading message content...</div>';
                
                // Show modal with loading state
                modal.style.display = 'flex';
                setTimeout(() => {
                    modal.classList.add('show');
                }, 10);
                
                try {
                    // Get full message content from API
                    const fullMessage = await this.getMessageContent(messageBasic.id);
                    
                    if (fullMessage) {
                        // Process verification codes or links
                        let htmlContent = fullMessage.html || fullMessage.text || 'No content available';
                        const verificationCode = isVerification ? this.extractVerificationCode(fullMessage.text) : null;
                        
                        // If a verification code was found, highlight it
                        if (verificationCode) {
                            htmlContent = `
                                <div class="message-content">
                                    ${htmlContent}
                                    
                                    <div class="verification-code-container">
                                        <p><strong>Verification Code Found:</strong></p>
                                        <div class="verification-code-value">${verificationCode}</div>
                                    </div>
                                </div>
                            `;
                        } else {
                            htmlContent = `<div class="message-content">${htmlContent}</div>`;
                        }
                        
                        // Set the actual message content
                        modalBody.innerHTML = htmlContent;
                        
                        // Convert any plain text URLs to clickable links
                        this.makeLinksClickable(modalBody);
                        
                    } else {
                        modalBody.innerHTML = '<div class="text-center text-gray-500">No message content available</div>';
                    }
                } catch (error) {
                    console.error('Error displaying message:', error);
                    modalBody.innerHTML = '<div class="api-error">Error loading message content. Please try again.</div>';
                }
            }
            
            makeLinksClickable(container) {
                // Find all text nodes in the container
                const textNodes = [];
                const walk = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
                
                let node;
                while (node = walk.nextNode()) {
                    textNodes.push(node);
                }
                
                // URL regex pattern
                const urlPattern = /((https?|ftp):\/\/[^\s/$.?#].[^\s]*)/gi;
                
                // Process each text node
                textNodes.forEach(textNode => {
                    const text = textNode.nodeValue;
                    if (urlPattern.test(text)) {
                        const fragment = document.createDocumentFragment();
                        let lastIndex = 0;
                        let match;
                        
                        // Reset lastIndex since we're reusing the regex
                        urlPattern.lastIndex = 0;
                        
                        while (match = urlPattern.exec(text)) {
                            // Add text before the link
                            if (match.index > lastIndex) {
                                fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
                            }
                            
                            // Create the link
                            const link = document.createElement('a');
                            link.href = match[0];
                            link.textContent = match[0];
                            link.target = '_blank';
                            link.rel = 'noopener noreferrer';
                            link.className = 'text-blue-600 hover:underline';
                            fragment.appendChild(link);
                            
                            lastIndex = match.index + match[0].length;
                        }
                        
                        // Add any remaining text
                        if (lastIndex < text.length) {
                            fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
                        }
                        
                        // Replace the text node with the fragment
                        textNode.parentNode.replaceChild(fragment, textNode);
                    }
                });
            }
            
            hideMessageModal() {
                const modal = document.getElementById('message-modal');
                modal.classList.remove('show');
                
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
            }
            
            async deleteMessage(messageId) {
                if (!this.token || !messageId) return;
                
                try {
                    // Delete message via API
                    const response = await fetch(`${this.mailTmApiUrl}/messages/${messageId}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${this.token}`
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error('Failed to delete message');
                    }
                    
                    // Update local messages array
                    this.messages = this.messages.filter(message => message.id !== messageId);
                    this.renderMessages();
                    
                } catch (error) {
                    console.error('Error deleting message:', error);
                    alert('Error deleting message. Please try again.');
                }
            }
            
            async clearInbox() {
                if (!this.token || this.messages.length === 0) return;
                
                const clearButton = document.getElementById('clear-inbox-button');
                clearButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Clearing...';
                clearButton.disabled = true;
                
                try {
                    // Delete all messages sequentially
                    for (const message of this.messages) {
                        await fetch(`${this.mailTmApiUrl}/messages/${message.id}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${this.token}`
                            }
                        });
                    }
                    
                    // Clear local messages array
                    this.messages = [];
                    this.renderMessages();
                    
                } catch (error) {
                    console.error('Error clearing inbox:', error);
                    alert('Error clearing inbox. Please try again.');
                } finally {
                    clearButton.innerHTML = '<i class="fas fa-eraser mr-1"></i> Clear All';
                    clearButton.disabled = false;
                }
            }
            
            toggleTheme() {
                this.theme = this.theme === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', this.theme);
                document.getElementById('theme-toggle').innerHTML = this.theme === 'dark' 
                    ? '<i class="fas fa-sun"></i>' 
                    : '<i class="fas fa-moon"></i>';
                
                localStorage.setItem('ghost-inbox-theme', this.theme);
            }
        }
        
        // Initialize the application when the DOM is loaded
        document.addEventListener('DOMContentLoaded', () => {
            window.ghostInbox = new GhostInbox();
        });
    