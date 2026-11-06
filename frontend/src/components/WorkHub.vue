<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { ElAlert } from 'element-plus/es/components/alert/index';
import { ElButton } from 'element-plus/es/components/button/index';
import { ElEmpty } from 'element-plus/es/components/empty/index';
import { ElForm, ElFormItem } from 'element-plus/es/components/form/index';
import { ElInput } from 'element-plus/es/components/input/index';
import { ElOption, ElSelect } from 'element-plus/es/components/select/index';
import { ElPagination } from 'element-plus/es/components/pagination/index';
import { ElTag } from 'element-plus/es/components/tag/index';
import { type Row, formatTime, postCategories } from '../../shared/domain';
import { useWorkCenter, workKinds, type WorkMode } from '../../shared/useWorkCenter';
import { api } from '../api';
const props = defineProps<{ user: Row | null; mode: WorkMode; target?: Row | null }>();
const emit = defineEmits<{ (e: 'updated'): void; (e: 'navigate', target: Row): void; (e: 'join'): void }>();
const { rows, total, page, pages, counts, filter, kind, filters, loading, busy, error, detailError, message, selected, pending, form, editing, editForm, opening, target, allowed, load, open, clearDetail, choose, edit, submit, markRead, selectFilter, selectKind, turn } = useWorkCenter(() => props.user, () => props.mode, api, () => emit('updated'));
const heading = computed(() => props.mode === 'mine' ? '我的事项' : props.mode === 'manage' ? '管理待办总览' : '业务通知');
const detailPanel = ref<HTMLElement | null>(null);
async function openItem(row: Row) { await open(row);await nextTick();detailPanel.value?.focus();detailPanel.value?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
watch(() => props.target, value => { if (value) openItem(value); }, { immediate: true });
function value(row: Row) { return row.label.includes('北京时间') ? formatTime(row.value) + ' · 北京时间' : row.value; }
</script>
<template>
  <section class="work-hub element-surface" :aria-label="heading">
    <header class="work-heading"><div><span class="work-kicker">沭阳之家 · 让事情有着落</span><h2>{{ heading }}</h2><p>{{ mode === 'mine' ? '进度集中看，下一步直接办。' : mode === 'manage' ? '按等待时间处理；这里只展示你有权处理的事项。' : '审核与业务变化在这里查看。已读不代表事项已经办完。' }}</p></div><ElButton :disabled="loading || busy || !allowed" @click="load">刷新列表</ElButton></header>
    <ElAlert v-if="message" :title="message" type="success" :closable="false" show-icon />
    <ElEmpty v-if="!allowed" description="登录后查看你的事项与通知"><ElButton type="primary" @click="emit('join')">登录账号</ElButton></ElEmpty>
    <template v-else>
      <section v-if="target" ref="detailPanel" class="work-detail" tabindex="-1" aria-label="事项详情">
        <ElButton :disabled="busy" @click="clearDetail">返回列表</ElButton><p v-if="opening" role="status">正在核对事项当前状态…</p>
        <ElAlert v-if="detailError" :title="detailError" type="error" :closable="false" show-icon />
        <ElButton v-if="detailError && !busy" @click="openItem(target)">重新加载详情</ElButton>
        <template v-if="selected"><div class="work-title"><h3>{{ selected.title }}</h3><ElTag>{{ selected.state }}</ElTag></div>
          <dl><div v-for="(field,index) in selected.fields" :key="index"><dt>{{ field.label }}</dt><dd>{{ value(field) }}</dd></div></dl>
          <div v-if="!pending && !editing" class="work-actions"><ElButton v-for="action in selected.actions" :key="action.label" :disabled="busy" type="primary" plain @click="choose(action)">{{ action.label }}</ElButton><ElButton v-if="selected.editForm" @click="edit">修改内容／续期</ElButton><ElButton v-if="selected.navigate" @click="emit('navigate', selected)">{{ selected.navigate === 'life' ? '查看服务与处理进度' : selected.navigate === 'profile' ? '修改会员资料' : selected.navigate === 'forum' ? '查看论坛原内容' : '前往签到' }}</ElButton></div>
          <ElForm v-if="pending" label-position="top" class="work-confirm" @submit.prevent="submit"><h3>{{ pending.label }}</h3><p>{{ pending.hint || '请核对当前记录后确认操作。' }}</p><ElFormItem v-if="pending.field" :label="pending.hint"><ElInput v-model="form[pending.field]" type="textarea" :maxlength="pending.max" :aria-label="pending.hint" :rows="3" show-word-limit /></ElFormItem><div class="work-actions"><ElButton type="primary" native-type="submit" :loading="busy">确认操作</ElButton><ElButton :disabled="busy" @click="pending = null">返回</ElButton></div></ElForm>
          <ElForm v-if="editing" label-position="top" class="work-confirm" @submit.prevent="submit"><h3>修改互助信息</h3><p>修改提交审核；审核通过前保留原公开内容。</p><ElFormItem label="标题"><ElInput v-model="editForm.title" aria-label="互助标题" maxlength="80" /></ElFormItem><ElFormItem label="分类"><ElSelect v-model="editForm.category" aria-label="互助分类"><ElOption v-for="item in postCategories" :key="item" :label="item" :value="item" /></ElSelect></ElFormItem><ElFormItem label="片区"><ElInput v-model="editForm.district" aria-label="互助片区" maxlength="50" placeholder="例如苏州吴中；无需详细住址" /></ElFormItem><ElFormItem label="内容"><ElInput v-model="editForm.content" type="textarea" aria-label="互助内容" :rows="5" maxlength="3000" show-word-limit /></ElFormItem><ElFormItem label="联系信息（仅审核会员可见）"><ElInput v-model="editForm.contact" aria-label="互助联系信息" maxlength="80" /></ElFormItem><ElFormItem label="有效期"><ElSelect v-model="editForm.validDays" aria-label="互助有效期"><ElOption v-for="days in [7,30,90]" :key="days" :label="days + '天'" :value="days" /></ElSelect></ElFormItem><div class="work-actions"><ElButton type="primary" native-type="submit" :loading="busy">提交修改审核</ElButton><ElButton :disabled="busy" @click="editing = false">取消编辑</ElButton></div></ElForm>
        </template>
      </section>
      <template v-else><div class="work-filters"><div class="work-tabs" aria-label="事项筛选"><ElButton v-for="item in filters" :key="item.id" :type="filter === item.id ? 'primary' : 'default'" :disabled="busy" :aria-pressed="filter === item.id" @click="selectFilter(item.id)">{{ item.label }}<span v-if="mode === 'mine' && counts[item.id] != null"> {{ counts[item.id] }}</span></ElButton></div><ElSelect v-if="mode !== 'notices'" :model-value="kind" aria-label="事项类型" :disabled="busy" @change="selectKind"><ElOption v-for="item in workKinds" :key="item.id" :label="item.label" :value="item.id" /></ElSelect><ElButton v-else :disabled="busy || loading || !!error || !total" @click="markRead()">将本次查询之前的通知标为已读</ElButton></div>
        <ElAlert v-if="error" :title="error" type="error" :closable="false" show-icon /><p v-if="loading" role="status">正在加载…</p><p v-else-if="!error" class="work-count">共 {{ total }} 条</p>
        <ElEmpty v-if="!loading && !error && !rows.length" :description="mode === 'notices' ? '暂无符合条件的通知' : mode === 'manage' ? '当前筛选下没有待办' : '暂无符合条件的事项'" />
        <article v-for="row in rows" :key="row.kind + row.id" class="work-row"><div><ElTag v-if="mode !== 'notices'" effect="plain">{{ row.kindLabel }}</ElTag><ElTag v-else :type="row.read ? 'info' : 'warning'">{{ row.read ? '已读' : '未读' }}</ElTag><h3>{{ row.title || row.message }}</h3><p v-if="row.deadline">安排时间：{{ formatTime(row.deadline) }} · 北京时间</p><p>{{ mode === 'manage' ? '提交于 ' : '更新于 ' }}{{ formatTime(mode === 'manage' ? row.waitingSince : row.updatedAt || row.createdAt) }}</p></div><div class="work-row-actions"><ElTag v-if="row.state">{{ row.state }}</ElTag><ElButton type="primary" plain :disabled="busy" @click="openItem(row)">查看详情</ElButton><ElButton v-if="mode === 'notices' && !row.read" :disabled="busy" @click="markRead(row)">标为已读</ElButton></div></article>
        <ElPagination v-if="pages > 1" :current-page="page" :page-size="20" :total="total" :pager-count="5" layout="prev, pager, next" :disabled="loading || busy" @current-change="turn" />
      </template>
    </template>
  </section>
</template>
<style scoped>
.work-hub{padding:24px;border:1px solid #dce4ed;border-radius:12px;background:#fff;min-width:0;margin:20px 0;color:#303133}.work-heading,.work-title{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.work-heading h2{margin:8px 0;font-size:24px;color:#29495b}.work-heading p,.work-count,.work-row p{color:#606266;font-size:14px;line-height:1.8}.work-kicker{color:#96733b;font-size:12px}.work-filters{display:flex;gap:16px;flex-wrap:wrap;margin:24px 0}.work-tabs,.work-actions,.work-row-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.work-filters>.el-select{width:190px}.work-row{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #ebeef5;padding:20px 0}.work-row>div:first-child{min-width:0;flex:1}.work-row h3,.work-title h3{font-size:18px;line-height:1.6;margin:10px 0;overflow-wrap:anywhere}.work-row-actions{justify-content:flex-end;align-content:center;max-width:250px}.work-detail{scroll-margin-top:85px;margin-top:20px;padding:20px;background:#f8fafc;border:1px solid #dce4ed;border-radius:10px}.work-detail:focus{outline:2px solid #409eff;outline-offset:3px}.work-detail dl>div{display:grid;grid-template-columns:160px minmax(0,1fr);gap:16px;margin:14px 0}.work-detail dt{color:#606266;font-size:14px}.work-detail dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.8}.work-confirm{margin-top:24px;border-top:1px solid #dce4ed;padding-top:20px;max-width:720px}.work-hub :deep(.el-button){min-height:44px;height:auto;margin:0;white-space:normal;line-height:1.5}.work-hub :deep(.el-button>span){white-space:normal}.work-hub :deep(.el-alert){margin:16px 0}.work-hub :deep(.el-pagination){margin-top:20px;justify-content:center}.work-hub :deep(.el-input__wrapper),.work-hub :deep(.el-select__wrapper){min-height:44px}.work-hub :deep(.el-select){max-width:100%}@media(max-width:700px){.work-hub{padding:16px}.work-heading,.work-row,.work-title{flex-direction:column}.work-heading h2{font-size:22px}.work-row-actions{justify-content:flex-start;max-width:none}.work-detail{padding:14px;scroll-margin-top:75px}.work-detail dl>div{grid-template-columns:minmax(0,1fr);gap:4px}.work-filters>.el-select{width:100%}.work-hub :deep(.el-pagination){flex-wrap:wrap;gap:6px}.work-tabs{gap:8px}}
</style>
