<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { ElButton, ElCard, ElEmpty, ElForm, ElFormItem, ElInput, ElOption, ElPagination, ElSelect, ElTable, ElTableColumn, ElTag } from 'element-plus';
import { type Row, roleNames, statusNames } from '../../shared/domain';
const props = defineProps<{ members: Row[]; total: number; query: string; status: string; role: string; loading: boolean }>();
const emit = defineEmits<{ (event: 'update:query', value: string): void; (event: 'update:status', value: string): void; (event: 'detail', kind: string, member: Row): void }>();
const compact = ref(window.matchMedia('(max-width: 700px)').matches);
const compactMedia = window.matchMedia('(max-width: 700px)');
const updateCompact = () => { compact.value = compactMedia.matches; };
onMounted(() => compactMedia.addEventListener('change', updateCompact));
onUnmounted(() => compactMedia.removeEventListener('change', updateCompact));
const page = ref(1), pageSize = 20;
watch(() => [props.query, props.status], () => { page.value = 1; });
watch(() => props.members.length, count => { page.value = Math.min(page.value, Math.max(1, Math.ceil(count / pageSize))); });
const rows = computed(() => props.members.slice((page.value - 1) * pageSize, page.value * pageSize));
const canManage = computed(() => ['superadmin', 'admin'].includes(props.role));
const stateType = (member: Row) => !member.enabled ? 'info' : member.status === 'approved' ? 'success' : member.status === 'pending' ? 'warning' : 'danger';
function review(member: Row) { emit('detail', 'reviewMember', { ...member, status: 'approved', note: '' }); }
</script>
<template>
  <ElCard shadow="never" class="member-management element-surface" aria-label="会员资料管理" :aria-busy="loading">
    <template #header><div class="data-heading"><div><h2>会员资料管理</h2><p>查看会员资料，处理入会申请与账号权限。</p></div><ElTag type="info" effect="plain">共 {{ total }} 个账号</ElTag></div></template>
    <ElForm class="management-filters" label-position="top" @submit.prevent>
      <ElFormItem label="查找会员"><ElInput :model-value="query" @update:model-value="emit('update:query', $event)" clearable maxlength="80" placeholder="姓名、手机、会员编号、地区" aria-label="搜索管理会员" /></ElFormItem>
      <ElFormItem label="申请与账号状态"><ElSelect :model-value="status" @update:model-value="emit('update:status', $event)" aria-label="会员状态筛选"><ElOption label="全部会员" value="全部" /><ElOption label="待审核" value="pending" /><ElOption label="已通过" value="approved" /><ElOption label="已退回" value="rejected" /><ElOption label="已停用" value="disabled" /></ElSelect></ElFormItem>
      <ElButton @click="emit('update:query', ''); emit('update:status', '全部')">重置筛选</ElButton>
    </ElForm>
    <p class="data-caption" role="status">{{ loading ? '正在更新资料…' : `找到 ${members.length} 个账号` }}</p>
    <ElTable table-layout="auto" v-if="!compact" flexible class="member-table" :data="rows" row-key="id" stripe border empty-text="没有符合条件的会员，请调整筛选条件。">
      <ElTableColumn label="会员 / 联系方式" min-width="190"><template #default="{ row }"><b>{{ row.name }}</b><small>{{ row.phone || row.username }}</small><small>{{ row.memberNo || '尚无会员编号' }}</small></template></ElTableColumn>
      <ElTableColumn label="家乡 / 现居地" min-width="170"><template #default="{ row }">{{ row.hometown || '—' }}<small>{{ row.district || '—' }}</small></template></ElTableColumn>
      <ElTableColumn label="申请状态" min-width="110"><template #default="{ row }"><ElTag :type="stateType(row)">{{ statusNames[row.status] }}</ElTag></template></ElTableColumn>
      <ElTableColumn label="角色 / 账号" min-width="120"><template #default="{ row }">{{ roleNames[row.role] }}<small>{{ row.enabled ? '已启用' : '已停用' }}</small></template></ElTableColumn>
      <ElTableColumn label="操作" min-width="230"><template #default="{ row }"><div class="member-actions"><ElButton type="primary" link @click="emit('detail', 'memberDetail', row)">资料</ElButton><ElButton v-if="row.status === 'pending'" type="primary" link @click="review(row)">审核申请</ElButton><ElButton v-if="canManage" type="primary" link @click="emit('detail', 'access', row)">权限</ElButton><ElButton v-if="canManage" type="primary" link @click="emit('detail', 'reset', { ...row, password: '' })">重置密码</ElButton></div></template></ElTableColumn>
    </ElTable>
    <div v-else class="member-mobile-list"><ElEmpty v-if="!rows.length" description="没有符合条件的会员，请调整筛选条件。" :image-size="64" /><article v-for="member in rows" :key="member.id" class="member-mobile-row"><div class="data-heading"><b>{{ member.name }}</b><ElTag :type="stateType(member)">{{ statusNames[member.status] }}</ElTag></div><p>{{ member.phone || member.username }} · {{ roleNames[member.role] }} · {{ member.enabled ? '已启用' : '已停用' }}</p><p>{{ member.memberNo || '尚无会员编号' }}</p><p>{{ member.hometown || '—' }} / {{ member.district || '—' }}</p><div class="member-actions"><ElButton type="primary" plain @click="emit('detail', 'memberDetail', member)">资料</ElButton><ElButton v-if="member.status === 'pending'" type="primary" plain @click="review(member)">审核申请</ElButton><ElButton v-if="canManage" @click="emit('detail', 'access', member)">权限</ElButton><ElButton v-if="canManage" @click="emit('detail', 'reset', { ...member, password: '' })">重置密码</ElButton></div></article></div>
    <ElPagination v-if="members.length" v-model:current-page="page" :page-size="pageSize" :total="members.length" layout="prev, pager, next" background class="data-pagination" />
  </ElCard>
</template>
