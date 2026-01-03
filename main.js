// Main JavaScript for The Repeaters Official

document.addEventListener('DOMContentLoaded', function() {
    // Mobile Menu Toggle
    const mobileToggle = document.getElementById('mobileToggle');
    const navMenu = document.getElementById('navMenu');
    
    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            mobileToggle.innerHTML = navMenu.classList.contains('active') 
                ? '<i class="fas fa-times"></i>' 
                : '<i class="fas fa-bars"></i>';
        });
    }
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!navMenu.contains(e.target) && !mobileToggle.contains(e.target)) {
            navMenu.classList.remove('active');
            if (mobileToggle) {
                mobileToggle.innerHTML = '<i class="fas fa-bars"></i>';
            }
        }
    });
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            // Skip if it's a dropdown or page link
            if (href === '#' || href.includes('.html')) return;
            
            e.preventDefault();
            const targetId = href;
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80,
                    behavior: 'smooth'
                });
                
                // Close mobile menu if open
                navMenu.classList.remove('active');
                if (mobileToggle) {
                    mobileToggle.innerHTML = '<i class="fas fa-bars"></i>';
                }
            }
        });
    });
    
    // Enrollment buttons
    document.querySelectorAll('.enroll-btn').forEach(button => {
        button.addEventListener('click', function() {
            const exam = this.getAttribute('data-exam');
            const examNames = {
                'chsl': 'SSC CHSL',
                'cgl': 'SSC CGL',
                'mts': 'SSC MTS',
                'selection': 'Selection Phase',
                'ntpc': 'Railway NTPC',
                'oneday': 'One Day Exams'
            };
            
            // Check if user is logged in
            const user = JSON.parse(localStorage.getItem('user'));
            if (user) {
                // Show enrollment modal
                showEnrollmentModal(examNames[exam] || exam);
            } else {
                // Redirect to login
                showLoginModal();
            }
        });
    });
    
    // Login Modal
    const loginModal = document.getElementById('loginModal');
    const closeModal = document.querySelector('.close-modal');
    
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            loginModal.style.display = 'none';
        });
    }
    
    window.addEventListener('click', (e) => {
        if (e.target === loginModal) {
            loginModal.style.display = 'none';
        }
    });
    
    // Google Drive Integration
    const driveButtons = document.querySelectorAll('.btn-google-drive');
    driveButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            if (!this.href.includes('drive.google.com')) {
                e.preventDefault();
                checkDriveAccess();
            }
        });
    });
    
    // Check authentication status on page load
    checkAuthStatus();
    
    // Initialize exam countdown timers
    initExamCountdowns();
    
    // Initialize performance charts
    initPerformanceCharts();
});

function showEnrollmentModal(examName) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-modal">&times;</span>
            <div class="modal-header">
                <h3><i class="fas fa-graduation-cap"></i> Enroll in ${examName}</h3>
            </div>
            <div class="modal-body">
                <form id="enrollmentForm">
                    <div class="form-group">
                        <label>Full Name</label>
                        <input type="text" required>
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" required>
                    </div>
                    <div class="form-group">
                        <label>Phone Number</label>
                        <input type="tel" required>
                    </div>
                    <div class="form-group">
                        <label>Select Batch</label>
                        <select required>
                            <option value="">Choose batch timing</option>
                            <option value="morning">Morning Batch (7-9 AM)</option>
                            <option value="afternoon">Afternoon Batch (2-4 PM)</option>
                            <option value="evening">Evening Batch (7-9 PM)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Payment Method</label>
                        <div class="payment-options">
                            <label><input type="radio" name="payment" value="card" required> Credit/Debit Card</label>
                            <label><input type="radio" name="payment" value="upi" required> UPI</label>
                            <label><input type="radio" name="payment" value="netbanking" required> Net Banking</label>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">Complete Enrollment (₹4999)</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    
    modal.querySelector('.close-modal').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    modal.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        processEnrollment(examName);
    });
}

function processEnrollment(examName) {
    // Simulate enrollment process
    const loading = document.createElement('div');
    loading.className = 'loading-overlay';
    loading.innerHTML = '<div class="spinner"></div><p>Processing enrollment...</p>';
    document.body.appendChild(loading);
    
    setTimeout(() => {
        loading.remove();
        alert(`Successfully enrolled in ${examName}! You will receive confirmation email shortly.`);
        window.location.href = 'dashboard.html';
    }, 2000);
}

function checkDriveAccess() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        showLoginModal();
        return;
    }
    
    // Check if user has Google Drive access token
    const driveToken = localStorage.getItem('drive_token');
    if (!driveToken) {
        // Request Google Drive access
        requestDriveAccess();
    } else {
        // Open Google Drive
        window.open('https://drive.google.com/drive/folders/YOUR_FOLDER_ID', '_blank');
    }
}

function requestDriveAccess() {
    // This would normally use Google OAuth
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fab fa-google-drive"></i> Google Drive Access</h3>
            </div>
            <div class="modal-body">
                <p>Connect your Google Drive to access study materials and save your progress.</p>
                <button id="connectDrive" class="btn btn-google-drive btn-block">
                    <i class="fab fa-google-drive"></i> Connect Google Drive
                </button>
                <p class="small-text">We'll only access the study materials folder</p>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    
    modal.querySelector('#connectDrive').addEventListener('click', () => {
        // Simulate Google OAuth
        localStorage.setItem('drive_token', 'simulated_token');
        modal.remove();
        window.open('https://drive.google.com/drive/folders/YOUR_FOLDER_ID', '_blank');
    });
}

function initExamCountdowns() {
    // SSC CGL 2024 countdown
    const cglDate = new Date('2024-06-15').getTime();
    updateCountdown('cglCountdown', cglDate);
    
    // Update every second
    setInterval(() => {
        updateCountdown('cglCountdown', cglDate);
    }, 1000);
}

function updateCountdown(elementId, targetDate) {
    const now = new Date().getTime();
    const distance = targetDate - now;
    
    if (distance < 0) {
        document.getElementById(elementId).innerHTML = "Exam Completed";
        return;
    }
    
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
    
    if (document.getElementById(elementId)) {
        document.getElementById(elementId).innerHTML = 
            `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }
}

function initPerformanceCharts() {
    // This would initialize charts using Chart.js
    // For now, we'll create a simple simulation
    const performanceData = {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        scores: [65, 72, 68, 85]
    };
    
    // You would integrate Chart.js here
    // const ctx = document.getElementById('performanceChart').getContext('2d');
    // new Chart(ctx, { ... });
}

// Utility Functions
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
        <button class="close-notification">&times;</button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    notification.querySelector('.close-notification').addEventListener('click', () => {
        notification.remove();
    });
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Add CSS for notifications
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: white;
        border-radius: 5px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        display: flex;
        align-items: center;
        gap: 10px;
        transform: translateX(150%);
        transition: transform 0.3s;
        z-index: 10000;
    }
    
    .notification.show {
        transform: translateX(0);
    }
    
    .notification.success {
        border-left: 4px solid #2ecc71;
    }
    
    .notification.error {
        border-left: 4px solid #e74c3c;
    }
    
    .close-notification {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        margin-left: auto;
    }
    
    .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        color: white;
    }
    
    .spinner {
        width: 50px;
        height: 50px;
        border: 5px solid #f3f3f3;
        border-top: 5px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 15px;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;

document.head.appendChild(notificationStyles);
