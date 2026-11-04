<script setup lang="ts">
import { ref } from 'vue';
import { appearances, type Appearance } from '../../shared/appearance';
defineProps<{ value: Appearance; notice: string }>();
const emit = defineEmits<{ (event: 'select', value: Appearance): void }>();
const dialog = ref<HTMLDialogElement | null>(null);
</script>
<template>
  <button class="appearance-trigger outline small" type="button" @click="dialog?.showModal()">换肤</button>
  <dialog ref="dialog" class="appearance-dialog" aria-labelledby="appearance-title">
    <header class="appearance-header"><div><h2 id="appearance-title">选择界面主题</h2><p>立即生效，仅记住这台设备的选择。</p></div><button type="button" class="outline" aria-label="关闭换肤" @click="dialog?.close()">关闭</button></header>
    <div class="appearance-options" role="group" aria-label="界面主题">
      <button v-for="item in appearances" :key="item.id" type="button" :class="['appearance-option', 'skin-' + (item.id === 'system' ? 'classic' : item.id), { chosen: value === item.id }]" :aria-pressed="value === item.id" @click="emit('select', item.id)"><span class="appearance-swatch" aria-hidden="true"/><strong>{{ item.name }}</strong><small>{{ item.description }}</small><span v-if="value === item.id" class="appearance-selected">已选</span></button>
    </div>
    <p v-if="notice" class="appearance-notice" role="status">{{ notice }}</p>
  </dialog>
</template>
