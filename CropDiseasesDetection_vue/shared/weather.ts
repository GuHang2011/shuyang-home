import { computed, onMounted, ref } from 'vue';
import { type Row } from './domain';
export const defaultCity = { name: '苏州', latitude: 31.30, longitude: 120.60 };
export const hometownCity = { name: '沭阳', latitude: 34.13, longitude: 118.79 };
export function weatherText(code: number) { if (code === 0) return '晴';if (code <= 3) return ['晴', '晴间多云', '多云', '阴'][code];if (code <= 48) return '雾';if (code <= 57) return '毛毛雨';if (code <= 67) return '有雨';if (code <= 77) return '有雪';if (code <= 82) return '阵雨';if (code <= 86) return '阵雪';return '雷雨'; }
export function weatherSymbol(code: number, day = true) { return code === 0 ? day ? '☀' : '☾' : code <= 3 ? '☁' : code <= 48 ? '≋' : code <= 67 || code >= 80 && code <= 82 ? '☂' : code <= 86 ? '❄' : 'ϟ'; }
export function useWeather(api: (path: string) => Promise<any>) {
  const city = ref<Row>({ ...defaultCity }), weather = ref<Row | null>(null), cities = ref<Row[]>([]), search = ref(''), error = ref(''), loading = ref(false), searching = ref(false);
  const current = computed(() => weather.value?.current || {});
  const days = computed(() => (weather.value?.daily?.time || []).map((date: string, i: number) => ({ date, label: ['今天', '明天', '后天'][i], code: weather.value?.daily.weather_code[i], high: weather.value?.daily.temperature_2m_max[i], low: weather.value?.daily.temperature_2m_min[i], rain: weather.value?.daily.precipitation_probability_max[i] })));
  let generation = 0;
  async function load(value?: Row) { const version = ++generation;loading.value = true;error.value = '';weather.value = null;if (value) city.value = { ...value, latitude: Number(Number(value.latitude).toFixed(2)), longitude: Number(Number(value.longitude).toFixed(2)) };try { const data = await api('/weather?latitude=' + encodeURIComponent(city.value.latitude) + '&longitude=' + encodeURIComponent(city.value.longitude));if (version === generation) weather.value = data; }catch(e) { if (version === generation) error.value = (e as Error).message; }finally { if (version === generation) loading.value = false; } }
  async function find() { if (search.value.trim().length < 2) { error.value = '请至少输入两个字的城市名称';return; }searching.value = true;error.value = '';try { cities.value = await api('/weather/cities?name=' + encodeURIComponent(search.value.trim()));if (!cities.value.length) error.value = '没有找到匹配城市，也可以试试城市拼音。'; }catch(e) { error.value = (e as Error).message; }finally { searching.value = false; } }
  onMounted(() => load());
  return { city, weather, cities, search, error, loading, searching, current, days, load, find };
}
