<script setup lang="ts">
import { ref } from 'vue';
import { appearances, type Appearance } from '../../../shared/appearance';
defineProps<{ value: Appearance; notice: string }>();
const emit = defineEmits<{ (event: 'select', value: Appearance): void }>();
const expanded = ref(false);
</script>
<template><view class="appearance-mobile"><view class="appearance-mobile-bar"><text>界面外观</text><button class="outline small" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? '收起换肤' : '换肤' }}</button></view><view v-if="expanded" class="appearance-mobile-panel"><view class="appearance-caption">立即生效，仅记住这台设备的选择。</view><view class="appearance-options"><button v-for="item in appearances" :key="item.id" :class="['appearance-option','skin-' + (item.id === 'system' ? 'classic' : item.id), { chosen: value === item.id }]" :aria-pressed="value === item.id" @click="emit('select', item.id)"><view class="appearance-swatch"/><text class="appearance-name">{{ item.name }}</text><text class="appearance-description">{{ item.description }}</text><text v-if="value === item.id" class="appearance-selected">已选</text></button></view><view v-if="notice" class="appearance-notice">{{ notice }}</view></view></view></template>
