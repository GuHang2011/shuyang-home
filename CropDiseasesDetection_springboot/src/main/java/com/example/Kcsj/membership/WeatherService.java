package com.example.Kcsj.membership;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.util.UriComponentsBuilder;
import java.net.URI;
import java.time.Instant;
import java.util.*;
import static com.example.Kcsj.membership.MemberStore.*;
import static com.example.Kcsj.membership.MemberData.pick;

/** Fixed Open-Meteo hosts, bounded cache, no member location records. */
@Service
public class WeatherService {
    private final RestTemplate http;
    private final Map<String,Cache> cache=Collections.synchronizedMap(new LinkedHashMap<String,Cache>(){protected boolean removeEldestEntry(Map.Entry<String,Cache> e){return size()>256;}});
    private static class Cache {final Object value;final long expires;Cache(Object value){this.value=value;this.expires=System.currentTimeMillis()+600000;}}
    public WeatherService(){SimpleClientHttpRequestFactory factory=new SimpleClientHttpRequestFactory();factory.setConnectTimeout(4000);factory.setReadTimeout(6000);http=new RestTemplate(factory);}
    public WeatherService(RestTemplate http){this.http=http;}
    @SuppressWarnings("unchecked") private Map<String,Object> fetch(URI uri){try{Map<String,Object> result=http.getForObject(uri,Map.class);if(result==null)throw new IllegalStateException();return result;}catch(Exception e){throw new ApiException(503,"天气服务暂时连接不上，请稍后重试或手动选择城市");}}
    public Object forecast(String latitude,String longitude){
        double lat=coordinate(latitude,-90,90),lon=coordinate(longitude,-180,180);lat=Math.round(lat*100)/100.0;lon=Math.round(lon*100)/100.0;
        String key="weather:"+lat+":"+lon;Cache old=cache.get(key);if(old!=null&&old.expires>System.currentTimeMillis())return old.value;
        URI uri=UriComponentsBuilder.fromHttpUrl("https://api.open-meteo.com/v1/forecast").queryParam("latitude",lat).queryParam("longitude",lon)
            .queryParam("current","temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m")
            .queryParam("daily","weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max").queryParam("timezone","Asia/Shanghai").queryParam("forecast_days",3).build().encode().toUri();
        Map<String,Object> raw=fetch(uri);if(!(raw.get("current") instanceof Map)||!(raw.get("daily") instanceof Map)||((Map<?,?>)raw.get("current")).get("temperature_2m")==null)throw new ApiException(503,"暂时没有可用的天气数据，请稍后重试");
        Map<String,Object> result=map("current",raw.get("current"),"daily",raw.get("daily"),"updatedAt",Instant.now().toString(),"timezone","Asia/Shanghai","source","Open-Meteo","sourceUrl","https://open-meteo.com/");cache.put(key,new Cache(result));return result;
    }
    public static double coordinate(String value,double min,double max){try{double result=Double.parseDouble(value);if(!Double.isFinite(result)||result<min||result>max)throw new Exception();return result;}catch(Exception e){throw new ApiException(400,"定位坐标无效，请重新选择位置");}}
    @SuppressWarnings("unchecked") public Object cities(String name){
        name=name==null?"":name.trim();if(name.length()<2||name.length()>40)throw new ApiException(400,"请输入2至40字的城市名称");String key="city:"+name;Cache old=cache.get(key);if(old!=null&&old.expires>System.currentTimeMillis())return old.value;
        URI uri=UriComponentsBuilder.fromHttpUrl("https://geocoding-api.open-meteo.com/v1/search").queryParam("name",name).queryParam("count",6).queryParam("language","zh").queryParam("format","json").build().encode().toUri();
        Map<String,Object> raw=fetch(uri);List<Map<String,Object>> result=new ArrayList<>();if(raw.get("results") instanceof List)for(Map<String,Object> row:(List<Map<String,Object>>)raw.get("results"))result.add(pick(row,"id","name","latitude","longitude","admin1","admin2","country"));cache.put(key,new Cache(result));return result;
    }
}
