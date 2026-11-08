<script setup lang="ts">
import type { Row } from '../../shared/domain';
import { useAddressBook } from '../../shared/useAddressBook';
import { api } from '../api';
const props=defineProps<{user:Row|null}>();
const emit=defineEmits<{(event:'join'):void;(event:'chat',row:Row):void;(event:'contact',row:Row):void;(event:'profile'):void}>();
const {query,group,mode,page,loading,busy,error,message,editing,removing,allowed,groups,filtered,pages,visible,load,edit,save}=useAddressBook(()=>props.user,api);
async function copy(text:string){try{await navigator.clipboard.writeText(text);message.value='已复制联系方式';}catch{error.value='无法复制，请选中文字手动复制';}}
</script>
<template>
 <section class="people-hub">
  <header class="feature-heading"><div><p class="feature-kicker">我的通讯录</p><h2>把常联系的人放在一起。</h2><p>公开资料、私人备注和已交换的联系方式，一处查看。</p></div><button class="outline" :disabled="loading||busy" @click="load">刷新通讯录</button></header>
  <div v-if="error" class="feature-error" role="alert">{{error}}</div><p v-if="message" class="feature-success" role="status">{{message}}</p>
  <div v-if="!allowed" class="feature-empty">通讯录仅向审核通过的会员开放。<button class="primary" @click="emit('join')">{{user?'查看入会状态':'登录账号'}}</button></div>
  <template v-else>
   <div class="feature-actions"><button v-for="item in [{id:'all',name:'发现老乡'},{id:'saved',name:'我的联系人'},{id:'favorite',name:'星标常用'}]" :key="item.id" :class="mode===item.id?'primary':'outline'" @click="mode=item.id">{{item.name}}</button><button class="text-button" @click="emit('profile')">设置我的公开偏好</button></div>
   <div class="people-search"><input v-model="query" aria-label="搜索通讯录" placeholder="姓名、地区、行业或私人备注" maxlength="80"><select v-model="group" aria-label="联系人分组"><option v-for="item in groups" :key="item">{{item}}</option></select></div>
   <p class="feature-muted">{{loading?'正在核对可见资料…':'共 '+filtered.length+' 位'}} · 分组与备注仅自己可见</p>
   <section v-if="editing" class="feature-card people-editor"><h3>整理联系人 · {{editing.name}}</h3><form @submit.prevent="save()"><label>分组<input v-model="editing.group" maxlength="30" placeholder="例如：活动伙伴、同乡同行"></label><label>私人备注<textarea v-model="editing.note" maxlength="300" rows="3" placeholder="记录认识的场合或沟通事项"></textarea></label><label class="feature-check"><input v-model="editing.favorite" type="checkbox">设为星标常用</label><div class="feature-actions"><button class="primary" :disabled="busy">保存联系人</button><button type="button" class="outline" :disabled="busy" @click="editing=null">取消</button></div></form></section>
   <section v-if="removing" class="feature-card"><p>从我的通讯录移除“{{removing.name}}”？分组和私人备注也会移除。</p><div class="feature-actions"><button class="primary" :disabled="busy" @click="save(true)">确认移除</button><button class="outline" :disabled="busy" @click="removing=null">保留</button></div></section>
   <div class="people-grid"><article v-for="person in visible" :key="person.id" class="feature-card people-card"><div class="people-top"><span class="people-avatar">{{person.available?person.name.slice(0,1):'—'}}</span><div><h3>{{person.name}} <span v-if="person.favorite" class="people-star" aria-label="星标联系人">★</span></h3><p>{{person.industry||'乡情相连'}}</p></div><span v-if="person.saved" class="feature-badge">已保存</span></div><p v-if="person.hometown||person.district">{{person.hometown}} · {{person.district}}</p><p class="people-bio">{{person.bio||(!person.available?'对方已关闭公开、撤销交换或暂不可联系。':'从一句问候，开始认识。')}}</p><p v-if="person.group||person.note" class="people-note">{{person.group?person.group+' · ':''}}{{person.note}}</p><div v-if="person.phone||person.contact" class="people-contact"><a v-if="person.phone" :href="'tel:'+person.phone">拨打 {{person.phone}}</a><p v-if="person.contact">已交换：{{person.contact}}</p><button class="text-button" @click="copy(person.contact||person.phone)">复制联系方式</button></div><div class="feature-actions"><button class="outline" :disabled="busy" @click="edit(person)">{{person.saved?'编辑备注':'保存联系人'}}</button><button v-if="person.available" class="primary" @click="emit('chat',person)">站内聊聊</button><button v-if="person.available&&!person.contact" class="text-button" @click="emit('contact',person)">申请交换联系方式</button><button v-if="person.saved" class="text-button" :disabled="busy" @click="removing=person">移除</button></div></article></div>
   <p v-if="!loading&&!error&&!visible.length" class="feature-empty">{{query||group!=='全部分组'?'没有匹配的联系人，请调整筛选。':mode==='all'?'暂时没有可见的老乡资料。':'还没有保存联系人，到“发现老乡”中添加吧。'}}</p>
   <div v-if="pages>1" class="feature-actions people-pagination"><button class="outline" :disabled="page<=1" @click="page--">上一页</button><span>{{page}} / {{pages}}</span><button class="outline" :disabled="page>=pages" @click="page++">下一页</button></div>
  </template>
 </section>
</template>
<style scoped src="../../shared/people-display.css"></style>
