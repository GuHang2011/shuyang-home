package com.example.Kcsj.membership;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.util.UriComponentsBuilder;
import java.net.URI;
import java.net.InetAddress;
import java.time.Instant;
import java.util.*;
import static com.example.Kcsj.membership.MemberStore.*;
import static com.example.Kcsj.membership.MemberData.pick;

/** Fixed Open-Meteo hosts, bounded cache, no member location records. */
@Service
public class WeatherService {
    private final RestTemplate http;
    @Value("${shuyang.weather.allow-local-network-location:false}")
    private boolean allowLocalNetworkLocation;
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
    public Object networkLocation(String remoteAddress) {
        String ip = publicAddress(remoteAddress);
        String key = "network:" + ip;
        Cache old = cache.get(key);
        if (old != null && old.expires > System.currentTimeMillis()) return old.value;
        // Query only the request address resolved through the configured trusted proxy.
        URI uri = UriComponentsBuilder.fromHttpUrl("https://ipwho.is/" + ip)
            .queryParam("lang", "zh-CN").build().encode().toUri();
        Map<String,Object> raw;
        try { raw = fetch(uri); }
        catch (ApiException e) { throw new ApiException(503, "网络定位暂时不可用，请手动选择城市"); }
        if (!Boolean.TRUE.equals(raw.get("success")) || !validCoordinates(raw) || text(raw,"city").isEmpty())
            throw new ApiException(503, "网络定位未返回可用城市，请手动选择城市");
        Map<String,Object> result = map("name", raw.get("city"), "admin1", raw.get("region"), "country", raw.get("country"),
            "latitude", Math.round(((Number)raw.get("latitude")).doubleValue()*100)/100.0,
            "longitude", Math.round(((Number)raw.get("longitude")).doubleValue()*100)/100.0,
            "locationSource", "network", "source", "ipwho.is", "approximate", true);
        cache.put(key, new Cache(result));
        return result;
    }

    private String publicAddress(String input) {
        try {
            if (input == null || !(input.matches("[0-9]{1,3}(\\.[0-9]{1,3}){3}") || input.contains(":") && input.matches("[0-9a-fA-F:]+"))) throw new IllegalArgumentException();
            InetAddress address = InetAddress.getByName(input);
            if (address.isLoopbackAddress() && allowLocalNetworkLocation) return ""; // Local preview only: this machine's network exit.
            if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isSiteLocalAddress() || address.isLinkLocalAddress() || address.isMulticastAddress()) throw new IllegalArgumentException();
            byte[] bytes = address.getAddress();
            if (bytes.length == 4) {
                int a = bytes[0]&255, b = bytes[1]&255, c = bytes[2]&255;
                if (a == 0 || a >= 224 || a == 100 && b >= 64 && b <= 127 || a == 192 && b == 0 || a == 198 && (b == 18 || b == 19 || b == 51 && c == 100) || a == 203 && b == 0 && c == 113) throw new IllegalArgumentException();
            } else if ((bytes[0]&0xe0) != 0x20 || bytes[0] == 0x20 && bytes[1] == 0x01 && bytes[2] == 0x0d && (bytes[3]&255) == 0xb8) throw new IllegalArgumentException();
            return address.getHostAddress();
        } catch (Exception e) { throw new ApiException(400, "当前网络地址无法用于城市定位，请手动选择城市"); }
    }
    public Object cities(String name) {
        name = name == null ? "" : name.trim();
        if (name.length() < 2 || name.length() > 40) throw new ApiException(400, "请输入2至40字的城市名称");
        String key = "city:" + name.toLowerCase(Locale.ROOT);
        Cache old = cache.get(key);
        if (old != null && old.expires > System.currentTimeMillis()) return old.value;

        // The existing hometown shortcut is also searchable. GeoNames currently has no
        // Chinese Shuyang county entry; do not substitute similarly named Fujian villages.
        if (Arrays.asList("沭阳", "沭阳县", "shuyang").contains(name.toLowerCase(Locale.ROOT))) {
            return Collections.singletonList(map("id", "preset-shuyang", "name", "沭阳县", "latitude", 34.13,
                "longitude", 118.79, "admin1", "江苏省", "admin2", "宿迁市", "country", "中国",
                "country_code", "CN", "placeType", "区县", "source", "平台家乡快捷地点"));
        }

        List<Map<String,Object>> result = new ArrayList<>();
        for (String query : cityQueries(name)) {
            result = cityCandidates(searchPlaces(query), name);
            if (!result.isEmpty()) break;
        }
        cache.put(key, new Cache(result));
        return result;
    }

    private List<String> cityQueries(String name) {
        LinkedHashSet<String> queries = new LinkedHashSet<>();
        // Open-Meteo performs exact matching for two characters: 淮安 misses 淮安市.
        // Try the full city name before the short name, then county/district fallbacks.
        if (name.matches("[\\p{IsHan}]{2,20}") && !name.matches(".*(市|县|区|自治州|盟|旗|省)$")) {
            queries.add(name + "市");
            queries.add(name);
            queries.add(name + "县");
            queries.add(name + "区");
        } else {
            queries.add(name);
            if (name.matches("[\\p{IsHan}]{2,20}[市县区]")) queries.add(name.substring(0, name.length() - 1));
        }
        return new ArrayList<>(queries);
    }

    @SuppressWarnings("unchecked") private List<Map<String,Object>> searchPlaces(String name) {
        URI uri = UriComponentsBuilder.fromHttpUrl("https://geocoding-api.open-meteo.com/v1/search")
            .queryParam("name", name).queryParam("count", 20).queryParam("language", "zh")
            .queryParam("format", "json").build().encode().toUri();
        Map<String,Object> raw = fetch(uri);
        return raw.get("results") instanceof List ? (List<Map<String,Object>>) raw.get("results") : Collections.emptyList();
    }

    private List<Map<String,Object>> cityCandidates(List<Map<String,Object>> rows, String query) {
        Map<String,Map<String,Object>> unique = new LinkedHashMap<>();
        for (Map<String,Object> row : rows) {
            if (placeRank(row) == 9 || row.get("id") == null || text(row, "name").isEmpty() || !validCoordinates(row)) continue;
            unique.putIfAbsent(String.valueOf(row.get("id")), row);
        }
        List<Map<String,Object>> sorted = new ArrayList<>(unique.values());
        sorted.sort(Comparator.<Map<String,Object>>comparingInt(r -> samePlace(text(r,"name"), query) ? 0 : 1)
            .thenComparingInt(this::placeRank).thenComparing(Comparator.comparingLong(this::population).reversed()));
        List<Map<String,Object>> result = new ArrayList<>();
        for (Map<String,Object> row : sorted.subList(0, Math.min(8, sorted.size()))) {
            Map<String,Object> item = pick(row,"id","name","latitude","longitude","admin1","admin2","admin3","admin4","country","country_code");
            int rank = placeRank(row);
            item.put("placeType", rank == 0 ? "城市" : rank == 1 ? "区县" : "居民点");
            result.add(item);
        }
        return result;
    }

    private int placeRank(Map<String,Object> row) {
        String feature = text(row, "feature_code");
        if (Arrays.asList("PPLC", "PPLA", "PPLA2", "ADM2").contains(feature)) return 0;
        if (Arrays.asList("PPLA3", "ADM3").contains(feature)) return 1;
        if (!"PPL".equals(feature)) return 9; // Exclude airports, villages and township seats.
        // 淮安市 is tagged PPL, not PPLA2. Administrative names establish its city level.
        if (samePlace(text(row,"name"), text(row,"admin2"))) return 0;
        if (samePlace(text(row,"name"), text(row,"admin3"))) return 1;
        return population(row) >= 50000 ? 2 : 9;
    }

    private static String text(Map<String,Object> row, String key) { return row.get(key) == null ? "" : String.valueOf(row.get(key)); }
    private static boolean samePlace(String a, String b) { return !a.isEmpty() && !b.isEmpty() && a.replaceFirst("[市县区]$", "").equalsIgnoreCase(b.replaceFirst("[市县区]$", "")); }
    private long population(Map<String,Object> row) { return row.get("population") instanceof Number ? ((Number)row.get("population")).longValue() : 0; }
    private boolean validCoordinates(Map<String,Object> row) {
        if (!(row.get("latitude") instanceof Number) || !(row.get("longitude") instanceof Number)) return false;
        double lat = ((Number)row.get("latitude")).doubleValue(), lon = ((Number)row.get("longitude")).doubleValue();
        return Double.isFinite(lat) && Double.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
    }
}
