package com.example.Kcsj.membership;

import java.time.Instant;
import java.util.*;
import static com.example.Kcsj.membership.MemberStore.*;

/** Shared input validation and explicit response projections. */
public final class MemberData {
    private MemberData() {}
    public static String text(Map<String,Object> data,String key,int min,int max) {
        Object raw=data.get(key);
        if(raw!=null && !(raw instanceof String)) throw new ApiException(400,"字段格式错误："+key);
        String value=s(data,key).trim();
        if(value.length()<min||value.length()>max) throw new ApiException(400,"请检查字段长度："+key+"（"+min+"–"+max+"字）");
        return value;
    }
    public static String choice(Map<String,Object> data,String key,String... allowed) {
        String value=text(data,key,1,40);
        if(!Arrays.asList(allowed).contains(value)) throw new ApiException(400,"选项无效："+key);
        return value;
    }
    public static boolean flag(Map<String,Object> data,String key) {
        if(!(data.get(key) instanceof Boolean)) throw new ApiException(400,"请选择："+key);
        return b(data,key);
    }
    public static int number(Map<String,Object> data,String key,int min,int max) {
        try {
            double value=Double.parseDouble(s(data,key));
            if(!Double.isFinite(value)||value!=Math.rint(value)||value<min||value>max) throw new Exception();
            return (int)value;
        } catch(Exception e) { throw new ApiException(400,"数字范围错误："+key); }
    }
    public static Instant instant(Map<String,Object> data,String key) {
        try { return Instant.parse(s(data,key)); }
        catch(Exception e) { throw new ApiException(400,"日期格式错误："+key); }
    }
    public static Map<String,Object> pick(Map<String,Object> data,String... keys) {
        Map<String,Object> result=new LinkedHashMap<>();
        for(String key:keys) if(data.containsKey(key)) result.put(key,data.get(key));
        return result;
    }
    public static Map<String,Object> profile(Map<String,Object> input) {
        return map("name",text(input,"name",2,30),"hometown",text(input,"hometown",2,50),
            "district",text(input,"district",2,50),"industry",text(input,"industry",0,50),
            "bio",text(input,"bio",0,300),"volunteer",flag(input,"volunteer"),
            "directoryVisible",flag(input,"directoryVisible"),"phoneVisible",flag(input,"phoneVisible"));
    }
    public static Map<String,Object> self(Map<String,Object> user) {
        return pick(user,"id","memberNo","username","phone","name","hometown","district","industry","bio",
            "role","forumBoards","status","enabled","volunteer","directoryVisible","phoneVisible","createdAt","reviewNote","mustChangePassword");
    }
}
