import { useRequestScope } from './useRequestScope';
import { computed, onMounted, ref, watch } from 'vue';
import { type Row } from './domain';
export function parseCheckinCode(value: string) { const match = /^SYH:CHECKIN:([0-9a-f-]{36}):([0-9a-f-]{36})$/i.exec(value.trim());return match ? { eventId: match[1], code: match[2] } : null; }
export function useCheckin(getUser: () => Row | null, api: (path: string, method?: string, body?: unknown) => Promise<any>, locate: () => Promise<Row>) {
  const events = ref<Row[]>([]), signups = ref<Row[]>([]), selected = ref<Row | null>(null), settings = ref<Row>({}), error = ref(''), message = ref(''), busy = ref(false), code = ref('');let generation = 0;const scope = useRequestScope();
  const selectionVersion = ref(0), loadingSettings = ref(false);
  const allowed = () => getUser()?.status === 'approved' && getUser()?.enabled !== false;
  const staff = computed(() => allowed() && ['superadmin','admin','organizer'].includes(getUser()?.role || ''));
  const mine = computed(() => signups.value.filter(s => s.status !== 'cancelled'));
  const signup = computed(() => signups.value.find(s => s.eventId === selected.value?.id));
  function resetSelection() { ++selectionVersion.value;loadingSettings.value = false;busy.value = false;settings.value = {};code.value = '';error.value = '';message.value = ''; }
  function captureSelection() { const version = selectionVersion.value, valid = scope.capture();return () => valid() && version === selectionVersion.value; }
  watch(selected, resetSelection, { flush: 'sync' });
  async function load() { const version = ++generation, current = scope.capture();if (!allowed()) return;error.value = '';try { const [nextEvents,nextSignups] = await Promise.all([api('/events'),api('/my/signups')]);if ((version !== generation || !current())) return;events.value = nextEvents;signups.value = nextSignups; } catch(e) { if ((version === generation && current())) error.value = (e as Error).message; } }
  async function select(row: Row, token = '') {
    if (!allowed()) return false;
    resetSelection();selected.value = row;code.value = token;const current = captureSelection();loadingSettings.value = true;
    try { const value = await api('/events/' + row.id + '/checkin-config');if (!current()) return false;settings.value = value;return true; }
    catch(e) { if (current()) error.value = (e as Error).message;return false; }
    finally { if (current()) loadingSettings.value = false; }
  }
  async function scanned(value: string) {
    if (!allowed()) { error.value = '请先登录并等待入会审核通过';return false; }
    resetSelection();selected.value = null;const current = captureSelection(), result = parseCheckinCode(value);
    if (!result) { error.value = '已识别二维码，内容不是本平台活动签到码。不会自动打开陌生链接。';return false; }
    try { const row = await api('/events/' + result.eventId);if (!current()) return false;return await select(row,result.code); }
    catch(e) { if (current()) error.value = (e as Error).message;return false; }
  }
  async function checkin() { if (!allowed() || !selected.value || busy.value) return;const eventId = selected.value.id, token = code.value, current = captureSelection();busy.value = true;error.value = '';message.value = '';try { const position = await locate();if (!current()) return;await api('/events/' + eventId + '/self-check-in','POST',{ ...position, code: token });if (!current()) return;await load();if (!current()) return;message.value = '地点签到成功，欢迎来相聚。志愿时长由组织者另行核定。'; } catch(e) { if (current()) error.value = (e as Error).message; } finally { if (current()) busy.value = false; } }
  watch([() => getUser()?.id, () => getUser()?.role, () => getUser()?.status, () => getUser()?.enabled], () => { scope.invalidate();resetSelection();generation++;events.value = [];signups.value = [];selected.value = null;load(); }, { flush: 'sync' });onMounted(load);
  return { events, mine, signup, selected, settings, error, message, busy, staff, load, select, scanned, checkin, captureSelection, selectionVersion, loadingSettings };
}
