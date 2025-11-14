/**
 * Utility functions for device detection
 */

/**
 * Detects if the current device is a mobile device
 * @returns true if mobile device, false if desktop
 */
export function isMobileDevice(): boolean {
  // Check user agent for mobile devices
  const mobileUserAgents = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const isMobileUA = mobileUserAgents.test(navigator.userAgent);
  
  // Check screen width (mobile typically <= 768px)
  const isMobileWidth = window.innerWidth <= 768;
  
  // Check for touch capability (mobile devices typically have touch)
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Consider it mobile if it matches user agent OR (has touch AND small width)
  return isMobileUA || (hasTouchScreen && isMobileWidth);
}

/**
 * Detects if the current device is a desktop device
 * @returns true if desktop device, false if mobile
 */
export function isDesktopDevice(): boolean {
  return !isMobileDevice();
}

