package com.example.Kcsj.membership;

import java.util.*;
import static com.example.Kcsj.membership.MemberStore.*;

/** Presentation flags never grant access to a topic or bypass its review. */
public final class ForumPromotion {
    private ForumPromotion() {}
    public static long revision(Map<String,Object> row) {
        return row.get("promotionRevision") instanceof Number ? ((Number)row.get("promotionRevision")).longValue() : 0;
    }
    public static void clear(Map<String,Object> row) {
        row.putAll(map("pinned",false,"hot",false,"pinnedAt","","promotionRevision",revision(row)+1));
    }
    public static Comparator<Map<String,Object>> order() {
        return Comparator.comparing((Map<String,Object> row)->b(row,"pinned")).reversed()
            .thenComparing(row->s(row,"pinnedAt"),Comparator.reverseOrder())
            .thenComparing(row->s(row,"createdAt"),Comparator.reverseOrder())
            .thenComparing(row->s(row,"id"));
    }
}
