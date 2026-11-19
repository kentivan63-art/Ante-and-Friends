import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

const STORAGE_BACKEND_KEY = 'ante_backend_url';

export function isNativeMobile(): boolean {
  return Capacitor.isNativePlatform();
}

export function getBackendBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    const stored = window.localStorage?.getItem(STORAGE_BACKEND_KEY)?.trim();
    if (stored) {
      return stored.replace(/\/+$/, '');
    }
    if (!isNativeMobile()) {
      return window.location.origin;
    }
  }

  return '';
}

export function setCustomBackendUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const cleaned = url.trim().replace(/\/+$/, '');
  if (!cleaned) {
    window.localStorage.removeItem(STORAGE_BACKEND_KEY);
  } else {
    window.localStorage.setItem(STORAGE_BACKEND_KEY, cleaned);
  }
}

export function getWebSocketUrl(): string | null {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) {
    return null;
  }

  try {
    const parsed = new URL(baseUrl);
    const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${parsed.host}/ws`;
  } catch {
    if (typeof window !== 'undefined' && !isNativeMobile()) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}/ws`;
    }
    return null;
  }
}

export function getInviteShareText(roomCode: string): string {
  const baseUrl = getBackendBaseUrl();
  if (baseUrl && !baseUrl.startsWith('capacitor://')) {
    return `${baseUrl}?room=${roomCode}`;
  }
  return roomCode;
}

export async function initMobileShell(): Promise<void> {
  if (!isNativeMobile()) return;

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#071914' });
    }
  } catch {
    // Ignore on platforms/versions where StatusBar plugin is unavailable
  }

  try {
    await SplashScreen.hide();
  } catch {
    // Ignore if splash screen already hidden
  }
}
