(() => {
  /**
   * Ẩn phần tử media gallery
   * Xử lý cả trường hợp phần tử được tạo động sau khi trang load
   */
  const hideMediaElements = () => {
    // Tìm phần tử theo data-framer-name="media"
    const mediaElements = document.querySelectorAll('[data-framer-name="media"]');
    mediaElements.forEach(el => {
      el.style.display = 'none';
    });

    // Tìm phần tử theo class framer-ywuw5s
    const framerElements = document.querySelectorAll('.framer-ywuw5s');
    framerElements.forEach(el => {
      el.style.display = 'none';
    });
  };

  // Chạy ngay khi DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideMediaElements);
  } else {
    hideMediaElements();
  }

  // Sử dụng MutationObserver để theo dõi phần tử được thêm vào DOM động
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element node
          // Kiểm tra node mới được thêm
          if (node.matches && (
            node.matches('[data-framer-name="media"]') ||
            node.matches('.framer-ywuw5s')
          )) {
            node.style.display = 'none';
          }
          // Kiểm tra các phần tử con
          const mediaChildren = node.querySelectorAll?.('[data-framer-name="media"], .framer-ywuw5s');
          if (mediaChildren) {
            mediaChildren.forEach(el => {
              el.style.display = 'none';
            });
          }
        }
      });
    });
  });

  // Bắt đầu quan sát khi DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  } else {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
})();

