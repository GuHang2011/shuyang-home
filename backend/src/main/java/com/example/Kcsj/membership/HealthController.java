package com.example.Kcsj.membership;

import java.util.Map;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
    private final JdbcTemplate jdbc;

    public HealthController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @GetMapping("/health")
    public ResponseEntity<Map<String,Object>> health() {
        try {
            Integer ready = jdbc.queryForObject("SELECT COUNT(*) FROM syh_write_lock WHERE id=1", Integer.class);
            if (Integer.valueOf(1).equals(ready))
                return ResponseEntity.ok(ApiResponse.ok(MemberStore.map("status", "up", "application", "shuyang-home")));
        } catch (DataAccessException unavailable) {
            // Health probes expose no credentials, SQL errors or database paths.
        }
        return ResponseEntity.status(503).body(MemberStore.map("code", 503, "message", "服务暂时不可用", "data", MemberStore.map("status", "down")));
    }
}
