<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElAlert, ElButton, ElCheckbox, ElForm, ElFormItem, ElInput, type FormInstance, type FormRules } from 'element-plus';
import { type Row, privacy, agreement } from '../../shared/domain';

const props = defineProps<{ modelValue: Row; mode: string; busy: boolean; rejected?: boolean }>();
const emit = defineEmits<{ (event: 'update:modelValue', value: Row): void; (event: 'submit'): void; (event: 'register'): void }>();
const formRef = ref<FormInstance>();
const set = (key: string, value: unknown) => emit('update:modelValue', { ...props.modelValue, [key]: value });
const required = (label: string, min = 1, max = 128) => [{ required: true, whitespace: true, message: `请填写${label}`, trigger: 'blur' }, { min, max, message: `${label}需为 ${min}–${max} 个字符`, trigger: 'blur' }];
const rules = computed<FormRules>(() => props.mode === 'login' ? {
  username: required('账号', 1, 80), password: required('登录密码')
} : {
  name: required('姓名', 2, 30), hometown: required('家乡乡镇', 2, 50), district: required('现居地区', 2, 50),
  ...(props.mode === 'register' ? {
    phone: [{ required: true, pattern: /^1[3-9][0-9]{9}$/, message: '请填写正确的 11 位手机号', trigger: 'blur' }],
    password: [{ required: true, pattern: /^(?=.*[A-Za-z])(?=.*\d).{12,128}$/, message: '请设置 12–128 位密码，包含字母和数字', trigger: 'blur' }],
    consent: [{ validator: (_rule: unknown, value: boolean, callback: (error?: Error) => void) => callback(value ? undefined : new Error('请先阅读并同意隐私说明及自愿参与约定')), trigger: 'change' }]
  } : {})
});
async function submit() {
  if (props.busy) return;
  if (await formRef.value?.validate().catch(() => false)) emit('submit');
}
</script>

<template>
  <div class="account-form element-surface" :class="{ 'login-form': mode === 'login' }">
    <div v-if="mode === 'login'" class="login-brand">
      <img src="/brand/logo.png" alt="沭阳之家标志"><div><strong>一声乡音，就是回家的路。</strong><p>乡情相聚 · 守望相助</p></div>
    </div>
    <ElAlert v-else title="资料由你决定是否公开，可随时修改名录与手机号的展示设置。" type="info" :closable="false" show-icon />
    <ElForm ref="formRef" :model="modelValue" :rules="rules" label-position="top" scroll-to-error :disabled="busy" size="large" @submit.prevent="submit" hide-required-asterisk>
      <template v-if="mode === 'login'">
        <ElFormItem label="手机号 / 管理员账号" prop="username"><ElInput :model-value="modelValue.username" @update:model-value="set('username', $event)" autocomplete="username" maxlength="80" placeholder="请输入账号" /></ElFormItem>
        <ElFormItem label="登录密码" prop="password"><ElInput :model-value="modelValue.password" @update:model-value="set('password', $event)" type="password" show-password autocomplete="current-password" maxlength="128" placeholder="请输入密码" /></ElFormItem>
      </template>
      <template v-else>
        <h3 class="form-section-title">基本资料 <small>带 * 的项目为必填</small></h3>
        <div class="account-form-grid">
          <ElFormItem label="姓名 *" prop="name"><ElInput :model-value="modelValue.name" @update:model-value="set('name', $event)" maxlength="30" autocomplete="name" /></ElFormItem>
          <ElFormItem v-if="mode === 'register'" label="手机号 *" prop="phone"><ElInput :model-value="modelValue.phone" @update:model-value="set('phone', $event)" maxlength="11" inputmode="tel" autocomplete="tel" /></ElFormItem>
          <ElFormItem label="家乡乡镇 *" prop="hometown"><ElInput :model-value="modelValue.hometown" @update:model-value="set('hometown', $event)" maxlength="50" placeholder="例如：沭阳 · 沭城街道" /></ElFormItem>
          <ElFormItem label="现居地区 *" prop="district"><ElInput :model-value="modelValue.district" @update:model-value="set('district', $event)" maxlength="50" placeholder="例如：苏州 · 吴中区" /></ElFormItem>
          <ElFormItem label="行业 / 职业" prop="industry"><ElInput :model-value="modelValue.industry" @update:model-value="set('industry', $event)" maxlength="50" placeholder="选填" /></ElFormItem>
        </div>
        <ElFormItem v-if="mode === 'register'" label="设置密码 *" prop="password"><ElInput :model-value="modelValue.password" @update:model-value="set('password', $event)" type="password" show-password autocomplete="new-password" maxlength="128" placeholder="至少12位，包含字母和数字" /></ElFormItem>
        <ElFormItem label="一句话介绍自己" prop="bio"><ElInput :model-value="modelValue.bio" @update:model-value="set('bio', $event)" type="textarea" :rows="3" maxlength="300" show-word-limit placeholder="兴趣、擅长的事，或想认识怎样的朋友（选填）" /></ElFormItem>
        <h3 class="form-section-title">参与与公开偏好</h3>
        <div class="privacy-options">
          <ElCheckbox :model-value="!!modelValue.volunteer" @update:model-value="set('volunteer', $event)">我愿意参与志愿服务</ElCheckbox>
          <ElCheckbox :model-value="!!modelValue.directoryVisible" @update:model-value="set('directoryVisible', $event)">向已审核会员公开我的名录资料</ElCheckbox>
          <ElCheckbox :model-value="!!modelValue.phoneVisible" @update:model-value="set('phoneVisible', $event)">在公开名录中同时展示我的手机号</ElCheckbox>
        </div>
        <details class="privacy-details"><summary>阅读隐私说明与参与约定</summary><p>{{ privacy }}</p><p>{{ agreement }}</p></details>
        <ElFormItem v-if="mode === 'register'" prop="consent" class="consent-field"><ElCheckbox :model-value="!!modelValue.consent" @update:model-value="set('consent', $event)">我已阅读并同意隐私说明及自愿参与约定</ElCheckbox></ElFormItem>
      </template>
      <ElButton class="account-submit" type="primary" native-type="submit" :loading="busy">{{ busy ? '正在提交…' : mode === 'login' ? '登录，回家看看' : mode === 'register' ? '提交入会申请' : rejected ? '保存并重新申请' : '保存资料' }}</ElButton>
    </ElForm>
    <div v-if="mode === 'login'" class="login-help"><p>还没加入？<ElButton type="primary" link :disabled="busy" @click="emit('register')">申请入会</ElButton></p><p>忘记密码请联系平台核实身份<br><a href="tel:13862597517">138 6259 7517</a></p></div>
  </div>
</template>
