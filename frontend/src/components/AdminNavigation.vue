<script setup lang="ts">
import { computed } from 'vue';
import { ElButton, ElTabPane, ElTabs, ElTag } from 'element-plus';
import { forumEnabled } from '../../shared/features';
const props = defineProps<{ modelValue: string; role: string; memberCount: number; pendingCount: number }>();
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void; (event: 'navigate', value: string): void }>();
const groups = computed(() => [
  { id: 'member', label: '会员服务', tabs: [{ id: 'members', label: '会员与入会' }, { id: 'posts', label: '互助审核' }] },
  { id: 'content', label: '内容与活动', tabs: [{ id: 'activities', label: '活动发起审核' }, ...(forumEnabled ? [{ id: 'forum', label: '论坛管理' }] : []), { id: 'polls', label: '投票管理' }] },
  { id: 'operation', label: '运营协作', tabs: [{ id: 'crowdfunding', label: '众筹审核' }, { id: 'ads', label: '广告管理' }, { id: 'resources', label: '资源管理' }] },
  { id: 'data', label: '数据管理', tabs: [{ id: 'files', label: '文件与打印' }, ...(['superadmin', 'admin'].includes(props.role) ? [{ id: 'audit', label: '操作日志' }] : [])] }
]);
const active = computed(() => groups.value.find(group => group.tabs.some(tab => tab.id === props.modelValue)) || groups.value[0]);
function selectGroup(name: string | number) { const group = groups.value.find(item => item.id === name);if (group && group.id !== active.value.id) emit('update:modelValue', group.tabs[0].id); }
</script>
<template>
  <section class="workspace-navigation element-surface" aria-label="工作台功能导航">
    <div class="workspace-overview"><div><span class="workspace-kicker">管理概览</span><p>服务每一位家人，让日常事务井然有序。</p></div><div class="workspace-counts"><ElTag type="info" effect="plain">会员账号 {{ memberCount }}</ElTag><ElTag :type="pendingCount ? 'warning' : 'success'" effect="light">待处理 {{ pendingCount }}</ElTag></div></div>
    <ElTabs :model-value="active.id" class="workspace-groups" @tab-change="selectGroup" aria-label="工作台分类"><ElTabPane v-for="group in groups" :key="group.id" :label="group.label" :name="group.id" /></ElTabs>
    <div class="workspace-subnav"><ElTabs :model-value="modelValue" @tab-change="emit('update:modelValue', String($event))" aria-label="管理模块"><ElTabPane v-for="tab in active.tabs" :key="tab.id" :label="tab.label" :name="tab.id" /></ElTabs><div class="workspace-shortcuts"><ElButton text type="primary" @click="emit('navigate', 'events')">活动管理 ↗</ElButton><ElButton text type="primary" @click="emit('navigate', 'notices')">公告管理 ↗</ElButton></div></div>
  </section>
</template>
