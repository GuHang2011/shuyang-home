<script setup lang="ts">
import { defineComponent, h, onUnmounted, ref } from 'vue';
import type { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
const emit = defineEmits<{ (event: 'result', value: string): void }>();const video = ref<HTMLVideoElement | null>(null), error = ref(''), running = ref(false), result = ref('');let reader: BrowserQRCodeReader | undefined, controls: IScannerControls | undefined;let disposed = false;
async function decoder() { if (!reader) { const module = await import('@zxing/browser');reader = new module.BrowserQRCodeReader(); }return reader; }
function stop() { controls?.stop();controls = undefined;running.value = false; }
function found(value: string) { result.value = value;stop(); }
async function start() { error.value = '';result.value = '';if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) { error.value = '摄像头需要HTTPS或localhost访问，也可以选择二维码图片识别。';return; }try { running.value = true;const qrReader = await decoder();if (disposed || !running.value) return;const control = await qrReader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } },video.value!, (value, _, control) => { if (value) { control.stop();found(value.getText()); } });if (disposed || !running.value) control.stop();else controls = control; } catch { stop();error.value = '未能打开摄像头，请检查摄像头权限，或选择二维码图片。'; } }
async function image(event: Event) { stop();error.value = '';const input = event.target as HTMLInputElement,file = input.files?.[0];if (!file) return;const url = URL.createObjectURL(file);try { found((await (await decoder()).decodeFromImageUrl(url)).getText()); } catch { error.value = '没有识别到二维码，请选用清晰、完整的图片。'; } finally { URL.revokeObjectURL(url);input.value = ''; } }
// Render native DOM tags so uni-app H5 does not rewrite them as uni-input/uni-video.
const NativeCamera = defineComponent(() => () => h('video', {
  ref: (el: any) => { video.value = el; }, autoplay: true, muted: true, playsinline: true,
  style: { display: running.value ? 'block' : 'none', width: '100%', maxHeight: '350px', borderRadius: '15px', background: '#1c3446', margin: '18px 0' }
}));
const NativeImagePicker = defineComponent(() => () => h('label', { class: 'outline scan-file', style: { display: 'inline-flex', alignItems: 'center', minHeight: '44px', cursor: 'pointer' } }, [
  '选择二维码图片', h('input', { type: 'file', accept: 'image/*', 'aria-label': '选择二维码图片', onChange: image, style: { position: 'absolute', opacity: '0', width: '1px', height: '1px' } })
]));
onUnmounted(() => { disposed = true;stop(); });
</script>
<template><section class="scanner-panel"><h3>扫一扫</h3><p>将二维码放入画面，或从相册选择二维码图片。</p><NativeCamera/><div class="button-row"><button class="primary" :disabled="running" @click="start">打开摄像头</button><button v-if="running" class="outline" @click="stop">停止扫描</button><NativeImagePicker/></div><p v-if="error" role="status" class="form-error">{{ error }}</p><div v-if="result" class="scan-result"><small>识别结果</small><p>{{ result }}</p><button class="primary" @click="emit('result',result)">确认打开站内签到</button><p>不会自动访问陌生链接或执行二维码内容。</p></div></section></template>
<style scoped>.scanner-panel{background:#fffefa;border:1px solid #e7dfce;border-radius:20px;padding:25px;margin:20px 0}.scanner-panel h3{font-size:20px;margin-bottom:10px}.scanner-panel p{font-size:12px;color:#8a8c7c;line-height:1.8}.scanner-panel video{display:none;width:100%;max-height:350px;border-radius:15px;background:#1c3446;margin:18px 0}.scanner-panel video.active{display:block}.scan-file{cursor:pointer;position:relative;font-size:13px}.scan-file input{opacity:0;position:absolute;width:1px;height:1px}.scan-result{padding:18px;background:#f1ead8;border-radius:14px;margin-top:20px;overflow-wrap:anywhere}.scan-result small{color:#9e8250}.scanner-panel .button-row{margin-top:18px}</style>
