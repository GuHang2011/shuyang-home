package com.example.Kcsj.membership;
import org.springframework.web.bind.annotation.*;
import javax.servlet.http.HttpServletRequest;
import java.util.Map;
import static com.example.Kcsj.membership.MemberStore.*;
@RestController
@RequestMapping("/weather")
public class WeatherController {
    private final WeatherService weather;
    private final MemberAuth auth;
    public WeatherController(WeatherService weather,MemberAuth auth){this.weather=weather;this.auth=auth;}
    @GetMapping public Map<String,Object> current(@RequestParam String latitude,@RequestParam String longitude,HttpServletRequest req){auth.limit("weather:"+req.getRemoteAddr(),120);return map("code",0,"data",weather.forecast(latitude,longitude));}
    @GetMapping("/cities") public Map<String,Object> cities(@RequestParam String name,HttpServletRequest req){auth.limit("weather-city:"+req.getRemoteAddr(),60);return map("code",0,"data",weather.cities(name));}
}
