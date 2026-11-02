package com.example.Kcsj.membership;

import java.util.*;

/** Synchronous event: the business record and its inbox entries commit or roll back together. */
public final class BusinessChange {
    public final String kind;
    public final Map<String,Object> before, after;
    public BusinessChange(String kind, Map<String,Object> before, Map<String,Object> after) {
        this.kind=kind;this.before=before;this.after=new LinkedHashMap<>(after);
    }
    public static boolean observes(String kind) {
        return Arrays.asList("user","post","event","signup","order","exchange","contact_exchange",
            "event_proposal","resource","forum_topic","forum_reply","advertisement","crowd_project","crowd_pledge").contains(kind);
    }
}
