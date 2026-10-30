package com.example.Kcsj;
import com.example.Kcsj.membership.*;
import org.junit.jupiter.api.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.http.MediaType;
import java.util.*;
import java.net.URLDecoder;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.test.util.ReflectionTestUtils;
import static com.example.Kcsj.membership.MemberStore.map;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import static org.hamcrest.Matchers.startsWith;
class WeatherServiceTests {
    RestTemplate http;MockRestServiceServer server;WeatherService service;
    @BeforeEach void setup(){http=new RestTemplate();server=MockRestServiceServer.bindTo(http).build();service=new WeatherService(http);}
    @Test void forecastUsesFixedHostCoarseCoordinatesAndCache(){
        server.expect(requestTo(startsWith("https://api.open-meteo.com/v1/forecast?"))).andExpect(queryParam("latitude","31.3")).andExpect(queryParam("longitude","120.6")).andRespond(withSuccess("{\"current\":{\"temperature_2m\":21},\"daily\":{\"time\":[]}}",MediaType.APPLICATION_JSON));
        Object first=service.forecast("31.301234","120.601234");assertSame(first,service.forecast("31.301234","120.601234"));server.verify();
    }
    @Test void invalidCoordinatesNeverCallProvider(){for(String invalid:Arrays.asList("NaN","Infinity","91","-91","abc"))assertThrows(ApiException.class,()->service.forecast(invalid,"120"));assertThrows(ApiException.class,()->service.forecast("31","181"));server.verify();}
    @Test void citySearchProjectsOnlyNeededLocationFields(){
        server.expect(requestTo(startsWith("https://geocoding-api.open-meteo.com/v1/search?"))).andRespond(withSuccess("{\"results\":[{\"id\":1,\"name\":\"Suzhou\",\"feature_code\":\"PPLA2\",\"latitude\":31.3,\"longitude\":120.6,\"country\":\"China\",\"unneeded\":\"private\"}]}",MediaType.APPLICATION_JSON));
        assertFalse(service.cities("Suzhou").toString().contains("private"));assertThrows(ApiException.class,()->service.cities("a"));server.verify();
    }
    @Test void providerFailureDoesNotReturnInventedWeather(){server.expect(anything()).andRespond(withServerError());assertThrows(ApiException.class,()->service.forecast("31.3","120.6"));server.verify();}

    // The names, feature codes and coordinates below reproduce the real GeoNames responses.
    @Test void huaianShortNameFindsJiangsuCityEvenWhenProviderTagsItAsPpl() throws Exception {
        expectPlaces("淮安市", place(1797873,"淮安市","PPL","江苏","淮安市",33.58861,119.01917));
        List<Map<String,Object>> rows = cities("淮安");
        assertEquals(1,rows.size());assertEquals("江苏",rows.get(0).get("admin1"));assertEquals("城市",rows.get(0).get("placeType"));
        assertEquals(33.58861,rows.get(0).get("latitude"));assertEquals(119.01917,rows.get(0).get("longitude"));
        assertSame(rows,service.cities(" 淮安 "));server.verify();
    }
    @Test void removesSameNamedVillagesAndAirportsWithoutRelabelingTheirCoordinates() throws Exception {
        expectPlaces("Huai'an", place(1941819,"淮安","PPL","福建省","福州市",26.08241,119.24467),
            place(10041830,"淮安","PPL","云南","大理白族自治州",25.6936,99.9357),
            place(7910482,"淮安涟水机场","AIRP","江苏","淮安市",33.78685,119.12853),
            place(1797873,"淮安市","PPL","江苏","淮安市",33.58861,119.01917));
        List<Map<String,Object>> rows=cities("Huai'an");assertEquals(1,rows.size());assertEquals(1797873,rows.get(0).get("id"));server.verify();
    }
    @Test void shortAndOfficialCityNamesWorkForOtherCities() throws Exception {
        expectPlaces("宿州市",place(1793743,"宿州市","PPLA2","安徽","宿州市",33.63611,116.97889));
        expectPlaces("苏州市");expectPlaces("苏州",place(1886760,"苏州","PPLA2","江苏","苏州市",31.30408,120.59538));
        assertEquals("安徽",cities("宿州").get(0).get("admin1"));assertEquals("江苏",cities("苏州市").get(0).get("admin1"));server.verify();
    }
    @Test void countyCandidatesPreserveHierarchyAndHometownShortcutNeedsNoProvider() throws Exception {
        expectPlaces("测试县",map("id",1,"name","测试县","feature_code","PPLA3","admin1","测试省","admin2","测试市","admin3","测试县","latitude",32,"longitude",118));
        Map<String,Object> county=cities("测试县").get(0);assertEquals("区县",county.get("placeType"));assertEquals("测试市",county.get("admin2"));assertEquals("测试县",county.get("admin3"));
        Map<String,Object> hometown=cities("沭阳").get(0);assertEquals("宿迁市",hometown.get("admin2"));assertEquals(34.13,hometown.get("latitude"));server.verify();
    }
    @Test void duplicateAndInvalidCoordinatesAreExcludedButSameNamedCitiesRemainDistinct() throws Exception {
        Map<String,Object> first=place(1,"Example","PPLA2","A","Example",30,120), second=place(2,"Example","PPLA2","B","Example",31,121);
        expectPlaces("Example",first,first,second,place(3,"Example","PPLA2","C","Example",91,120));
        assertEquals(2,cities("Example").size());server.verify();
    }
    @Test void onlyVillagesReturnsEmptyRatherThanInventingACity() throws Exception {
        expectPlaces("Hamlet",place(1,"Hamlet","PPL","Region","Other city",30,120));assertTrue(cities("Hamlet").isEmpty());server.verify();
    }
    @Test void networkLocationUsesVisitorAddressAndProjectsCoarseCityOnly() {
        server.expect(requestTo("https://ipwho.is/8.8.8.8?lang=zh-CN")).andRespond(withSuccess("{\"success\":true,\"city\":\"示例城市\",\"region\":\"示例省\",\"country\":\"中国\",\"latitude\":33.58861,\"longitude\":119.01917,\"ip\":\"8.8.8.8\",\"connection\":{\"isp\":\"private\"}}",MediaType.APPLICATION_JSON));
        Map<?,?> row=(Map<?,?>)service.networkLocation("8.8.8.8");assertEquals(33.59,row.get("latitude"));assertEquals(119.02,row.get("longitude"));assertEquals("network",row.get("locationSource"));assertEquals(true,row.get("approximate"));assertFalse(row.containsKey("ip"));assertFalse(row.containsKey("connection"));assertSame(row,service.networkLocation("8.8.8.8"));server.verify();
    }
    @Test void networkLocationRejectsPrivateMalformedAndUntrustedInputWithoutCallingProvider() {
        for(String ip:Arrays.asList("127.0.0.1","::1","10.1.2.3","192.168.1.2","169.254.1.1","100.64.0.1","fc00::1","2001:db8::1","0.0.0.0","example.com","8.8.8.8/evil","8.8.8.8, 1.1.1.1","999.1.1.1")) assertThrows(ApiException.class,()->service.networkLocation(ip),ip);
        server.verify();
    }
    @Test void localPreviewNetworkExitRequiresExplicitConfiguration() {
        ReflectionTestUtils.setField(service,"allowLocalNetworkLocation",true);
        server.expect(requestTo("https://ipwho.is/?lang=zh-CN")).andRespond(withSuccess("{\"success\":true,\"city\":\"示例城市\",\"latitude\":30,\"longitude\":120}",MediaType.APPLICATION_JSON));
        assertNotNull(service.networkLocation("127.0.0.1"));assertThrows(ApiException.class,()->service.networkLocation("192.168.1.1"));server.verify();
    }
    @Test void networkProviderFailureAndInvalidDataDoNotSelectAnInventedCity() {
        server.expect(anything()).andRespond(withServerError());
        server.expect(anything()).andRespond(withSuccess("{\"success\":false,\"city\":\"wrong\",\"latitude\":30,\"longitude\":120}",MediaType.APPLICATION_JSON));
        server.expect(anything()).andRespond(withSuccess("{\"success\":true,\"city\":\"wrong\",\"latitude\":91,\"longitude\":120}",MediaType.APPLICATION_JSON));
        for(int i=0;i<3;i++)assertThrows(ApiException.class,()->service.networkLocation("8.8.8.8"));server.verify();
    }
    @SuppressWarnings("unchecked") private List<Map<String,Object>> cities(String name){return (List<Map<String,Object>>)service.cities(name);}
    private Map<String,Object> place(int id,String name,String feature,String province,String city,double lat,double lon){return map("id",id,"name",name,"feature_code",feature,"admin1",province,"admin2",city,"country","中国","country_code","CN","latitude",lat,"longitude",lon);}
    @SafeVarargs private final void expectPlaces(String query,Map<String,Object>... rows) throws Exception {
        server.expect(requestTo(startsWith("https://geocoding-api.open-meteo.com/v1/search?")))
            .andExpect(request->assertTrue(URLDecoder.decode(request.getURI().getRawQuery(),"UTF-8").contains("name="+query+"&")))
            .andRespond(withSuccess(new ObjectMapper().writeValueAsString(map("results",Arrays.asList(rows))),MediaType.APPLICATION_JSON));
    }
}
