<script setup lang="ts">
import { computed } from 'vue';
import QRCode from 'qrcode';
const props=defineProps<{code:string}>();
const svg=computed(()=>{
  if(!props.code)return '';const matrix=QRCode.create('SYH:PICKUP:'+props.code,{errorCorrectionLevel:'M'}).modules,n=matrix.size;let path='';
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(matrix.get(y,x))path+=`M${x+4},${y+4}h1v1h-1z`;
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n+8} ${n+8}"><rect width="100%" height="100%" fill="white"/><path d="${path}" fill="#142f43"/></svg>`);
});
</script>
<template><image v-if="svg" :src="svg" mode="aspectFit" style="width:240px;height:240px;max-width:100%" aria-label="取货凭证二维码"/></template>
