<script setup lang="ts">
import { ref } from 'vue';
import { ElAlert, ElButton, ElCard, ElCheckbox, ElForm, ElFormItem, ElInput, ElOption, ElPagination, ElSelect, ElStep, ElSteps, ElTabPane, ElTable, ElTableColumn, ElTabs, ElTag, ElUpload, type UploadFile, type UploadInstance } from 'element-plus';
import { type Row } from '../../shared/domain';
import { api } from '../api';
import { useBusinessFiles, fileInstructions, fileStatuses } from '../../shared/useBusinessFiles';
import { readWebWorkbook, saveWebWorkbook, printWebReport } from '../../shared/businessFilesBrowser';
const props = defineProps<{ user: Row | null }>();
const emit = defineEmits<{ (event: 'updated'): void }>();
const { kinds, events, kind, eventId, query, status, report, preview, filename, confirmed, busy, loading, error, message, page, rows, pages, canCommit, allowed, selection, selectKind, loadOptions, loadReport, download, printReport, chooseFile, commit } = useBusinessFiles(() => props.user, api, saveWebWorkbook, printWebReport, () => emit('updated'));
const uploadRef = ref<UploadInstance>();
async function selected(file: UploadFile) { if (file.raw) await chooseFile(() => readWebWorkbook(file.raw!));uploadRef.value?.clearFiles(); }
</script>
<template>
  <ElCard shadow="never" class="business-files element-surface" v-if="allowed" aria-label="业务文件中心">
    <template #header><div class="data-heading"><div><h2>文件导入、导出与打印</h2><p>选择业务数据，筛选后导出或打印；批量更新请先下载对应模板。</p></div><ElTag type="info" effect="plain">Excel / PDF</ElTag></div></template>
    <ElAlert v-if="error" type="error" :closable="false" show-icon><template #title>{{ error }}</template><ElButton type="primary" link :disabled="busy || loading" @click="kinds.length ? loadReport() : loadOptions()">重新加载报表</ElButton></ElAlert>
    <ElAlert v-if="message" :title="message" type="success" :closable="false" show-icon role="status" />
    <ElTabs class="file-kinds" :model-value="kind" @tab-change="selectKind(String($event))" aria-label="数据类型"><ElTabPane v-for="item in kinds" :key="item.id" :name="item.id" :label="item.label" :disabled="busy" /></ElTabs>
    <ElForm v-if="kind" class="file-filters" label-position="top" :disabled="busy" @submit.prevent="loadReport">
      <ElFormItem v-if="kind === 'signups'" label="活动"><ElSelect v-model="eventId" aria-label="活动" placeholder="请选择活动" filterable @change="loadReport"><ElOption v-for="event in events" :key="event.id" :value="event.id" :label="event.title" /></ElSelect></ElFormItem>
      <ElFormItem label="搜索"><ElInput v-model="query" clearable maxlength="80" placeholder="姓名、编号或报表内容" /></ElFormItem>
      <ElFormItem label="状态"><ElSelect v-model="status" aria-label="状态" @change="loadReport"><ElOption value="all" label="全部" /><ElOption v-for="item in fileStatuses[kind]" :key="item.id" :value="item.id" :label="item.label" /></ElSelect></ElFormItem>
      <ElButton native-type="submit" type="primary" plain :disabled="busy || loading || !selection">查询 / 刷新</ElButton>
    </ElForm>
    <div class="file-actions"><ElButton type="primary" :disabled="busy || loading || !report" @click="download()">导出 Excel</ElButton><ElButton :disabled="busy || loading || !report" @click="printReport">打印 / 保存 PDF</ElButton></div>
    <p v-if="loading" role="status">正在加载…</p><p v-else-if="!report" class="data-caption">{{ kind === 'signups' && !eventId ? '选择活动后查看报名名单。' : '点击查询，载入当前筛选结果后即可导出和打印。' }}</p>
    <template v-if="report"><p class="report-summary">{{ report.title }} · 共 {{ report.total }} 条 · {{ report.generatedAt }}（北京时间）</p><p class="data-caption">导出和打印包含当前筛选的全部 {{ report.total }} 条记录。</p>
      <ElTable table-layout="auto" flexible class="file-table" :data="rows" stripe border empty-text="没有符合条件的记录。" aria-label="业务报表，可横向滚动"><ElTableColumn v-for="(heading, index) in report.headers" :key="heading" :label="heading" :min-width="heading.length > 8 ? 190 : 140"><template #default="scope">{{ scope.row[index] || '—' }}</template></ElTableColumn></ElTable>
      <div v-if="report.total" class="file-pager"><span>第 {{ page }} / {{ pages }} 页</span><ElPagination v-model:current-page="page" :page-size="20" :total="report.total" layout="prev, pager, next" prev-text="上一页" next-text="下一页" background /></div>
    </template>
    <section v-if="kind" class="file-import" aria-label="Excel 导入">
      <h3>{{ kinds.find(item => item.id === kind)?.label }}导入</h3><p>{{ fileInstructions[kind] }}</p>
      <ElSteps :active="preview ? 2 : filename ? 1 : 0" simple class="import-steps"><ElStep title="下载模板" /><ElStep title="选择并预览" /><ElStep title="核对后导入" /></ElSteps>
      <p class="data-caption">仅接收本页模板的 .xlsx 文件，单工作表、纯文本单元格，最多500行、2MB。报表含只读信息，导入时请使用专用模板。</p>
      <div class="file-actions"><ElButton :disabled="busy" @click="download(true)">下载导入模板</ElButton><ElUpload ref="uploadRef" action="#" :auto-upload="false" :show-file-list="false" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" :disabled="busy || !selection" :on-change="selected"><ElButton type="primary" :disabled="busy || !selection">选择文件并预览</ElButton></ElUpload></div>
      <p v-if="busy" role="status">正在处理，请稍候…</p><p v-if="filename" class="filename">文件：{{ filename }}</p>
      <template v-if="preview"><h4>导入预览</h4><p>共 {{ preview.total }} 行，将更新 {{ preview.changes }} 条，发现 {{ preview.invalid }} 行问题。</p><ElAlert v-if="preview.invalid" type="error" :closable="false" show-icon title="尚未写入任何业务数据。请修正以下问题后重新选择文件。" />
        <ol class="import-lines"><li v-for="line in preview.lines" :key="line.line" :class="{ invalid: line.error }"><strong>第 {{ line.line }} 行 · {{ line.name || '待核对记录' }}</strong><span>{{ line.error || (line.changed ? '校验通过，等待确认' : '数据相同，无需修改') }}</span><dl><template v-for="(value, key) in line.values" :key="key"><dt>{{ key }}</dt><dd>{{ value || '（空）' }}</dd></template></dl></li></ol>
        <template v-if="!preview.invalid && preview.changes"><p class="data-caption">预览有效期10分钟；提交时再次校验。任何一行不满足条件，整批都不会写入。</p><ElCheckbox v-model="confirmed" :disabled="busy" class="import-confirmation">我已核对全部内容，并确认相关会员的参与意愿或资料修改授权</ElCheckbox><ElButton type="primary" :disabled="!canCommit" @click="commit">确认导入 {{ preview.changes }} 条</ElButton></template>
      </template>
    </section>
  </ElCard>
</template>
