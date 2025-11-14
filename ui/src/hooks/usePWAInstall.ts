import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('[PWA] App is already installed (standalone mode)');
      setIsInstalled(true);
      return;
    }

    // Check if running as PWA (iOS)
    if ((window.navigator as any).standalone === true) {
      console.log('[PWA] App is already installed (iOS standalone)');
      setIsInstalled(true);
      return;
    }

    // 🚀 PWA: Check if service worker is registered (indicates PWA support)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          console.log('[PWA] Service Worker is registered');
        }
      });
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('[PWA] beforeinstallprompt event fired');
      // Prevent the default browser install prompt
      e.preventDefault();
      
      // Store the event for later use
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      console.log('[PWA] App installed event fired');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // 🚀 PWA: For iOS and browsers that don't support beforeinstallprompt
    // Show install button if manifest exists and not already installed
    setTimeout(() => {
      if (!isInstalled && !isInstallable) {
        // Check if manifest exists
        const manifestLink = document.querySelector('link[rel="manifest"]');
        if (manifestLink) {
          console.log('[PWA] Manifest found, showing install option');
          // For iOS, we can show manual install instructions
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
          if (isIOS) {
            // iOS doesn't support beforeinstallprompt, but we can show instructions
            setIsInstallable(true);
          } else {
            // For other browsers, check if we're on HTTPS or localhost
            const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
            if (isSecure) {
              // Show install button even without beforeinstallprompt (for testing)
              // Browser will show its own prompt if criteria are met
              setIsInstallable(true);
            }
          }
        }
      }
    }, 2000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isInstalled, isInstallable]);

  const installPWA = async () => {
    // Detect platform
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isMacOS = /Macintosh|Mac OS X/.test(navigator.userAgent);
    const isWindows = /Windows/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    // Detect browser
    const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent);
    const isEdge = /Edg/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);

    // iOS instructions
    if (isIOS) {
      alert('Để cài đặt trên iOS:\n1. Nhấn nút Share (hình vuông với mũi tên)\n2. Chọn "Add to Home Screen"\n3. Nhấn "Add"');
      return;
    }

    // macOS instructions
    if (isMacOS) {
      if (isSafari) {
        alert('Để cài đặt trên macOS Safari:\n1. Nhấn Share (hình vuông với mũi tên)\n2. Chọn "Add to Dock"\n\nHoặc dùng Chrome/Edge để có trải nghiệm PWA tốt hơn.');
        return;
      } else if (isChrome || isEdge) {
        if (!deferredPrompt) {
          alert('Để cài đặt trên macOS:\n1. Nhấn vào menu của browser (3 chấm ở góc trên bên phải)\n2. Chọn "Install [App Name]..." hoặc "Install App"\n3. Nhấn "Install" trong popup');
          return;
        }
      } else if (isFirefox) {
        alert('Firefox trên macOS không hỗ trợ PWA install.\nVui lòng dùng Chrome hoặc Edge để cài đặt app.');
        return;
      }
    }

    // Windows instructions
    if (isWindows) {
      if (isChrome || isEdge) {
        if (!deferredPrompt) {
          alert('Để cài đặt trên Windows:\n1. Nhấn vào menu của browser (3 chấm)\n2. Chọn "Install [App Name]..." hoặc "Install App"\n3. Nhấn "Install" trong popup');
          return;
        }
      } else if (isFirefox) {
        alert('Firefox trên Windows không hỗ trợ PWA install.\nVui lòng dùng Chrome hoặc Edge để cài đặt app.');
        return;
      }
    }

    // Android instructions
    if (isAndroid) {
      if (!deferredPrompt) {
        alert('Để cài đặt trên Android:\n1. Nhấn vào menu của browser (3 chấm)\n2. Chọn "Install App" hoặc "Add to Home Screen"');
        return;
      }
    }

    // Try to show install prompt if available
    if (!deferredPrompt) {
      console.warn('[PWA] No install prompt available');
      // Generic fallback
      alert('Để cài đặt app:\n1. Nhấn vào menu của browser (3 chấm)\n2. Tìm "Install App" hoặc "Add to Home Screen"\n3. Nhấn "Install"');
      return;
    }

    try {
      console.log('[PWA] Showing install prompt');
      // Show the install prompt
      await deferredPrompt.prompt();

      // Wait for user response
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('[PWA] User accepted the install prompt');
        setIsInstalled(true);
      } else {
        console.log('[PWA] User dismissed the install prompt');
      }

      // Clear the deferred prompt
      setDeferredPrompt(null);
      setIsInstallable(false);
    } catch (error) {
      console.error('[PWA] Error installing PWA:', error);
      // Fallback with platform-specific instructions
      if (isMacOS && (isChrome || isEdge)) {
        alert('Để cài đặt trên macOS:\n1. Nhấn vào menu của browser (3 chấm)\n2. Chọn "Install [App Name]..." hoặc "Install App"');
      } else {
        alert('Để cài đặt app:\n1. Nhấn vào menu của browser\n2. Tìm "Install App" hoặc "Add to Home Screen"');
      }
    }
  };

  return {
    isInstallable,
    isInstalled,
    installPWA,
  };
}

