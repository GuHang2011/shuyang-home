<script setup lang="ts">
import { api, baseUrl } from '../platform';
import gardenPhoto from '../../../shared/assets/suzhou-garden.jpg';
import { gardenCredit } from '../../../shared/placeMaterials';
import { getCurrentInstance, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useHomeCarousel } from '../../../shared/useHomeCarousel';
const props = withDefaults(defineProps<{ member?: boolean; foreground?: boolean }>(), { foreground: true });
const emit = defineEmits<{ (event: 'navigate', page: string): void; (event: 'join'): void }>();
const { slides, index, current, paused, touching, focused, hovered, reducedMotion, cover, select, next, previous } = useHomeCarousel(api, () => props.foreground);
const failedCover = ref(''), bannerHeight = ref(390);
const instance = getCurrentInstance();
let disposed = false;
async function measureBanner() {
  await nextTick();
  if (disposed) return;
  // Measure all slides so changing text never shifts the rest of the home page.
  uni.createSelectorQuery().in(instance?.proxy).selectAll('.home-banner-slide').boundingClientRect((boxes: any) => {
    if (!disposed && Array.isArray(boxes) && boxes.length) bannerHeight.value = Math.ceil(Math.max(...boxes.map(box => Number(box.height) || 0)));
  }).exec();
}
onMounted(() => { measureBanner();uni.onWindowResize(measureBanner); });
onUnmounted(() => { disposed = true;uni.offWindowResize(measureBanner); });
watch(() => props.member, measureBanner);
function changed(event: any) { select(Number(event.detail.current)); }
function sourceLink(url: string) {
  // #ifdef H5
  window.open(url, '_blank', 'noopener,noreferrer');
  // #endif
  // #ifdef MP-WEIXIN
  uni.setClipboardData({ data: url, success: () => uni.showToast({ title: '来源链接已复制', icon: 'none' }) });
  // #endif
}
</script>
<template>
  <view :class="['home-carousel-mobile', 'tone-' + current.theme]" @mouseenter="hovered = true" @mouseleave="hovered = false" @focusin="focused = true" @focusout="focused = false">
    <swiper class="home-banner-swiper" :style="{ height: bannerHeight + 'px' }" :current="index" :autoplay="false" :duration="reducedMotion ? 0 : 350" circular @change="changed" @touchstart="touching = true" @touchend="touching = false" @touchcancel="touching = false">
      <swiper-item v-for="(slide, position) in slides" :key="slide.id"><view class="home-banner-slide" :aria-hidden="position !== index">
        <view class="home-banner-photo">
          <image v-if="slide.id === 'memories' && cover && failedCover !== cover" :src="baseUrl() + '/media/' + encodeURIComponent(cover)" mode="aspectFill" aria-label="已发布活动相册封面" @error="failedCover = cover"/>
          <image v-else :src="gardenPhoto" mode="aspectFill" aria-label="苏州园林中的亭子、白墙与假山"/>
        </view>
        <view v-if="slide.id === 'memories' && cover && failedCover !== cover" class="home-banner-credit">活动相册 · 管理员发布</view>
        <view v-else class="home-banner-credit">苏州园林 · 城市风景 <button :tabindex="position === index ? 0 : -1" @click="sourceLink(gardenCredit.sourceUrl)">摄影 SteFou!</button><button :tabindex="position === index ? 0 : -1" @click="sourceLink(gardenCredit.licenseUrl)">CC BY 2.0</button></view>
        <view class="home-banner-copy"><view class="home-banner-title">{{ slide.first }}{{ slide.second }}</view>
          <view class="home-banner-description">{{ slide.description }}<br/>{{ slide.detail }}</view>
          <view class="home-banner-actions"><button :tabindex="position === index ? 0 : -1" class="home-banner-primary" @click="emit('navigate',slide.target)">{{ slide.action }} <text>→</text></button><button :tabindex="position === index ? 0 : -1" class="home-banner-secondary" @click="emit('join')">{{ member ? '我的会员卡' : '申请入会' }}</button></view>
        </view>
      </view></swiper-item>
    </swiper>
    <view class="home-banner-controls"><view class="home-banner-dots"><button v-for="(slide, position) in slides" :key="slide.id" :aria-label="'查看第' + (position + 1) + '张：' + slide.label" :class="{ active: index === position }" @click="select(position)"><view/></button></view><text class="home-banner-count">0{{ index + 1 }} / 0{{ slides.length }}</text><view class="home-banner-arrows"><button :aria-label="paused || reducedMotion ? '开启自动轮播' : '暂停自动轮播'" @click="reducedMotion ? reducedMotion = false : paused = !paused">{{ paused || reducedMotion ? '▷' : 'Ⅱ' }}</button><button aria-label="上一张推荐" @click="previous">←</button><button aria-label="下一张推荐" @click="next">→</button></view></view>
  </view>
</template>
<style scoped>
.home-carousel-mobile{overflow:hidden;margin:18px 0 0;background:var(--skin-surface,#fffdf8);color:var(--skin-text,#294657);border:1px solid var(--skin-border,#e2ddcf);border-radius:12px}.home-banner-slide{box-sizing:border-box}.home-banner-photo{height:140px}.home-banner-photo image{width:100%;height:100%;display:block}.home-banner-credit{display:flex;align-items:center;flex-wrap:wrap;gap:0 6px;padding:4px 12px;font-size:11px;line-height:1.6;color:var(--skin-muted,#657076);background:var(--skin-soft,#f3eee3);min-height:36px}.home-banner-credit button{display:inline-flex;align-items:center;margin:0;padding:0;min-height:32px;background:transparent;font-size:11px;line-height:1.6;color:inherit;text-decoration:underline}.home-banner-copy{padding:16px 18px}.home-banner-title{font-size:23px;font-weight:600;line-height:1.5;margin-bottom:8px}.home-banner-description{font-size:14px;line-height:1.85;color:var(--skin-muted,#657076)}.home-banner-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:14px}.home-banner-actions button{margin:0;display:flex;align-items:center;justify-content:center;min-height:44px;font-size:14px;line-height:1.6;border-radius:8px;padding:10px 14px}.home-banner-primary{background:var(--skin-primary,#29495b);color:var(--skin-on-primary,#fff)}.home-banner-primary text{margin-left:12px}.home-banner-secondary{background:transparent;color:var(--skin-text,#294657);border:1px solid var(--skin-border,#ded8ca)}.home-banner-controls{display:flex;align-items:center;gap:6px;border-top:1px solid var(--skin-border,#e2ddcf);padding:3px 12px}.home-banner-dots{display:flex}.home-banner-dots button{width:44px;min-width:44px;height:44px;min-height:44px;padding:0;margin:0;background:transparent;display:flex;align-items:center;justify-content:center}.home-banner-dots button>view{width:6px;height:6px;border-radius:5px;background:var(--skin-border,#ccc)}.home-banner-dots button.active>view{width:20px;background:var(--skin-primary,#29495b)}.home-banner-count{display:none}.home-banner-arrows{display:flex;gap:2px;margin-left:auto}.home-banner-arrows button{width:44px;min-width:44px;height:44px;min-height:44px;display:flex;align-items:center;justify-content:center;margin:0;padding:0;border-radius:8px;font-size:18px;line-height:1;color:var(--skin-text,#294657);background:transparent}
</style>

<style scoped>
@media(max-width:350px){.home-banner-arrows button:nth-child(2){display:none}}
</style>
