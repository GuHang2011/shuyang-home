<script setup lang="ts">
import { type Row } from '../../../shared/domain';
import { api } from '../platform';
import { useBusinessFiles, fileInstructions, fileStatuses } from '../../../shared/useBusinessFiles';
import { chooseBusinessWorkbook, saveBusinessWorkbook, printBusinessReport } from '../businessFilesPlatform';
const props = defineProps<{ user: Row | null }>();
const { kinds, events, kind, eventId, query, status, report, preview, filename, confirmed, busy, loading, error, message, page, rows, pages, canCommit, allowed, selection, selectKind, loadOptions, loadReport, download, printReport, chooseFile, commit } = useBusinessFiles(() => props.user, api, saveBusinessWorkbook, printBusinessReport);
function selectEvent(event: any) { eventId.value = events.value[Number(event.detail.value)]?.id || '';loadReport(); }
function selectStatus(event: any) { status.value = [{ id: 'all' }, ...(fileStatuses[kind.value] || [])][Number(event.detail.value)].id;loadReport(); }
function toggleConfirmed(event: any) { confirmed.value = !!event.detail.value; }
</script>
<template>
  <view v-if="allowed" class="business-files">
    <view class="title">业务文件中心</view><view class="intro">筛选后导出与打印，批量更新先预览再确认。</view>
    <view v-if="error" class="error">{{ error }}<button :disabled="busy || loading" @click="kinds.length ? loadReport() : loadOptions()">重新加载报表</button></view><view v-if="message" class="success-note">{{ message }}</view>
    <view class="button-row file-kinds"><button v-for="item in kinds" :key="item.id" :disabled="busy" :class="{ selected: kind === item.id }" @click="selectKind(item.id)">{{ item.label }}</button></view>
    <view v-if="kind" class="panel">
      <picker v-if="kind === 'signups'" :disabled="busy" :range="events" range-key="title" @change="selectEvent"><view class="file-picker">活动：{{ events.find(item => item.id === eventId)?.title || '点击选择活动' }} ▾</view></picker>
      <input v-model="query" class="search" :disabled="busy" maxlength="80" placeholder="搜索姓名、编号或报表内容" @confirm="loadReport"/>
      <picker :disabled="busy" :range="[{ id: 'all', label: '全部' }, ...(fileStatuses[kind] || [])]" range-key="label" @change="selectStatus"><view class="file-picker">状态：{{ fileStatuses[kind]?.find(item => item.id === status)?.label || '全部' }} ▾</view></picker>
      <button class="outline" :disabled="busy || loading || !selection" @click="loadReport">查询 / 刷新</button>
      <view class="button-row"><button class="primary" :disabled="busy || loading || !report" @click="download()">导出 Excel</button>
        <!-- #ifdef H5 --><button class="outline" :disabled="busy || loading || !report" @click="printReport">打印 / 保存 PDF</button><!-- #endif -->
        <!-- #ifdef MP-WEIXIN --><button class="outline" :disabled="busy || loading || !report" @click="download()">导出供打印</button><!-- #endif -->
      </view>
      <!-- #ifdef MP-WEIXIN --><view class="safe-note">微信不提供直接打印接口。导出后可在文档菜单保存或转发，再用办公软件打印。</view><!-- #endif -->
      <view v-if="loading" class="intro">正在加载…</view><view v-else-if="!report" class="intro">{{ kind === 'signups' && !eventId ? '选择活动后查看报名名单。' : '查询当前筛选结果后即可导出和打印。' }}</view>
      <template v-if="report"><view class="report-title">{{ report.title }} · {{ report.total }} 条</view><view class="intro">导出／打印全部筛选结果，屏幕每页显示20条。{{ report.generatedAt }}（北京时间）</view>
        <scroll-view scroll-x class="file-table"><view class="file-table-inner"><view class="file-row heading"><view v-for="header in report.headers" :key="header" class="file-cell">{{ header }}</view></view><view v-for="(row, i) in rows" :key="i" class="file-row"><view v-for="(cell, j) in row" :key="j" class="file-cell">{{ cell || '—' }}</view></view></view></scroll-view>
        <view v-if="!report.total" class="intro">没有符合条件的记录。</view><view v-else class="file-pager"><button :disabled="page <= 1" @click="page--">上一页</button><text>{{ page }} / {{ pages }}</text><button :disabled="page >= pages" @click="page++">下一页</button></view>
      </template>
    </view>
    <view v-if="kind" class="panel file-import"><view class="section-title">Excel 导入</view><view class="intro">{{ fileInstructions[kind] }}</view><view class="safe-note">使用专用 .xlsx 模板，单工作表、纯文本单元格，最多500行、2MB。导出的报表不作为导入模板。</view>
      <view class="button-row"><button class="outline" :disabled="busy" @click="download(true)">下载导入模板</button><button class="primary" :disabled="busy || !selection" @click="chooseFile(chooseBusinessWorkbook)">选择文件并预览</button></view>
      <view v-if="busy" class="intro">正在处理，请稍候…</view><view v-if="filename" class="filename">文件：{{ filename }}</view>
      <template v-if="preview"><view class="report-title">导入预览：{{ preview.total }} 行，更新 {{ preview.changes }} 条，问题 {{ preview.invalid }} 行</view><view v-if="preview.invalid" class="error">尚未写入业务数据。请修正问题后重新选择文件。</view>
        <scroll-view scroll-y class="import-lines"><view v-for="line in preview.lines" :key="line.line" class="import-line" :class="{ invalid: line.error }"><view>第 {{ line.line }} 行 · {{ line.name || '待核对记录' }}</view><view>{{ line.error || (line.changed ? '校验通过，等待确认' : '数据相同，无需修改') }}</view><view v-for="(value, key) in line.values" :key="key" class="line-value">{{ key }}：{{ value || '（空）' }}</view></view></scroll-view>
        <template v-if="!preview.invalid && preview.changes"><view class="safe-note">预览有效期10分钟；提交时再次检查，整批成功或整批不写入。</view><switch :checked="confirmed" :disabled="busy" @change="toggleConfirmed"/><text class="confirm-copy">我已核对全部内容，并确认会员参与意愿或资料修改授权</text><button class="primary" :disabled="!canCommit" @click="commit">确认导入 {{ preview.changes }} 条</button></template>
      </template>
    </view>
  </view>
</template>
<style scoped>
.business-files{min-width:0}.file-kinds{display:flex;flex-wrap:wrap}.file-kinds button{margin:0;min-height:44px;font-size:14px}.file-kinds .selected{background:#294657;color:#fff}.file-picker{padding:12px;border:1px solid #deded4;border-radius:10px;margin-bottom:12px;overflow-wrap:anywhere;font-size:14px;min-height:44px;box-sizing:border-box}.business-files button{min-height:44px;white-space:normal;font-size:14px}.business-files .button-row{display:flex;gap:8px;flex-wrap:wrap}.button-row button{flex:1;min-width:100px}.report-title{font-weight:600;font-size:15px;margin:12px 0;overflow-wrap:anywhere}.file-table{width:100%;border:1px solid #e1e7e5;border-radius:8px;box-sizing:border-box}.file-table-inner{display:inline-block;min-width:100%}.file-row{display:flex;align-items:stretch}.file-cell{width:130px;flex-shrink:0;box-sizing:border-box;padding:8px;border-bottom:1px solid #e1e7e5;font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}.heading{background:#eef2ee;font-weight:600}.file-pager{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:12px;font-size:13px}.file-pager button{margin:0;padding:8px}.import-lines{max-height:340px}.import-line{border:1px solid #dce5de;border-radius:10px;padding:10px;margin:10px 0;font-size:13px}.import-line.invalid{border-color:#b54837;background:#fff7f4}.line-value{font-size:12px;color:#62747d;margin-top:5px;white-space:pre-wrap;overflow-wrap:anywhere}.filename{font-size:13px;overflow-wrap:anywhere}.success-note{padding:12px;border-radius:10px;background:#e7f3e9;color:#24613b}.confirm-copy{font-size:13px;line-height:1.8}.file-import>.primary{margin-top:14px}.business-files .search{width:100%;box-sizing:border-box}
</style>
