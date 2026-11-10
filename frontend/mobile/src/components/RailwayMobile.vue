<script setup lang="ts">
import { ref } from 'vue';
import type { Row } from '../../../shared/domain';
import { railwayPlaces, railwayQuestions, railwaySources, railwaySections, railwayReadingSteps, railwayStages, railwayDate, safeRailwayUrl, useRailway } from '../../../shared/railway';
import { RAILWAY_BOARD } from '../../../shared/railwayForum';
import ForumMobile from './ForumMobile.vue';
const props = defineProps<{ notices: Row[]; user: Row | null }>();
const emit = defineEmits<{ (event: 'join'): void }>();
const { section, place, expanded, question, articles, filtered, chooseSection } = useRailway(() => props.notices);
const active = ref('discussion');
let sourceAction = '复制链接';
// #ifdef H5
sourceAction = '查看原文';
// #endif
function openSource(value: string) {
  const url = safeRailwayUrl(value);if (!url) return;
  // #ifdef H5
  window.open(url, '_blank', 'noopener,noreferrer');
  // #endif
  // #ifdef MP-WEIXIN
  uni.setClipboardData({ data: url, fail: () => uni.showToast({title:'复制失败，请重试',icon:'none'}) });
  // #endif
}
</script>
<template>
  <view class="railway-hub railway-mobile">
    <view class="rail-masthead"><view><view class="rail-kicker">沭阳之家 / 淮新高铁论坛</view><view class="rail-page-title">一凡说高铁 <text class="hot-badge">HOT</text></view><view class="rail-lead">聊进展、问接驳，也分享返乡路上的经验。</view></view><!-- #ifdef MP-WEIXIN --><button class="rail-button rail-outline" open-type="share">分享专题 ↗</button><!-- #endif --></view>
    <view class="rail-section-tabs" aria-label="高铁专题栏目"><button v-for="item in railwaySections" :key="item.id" :class="{active:active===item.id}" :aria-pressed="active===item.id" @click="active=item.id">{{ item.label }}<text v-if="item.id==='news'" class="rail-tab-count">{{ articles.length }}</text></button></view>
    <view v-show="active==='discussion'" class="rail-discussion-layout"><view class="rail-discussion-main"><ForumMobile :user="user" :active="active==='discussion'" :board="RAILWAY_BOARD" title="淮新高铁讨论区" intro="提问、分享资料或说说你的看法。新帖与回复审核后公开。" embedded @join="emit('join')"/></view><view class="rail-side"><view class="rail-card"><view class="rail-kicker">发帖前看一眼</view><view class="rail-section-title">让消息有出处</view><view class="rail-reading-list"><view v-for="(step,i) in railwayReadingSteps" :key="step.title" class="rail-reading-item"><view class="rail-reading-title">{{ i+1 }}. {{ step.title }}</view><view class="rail-reading-copy">{{ step.text }}</view></view></view><button class="rail-text-button" @click="active='reference'">查看常见问题与官方入口 →</button></view><view class="rail-side-note"><view class="rail-side-title">在这里怎样交流</view><view class="rail-reading-copy">可上传照片、语音，引用楼层继续讨论。请尊重不同意见，不公开他人的电话号码或个人资料。</view><view class="rail-reading-copy">版主可以审核、置顶、推荐热帖及处理违规内容。</view></view></view></view>
    <view v-show="active==='news'" class="rail-news"><view class="rail-section-head"><view><view class="rail-section-title">资讯与解读</view><view class="rail-caption">整理公开资料，个人解读单独标注。</view></view></view><view class="rail-tabs"><button v-for="item in ['全部','淮新高铁','一凡说高铁']" :key="item" :class="{active:section===item}" :aria-pressed="section===item" @click="chooseSection(item)">{{ item==='淮新高铁'?'专题资讯':item==='一凡说高铁'?'一凡解读':item }}</button></view><view v-if="!filtered.length" class="rail-empty"><view class="rail-empty-title">还没有发布{{ section==='一凡说高铁'?'解读':'资讯' }}</view><view class="rail-reading-copy">可以先查看资料入口，或到讨论区分享你找到的原文。</view><button class="rail-text-button" @click="active='reference'">查看资料入口 →</button></view><view v-for="item in filtered" :key="item.id" class="rail-article"><view class="rail-article-meta"><text :class="['rail-category',{opinion:item.category==='一凡说高铁'}]">{{ item.category==='一凡说高铁'?'一凡解读 · 观点':'专题资讯' }}</text><text>{{ railwayDate(item.sourceDate || item.createdAt) }}</text></view><button class="rail-mobile-article-title" :aria-expanded="expanded===item.id" @click="expanded=expanded===item.id?'':item.id">{{ item.title }}</button><view :class="['rail-article-copy',{collapsed:expanded!==item.id}]">{{ item.content }}</view><view class="rail-article-bottom"><text>来源：{{ item.sourceName || (item.category==='一凡说高铁'?'一凡说高铁':'平台整理') }}</text><view class="rail-mobile-actions"><button v-if="safeRailwayUrl(item.sourceUrl)" class="rail-text-button" @click="openSource(item.sourceUrl)">{{ sourceAction }} ↗</button><button class="rail-text-button" :aria-expanded="expanded===item.id" @click="expanded=expanded===item.id?'':item.id">{{ expanded===item.id?'收起':'阅读全文' }}</button></view></view></view></view>
    <view v-show="active==='reference'" class="rail-reference"><view class="rail-card"><view class="rail-section-head"><view><view class="rail-section-title">读懂铁路消息</view><view class="rail-caption">下面是阅读文件的常识，不表示淮新高铁当前所处进度。</view></view></view><view class="rail-stage-grid"><view v-for="(stage,i) in railwayStages" :key="stage.title" class="rail-stage"><text class="rail-stage-number">0{{ i+1 }}</text><view class="rail-reading-title">{{ stage.title }}</view><view class="rail-reading-copy">{{ stage.text }}</view></view></view></view><view class="rail-layout"><view class="rail-card"><view class="rail-section-title">大家关心的问题</view><view v-for="(item,i) in railwayQuestions" :key="item.question" class="rail-faq"><button :aria-expanded="question===i" @click="question=question===i?-1:i"><text>{{ item.question }}</text><text>{{ question===i?'−':'＋' }}</text></button><view v-if="question===i" class="rail-faq-answer">{{ item.answer }}</view></view></view><view class="rail-card"><view class="rail-section-title">官方资料入口</view><button v-for="item in railwaySources" :key="item.url" class="rail-source" @click="openSource(item.url)"><view><view class="rail-source-title">{{ item.title }}</view><view class="rail-source-copy">{{ item.description }}</view></view><text>{{ sourceAction==='复制链接'?'复制':'↗' }}</text></button><view class="rail-caption">请在原网站检索“淮新高铁”等关键词，核对发布日期和全文。</view></view></view><view class="rail-card"><view class="rail-section-head"><view class="rail-section-title">关注区域</view><text class="rail-mini-label">非正式线路图</text></view><view class="rail-route-line"><button v-for="(item,i) in railwayPlaces" :key="item.name" :class="['rail-place',{active:place===i}]" :aria-pressed="place===i" @click="place=i"><text class="rail-reading-title">{{ item.name }}</text><text>{{ item.label }}</text></button></view><view class="rail-place-detail">{{ railwayPlaces[place].text }}</view><view class="rail-caption">车站名称、选址及线路走向以正式批复和公示为准。</view></view></view>
  </view>
</template>
<style scoped src="../../../shared/railway.css"></style>
