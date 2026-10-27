import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { type Row } from './domain';
export const defaultCity = { name: '苏州', latitude: 31.30, longitude: 120.60 };
export const hometownCity = { name: '沭阳', latitude: 34.13, longitude: 118.79 };
export type WeatherPosition = { latitude: number; longitude: number; accuracy?: number };
export function cityDetails(row: Row) { return [...new Set([row.admin1, row.admin2, row.admin3, row.admin4, row.country, row.placeType].filter(Boolean))].join(' · '); }
export function weatherText(code: number) { if (code === 0) return '晴';if (code <= 3) return ['晴', '晴间多云', '多云', '阴'][code];if (code <= 48) return '雾';if (code <= 57) return '毛毛雨';if (code <= 67) return '有雨';if (code <= 77) return '有雪';if (code <= 82) return '阵雨';if (code <= 86) return '阵雪';return '雷雨'; }
export function weatherSymbol(code: number, day = true) { return code === 0 ? day ? '☀' : '☾' : code <= 3 ? '☁' : code <= 48 ? '≋' : code <= 67 || code >= 80 && code <= 82 ? '☂' : code <= 86 ? '❄' : 'ϟ'; }
export function useWeather(api: (path: string) => Promise<any>) {
  const city = ref<Row>({ ...defaultCity }), weather = ref<Row | null>(null), cities = ref<Row[]>([]), search = ref(''), error = ref(''), searchError = ref(''), loading = ref(false), searching = ref(false), locating = ref(false), locationStatus = ref('');
  const locationHint = computed(() => city.value.locationSource === 'network' ? '网络估算 · ' + [city.value.admin1, city.value.name].filter(Boolean).join(' ') + ' · ipwho.is；有偏差可手动选城' : city.value.locationSource === 'device' ? '设备定位 · 仅用于附近天气' : '');
  const current = computed(() => weather.value?.current || {});
  const days = computed(() => (weather.value?.daily?.time || []).map((date: string, i: number) => ({ date, label: ['今天', '明天', '后天'][i], code: weather.value?.daily.weather_code[i], high: weather.value?.daily.temperature_2m_max[i], low: weather.value?.daily.temperature_2m_min[i], rain: weather.value?.daily.precipitation_probability_max[i] })));
  let generation = 0, searchGeneration = 0, locationGeneration = 0;
  async function load(value?: Row) { ++locationGeneration;locating.value = false;locationStatus.value = '';const version = ++generation;loading.value = true;error.value = '';weather.value = null;if (value) city.value = { ...value, latitude: Number(Number(value.latitude).toFixed(2)), longitude: Number(Number(value.longitude).toFixed(2)) };try { const data = await api('/weather?latitude=' + encodeURIComponent(city.value.latitude) + '&longitude=' + encodeURIComponent(city.value.longitude));if (version === generation) weather.value = data; }catch(e) { if (version === generation) error.value = (e as Error).message; }finally { if (version === generation) loading.value = false; } }
  watch(search, () => { ++searchGeneration;cities.value = [];searchError.value = '';searching.value = false; }, { flush: 'sync' });
  async function find() {
    const version = ++searchGeneration, query = search.value.trim();
    cities.value = [];searchError.value = '';searching.value = false;
    if (query.length < 2 || query.length > 40) { searchError.value = '请输入2至40字的城市名称';return; }
    searching.value = true;
    try { const rows = await api('/weather/cities?name=' + encodeURIComponent(query));if (version !== searchGeneration) return;cities.value = rows;if (!rows.length) searchError.value = '未找到城市或区县，请尝试完整名称或拼音，也可使用定位。'; }
    catch(e) { if (version === searchGeneration) searchError.value = (e as Error).message; }
    finally { if (version === searchGeneration) searching.value = false; }
  }
  async function locate(getPosition?: () => Promise<WeatherPosition>) {
    const version = ++locationGeneration;
    locating.value = true;error.value = '';locationStatus.value = getPosition ? '正在获取设备位置…' : '正在根据网络估算城市…';
    let next: Row | undefined;
    if (getPosition) {
      try {
        const position = await getPosition();
        if (version !== locationGeneration) return false;
        if (Number.isFinite(position.latitude) && Math.abs(position.latitude) <= 90 && Number.isFinite(position.longitude) && Math.abs(position.longitude) <= 180 && Number.isFinite(position.accuracy) && position.accuracy! >= 0 && position.accuracy! <= 5000) next = { name: '当前位置', ...position, locationSource: 'device' };
        else locationStatus.value = '设备定位误差较大，正在尝试网络定位…';
      } catch { if (version !== locationGeneration) return false;locationStatus.value = '设备定位不可用，正在尝试网络定位…'; }
    }
    try {
      if (!next) next = await api('/weather/network-location');
      if (version !== locationGeneration) return false;
      void load(next);
      return true;
    } catch(e) { if (version === locationGeneration) error.value = (e as Error).message;return false; }
    finally { if (version === locationGeneration) { locating.value = false;locationStatus.value = ''; } }
  }
  onMounted(() => load());
  onUnmounted(() => { ++generation;++searchGeneration;++locationGeneration; });
  return { city, weather, cities, search, error, searchError, loading, searching, locating, locationStatus, locationHint, current, days, load, find, locate };
}
