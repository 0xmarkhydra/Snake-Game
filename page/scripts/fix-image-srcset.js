(() => {
  /**
   * Script để sửa tất cả các srcset từ framerusercontent.com thành đường dẫn local
   * Đảm bảo ảnh mout1, mout2, và snake images hiển thị đúng
   */
  
  const fixImageSrcset = () => {
    // Tìm tất cả các thẻ img
    const images = document.querySelectorAll('img');
    
    images.forEach(img => {
      const srcset = img.getAttribute('srcset');
      if (!srcset) return;
      
      // Kiểm tra nếu srcset chứa framerusercontent.com
      if (srcset.includes('framerusercontent.com')) {
        // Lấy tên file từ src attribute
        const src = img.getAttribute('src');
        if (!src || !src.startsWith('./assets/')) {
          // Nếu src không có, thử tìm từ srcset
          const match = srcset.match(/framerusercontent\.com\/images\/([^?]+)/);
          if (match && match[1]) {
            const fileName = match[1];
            img.setAttribute('src', `./assets/${fileName}`);
          } else {
            return;
          }
        }
        
        // Lấy tên file từ src (ví dụ: ./assets/mout2.png -> mout2.png)
        const fileName = src.replace('./assets/', '');
        
        // Tạo srcset mới với đường dẫn local
        // Thay thế tất cả các URL framerusercontent.com bằng đường dẫn local
        const newSrcset = srcset
          .replace(/https:\/\/framerusercontent\.com\/images\/([^?]+)(\?[^,\s]+)?/g, (match, file, params) => {
            // Nếu file name trong URL khớp với fileName trong src, thay thế
            if (file === fileName || match.includes(fileName)) {
              // Giữ nguyên params nếu có, hoặc tạo params mới từ match
              return `./assets/${fileName}${params || ''}`;
            }
            // Nếu không khớp, vẫn thay thế nếu có thể xác định được file name
            return `./assets/${file}${params || ''}`;
          });
        
        // Cập nhật srcset
        img.setAttribute('srcset', newSrcset);
        
        // Đảm bảo src cũng đúng
        if (!img.getAttribute('src') || !img.getAttribute('src').startsWith('./assets/')) {
          img.setAttribute('src', `./assets/${fileName}`);
        }
        
        // Đảm bảo ảnh hiển thị
        img.style.display = 'block';
        img.style.opacity = '1';
        img.style.visibility = 'visible';
      }
    });
    
    // Đặc biệt xử lý các ảnh mout2 và snake
    const mountImages = document.querySelectorAll('[data-framer-name="Mount-r-b"], [data-framer-name="Mount-l-b"] img');
    mountImages.forEach(img => {
      if (img.src && img.src.includes('mout2.png')) {
        img.src = './assets/mout2.png';
        img.style.display = 'block';
        img.style.opacity = '1';
        img.style.visibility = 'visible';
      }
    });
    
    // Xử lý Mount2-r và Mount2-l
    const mount2r = document.querySelector('[data-framer-name="Mount2-r"]');
    if (mount2r) {
      const img = mount2r.querySelector('img');
      if (img) {
        img.src = './assets/mout2.png';
        // Sửa srcset nếu có lỗi double path
        if (img.srcset) {
          img.srcset = img.srcset
            .replace(/\.\/assets\/\.\/assets\//g, './assets/')
            .replace(/Z9bmdP5gjhIpBnq3G9Vvem7pUU0\.webp/g, 'mout2.png')
            .replace(/https:\/\/framerusercontent\.com\/images\/Z9bmdP5gjhIpBnq3G9Vvem7pUU0\.webp[^,\s]*/g, './assets/mout2.png');
        }
        img.style.display = 'block';
        img.style.opacity = '1';
        img.style.visibility = 'visible';
      }
    }
    
    const mount2l = document.querySelector('[data-framer-name="Mount2-l"]');
    if (mount2l) {
      const img = mount2l.querySelector('img');
      if (img) {
        img.src = './assets/mout1.png';
        // Sửa srcset nếu có lỗi double path
        if (img.srcset) {
          img.srcset = img.srcset
            .replace(/\.\/assets\/\.\/assets\//g, './assets/')
            .replace(/Z9bmdP5gjhIpBnq3G9Vvem7pUU0\.webp/g, 'mout1.png')
            .replace(/https:\/\/framerusercontent\.com\/images\/Z9bmdP5gjhIpBnq3G9Vvem7pUU0\.webp[^,\s]*/g, './assets/mout1.png');
        }
        img.style.display = 'block';
        img.style.opacity = '1';
        img.style.visibility = 'visible';
      }
    }
    
    // Xử lý ảnh snake (yUVgrZDk2l1IjQOlMpzc2cM7fdM.png hoặc oHQkubo9Vwyd2py5kwKiJFIYpVA.png)
    const snakeImages = document.querySelectorAll('img[src*="yUVgrZDk2l1IjQOlMpzc2cM7fdM"], img[src*="oHQkubo9Vwyd2py5kwKiJFIYpVA"]');
    snakeImages.forEach(img => {
      if (img.src.includes('yUVgrZDk2l1IjQOlMpzc2cM7fdM')) {
        img.src = './assets/yUVgrZDk2l1IjQOlMpzc2cM7fdM.png';
      } else if (img.src.includes('oHQkubo9Vwyd2py5kwKiJFIYpVA')) {
        img.src = './assets/oHQkubo9Vwyd2py5kwKiJFIYpVA.png';
      }
      img.style.display = 'block';
      img.style.opacity = '1';
      img.style.visibility = 'visible';
    });
    
    // Thay thế tất cả các tham chiếu đến khung.png thành yUVgrZDk2l1IjQOlMpzc2cM7fdM.png
    // Và sửa lỗi double path trong srcset
    const allImages = document.querySelectorAll('img');
    allImages.forEach(img => {
      // Sửa lỗi double path trong srcset
      if (img.srcset && img.srcset.includes('./assets/./assets/')) {
        img.srcset = img.srcset.replace(/\.\/assets\/\.\/assets\//g, './assets/');
      }
      
      // Kiểm tra và thay thế trong src
      if (img.src && img.src.includes('khung.png')) {
        img.src = img.src.replace(/khung\.png/g, 'yUVgrZDk2l1IjQOlMpzc2cM7fdM.png');
      }
      
      // Kiểm tra và thay thế trong srcset
      const srcset = img.getAttribute('srcset');
      if (srcset && srcset.includes('khung.png')) {
        img.setAttribute('srcset', srcset.replace(/khung\.png/g, 'yUVgrZDk2l1IjQOlMpzc2cM7fdM.png'));
      }
      
      // Kiểm tra và thay thế trong src attribute
      const srcAttr = img.getAttribute('src');
      if (srcAttr && srcAttr.includes('khung.png')) {
        img.setAttribute('src', srcAttr.replace(/khung\.png/g, 'yUVgrZDk2l1IjQOlMpzc2cM7fdM.png'));
      }
      
      // Xử lý Z9bmdP5gjhIpBnq3G9Vvem7pUU0.webp - thay bằng mout1 hoặc mout2
      const parent = img.closest('[data-framer-name="Mount2-r"], [data-framer-name="Mount2-l"]');
      if (parent) {
        const isMount2r = parent.getAttribute('data-framer-name') === 'Mount2-r';
        const targetFile = isMount2r ? 'mout2.png' : 'mout1.png';
        
        if (img.src && img.src.includes('Z9bmdP5gjhIpBnq3G9Vvem7pUU0.webp')) {
          img.src = `./assets/${targetFile}`;
        }
        
        if (img.srcset && img.srcset.includes('Z9bmdP5gjhIpBnq3G9Vvem7pUU0.webp')) {
          img.srcset = img.srcset
            .replace(/\.\/assets\/\.\/assets\//g, './assets/')
            .replace(/Z9bmdP5gjhIpBnq3G9Vvem7pUU0\.webp/g, targetFile)
            .replace(/https:\/\/framerusercontent\.com\/images\/Z9bmdP5gjhIpBnq3G9Vvem7pUU0\.webp[^,\s]*/g, `./assets/${targetFile}`);
        }
      }
      
      // Đảm bảo ảnh hiển thị
      img.style.display = 'block';
      img.style.opacity = '1';
      img.style.visibility = 'visible';
    });
  };
  
  /**
   * Thay thế poster image của video từ 0zo8KtNXgfSvh7ygZgH5ObSV4w.png thành live.png
   */
  const fixVideoPoster = () => {
    // Tìm tất cả các thẻ video
    const videos = document.querySelectorAll('video');
    
    videos.forEach(video => {
      const poster = video.getAttribute('poster');
      
      if (poster && poster.includes('0zo8KtNXgfSvh7ygZgH5ObSV4w.png')) {
        // Thay thế URL poster thành live.png
        const newPoster = poster.replace(
          /0zo8KtNXgfSvh7ygZgH5ObSV4w\.png[^"'\s]*/g, 
          'live.png'
        );
        video.setAttribute('poster', newPoster);
        
        // Cập nhật poster property nếu có
        if (video.poster) {
          video.poster = newPoster;
        }
      }
      
      // Xử lý trường hợp poster là URL đầy đủ từ framerusercontent
      if (poster && poster.includes('framerusercontent.com') && poster.includes('0zo8KtNXgfSvh7ygZgH5ObSV4w')) {
        // Thay thế thành đường dẫn local
        const newPoster = './assets/live.png';
        video.setAttribute('poster', newPoster);
        if (video.poster) {
          video.poster = newPoster;
        }
      }
    });
  };
  
  // Chạy ngay khi DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      fixImageSrcset();
      fixVideoPoster();
      // Chạy lại sau một khoảng thời gian để xử lý các phần tử được thêm động
      setTimeout(() => {
        fixImageSrcset();
        fixVideoPoster();
      }, 500);
      setTimeout(() => {
        fixImageSrcset();
        fixVideoPoster();
      }, 1500);
    });
  } else {
    fixImageSrcset();
    fixVideoPoster();
    setTimeout(() => {
      fixImageSrcset();
      fixVideoPoster();
    }, 500);
    setTimeout(() => {
      fixImageSrcset();
      fixVideoPoster();
    }, 1500);
  }
  
  // Sử dụng MutationObserver để theo dõi khi các phần tử được thêm vào DOM
  const observer = new MutationObserver((mutations) => {
    let shouldFix = false;
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element node
          if (node.tagName === 'IMG' || node.querySelectorAll?.('img').length > 0) {
            shouldFix = true;
          }
          // Cũng kiểm tra video elements
          if (node.tagName === 'VIDEO' || node.querySelectorAll?.('video').length > 0) {
            shouldFix = true;
          }
        }
      });
      // Kiểm tra thay đổi attribute poster
      if (mutation.type === 'attributes' && mutation.attributeName === 'poster') {
        shouldFix = true;
      }
    });
    
    if (shouldFix) {
      setTimeout(() => {
        fixImageSrcset();
        fixVideoPoster();
      }, 100);
    }
  });
  
  // Bắt đầu quan sát
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['poster']
      });
    });
  } else {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['poster']
    });
  }
  
  // Kiểm tra định kỳ như một fallback
  setInterval(() => {
    fixVideoPoster();
  }, 1000);
})();

