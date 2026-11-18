package com.example.Kcsj;

import com.example.Kcsj.common.CorsConfig;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpHeaders;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class CorsConfigTests {
    private MockMvc client(String origins) {
        CorsConfig config = new CorsConfig();
        ReflectionTestUtils.setField(config, "origins", origins);
        return MockMvcBuilders.standaloneSetup(new FixtureController())
            .addFilters(config.corsFilter()).build();
    }

    @ParameterizedTest
    @ValueSource(strings = {"https://members.test", "https://mobile.test"})
    void allowsConfiguredOriginsDespiteSurroundingWhitespaceAndEmptyEntries(String origin) throws Exception {
        client("https://members.test,  https://mobile.test , , ")
            .perform(options("/cors-fixture")
                .header(HttpHeaders.ORIGIN, origin)
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "authorization,content-type"))
            .andExpect(status().isOk())
            .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, origin))
            .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_HEADERS, "authorization, content-type"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"https://unlisted.test", "https://mobile.test.attacker.test", "null"})
    void emptyEntriesDoNotPermitUnconfiguredOrigins(String origin) throws Exception {
        client("https://members.test, , https://mobile.test, ")
            .perform(options("/cors-fixture")
                .header(HttpHeaders.ORIGIN, origin)
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
            .andExpect(status().isForbidden())
            .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " , , "})
    void entirelyEmptyConfigurationKeepsCrossOriginRequestsDenied(String origins) throws Exception {
        client(origins)
            .perform(options("/cors-fixture")
                .header(HttpHeaders.ORIGIN, "https://members.test")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
            .andExpect(status().isForbidden())
            .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    @RestController
    static class FixtureController {
        @PostMapping("/cors-fixture")
        String post() { return "fixture"; }
    }
}
