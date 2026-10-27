<script setup lang="ts">
const props = defineProps<{ modelValue: string; label: string }>();
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>();
function date(event: any) { emit('update:modelValue', event.detail.value + 'T' + (props.modelValue?.slice(11, 16) || '09:00')); }
function time(event: any) { emit('update:modelValue', (props.modelValue?.slice(0, 10) || new Date().toISOString().slice(0, 10)) + 'T' + event.detail.value); }
</script>
<template><view class="field"><text class="field-label">{{ label }}（北京时间）</text><view class="row"><picker mode="date" :value="modelValue?.slice(0, 10)" @change="date"><view class="outline small">{{ modelValue?.slice(0, 10) || '选择日期' }}</view></picker><picker mode="time" :value="modelValue?.slice(11, 16)" @change="time"><view class="outline small">{{ modelValue?.slice(11, 16) || '选择时间' }}</view></picker></view></view></template>
