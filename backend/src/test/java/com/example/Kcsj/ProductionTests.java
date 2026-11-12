package com.example.Kcsj;

import com.example.Kcsj.common.ProductionConfig;
import com.example.Kcsj.membership.*;
import java.util.Base64;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProductionTests {
    private MockEnvironment valid() {
        return new MockEnvironment().withProperty("shuyang.production", "true")
            .withProperty("server.address", "127.0.0.1")
            .withProperty("spring.datasource.url", "jdbc:h2:file:/var/lib/shuyang-home/main;DB_CLOSE_ON_EXIT=FALSE")
            .withProperty("spring.datasource.password", "SyntheticDatabase1234")
            .withProperty("shuyang.data-key", Base64.getEncoder().encodeToString(new byte[32]))
            .withProperty("shuyang.allowed-origins", "https://members.test,https://mobile.test");
    }

    @Test void acceptsPersistentEncryptedLoopbackDeployment() {
        assertDoesNotThrow(() -> ProductionConfig.validate(valid()));
    }

    @ParameterizedTest
    @CsvSource({
        "server.address,0.0.0.0",
        "shuyang.production,false",
        "spring.datasource.url,jdbc:h2:mem:test",
        "spring.datasource.url,jdbc:h2:file:./data/test",
        "spring.datasource.url,jdbc:h2:file:/data/test;AUTO_SERVER=TRUE",
        "spring.datasource.password,REPLACE_WITH_RANDOM_DATABASE_PASSWORD",
        "spring.datasource.password,short",
        "shuyang.data-key,''",
        "shuyang.data-key,not-base64",
        "shuyang.allowed-origins,''",
        "shuyang.allowed-origins,*",
        "shuyang.allowed-origins,http://members.test",
        "shuyang.allowed-origins,https://members.example.com",
        "shuyang.allowed-origins,https://members.test/path",
        "shuyang.allowed-origins,https://user:password@members.test",
        "shuyang.allowed-origins,https://members.test?secret=1",
        "shuyang.allowed-origins,https://members.test#fragment",
        "shuyang.weather.allow-local-network-location,true",
        "shuyang.admin-password,REPLACE_WITH_RANDOM_INITIAL_ADMIN_PASSWORD",
        "shuyang.admin-password,short123"
    })
    void rejectsUnsafeSettingsWithoutDisclosingTheirValues(String key, String value) {
        IllegalStateException error = assertThrows(IllegalStateException.class, () -> ProductionConfig.validate(valid().withProperty(key, value)));
        assertFalse(error.getMessage().contains("SyntheticDatabase1234"));
        assertFalse(error.getMessage().contains("user:password"));
    }

    @Test void freshProductionDatabaseRequiresAnInitialAdministrator() {
        MemberStore store = mock(MemberStore.class);
        when(store.all("user")).thenReturn(List.of());
        MemberAuth auth = new MemberAuth(store);
        ReflectionTestUtils.setField(auth, "initialPassword", "");
        ReflectionTestUtils.setField(auth, "production", true);
        assertThrows(IllegalStateException.class, auth::bootstrap);
        when(store.all("user")).thenReturn(List.of(MemberStore.map("role", "superadmin")));
        assertDoesNotThrow(auth::bootstrap);
    }

    @Test void healthChecksTheDatabaseWithoutExposingItsFailure() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        HealthController health = new HealthController(jdbc);
        when(jdbc.queryForObject(anyString(), eq(Integer.class))).thenReturn(1);
        assertEquals(200, health.health().getStatusCode().value());
        when(jdbc.queryForObject(anyString(), eq(Integer.class))).thenThrow(new DataAccessResourceFailureException("private-path-and-password"));
        var result = health.health();
        assertEquals(503, result.getStatusCode().value());
        assertFalse(result.getBody().toString().contains("private-path-and-password"));
    }
}
