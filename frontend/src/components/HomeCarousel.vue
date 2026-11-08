<script setup lang="ts">
import { ref } from 'vue';
import { api } from '../api';
import { useHomeCarousel } from '../../shared/useHomeCarousel';
import Icon from './Icon.vue';
import gardenPhoto from '../../shared/assets/suzhou-garden.jpg';
import { gardenCredit } from '../../shared/placeMaterials';
defineProps<{ member?: boolean }>();
const emit = defineEmits<{ (event: 'navigate', page: string): void; (event: 'join'): void }>();
const { slides, index, current, paused, hovered, focused, touching, reducedMotion, playing, cover, select, next, previous } = useHomeCarousel(api);
const failedCover = ref('');
let start: { x: number; y: number } | null = null, suppressClickUntil = 0;
function pointerStart(event: PointerEvent) { if (event.pointerType !== 'touch') return;start = { x: event.clientX, y: event.clientY };touching.value = true; }
function pointerEnd(event: PointerEvent) {
  if (start) { const dx = event.clientX - start.x, dy = event.clientY - start.y;if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) { dx < 0 ? next() : previous();suppressClickUntil = Date.now() + 400; } }
  start = null;touching.value = false;
}
function stopClick(event: MouseEvent) { if (Date.now() < suppressClickUntil) { event.preventDefault();event.stopPropagation(); } }
function blur(event: FocusEvent) { if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) focused.value = false; }
</script>
<template>
  <section class="home-carousel" :class="'tone-' + current.theme" role="region" aria-roledescription="轮播" aria-label="首页推荐" :data-slide="index" @pointerenter="hovered = $event.pointerType === 'mouse'" @pointerleave="hovered = false; start = null; touching = false" @focusin="focused = true" @focusout="blur" @keydown.left.prevent="previous" @keydown.right.prevent="next" @pointerdown="pointerStart" @pointerup="pointerEnd" @pointercancel="start = null; touching = false" @click.capture="stopClick">
    <div class="carousel-stage" :aria-live="playing ? 'off' : 'polite'" aria-atomic="true">
        <article v-for="(slide, position) in slides" :key="slide.id" class="carousel-slide" :class="{ active: index === position }" :aria-hidden="index !== position" :inert="index !== position" aria-roledescription="幻灯片" :aria-label="(position + 1) + ' / ' + slides.length + '：' + slide.first + slide.second">
          <div class="carousel-copy">
            <p class="carousel-label">{{ slide.label }}</p>
            <h2>{{ slide.first }}<span>{{ slide.second }}</span></h2>
            <p class="carousel-description">{{ slide.description }}<br>{{ slide.detail }}</p>
            <div class="carousel-actions"><button :tabindex="index === position ? 0 : -1" class="carousel-primary" @click="emit('navigate', slide.target)">{{ slide.action }}<Icon name="arrow"/></button><button :tabindex="index === position ? 0 : -1" class="carousel-secondary" @click="emit('join')">{{ member ? '我的会员卡' : '申请入会' }}</button></div>
          </div>
          <figure class="carousel-photo">
            <template v-if="slide.id === 'memories' && cover && failedCover !== cover"><img :src="'/api/media/' + encodeURIComponent(cover)" alt="已发布活动相册封面" @error="failedCover = cover"><figcaption>活动相册 · 管理员发布</figcaption></template>
            <template v-else><img :src="gardenPhoto" alt="苏州园林中的亭子、白墙与假山" width="474" height="266"><figcaption>{{ gardenCredit.title }} · 城市风景<br><a :tabindex="index === position ? 0 : -1" :href="gardenCredit.sourceUrl" target="_blank" rel="noopener noreferrer">摄影 {{ gardenCredit.author }}</a> · <a :tabindex="index === position ? 0 : -1" :href="gardenCredit.licenseUrl" target="_blank" rel="noopener noreferrer">{{ gardenCredit.license }}</a></figcaption></template>
          </figure>
        </article>
    </div>
    <div class="carousel-controls"><div class="carousel-dots" role="group" aria-label="选择推荐内容"><button v-for="(slide, position) in slides" :key="slide.id" :class="{ active: position === index }" :aria-label="'查看第' + (position + 1) + '张：' + slide.label" :aria-current="position === index ? 'true' : undefined" @click="select(position)"><span></span></button></div><span class="carousel-count" aria-hidden="true">0{{ index + 1 }} <b>/ 0{{ slides.length }}</b></span><div class="carousel-arrows"><button class="carousel-pause" :aria-label="paused || reducedMotion ? '开启自动轮播' : '暂停自动轮播'" :aria-pressed="paused || reducedMotion" @click="reducedMotion ? reducedMotion = false : paused = !paused"><span aria-hidden="true">{{ paused || reducedMotion ? '▷' : 'Ⅱ' }}</span></button><button aria-label="上一张推荐" @click="previous"><Icon name="arrow" class="previous-arrow"/></button><button aria-label="下一张推荐" @click="next"><Icon name="arrow"/></button></div></div>
  </section>
</template>
<style scoped>
.home-carousel{position:relative;min-width:0;overflow:hidden;border:1px solid var(--skin-border,#e2ddcf);border-radius:14px;color:var(--skin-text,#294657);background:var(--skin-surface,#fffdf8);touch-action:pan-y;container:homepage-banner / inline-size}
.carousel-stage{display:grid}.carousel-slide{grid-area:1/1;display:grid;grid-template-columns:1fr minmax(0,.85fr);min-width:0;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .25s}.carousel-slide.active{opacity:1;visibility:visible;pointer-events:auto}
.carousel-copy{padding:28px 22px 20px;min-width:0}.carousel-label{margin:0 0 15px;font-size:13px;line-height:1.6;color:var(--skin-accent,#89601e)}.carousel-copy h2{font-size:28px;font-weight:600;line-height:1.5;letter-spacing:0;margin:0 0 16px;color:var(--skin-text,#294657)}.carousel-copy h2 span{display:block}.carousel-description{font-size:14px;line-height:1.85;margin:0;color:var(--skin-muted,#657076);overflow-wrap:anywhere}.carousel-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:22px}.carousel-actions button{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:44px;padding:10px 14px;border-radius:8px;font-size:14px;line-height:1.5}.carousel-primary{color:var(--skin-on-primary,#fff);background:var(--skin-primary,#29495b)}.carousel-secondary{color:var(--skin-text,#294657);background:transparent;border:1px solid var(--skin-border,#ded8ca)}.carousel-primary .icon{width:16px;height:16px}
.carousel-photo{min-width:0;margin:20px 20px 16px 0;align-self:stretch;display:flex;flex-direction:column;justify-content:center}.carousel-photo img{display:block;width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;border-radius:8px}.carousel-photo figcaption{font-size:12px;line-height:1.7;color:var(--skin-muted,#657076);padding-top:7px}.carousel-photo a{color:inherit;text-decoration:underline;text-underline-offset:3px;display:inline-flex;align-items:center;min-height:28px}
.carousel-controls{display:flex;align-items:center;gap:8px;padding:5px 18px;border-top:1px solid var(--skin-border,#e2ddcf)}.carousel-dots{display:flex}.carousel-dots button{display:grid;place-items:center;width:44px;min-height:44px;padding:0;background:transparent}.carousel-dots button>span{width:6px;height:6px;border-radius:5px;background:var(--skin-border,#ccc)}.carousel-dots button.active>span{width:20px;background:var(--skin-primary,#29495b)}.carousel-count{font-size:12px;color:var(--skin-muted,#657076)}.carousel-count b{font-weight:400}.carousel-arrows{display:flex;gap:2px;margin-left:auto}.carousel-arrows button{display:grid;place-items:center;min-width:44px;height:44px;background:transparent;color:var(--skin-text,#294657);padding:0;border-radius:8px}.carousel-arrows button:hover{background:var(--skin-soft,#f3eee3)}.carousel-arrows .icon{width:17px;height:17px}.previous-arrow{transform:rotate(180deg)}.home-carousel button:focus-visible,.home-carousel a:focus-visible{outline:2px solid var(--skin-primary,#29495b);outline-offset:2px}
@container homepage-banner (max-width:570px){.carousel-slide{grid-template-columns:1fr}.carousel-photo{order:-1;margin:0;position:relative}.carousel-photo img{height:145px;aspect-ratio:auto;border-radius:0;object-position:center 48%}.carousel-photo figcaption{padding:7px 18px;background:var(--skin-soft,#f3eee3);font-size:11px;line-height:1.5}.carousel-photo figcaption br{display:none}.carousel-photo figcaption a:first-of-type{margin-left:8px}.carousel-copy{padding:18px}.carousel-label{display:none}.carousel-copy h2{font-size:25px;margin-bottom:8px}.carousel-copy h2 span{display:inline}.carousel-description{font-size:14px}.carousel-actions{margin-top:14px}.carousel-count{display:none}.carousel-controls{padding:3px 12px}}
@media(prefers-reduced-motion:reduce){.carousel-slide{transition:none}}
@container homepage-banner (max-width:350px){.carousel-arrows button:nth-child(2){display:none}}
</style>
