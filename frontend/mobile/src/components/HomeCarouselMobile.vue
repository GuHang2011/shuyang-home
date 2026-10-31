<script setup lang="ts">
import { api, baseUrl } from '../platform';
import { getCurrentInstance, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useHomeCarousel } from '../../../shared/useHomeCarousel';
const props = withDefaults(defineProps<{ member?: boolean; foreground?: boolean }>(), { foreground: true });
const emit = defineEmits<{ (event: 'navigate', page: string): void; (event: 'join'): void }>();
const { slides, index, current, paused, touching, focused, hovered, reducedMotion, cover, select, next, previous } = useHomeCarousel(api, () => props.foreground);
const failedCover = ref(''), bannerHeight = ref(430);
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
</script>
<template>
  <view :class="['home-carousel-mobile', 'tone-' + current.theme]" @mouseenter="hovered = true" @mouseleave="hovered = false" @focusin="focused = true" @focusout="focused = false">
    <swiper class="home-banner-swiper" :style="{ height: bannerHeight + 'px' }" :current="index" :autoplay="false" :duration="reducedMotion ? 0 : 350" circular @change="changed" @touchstart="touching = true" @touchend="touching = false" @touchcancel="touching = false">
      <swiper-item v-for="(slide, position) in slides" :key="slide.id"><view class="home-banner-slide" :aria-hidden="position !== index">
        <view class="home-banner-label">● {{ slide.label }}</view>
        <view class="home-banner-title">{{ slide.first }}<br/><text>{{ slide.second }}</text></view>
        <view class="home-banner-description">{{ slide.description }}<br/>{{ slide.detail }}</view>
        <view class="home-banner-actions"><button :tabindex="position === index ? 0 : -1" class="home-banner-primary" @click="emit('navigate',slide.target)">{{ slide.action }} <text>→</text></button><button :tabindex="position === index ? 0 : -1" class="home-banner-secondary" @click="emit('join')">{{ member ? '我的会员卡' : '加入沭阳之家' }} ↗</button></view>
        <view class="home-banner-note">{{ slide.note }}</view>
        <view class="home-banner-mark" aria-hidden="true"><image v-if="slide.id === 'memories' && cover && failedCover !== cover" :src="baseUrl() + '/media/' + encodeURIComponent(cover)" mode="aspectFill" @error="failedCover = cover"/><image v-else src="/static/logo.png" mode="aspectFit"/></view>
      </view></swiper-item>
    </swiper>
    <view class="home-banner-controls"><view class="home-banner-dots"><button v-for="(slide, position) in slides" :key="slide.id" :aria-label="'查看第' + (position + 1) + '张：' + slide.label" :class="{ active: index === position }" @click="select(position)"><view/></button></view><text class="home-banner-count">0{{ index + 1 }} / 0{{ slides.length }}</text><view class="home-banner-arrows"><button :aria-label="paused || reducedMotion ? '开启自动轮播' : '暂停自动轮播'" @click="reducedMotion ? reducedMotion = false : paused = !paused">{{ paused || reducedMotion ? '▷' : 'Ⅱ' }}</button><button aria-label="上一张推荐" @click="previous">←</button><button aria-label="下一张推荐" @click="next">→</button></view></view>
  </view>
</template>
<style scoped>
.home-carousel-mobile{position:relative;overflow:hidden;margin:24rpx 0 0;background:linear-gradient(120deg,#233f52,#375d69);color:#fffdf6;border-radius:36rpx}.home-carousel-mobile.tone-green{background:linear-gradient(120deg,#284d47,#4c7162)}.home-carousel-mobile.tone-clay{background:linear-gradient(120deg,#5b4a3d,#8a6b50)}.home-banner-slide{position:relative;box-sizing:border-box;padding:28px 22px 26px}.home-banner-label{font-size:12px;color:#e4cb94;line-height:1.8;max-width:calc(100% - 42px)}.home-banner-title{font-size:30px;line-height:1.5;font-weight:600;letter-spacing:0;margin:24px 0 16px;color:#fffdf6}.home-banner-title text{color:#e4cb94}.home-banner-description{font-size:15px;line-height:1.9;color:#e1e8e8}.home-banner-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:24px}.home-carousel-mobile .home-banner-actions button{margin:0;display:flex;align-items:center;justify-content:center;min-height:46px;font-size:14px;line-height:1.6;border-radius:10px;padding:10px 14px;white-space:nowrap}.home-carousel-mobile .home-banner-primary{background:#e4cb94;color:#243f52}.home-banner-primary text{margin-left:12px}.home-carousel-mobile .home-banner-secondary{padding:8px 0;background:transparent;color:#fff5dc}.home-banner-note{font-size:12px;line-height:1.8;color:#c6d6d6;margin-top:20px}.home-banner-mark{position:absolute;right:21px;top:22px;width:40px;height:40px;background:#faf7e9;border-radius:12px;padding:6px;transform:rotate(7deg);box-sizing:border-box;pointer-events:none}.home-banner-mark image{width:100%;height:100%;border-radius:5px}.home-banner-controls{display:flex;align-items:center;gap:6px;border-top:1px solid #fff3d82a;margin:0 18px;padding:10px 0 18px}.home-banner-dots{display:flex}.home-carousel-mobile .home-banner-dots button{width:44px;min-width:44px;height:44px;min-height:44px;padding:0;margin:0;background:transparent;display:flex;align-items:center;justify-content:center;border-radius:8px}.home-banner-dots button>view{width:6px;height:6px;border-radius:8px;background:#ffffff66}.home-banner-dots button.active>view{width:22px;background:#e4cb94}.home-banner-count{font-size:11px;color:#e1dbca;white-space:nowrap}.home-banner-arrows{display:flex;gap:4px;margin-left:auto}.home-carousel-mobile .home-banner-arrows button{width:44px;min-width:44px;height:44px;min-height:44px;display:flex;align-items:center;justify-content:center;margin:0;padding:0;border:1px solid #ffffff45;border-radius:50%;font-size:18px;line-height:1;color:#fff7e2;background:#ffffff09}
@media(min-width:420px){.home-banner-title{font-size:34px}}
@media(max-width:480px){.home-banner-count{display:none}}
@media(prefers-reduced-motion:reduce){.home-carousel-mobile *{transition:none}}
</style>
