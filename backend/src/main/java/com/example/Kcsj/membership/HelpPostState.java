package com.example.Kcsj.membership;

import java.util.*;
import java.time.Instant;
import static com.example.Kcsj.membership.MemberStore.*;

public final class HelpPostState {
    private HelpPostState(){}
    public static String state(Map<String,Object> row) {
        if(s(row,"status").equals("closed"))return "closed";
        String progress=s(row,"progress");if(progress.equals("resolved"))return progress;
        String expiry=s(row,"expiresAt");
        if(!expiry.isEmpty()&&!Instant.parse(expiry).isAfter(Instant.now()))return "expired";
        return progress.equals("helping")?"helping":"open";
    }
    public static boolean needsReview(Map<String,Object> row){return s(row,"status").equals("pending")||s(row,"draftStatus").equals("pending");}
    public static long revision(Map<String,Object> row){return row.get("editRevision") instanceof Number?((Number)row.get("editRevision")).longValue():0;}
    public static Map<String,Object> view(Map<String,Object> row,boolean privateView) {
        Map<String,Object> result=new LinkedHashMap<>(row);result.put("progressState",state(row));
        if(!privateView)for(String key:Arrays.asList("editDraft","draftStatus","draftNote","reviewNote","reviewedBy","history","editRevision"))result.remove(key);
        result.remove("businessVersion");return result;
    }
}
