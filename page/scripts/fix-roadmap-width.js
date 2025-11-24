(() => {
  /**
   * Script để đảm bảo width cố định cho các roadmap items
   * Ngăn chặn việc "lúc to lúc nhỏ"
   */
  
  const fixRoadmapWidth = () => {
    // Tìm tất cả các swiper container có columns mode
    const containers = document.querySelectorAll('[data-width-mode="columns"]');
    
    containers.forEach(container => {
      // Tìm tất cả slides trong container này
      const slides = container.querySelectorAll('.swiper-slide');
      
      // Kiểm tra xem có roadmap items không
      const hasRoadmap = Array.from(slides).some(slide => 
        slide.querySelector('[data-framer-name^="roadmap-item"]') ||
        slide.querySelector('[data-framer-name="810-roadmap-item-02"]')
      );
      
      if (hasRoadmap && slides.length === 4) {
        const containerWidth = container.offsetWidth || container.clientWidth;
        if (containerWidth > 0) {
          // Tính toán width: (100% - 30px) / 4
          const slideWidth = (containerWidth - 30) / 4;
          
          slides.forEach(slide => {
            // Chỉ fix các slide có roadmap items
            const hasRoadmapItem = slide.querySelector('[data-framer-name^="roadmap-item"]') ||
                                   slide.querySelector('[data-framer-name="810-roadmap-item-02"]');
            
            if (hasRoadmapItem) {
              slide.style.setProperty('width', `${slideWidth}px`, 'important');
              slide.style.setProperty('min-width', `${slideWidth}px`, 'important');
              slide.style.setProperty('max-width', `${slideWidth}px`, 'important');
              slide.style.setProperty('flex-shrink', '0', 'important');
              slide.style.setProperty('flex-grow', '0', 'important');
              slide.style.setProperty('margin-left', '5px', 'important');
              slide.style.setProperty('margin-right', '5px', 'important');
              slide.style.setProperty('box-sizing', 'border-box', 'important');
            }
          });
        }
      }
    });
    
    // Cũng fix cho các container roadmap items
    const roadmapContainers = document.querySelectorAll(
      '[data-framer-name^="roadmap-item"], ' +
      '[data-framer-name="810-roadmap-item-02"]'
    );
    
    roadmapContainers.forEach(container => {
      container.style.setProperty('width', '100%', 'important');
      container.style.setProperty('box-sizing', 'border-box', 'important');
    });
  };
  
  // Chạy ngay lập tức nếu có thể
  fixRoadmapWidth();
  
  // Chạy sau khi DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      requestAnimationFrame(() => {
        fixRoadmapWidth();
        setTimeout(fixRoadmapWidth, 50);
        setTimeout(fixRoadmapWidth, 150);
        setTimeout(fixRoadmapWidth, 300);
      });
    });
  } else {
    requestAnimationFrame(() => {
      fixRoadmapWidth();
      setTimeout(fixRoadmapWidth, 50);
      setTimeout(fixRoadmapWidth, 150);
      setTimeout(fixRoadmapWidth, 300);
    });
  }
  
  // Chạy sau khi trang load xong
  window.addEventListener('load', () => {
    requestAnimationFrame(() => {
      fixRoadmapWidth();
      setTimeout(fixRoadmapWidth, 100);
      setTimeout(fixRoadmapWidth, 300);
      setTimeout(fixRoadmapWidth, 500);
    });
  });
  
  // Sử dụng MutationObserver để theo dõi khi có thay đổi
  const observer = new MutationObserver((mutations) => {
    let shouldFix = false;
    
    mutations.forEach((mutation) => {
      // Kiểm tra thay đổi style
      if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
        const target = mutation.target;
        if (target.classList.contains('swiper-slide') && 
            (target.querySelector('[data-framer-name^="roadmap-item"]') || 
             target.querySelector('[data-framer-name="810-roadmap-item-02"]'))) {
          shouldFix = true;
        }
      }
      
      // Kiểm tra phần tử mới được thêm
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          if (node.classList.contains('swiper-slide') || 
              node.querySelector?.('[data-framer-name^="roadmap-item"]') ||
              node.querySelector?.('[data-framer-name="810-roadmap-item-02"]')) {
            shouldFix = true;
          }
        }
      });
    });
    
    if (shouldFix) {
      requestAnimationFrame(() => {
        fixRoadmapWidth();
        setTimeout(fixRoadmapWidth, 50);
      });
    }
  });
  
  // Bắt đầu quan sát
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style']
      });
    });
  } else {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style']
    });
  }
  
  // Kiểm tra định kỳ như một fallback - giảm tần suất để tránh lag
  let isResizing = false;
  setInterval(() => {
    // Chỉ chạy nếu không đang resize để tránh lag
    if (!isResizing) {
      requestAnimationFrame(fixRoadmapWidth);
    }
  }, 1000); // Tăng từ 200ms lên 1000ms để giảm tải CPU
  
  // Fix khi window resize - tăng debounce để tránh lag khi mở DevTools
  let resizeTimeout;
  let resizeRAF;
  window.addEventListener('resize', () => {
    isResizing = true;
    
    // Hủy các request trước đó
    if (resizeRAF) {
      cancelAnimationFrame(resizeRAF);
    }
    clearTimeout(resizeTimeout);
    
    // Sử dụng requestAnimationFrame + debounce để tối ưu
    resizeRAF = requestAnimationFrame(() => {
      resizeTimeout = setTimeout(() => {
        fixRoadmapWidth();
        isResizing = false;
      }, 300); // Tăng từ 100ms lên 300ms để giảm lag khi resize nhanh
    });
  }, { passive: true }); // Thêm passive để tối ưu performance
})();

