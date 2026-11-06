<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import QRCode from 'qrcode';
const props=defineProps<{code:string}>();const url=ref('');let version=0;
watch(()=>props.code,async value=>{const n=++version;url.value='';if(value){const result=await QRCode.toDataURL('SYH:PICKUP:'+value,{width:240,margin:2,errorCorrectionLevel:'M'});if(n===version)url.value=result;}},{immediate:true});
onUnmounted(()=>{version++;});
</script>
<template><img v-if="url" :src="url" alt="取货凭证二维码，仅向授权取货人员展示" width="240" height="240" style="max-width:100%;height:auto"></template>
