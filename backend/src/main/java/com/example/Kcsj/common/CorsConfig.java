package com.example.Kcsj.common;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import java.util.Arrays;

@Configuration
public class CorsConfig {
    @Value("${shuyang.allowed-origins}") private String origins;
    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config=new CorsConfiguration();
        config.setAllowedOrigins(Arrays.asList(origins.split(",")));
        config.setAllowedMethods(Arrays.asList("GET","POST","PUT","OPTIONS"));
        config.setAllowedHeaders(Arrays.asList("Authorization","Content-Type","Idempotency-Key","X-Client-Version"));
        config.setExposedHeaders(Arrays.asList("Content-Disposition","Idempotency-Replayed"));
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source=new UrlBasedCorsConfigurationSource();source.registerCorsConfiguration("/**",config);
        return new FirstCorsFilter(source);
    }
    private static class FirstCorsFilter extends CorsFilter implements Ordered {
        FirstCorsFilter(UrlBasedCorsConfigurationSource source){super(source);}
        @Override public int getOrder(){return Ordered.HIGHEST_PRECEDENCE;}
    }
}
