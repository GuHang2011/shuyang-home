package com.example.Kcsj;
import com.example.Kcsj.membership.*;
import org.junit.jupiter.api.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.http.MediaType;
import java.util.*;
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
        server.expect(requestTo(startsWith("https://geocoding-api.open-meteo.com/v1/search?"))).andRespond(withSuccess("{\"results\":[{\"id\":1,\"name\":\"Suzhou\",\"latitude\":31.3,\"longitude\":120.6,\"country\":\"China\",\"unneeded\":\"private\"}]}",MediaType.APPLICATION_JSON));
        assertFalse(service.cities("Suzhou").toString().contains("private"));assertThrows(ApiException.class,()->service.cities("a"));server.verify();
    }
    @Test void providerFailureDoesNotReturnInventedWeather(){server.expect(anything()).andRespond(withServerError());assertThrows(ApiException.class,()->service.forecast("31.3","120.6"));server.verify();}
}
