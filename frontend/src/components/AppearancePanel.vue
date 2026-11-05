<script setup lang="ts">
import { appearances } from '../../shared/appearance';
const themes = appearances.filter(item => ['amber','classic','night'].includes(item.id));
defineProps<{theme:string;error:string}>();
const emit=defineEmits<{(event:'change',theme:string):void}>();
</script>
<template><section class="appearance-panel"><p class="feature-kicker">把界面，调成你的习惯</p><h2>选择你喜欢的样子。</h2><p class="feature-muted">切换立即生效，下次打开记住本设备的选择。</p><div class="appearance-options"><button v-for="item in themes" :key="item.id" :class="['appearance-option','preview-'+item.id,{chosen:theme===item.id}]" :aria-pressed="theme===item.id" @click="emit('change',item.id)"><span class="appearance-preview"><span class="preview-sidebar"></span><span class="preview-lines"><i></i><i></i><i></i></span></span><strong>{{item.name}} {{theme===item.id?'✓':''}}</strong><span>{{item.description}}</span></button></div><p v-if="error" class="feature-error" role="alert">{{error}}</p></section></template>
<style scoped src="../../shared/people-display.css"></style>
