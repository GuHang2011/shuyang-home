import { computed, onMounted, onUnmounted, ref } from 'vue';

export const appearanceKey = 'shuyang_home_appearance';
export const appearances = [
  { id: 'classic', name: '简洁商务', description: '熟悉的蓝金配色' },
  { id: 'forest', name: '竹青', description: '清爽的绿色界面' },
  { id: 'amber', name: '温暖乡情', description: '米白、深蓝与暖金，熟悉的乡情' },
  { id: 'night', name: '深色', description: '柔和的深色界面' },
  { id: 'system', name: '跟随系统', description: '自动切换经典与夜间' }
] as const;
export type Appearance = typeof appearances[number]['id'];
export type Skin = Exclude<Appearance, 'system'>;
export function validAppearance(value: unknown): Appearance { return appearances.some(item => item.id === value) ? value as Appearance : 'classic'; }
export function useAppearance(adapter: {
  read: () => unknown;
  write: (value: Appearance) => void;
  dark: () => boolean;
  apply: (skin: Skin) => void;
  subscribe?: (changed: (dark: boolean) => void, stored: (value: unknown) => void) => () => void;
}) {
  const choice = ref<Appearance>('classic'), dark = ref(false), notice = ref('');let release: (() => void) | undefined;
  try { choice.value = validAppearance(adapter.read()); } catch { notice.value = '当前环境无法读取外观设置，已使用经典主题。'; }
  try { dark.value = adapter.dark(); } catch { dark.value = false; }
  const skin = computed<Skin>(() => choice.value === 'system' ? (dark.value ? 'night' : 'classic') : choice.value);
  const apply = () => adapter.apply(skin.value);
  function select(value: unknown) {
    choice.value = validAppearance(value);notice.value = '';
    try { adapter.write(choice.value); } catch { notice.value = '主题已应用；当前环境无法保存，重新打开后可能需要再次选择。'; }
    apply();
  }
  apply();
  onMounted(() => { release = adapter.subscribe?.(value => { dark.value = value;apply(); }, value => { choice.value = validAppearance(value);apply(); }); });
  onUnmounted(() => release?.());
  return { choice, skin, notice, select };
}
