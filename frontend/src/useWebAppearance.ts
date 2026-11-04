import { appearanceKey, useAppearance, type Skin } from '../shared/appearance';
export function applyWebSkin(skin: Skin) {
  const root = typeof document !== 'undefined' ? document.documentElement : null;if (!root) return;
  root.classList.remove('skin-classic', 'skin-forest', 'skin-amber', 'skin-night', 'custom-skin');
  root.classList.add('skin-surface', 'skin-' + skin);
  if (skin !== 'classic') root.classList.add('custom-skin');
  root.dataset.skin = skin;root.style.colorScheme = skin === 'night' ? 'dark' : 'light';
}
export function useWebAppearance() {
  return useAppearance({
    read: () => localStorage.getItem(appearanceKey), write: value => localStorage.setItem(appearanceKey, value),
    dark: () => window.matchMedia?.('(prefers-color-scheme: dark)').matches || false, apply: applyWebSkin,
    subscribe(changed, stored) {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const theme = (event: MediaQueryListEvent) => changed(event.matches);
      const storage = (event: StorageEvent) => { if (event.key === appearanceKey || event.key === null) stored(event.newValue); };
      media.addEventListener?.('change', theme);window.addEventListener('storage', storage);
      return () => { media.removeEventListener?.('change', theme);window.removeEventListener('storage', storage); };
    }
  });
}
