// Mobile-specific interactions for TaskFlow

class MobileManager {
  constructor() {
    this.mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    this.headerRight = document.getElementById('header-right');
    this.appScreen = document.getElementById('app-screen');
    this.isMobile = window.innerWidth <= 768;

    this.init();
  }

  init() {
    this.setupMobileMenuToggle();
    this.setupWindowResizeListener();
    this.setupServiceWorker();
    this.preventZoom();
    this.setupTouchOptimizations();
  }

  setupMobileMenuToggle() {
    if (!this.mobileMenuToggle) return;

    this.mobileMenuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMobileMenu();
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (
        !e.target.closest('.app-header') &&
        !e.target.closest('.header-right')
      ) {
        this.closeMobileMenu();
      }
    });

    // Close menu when clicking a link
    if (this.headerRight) {
      this.headerRight.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          if (window.innerWidth <= 480) {
            this.closeMobileMenu();
          }
        });
      });
    }
  }

  toggleMobileMenu() {
    if (!this.headerRight) return;

    const isOpen = this.headerRight.classList.contains('show');
    if (isOpen) {
      this.closeMobileMenu();
    } else {
      this.openMobileMenu();
    }
  }

  openMobileMenu() {
    if (this.headerRight) {
      this.headerRight.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
  }

  closeMobileMenu() {
    if (this.headerRight) {
      this.headerRight.classList.remove('show');
      document.body.style.overflow = '';
    }
  }

  setupWindowResizeListener() {
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimeout = setTimeout(() => {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth <= 768;

        if (wasMobile && !this.isMobile) {
          this.closeMobileMenu();
        }
      }, 250);
    });
  }

  setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('Service Worker registered'))
        .catch(err => console.log('SW registration failed:', err));
    }
  }

  preventZoom() {
    // Prevent double-tap zoom on iOS while preserving accessibility
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    }, false);
  }

  setupTouchOptimizations() {
    // Add active state on touch for visual feedback
    const buttons = document.querySelectorAll('button, a, input[type="submit"]');
    buttons.forEach(btn => {
      btn.addEventListener('touchstart', function() {
        this.style.opacity = '0.7';
      });
      btn.addEventListener('touchend', function() {
        this.style.opacity = '1';
      });
    });
  }

  // Utility: Check if device is in portrait orientation
  static isPortrait() {
    return window.innerHeight > window.innerWidth;
  }

  // Utility: Check if device is touch-capable
  static isTouchDevice() {
    return (('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0) ||
            (navigator.msMaxTouchPoints > 0));
  }

  // Utility: Get viewport safe area insets
  static getSafeAreaInsets() {
    if (CSS.supports('padding: env(safe-area-inset-top)')) {
      return {
        top: parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)')) || 0,
        right: parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-right)')) || 0,
        bottom: parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)')) || 0,
        left: parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-left)')) || 0
      };
    }
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
}

// Swipe detection for mobile interactions
class SwipeManager {
  constructor() {
    this.touchStartX = 0;
    this.touchEndX = 0;
    this.touchStartY = 0;
    this.touchEndY = 0;
  }

  addSwipeListener(element, callback) {
    element.addEventListener('touchstart', (e) => {
      this.touchStartX = e.changedTouches[0].screenX;
      this.touchStartY = e.changedTouches[0].screenY;
    }, false);

    element.addEventListener('touchend', (e) => {
      this.touchEndX = e.changedTouches[0].screenX;
      this.touchEndY = e.changedTouches[0].screenY;
      this.handleSwipe(callback);
    }, false);
  }

  handleSwipe(callback) {
    const diffX = this.touchEndX - this.touchStartX;
    const diffY = this.touchEndY - this.touchStartY;
    const threshold = 50;

    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (Math.abs(diffX) > threshold) {
        callback(diffX > 0 ? 'right' : 'left');
      }
    }
  }
}

// Initialize mobile manager when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new MobileManager();
  });
} else {
  new MobileManager();
}
