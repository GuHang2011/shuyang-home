package com.example.Kcsj.membership;

import java.util.Map;

/** Shared response helper: replaces the identical private ok() duplicated across 10 controllers. */
public final class ApiResponse {
    private ApiResponse() {}
    public static Map<String,Object> ok(Object data) { return MemberStore.map("code", 0, "data", data); }
}
