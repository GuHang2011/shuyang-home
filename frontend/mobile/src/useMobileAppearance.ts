import { appearanceKey, useAppearance, type Skin } from '../../shared/appearance';
export function useMobileAppearance() {
  return useAppearance({
    read: () => uni.getStorageSync(appearanceKey), write: value => uni.setStorageSync(appearanceKey, value),
    dark: () => {
      // #ifdef H5
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
      // #endif
      // #ifdef MP-WEIXIN
      return uni.getSystemInfoSync().theme === 'dark';
      // #endif
      return false;
    },
    apply(skin: Skin) {
      uni.setNavigationBarColor?.({ frontColor: skin === 'night' ? '#ffffff' : '#000000', backgroundColor: skin === 'night' ? '#17232e' : '#ffffff' });
      // #ifdef H5
      const root = typeof document !== 'undefined' ? document.documentElement : null;if (!root) return;
      root.classList.remove('skin-classic', 'skin-forest', 'skin-amber', 'skin-night', 'custom-skin');
      root.classList.add('skin-surface', 'skin-' + skin);if (skin !== 'classic') root.classList.add('custom-skin');
      root.dataset.skin = skin;root.style.colorScheme = skin === 'night' ? 'dark' : 'light';
      // #endif
    },
    subscribe(changed, stored) {
      // #ifdef H5
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const media = window.matchMedia('(prefers-color-scheme: dark)'), mediaChange = (event: MediaQueryListEvent) => changed(event.matches);
      const storage = (event: StorageEvent) => { if (event.key === appearanceKey || event.key === null) { try { stored(uni.getStorageSync(appearanceKey)); } catch {} } };
      media.addEventListener?.('change', mediaChange);window.addEventListener('storage', storage);
      return () => { media.removeEventListener?.('change', mediaChange);window.removeEventListener('storage', storage); };
      // #endif
      // #ifdef MP-WEIXIN
      const nativeChange = (event: { theme: string }) => changed(event.theme === 'dark');
      uni.onThemeChange(nativeChange);return () => uni.offThemeChange(nativeChange);
      // #endif
    }
  });
}
