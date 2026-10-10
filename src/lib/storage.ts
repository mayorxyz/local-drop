/**
 * Storage module: device name management, localStorage persistence
 */

const DEVICE_NAME_KEY = 'localdrop_device_name';
const THEME_KEY = 'localdrop_theme';

// Adjective-noun combinations for random device names
const ADJECTIVES = [
  'Blue', 'Red', 'Green', 'Swift', 'Bright', 'Cool', 'Fast', 'Wild',
  'Calm', 'Bold', 'Keen', 'Warm', 'Dark', 'Light', 'Pure', 'Deep'
];

const NOUNS = [
  'Fox', 'Wolf', 'Hawk', 'Bear', 'Lynx', 'Deer', 'Owl', 'Raven',
  'Tiger', 'Eagle', 'Falcon', 'Panda', 'Otter', 'Dolphin', 'Phoenix', 'Dragon'
];

/**
 * Generate a random device name like "Blue-Fox"
 */
export function generateDeviceName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}-${noun}`;
}

/**
 * Get device name from localStorage, or generate and save a new one
 */
export function getDeviceName(): string {
  const stored = localStorage.getItem(DEVICE_NAME_KEY);
  if (stored) return stored;
  
  const name = generateDeviceName();
  localStorage.setItem(DEVICE_NAME_KEY, name);
  return name;
}

/**
 * Update device name in localStorage
 */
export function setDeviceName(name: string): void {
  localStorage.setItem(DEVICE_NAME_KEY, name);
}

/**
 * Get theme preference from localStorage
 */
export function getThemePreference(): 'dark' | 'light' | 'system' {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'dark' || stored === 'light' || stored === 'system') {
    return stored;
  }
  return 'system';
}

/**
 * Set theme preference in localStorage
 */
export function setThemePreference(theme: 'dark' | 'light' | 'system'): void {
  localStorage.setItem(THEME_KEY, theme);
}

/**
 * Request persistent storage on first run
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage || !navigator.storage.persist) {
    return false;
  }
  
  try {
    const persisted = await navigator.storage.persist();
    return persisted;
  } catch {
    return false;
  }
}
