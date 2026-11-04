package com.example.Kcsj.membership;

import java.time.Instant;
import java.util.*;
import static com.example.Kcsj.membership.MemberStore.*;
import static com.example.Kcsj.membership.MemberData.pick;

public final class Broadcasts {
    private Broadcasts() {}
    public static String state(Map<String,Object> row,Instant time) {
        if(!s(row,"status").equals("published"))return s(row,"status");
        if(!time.isBefore(Instant.parse(s(row,"endsAt"))))return "expired";
        return time.isBefore(Instant.parse(s(row,"startsAt")))?"scheduled":"active";
    }
    public static boolean active(Map<String,Object> row) {return state(row,Instant.now()).equals("active");}
    public static long revision(Map<String,Object> row) {return ((Number)row.get("revision")).longValue();}
    public static Map<String,Object> view(Map<String,Object> row,Instant time) {
        Map<String,Object> result=pick(row,"id","title","content","audio","startsAt","endsAt","status","revision","createdAt","updatedAt");
        result.put("state",state(row,time));return result;
    }
}
