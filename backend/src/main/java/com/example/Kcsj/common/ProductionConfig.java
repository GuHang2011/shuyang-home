package com.example.Kcsj.common;

import java.net.URI;
import java.util.Base64;
import java.util.List;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;

/** Reject unsafe deployment settings before any database is opened or changed. */
@Configuration(proxyBeanMethods = false)
@Profile("prod")
public class ProductionConfig {
    @Bean
    static BeanFactoryPostProcessor productionSettings(Environment environment) {
        return factory -> validate(environment);
    }

    public static void validate(Environment env) {
        require(env.getProperty("shuyang.production", Boolean.class, false), "Use the supplied application-prod.properties");
        require(List.of("127.0.0.1", "::1").contains(env.getProperty("server.address", "")), "server.address must be loopback behind the HTTPS proxy");
        String database = env.getProperty("spring.datasource.url", "");
        require(database.matches("jdbc:h2:file:(/[^;]+|[A-Za-z]:[/\\\\][^;]+)(;.*)?")
            && !database.toUpperCase(java.util.Locale.ROOT).contains("AUTO_SERVER=TRUE"),
            "SHUYANG_DB_URL must use an absolute, single-instance H2 file path");
        String databasePassword = env.getProperty("spring.datasource.password", "");
        require(databasePassword.length() >= 16 && !placeholder(databasePassword), "Set a random SHUYANG_DB_PASSWORD of at least 16 characters");
        String key = env.getProperty("shuyang.data-key", "");
        try {
            int bytes = Base64.getDecoder().decode(key).length;
            require(bytes == 16 || bytes == 32, "Set SHUYANG_DATA_KEY to a Base64 AES key (16 or 32 bytes)");
        } catch (IllegalArgumentException error) {
            throw new IllegalStateException("Set SHUYANG_DATA_KEY to a Base64 AES key (16 or 32 bytes)");
        }
        String origins = env.getProperty("shuyang.allowed-origins", "");
        require(!origins.isBlank(), "Set SHUYANG_ALLOWED_ORIGINS to the real HTTPS site origin");
        for (String value : origins.split(",", -1)) {
            try {
                URI origin = URI.create(value.trim());
                String host = origin.getHost();
                require("https".equals(origin.getScheme()) && host != null
                    && !host.equals("localhost") && !host.equals("example.com") && !host.endsWith(".example.com")
                    && origin.getRawUserInfo() == null && origin.getRawQuery() == null && origin.getRawFragment() == null
                    && (origin.getRawPath() == null || origin.getRawPath().isEmpty()),
                    "SHUYANG_ALLOWED_ORIGINS must contain exact HTTPS origins without paths or example domains");
            } catch (IllegalArgumentException error) {
                throw new IllegalStateException("SHUYANG_ALLOWED_ORIGINS contains an invalid origin");
            }
        }
        require(!env.getProperty("shuyang.weather.allow-local-network-location", Boolean.class, false),
            "SHUYANG_WEATHER_LOCAL_NETWORK must be false in production");
        String initialPassword = env.getProperty("shuyang.admin-password", "");
        require(initialPassword.isEmpty() || (!placeholder(initialPassword) && initialPassword.length() >= 12
            && initialPassword.length() <= 128 && initialPassword.matches(".*[A-Za-z].*") && initialPassword.matches(".*[0-9].*")),
            "Set a unique SHUYANG_ADMIN_PASSWORD for first startup, or leave it empty after initialization");
    }

    private static boolean placeholder(String value) {
        return value.toUpperCase(java.util.Locale.ROOT).contains("REPLACE_");
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new IllegalStateException("Production configuration: " + message);
    }
}
