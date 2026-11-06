import { ref, watch } from 'vue';
import type { Row } from './domain';
import { useRequestScope } from './useRequestScope';
import { weatherText } from './weather';

/** Use the organizer's event coordinates, never the visitor's current city. */
export function useTripWeather(selected:()=>Row|null,user:()=>Row|null,api:(path:string)=>Promise<any>){
  const forecast=ref(''),scope=useRequestScope();let generation=0;
  watch([selected,()=>user()?.id],async()=>{
    const row=selected(),version=++generation,valid=scope.capture();forecast.value='';if(row?.type!=='trip')return;
    if(!user()||user()?.status!=='approved'){forecast.value='登录后可查看活动地点天气。';return;}
    forecast.value='正在查询活动地点天气…';
    try{
      const settings=await api('/events/'+encodeURIComponent(row.referenceId)+'/checkin-config');
      if(!valid()||version!==generation)return;
      if(!settings.enabled||!Number.isFinite(settings.latitude)||!Number.isFinite(settings.longitude)){forecast.value='组织者尚未设置活动坐标，暂不展示当地天气。';return;}
      const data=await api(`/weather?latitude=${settings.latitude}&longitude=${settings.longitude}`);
      if(!valid()||version!==generation)return;
      const date=new Date(new Date(row.event.startsAt).getTime()+8*3600000).toISOString().slice(0,10),i=(data.daily?.time||[]).indexOf(date);
      forecast.value=i<0?'活动日期暂不在预报范围内，请临近出发时查看。':`${date} 活动地点：${weatherText(data.daily.weather_code[i])}，${data.daily.temperature_2m_min[i]}–${data.daily.temperature_2m_max[i]}℃；降水概率 ${data.daily.precipitation_probability_max[i]}%。数据：Open-Meteo。`;
    }catch{if(valid()&&version===generation)forecast.value='活动天气暂不可用，出发前请再次确认。';}
  },{immediate:true});return forecast;
}
