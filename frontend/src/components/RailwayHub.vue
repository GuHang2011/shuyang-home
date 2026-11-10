<script setup lang="ts">
import { ref } from 'vue';
import type { Row } from '../../shared/domain';
import { railwayPlaces, railwayQuestions, railwaySources, railwaySections, railwayReadingSteps, railwayStages, railwayDate, safeRailwayUrl, useRailway } from '../../shared/railway';
import { RAILWAY_BOARD } from '../../shared/railwayForum';
import ForumHub from './ForumHub.vue';
const props = defineProps<{ notices: Row[]; user: Row | null; manage?: boolean }>();
const emit = defineEmits<{ (event: 'publish', category: string): void; (event: 'edit', row: Row): void; (event: 'join'): void }>();
const { section, place, expanded, question, articles, filtered, chooseSection } = useRailway(() => props.notices);
const active = ref('discussion'), message = ref('');
async function share() {
  try { await navigator.clipboard.writeText(location.origin + location.pathname + '#railway');message.value = '专题链接已复制。'; }
  catch { message.value = '暂时无法复制，可使用地址栏中的专题链接。'; }
}
</script>
<template>
  <div class="railway-hub">
    <header class="rail-masthead"><div><p class="rail-kicker">沭阳之家 / 淮新高铁论坛</p><h1 class="rail-page-title">一凡说高铁 <span class="hot-badge">HOT</span></h1><p class="rail-lead">聊进展、问接驳，也分享返乡路上的经验。</p></div><button class="rail-button rail-outline" @click="share">分享专题 ↗</button></header>
    <p v-if="message" class="rail-feedback" role="status">{{ message }}</p>
    <nav class="rail-section-tabs" aria-label="高铁专题栏目"><button v-for="item in railwaySections" :key="item.id" :class="{active:active===item.id}" :aria-pressed="active===item.id" @click="active=item.id">{{ item.label }}<span v-if="item.id==='news'" class="rail-tab-count">{{ articles.length }}</span></button></nav>
    <div v-show="active==='discussion'" class="rail-discussion-layout">
      <div class="rail-discussion-main"><ForumHub :user="user" :active="active==='discussion'" :board="RAILWAY_BOARD" title="淮新高铁讨论区" intro="提问、分享资料或说说你的看法。新帖与回复审核后公开。" embedded @join="emit('join')"/></div>
      <aside class="rail-side"><section class="rail-card"><p class="rail-kicker">发帖前看一眼</p><h2 class="rail-section-title">让消息有出处</h2><ol class="rail-reading-list"><li v-for="step in railwayReadingSteps" :key="step.title"><strong>{{ step.title }}</strong><p>{{ step.text }}</p></li></ol><button class="rail-text-button" @click="active='reference'">查看常见问题与官方入口 →</button></section><section class="rail-side-note"><h2>在这里怎样交流</h2><p>可上传照片、语音，引用楼层继续讨论。请尊重不同意见，不公开他人的电话号码或个人资料。</p><p>版主可以审核、置顶、推荐热帖及处理违规内容。</p></section></aside>
    </div>
    <section v-show="active==='news'" class="rail-news" aria-label="资讯与解读">
      <div class="rail-section-head"><div><h2 class="rail-section-title">资讯与解读</h2><p class="rail-caption">整理公开资料，个人解读单独标注。</p></div><button v-if="manage" class="rail-button rail-primary" @click="emit('publish',section==='一凡说高铁'?section:'淮新高铁')">＋ 发布资讯</button></div>
      <div class="rail-tabs" role="group" aria-label="资讯分类"><button v-for="item in ['全部','淮新高铁','一凡说高铁']" :key="item" :class="{active:section===item}" :aria-pressed="section===item" @click="chooseSection(item)">{{ item==='淮新高铁'?'专题资讯':item==='一凡说高铁'?'一凡解读':item }}</button></div>
      <div v-if="!filtered.length" class="rail-empty"><h3>还没有发布{{ section==='一凡说高铁'?'解读':'资讯' }}</h3><p>可以先查看资料入口，或到讨论区分享你找到的原文。</p><button class="rail-text-button" @click="active='reference'">查看资料入口 →</button></div>
      <article v-for="item in filtered" :key="item.id" class="rail-article"><div class="rail-article-meta"><span :class="['rail-category',{opinion:item.category==='一凡说高铁'}]">{{ item.category==='一凡说高铁'?'一凡解读 · 观点':'专题资讯' }}</span><time>{{ railwayDate(item.sourceDate || item.createdAt) }}</time></div><h3 class="rail-article-title"><button :aria-expanded="expanded===item.id" @click="expanded=expanded===item.id?'':item.id">{{ item.title }}</button></h3><p :class="['rail-article-copy',{collapsed:expanded!==item.id}]">{{ item.content }}</p><div class="rail-article-bottom"><span>来源：{{ item.sourceName || (item.category==='一凡说高铁'?'一凡说高铁':'平台整理') }}</span><div><a v-if="safeRailwayUrl(item.sourceUrl)" class="rail-text-button" :href="safeRailwayUrl(item.sourceUrl)" target="_blank" rel="noopener noreferrer">查看原文 ↗</a><button class="rail-text-button" :aria-expanded="expanded===item.id" @click="expanded=expanded===item.id?'':item.id">{{ expanded===item.id?'收起':'阅读全文' }}</button><button v-if="manage" class="rail-text-button" @click="emit('edit',item)">编辑</button></div></div></article>
    </section>
    <div v-show="active==='reference'" class="rail-reference">
      <section class="rail-card"><div class="rail-section-head"><div><h2 class="rail-section-title">读懂铁路消息</h2><p class="rail-caption">下面是阅读文件的常识，不表示淮新高铁当前所处进度。</p></div></div><div class="rail-stage-grid"><article v-for="(stage,i) in railwayStages" :key="stage.title"><span class="rail-stage-number">0{{ i+1 }}</span><h3>{{ stage.title }}</h3><p>{{ stage.text }}</p></article></div></section>
      <div class="rail-layout"><section class="rail-card"><h2 class="rail-section-title">大家关心的问题</h2><div v-for="(item,i) in railwayQuestions" :key="item.question" class="rail-faq"><button :aria-expanded="question===i" :aria-controls="'rail-answer-'+i" @click="question=question===i?-1:i"><span>{{ item.question }}</span><span aria-hidden="true">{{ question===i?'−':'＋' }}</span></button><p v-if="question===i" :id="'rail-answer-'+i">{{ item.answer }}</p></div></section><aside class="rail-card"><h2 class="rail-section-title">官方资料入口</h2><a v-for="item in railwaySources" :key="item.url" class="rail-source" :href="item.url" target="_blank" rel="noopener noreferrer"><span><strong>{{ item.title }}</strong><span>{{ item.description }}</span></span><span aria-hidden="true">↗</span></a><p class="rail-caption">请在原网站检索“淮新高铁”等关键词，核对发布日期和全文。</p></aside></div>
      <section class="rail-card rail-route"><div class="rail-section-head"><h2 class="rail-section-title">关注区域</h2><span class="rail-mini-label">非正式线路图</span></div><div class="rail-route-line" role="group" aria-label="选择关注区域"><button v-for="(item,i) in railwayPlaces" :key="item.name" :class="['rail-place',{active:place===i}]" :aria-pressed="place===i" @click="place=i"><strong>{{ item.name }}</strong><span>{{ item.label }}</span></button></div><p class="rail-place-detail" aria-live="polite">{{ railwayPlaces[place].text }}</p><p class="rail-caption">车站名称、选址及线路走向以正式批复和公示为准。</p></section>
    </div>
  </div>
</template>
<style scoped src="../../shared/railway.css"></style>
