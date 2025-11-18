(() => {
  /**
   * Đăng ký service worker để cache ảnh (và các asset tĩnh khác) sau khi tải lần đầu.
   * Giúp hạn chế việc trình duyệt phải tải lại ảnh nhiều lần, tiết kiệm băng thông.
   */
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const swPath = './service-worker.js';

  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register(swPath, { scope: './' });

      // Nếu có SW mới, đảm bảo nó active sớm.
      if (registration.waiting && navigator.serviceWorker.controller) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    } catch (error) {
      console.warn('[SW] Đăng ký service worker thất bại:', error);
    }
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
})();


