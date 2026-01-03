// Authentication System for The Repeaters Official

class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.init();
    }
    
    init() {
        // Check if user is already logged in
        const userData = localStorage.getItem('user');
        if (userData) {
            this.currentUser = JSON.parse(userData);
            this.updateUI();
        }
        
        // Initialize Firebase if available
        if (typeof firebase !== 'undefined') {
            this.initFirebase();
        }
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    initFirebase() {
        // Firebase auth state listener
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                this.currentUser = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL
                };
                localStorage.setItem('user', JSON.stringify(this.currentUser));
                this.updateUI();
            } else {
                this.currentUser = null;
                localStorage.removeItem('user');
                this.updateUI();
            }
        });
    }
    
    setupEventListeners() {
        // Login form submission
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.login(
                    document.getElementById('loginEmail').value,
                    document.getElementById('loginPassword').value
                );
            });
        }
        
        // Register form submission
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.register(
                    document.getElementById('registerName').value,
                    document.getElementById('registerEmail').value,
                    document.getElementById('registerPassword').value,
                    document.getElementById('registerPhone').value
                );
            });
        }
        
        // Google login
        const googleLoginBtn = document.getElementById('googleLogin');
        if (googleLoginBtn) {
            googleLoginBtn.addEventListener('click', () => {
                this.loginWithGoogle();
            });
        }
        
        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }
    }
    
    async login(email, password) {
        try {
            // Show loading
            showLoading();
            
            if (typeof firebase !== 'undefined') {
                // Firebase login
                const userCredential = await firebase.auth()
                    .signInWithEmailAndPassword(email, password);
                return userCredential.user;
            } else {
                // Simulated login for demo
                await this.simulateLogin(email, password);
            }
        } catch (error) {
            console.error('Login error:', error);
            showNotification('Login failed: ' + error.message, 'error');
        } finally {
            hideLoading();
        }
    }
    
    async loginWithGoogle() {
        try {
            if (typeof firebase !== 'undefined') {
                const provider = new firebase.auth.GoogleAuthProvider();
                const result = await firebase.auth().signInWithPopup(provider);
                return result.user;
            } else {
                // Simulated Google login
                await this.simulateGoogleLogin();
            }
        } catch (error) {
            console.error('Google login error:', error);
            showNotification('Google login failed', 'error');
        }
    }
    
    async register(name, email, password, phone) {
        try {
            showLoading();
            
            if (typeof firebase !== 'undefined') {
                // Firebase registration
                const userCredential = await firebase.auth()
                    .createUserWithEmailAndPassword(email, password);
                
                // Update profile
                await userCredential.user.updateProfile({
                    displayName: name
                });
                
                // Save additional user data to Firestore
                await firebase.firestore().collection('users').doc(userCredential.user.uid).set({
                    name: name,
                    email: email,
                    phone: phone,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    role: 'student',
                    enrolledCourses: []
                });
                
                return userCredential.user;
            } else {
                // Simulated registration
                await this.simulateRegister(name, email, password, phone);
            }
        } catch (error) {
            console.error('Registration error:', error);
            showNotification('Registration failed: ' + error.message, 'error');
        } finally {
            hideLoading();
        }
    }
    
    async logout() {
        try {
            if (typeof firebase !== 'undefined') {
                await firebase.auth().signOut();
            }
            
            this.currentUser = null;
            localStorage.removeItem('user');
            localStorage.removeItem('drive_token');
            
            this.updateUI();
            showNotification('Logged out successfully', 'success');
            
            // Redirect to home page
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
            
        } catch (error) {
            console.error('Logout error:', error);
            showNotification('Logout failed', 'error');
        }
    }
    
    async simulateLogin(email, password) {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Mock user data
        this.currentUser = {
            uid: 'demo-user-123',
            email: email,
            displayName: 'Demo User',
            photoURL: null
        };
        
        localStorage.setItem('user', JSON.stringify(this.currentUser));
        this.updateUI();
        showNotification('Login successful!', 'success');
        
        // Close modal if exists
        const modal = document.getElementById('loginModal');
        if (modal) modal.style.display = 'none';
        
        // Redirect to dashboard
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);
    }
    
    async simulateGoogleLogin() {
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        this.currentUser = {
            uid: 'google-user-123',
            email: 'demo@gmail.com',
            displayName: 'Google User',
            photoURL: 'https://via.placeholder.com/150'
        };
        
        localStorage.setItem('user', JSON.stringify(this.currentUser));
        this.updateUI();
        showNotification('Google login successful!', 'success');
        
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);
    }
    
    async simulateRegister(name, email, password, phone) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        this.currentUser = {
            uid: 'new-user-' + Date.now(),
            email: email,
            displayName: name,
            phone: phone,
            photoURL: null
        };
        
        localStorage.setItem('user', JSON.stringify(this.currentUser));
        this.updateUI();
        showNotification('Registration successful!', 'success');
        
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);
    }
    
    updateUI() {
        const authLinks = document.getElementById('authLinks');
        const userMenu = document.getElementById('userMenu');
        const userName = document.getElementById('userName');
        
        if (this.currentUser) {
            if (authLinks) authLinks.style.display = 'none';
            if (userMenu) userMenu.style.display = 'block';
            if (userName) {
                userName.innerHTML = `<i class="fas fa-user-circle"></i> ${this.currentUser.displayName || 'User'}`;
            }
        } else {
            if (authLinks) authLinks.style.display = 'block';
            if (userMenu) userMenu.style.display = 'none';
        }
    }
    
    isAuthenticated() {
        return this.currentUser !== null;
    }
    
    getUser() {
        return this.currentUser;
    }
    
    async updateProfile(data) {
        try {
            if (typeof firebase !== 'undefined' && this.currentUser) {
                // Update in Firebase
                await firebase.auth().currentUser.updateProfile(data);
                
                // Update Firestore
                await firebase.firestore().collection('users')
                    .doc(this.currentUser.uid)
                    .update(data);
            }
            
            // Update local data
            this.currentUser = { ...this.currentUser, ...data };
            localStorage.setItem('user', JSON.stringify(this.currentUser));
            
            showNotification('Profile updated successfully', 'success');
            return true;
        } catch (error) {
            console.error('Update profile error:', error);
            showNotification('Failed to update profile', 'error');
            return false;
        }
    }
}

// Initialize auth system
const auth = new AuthSystem();

// Helper functions
function showLoading() {
    const loading = document.createElement('div');
    loading.className = 'loading-overlay';
    loading.innerHTML = '<div class="spinner"></div><p>Please wait...</p>';
    loading.id = 'auth-loading';
    document.body.appendChild(loading);
}

function hideLoading() {
    const loading = document.getElementById('auth-loading');
    if (loading) {
        loading.remove();
    }
}

function showLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.style.display = 'flex';
    } else {
        // Redirect to login page
        window.location.href = 'login.html';
    }
}

function checkAuthStatus() {
    return auth.isAuthenticated();
}

// Export for use in other files
window.auth = auth;
