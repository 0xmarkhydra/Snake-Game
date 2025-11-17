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

/**
 * Detects the operating system
 * @returns 'mac' | 'windows' | 'linux' | 'unknown'
 */
export function getOS(): 'mac' | 'windows' | 'linux' | 'unknown' {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();
  
  if (platform.includes('mac') || userAgent.includes('mac')) {
    return 'mac';
  }
  if (platform.includes('win') || userAgent.includes('windows')) {
    return 'windows';
  }
  if (platform.includes('linux') || userAgent.includes('linux')) {
    return 'linux';
  }
  return 'unknown';
}

/**
 * Detects if running on macOS
 * @returns true if macOS, false otherwise
 */
export function isMacOS(): boolean {
  return getOS() === 'mac';
}

/**
 * Detects if running on Windows
 * @returns true if Windows, false otherwise
 */
export function isWindows(): boolean {
  return getOS() === 'windows';
}

/**
 * Gets optimal device pixel ratio based on OS and device capabilities
 * Mac handles high DPI better, Windows may need lower resolution for performance
 * @returns optimal devicePixelRatio multiplier (1-2)
 */
export function getOptimalDevicePixelRatio(): number {
  const os = getOS();
  const devicePixelRatio = window.devicePixelRatio || 1;
  
  // Mac typically handles retina (2x) well
  if (os === 'mac') {
    return Math.min(devicePixelRatio, 2);
  }
  
  // Windows: be more conservative with resolution for better performance
  // Use 1.5x max on Windows unless it's a high-end display (4K+)
  if (os === 'windows') {
    // For 4K displays (devicePixelRatio >= 2), still use 2x
    if (devicePixelRatio >= 2) {
      return 2;
    }
    // For regular displays, cap at 1.5x for better performance
    return Math.min(devicePixelRatio, 1.5);
  }
  
  // Linux and others: use device default, cap at 2
  return Math.min(devicePixelRatio, 2);
}

/**
 * Gets optimal target FPS based on OS and device
 * @returns target FPS (30, 60, or 120)
 */
export function getOptimalTargetFPS(): number {
  if (isMobileDevice()) {
    return 60;
  }
  
  const os = getOS();
  
  // Mac typically handles 120fps better
  if (os === 'mac') {
    return 120;
  }
  
  // Windows: start with 60fps for better stability, can adapt up if performance allows
  if (os === 'windows') {
    return 60;
  }
  
  // Linux and others: default to 60
  return 60;
}

