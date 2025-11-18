(() => {
  /**
   * Thêm ảnh mout2.png ở bên trái màn hình
   * Tạo phần tử mới tương tự Mount-l-b nhưng đặt ở vị trí bên trái hơn
   */
  const addMout2Left = () => {
    // Tìm phần tử hero section
    const heroSection = document.querySelector('[data-framer-name="hero"]');
    if (!heroSection) return;

    // Kiểm tra xem đã có phần tử mout2-left chưa
    if (document.querySelector('[data-framer-name="Mount-l-b-extra"]')) {
      return;
    }

    // Tìm phần tử Mount-l-b để tham khảo
    const mountLB = document.querySelector('[data-framer-name="Mount-l-b"]');
    if (!mountLB) return;

    // Tạo phần tử mới bằng cách clone
    const newMout2 = mountLB.cloneNode(true);
    newMout2.setAttribute('data-framer-name', 'Mount-l-b-extra');
    
    // Xóa các class cũ và thêm class mới nếu cần
    newMout2.className = mountLB.className;
    
    // Đảm bảo ảnh là mout2.png - tìm tất cả các phần tử có background image
    const allElements = newMout2.querySelectorAll('*');
    allElements.forEach(el => {
      const bgImage = window.getComputedStyle(el).backgroundImage;
      if (bgImage && bgImage.includes('mout2.png')) {
        // Đã có mout2.png rồi, không cần thay đổi
        return;
      }
      if (bgImage && (bgImage.includes('mout1') || bgImage.includes('mountain'))) {
        el.style.backgroundImage = `url('./assets/mout2.png')`;
      }
    });
    
    // Kiểm tra phần tử chính
    const mainBg = window.getComputedStyle(newMout2).backgroundImage;
    if (mainBg && !mainBg.includes('mout2.png')) {
      newMout2.style.backgroundImage = `url('./assets/mout2.png')`;
    }
    
    // Đặt vị trí ở bên trái hơn (left: -10% thay vì 4%)
    // CSS sẽ xử lý phần lớn styling, nhưng đảm bảo các thuộc tính cơ bản
    newMout2.style.position = 'absolute';
    newMout2.style.left = '-10%';
    newMout2.style.opacity = '0.25';
    newMout2.style.zIndex = '0';
    newMout2.style.pointerEvents = 'none';
    
    // Thêm vào hero section
    heroSection.appendChild(newMout2);
  };

  // Chạy ngay khi DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addMout2Left);
  } else {
    addMout2Left();
  }

  // Sử dụng MutationObserver để theo dõi khi hero section được thêm vào DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element node
          // Kiểm tra nếu hero section được thêm vào
          if (node.matches && node.matches('[data-framer-name="hero"]')) {
            setTimeout(addMout2Left, 100);
          }
          // Kiểm tra các phần tử con
          const heroSection = node.querySelectorAll?.('[data-framer-name="hero"]');
          if (heroSection && heroSection.length > 0) {
            setTimeout(addMout2Left, 100);
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

