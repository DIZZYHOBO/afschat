// PWA Installation and Service Worker Management
class PWAInstaller {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.swRegistration = null;
        this.init();
    }

    async init() {
        // Check if already installed
        this.checkInstallStatus();
        
        // Register service worker
        await this.registerServiceWorker();
        
        // Set up install prompt handling
        this.setupInstallPrompt();
        
        // Handle app shortcuts
        this.handleShortcuts();
        
        // Set up update checking
        this.setupUpdateHandling();
        
        console.log('🔧 PWA Installer initialized');
    }

    checkInstallStatus() {
        // Check if running as PWA
        this.isInstalled = window.matchMedia('(display-mode: standalone)').matches || 
                          window.navigator.standalone === true;
        
        if (this.isInstalled) {
            console.log('📱 Running as installed PWA');
            document.body.classList.add('pwa-installed');
        } else {
            console.log('🌐 Running in browser');
            this.showInstallPrompt();
        }
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                this.swRegistration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/'
                });

                console.log('✅ Service Worker registered:', this.swRegistration);

                // Listen for service worker updates
                this.swRegistration.addEventListener('updatefound', () => {
                    console.log('🔄 Service Worker update found');
                    this.handleServiceWorkerUpdate();
                });

                // Handle service worker messages
                navigator.serviceWorker.addEventListener('message', (event) => {
                    this.handleServiceWorkerMessage(event);
                });

            } catch (error) {
                console.error('❌ Service Worker registration failed:', error);
            }
        } else {
            console.warn('⚠️ Service Worker not supported');
        }
    }

    setupInstallPrompt() {
        // Listen for beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('📲 Install prompt available');
            
            // Prevent the mini-infobar from appearing
            e.preventDefault();
            
            // Save the event for later use
            this.deferredPrompt = e;
            
            // Show custom install button
            this.showInstallButton();
        });

        // Listen for app installed event
        window.addEventListener('appinstalled', () => {
            console.log('🎉 AFSChat installed successfully');
            this.isInstalled = true;
            this.hideInstallButton();
            this.showSuccessMessage();
        });
    }

    showInstallButton() {
        // Create install button if it doesn't exist
        let installBtn = document.getElementById('pwa-install-btn');
        
        if (!installBtn) {
            installBtn = document.createElement('button');
            installBtn.id = 'pwa-install-btn';
            installBtn.className = 'pwa-install-button';
            installBtn.innerHTML = `
                <span class="install-icon">📱</span>
                <span class="install-text">Install AFSChat</span>
            `;
            
            // Style the button
            installBtn.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: linear-gradient(135deg, #238636, #2ea043);
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 25px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 4px 20px rgba(35, 134, 54, 0.3);
                z-index: 1000;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: all 0.3s ease;
                backdrop-filter: blur(10px);
            `;
            
            // Add hover effect
            installBtn.addEventListener('mouseenter', () => {
                installBtn.style.transform = 'translateY(-2px)';
                installBtn.style.boxShadow = '0 6px 25px rgba(35, 134, 54, 0.4)';
            });
            
            installBtn.addEventListener('mouseleave', () => {
                installBtn.style.transform = 'translateY(0)';
                installBtn.style.boxShadow = '0 4px 20px rgba(35, 134, 54, 0.3)';
            });
            
            // Add click handler
            installBtn.addEventListener('click', () => this.installApp());
            
            document.body.appendChild(installBtn);
        }
        
        installBtn.style.display = 'flex';
    }

    hideInstallButton() {
        const installBtn = document.getElementById('pwa-install-btn');
        if (installBtn) {
            installBtn.style.display = 'none';
        }
    }

    async installApp() {
        if (!this.deferredPrompt) {
            console.warn('⚠️ Install prompt not available');
            return;
        }

        // Show the install prompt
        this.deferredPrompt.prompt();

        // Wait for the user to respond
        const { outcome } = await this.deferredPrompt.userChoice;
        
        console.log(`👤 User response: ${outcome}`);
        
        if (outcome === 'accepted') {
            console.log('✅ User accepted the install prompt');
        } else {
            console.log('❌ User dismissed the install prompt');
        }

        // Clear the deferred prompt
        this.deferredPrompt = null;
        this.hideInstallButton();
    }

    showInstallPrompt() {
        // Show a subtle prompt in the UI
        if (!this.isInstalled && !document.getElementById('pwa-prompt')) {
            const prompt = document.createElement('div');
            prompt.id = 'pwa-prompt';
            prompt.innerHTML = `
                <div style="
                    background: rgba(35, 134, 54, 0.1);
                    border: 1px solid #238636;
                    border-radius: 8px;
                    padding: 12px 16px;
                    margin: 10px;
                    font-size: 13px;
                    color: #238636;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                ">
                    <span>📱 Install AFSChat for the best experience</span>
                    <button onclick="this.parentElement.parentElement.remove()" style="
                        background: none;
                        border: none;
                        color: #238636;
                        cursor: pointer;
                        padding: 4px;
                    ">✕</button>
                </div>
            `;
            
            // Add to sidebar header
            const sidebarHeader = document.querySelector('.sidebar-header');
            if (sidebarHeader) {
                sidebarHeader.appendChild(prompt);
            }
        }
    }

    showSuccessMessage() {
        // Show success toast
        if (window.secureMessenger) {
            window.secureMessenger.showToast('success', '🎉 App Installed!', 
                'AFSChat has been installed and is ready for offline use.');
        }
    }

    handleShortcuts() {
        // Handle app shortcuts from manifest
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        
        switch (action) {
            case 'new-chat':
                // Open new chat interface
                setTimeout(() => {
                    if (window.secureMessenger) {
                        window.secureMessenger.openSidebar();
                    }
                }, 1000);
                break;
                
            case 'add-contact':
                // Open add contact modal
                setTimeout(() => {
                    const addContactBtn = document.querySelector('[onclick="showAddContactModal()"]');
                    if (addContactBtn) {
                        addContactBtn.click();
                    }
                }, 1000);
                break;
        }
    }

    setupUpdateHandling() {
        // Handle service worker updates
        if (this.swRegistration) {
            this.swRegistration.addEventListener('updatefound', () => {
                const newWorker = this.swRegistration.installing;
                
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New update available
                        this.showUpdatePrompt();
                    }
                });
            });
        }
    }

    showUpdatePrompt() {
        if (window.secureMessenger) {
            // Create custom update prompt
            const updateToast = document.createElement('div');
            updateToast.className = 'toast info';
            updateToast.innerHTML = `
                <div class="toast-header">
                    <div class="toast-title">
                        <span class="toast-icon">🔄</span>
                        Update Available
                    </div>
                </div>
                <div class="toast-body">
                    A new version of AFSChat is available with improvements and bug fixes.
                </div>
                <div class="toast-actions">
                    <button class="toast-btn info" onclick="pwaInstaller.updateApp()">
                        Update Now
                    </button>
                    <button class="toast-btn deny" onclick="this.parentElement.parentElement.remove()">
                        Later
                    </button>
                </div>
            `;

            document.getElementById('toastContainer').appendChild(updateToast);
            setTimeout(() => updateToast.classList.add('show'), 100);
        }
    }

    async updateApp() {
        if (this.swRegistration && this.swRegistration.waiting) {
            // Tell the waiting service worker to skip waiting
            this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
            
            // Reload the page to use the new service worker
            window.location.reload();
        }
    }

    handleServiceWorkerUpdate() {
        console.log('🔄 Service Worker update detected');
        // The update handling is done in setupUpdateHandling
    }

    handleServiceWorkerMessage(event) {
        const { data } = event;
        
        switch (data.type) {
            case 'SYNC_MESSAGES':
                console.log('🔄 Background sync triggered');
                // Handle message synchronization
                if (window.secureMessenger) {
                    // Could trigger a check for pending messages
                    console.log('📨 Checking for pending messages...');
                }
                break;
                
            case 'VERSION':
                console.log('📋 Service Worker version:', data.version);
                break;
        }
    }

    // Utility method to check if app is running offline
    isOffline() {
        return !navigator.onLine;
    }

    // Method to manually check for updates
    async checkForUpdates() {
        if (this.swRegistration) {
            await this.swRegistration.update();
        }
    }
}

// Initialize PWA installer when DOM is loaded
let pwaInstaller;

document.addEventListener('DOMContentLoaded', () => {
    pwaInstaller = new PWAInstaller();
});

// Handle online/offline status
window.addEventListener('online', () => {
    console.log('🌐 Back online');
    if (window.secureMessenger) {
        window.secureMessenger.showToast('success', '🌐 Back Online', 'Connection restored');
    }
});

window.addEventListener('offline', () => {
    console.log('📴 Gone offline');
    if (window.secureMessenger) {
        window.secureMessenger.showToast('warning', '📴 Offline Mode', 'Some features may be limited');
    }
});

// Export for global access
window.pwaInstaller = pwaInstaller;
