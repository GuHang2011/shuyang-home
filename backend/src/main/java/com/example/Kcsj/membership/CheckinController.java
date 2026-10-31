package com.example.Kcsj.membership;

import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import javax.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.*;
import static com.example.Kcsj.membership.MemberStore.*;
import static com.example.Kcsj.membership.MemberData.*;

@RestController @Transactional
public class CheckinController {
    private final MemberStore store;private final MemberAuth auth;
    public CheckinController(MemberStore store,MemberAuth auth){this.store=store;this.auth=auth;}
    private Map<String,Object> ok(Object row){return map("code",0,"data",row);}
    private Map<String,Object> config(String id){return store.all("event_checkin").stream().filter(r->s(r,"id").equals(id)).findFirst().orElse(map("id",id,"enabled",false));}
    @GetMapping("/events/{id}/checkin-config") public Map<String,Object> get(@PathVariable String id,HttpServletRequest req){Map<String,Object> actor=auth.require(req);auth.member(actor);Map<String,Object> event=store.get("event",id);if(s(event,"status").equals("draft")&&!auth.isStaff(actor))throw new ApiException(404,"活动不存在");Map<String,Object> view=pick(config(id),"id","enabled","latitude","longitude","radius","opensAt","closesAt");view.put("eventTitle",s(event,"title"));return ok(view);}
    @PutMapping("/events/{id}/checkin-config") public Map<String,Object> configure(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req){
        store.lockWrites();Map<String,Object> actor=auth.staff(req),event=store.get("event",id);boolean enabled=flag(input,"enabled");Map<String,Object> row=config(id);row.put("enabled",enabled);
        if(enabled){double lat=WeatherService.coordinate(s(input,"latitude"),-90,90),lon=WeatherService.coordinate(s(input,"longitude"),-180,180);int radius=number(input,"radius",50,2000);Instant open=instant(input,"opensAt"),close=instant(input,"closesAt");if(!close.isAfter(open)||open.isBefore(instant(event,"startsAt").minusSeconds(3600))||close.isAfter(instant(event,"endsAt").plusSeconds(7200)))throw new ApiException(400,"签到窗口须在活动开始前1小时至结束后2小时之间");row.putAll(map("latitude",lat,"longitude",lon,"radius",radius,"opensAt",open.toString(),"closesAt",close.toString()));}
        row.remove("tokenHash");row.remove("codeExpiresAt");store.save("event_checkin",row);auth.audit(actor,"event.checkin-config",id);return ok(pick(row,"id","enabled","latitude","longitude","radius","opensAt","closesAt"));
    }
    @PostMapping("/events/{id}/checkin-code") public Map<String,Object> code(@PathVariable String id,HttpServletRequest req){store.lockWrites();Map<String,Object> actor=auth.staff(req),row=config(id);Map<String,Object> event=store.get("event",id);if(!b(row,"enabled")||!s(event,"status").equals("published"))throw new ApiException(409,"请先启用已发布活动的地点签到");String token=UUID.randomUUID().toString();Instant expires=Instant.now().plusSeconds(300);row.put("tokenHash",auth.digest(token));row.put("codeExpiresAt",expires.toString());store.save("event_checkin",row);auth.audit(actor,"event.checkin-code",id);return ok(map("code","SYH:CHECKIN:"+id+":"+token,"expiresAt",expires.toString()));}
    @PostMapping("/events/{id}/self-check-in") public Map<String,Object> checkin(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req){
        store.lockWrites();Map<String,Object> actor=auth.require(req);auth.member(actor);auth.limit("location-checkin:"+s(actor,"id"),30);Map<String,Object> event=store.get("event",id),settings=config(id),signup=store.get("signup",id+":"+s(actor,"id"));
        if(s(signup,"status").equals("checked_in"))return ok(signup);if(!s(signup,"status").equals("registered")||!s(event,"status").equals("published")||!b(settings,"enabled"))throw new ApiException(409,"请先报名，并确认活动已开放地点签到");
        Instant now=Instant.now();if(now.isBefore(instant(settings,"opensAt"))||now.isAfter(instant(settings,"closesAt")))throw new ApiException(409,"当前不在签到时间内");
        String code=text(input,"code",0,100);if(!code.isEmpty()&&(!auth.digest(code).equals(s(settings,"tokenHash"))||s(settings,"codeExpiresAt").isEmpty()||now.isAfter(instant(settings,"codeExpiresAt"))))throw new ApiException(409,"签到二维码已失效，请扫描现场新码或使用地点签到");
        double lat=WeatherService.coordinate(s(input,"latitude"),-90,90),lon=WeatherService.coordinate(s(input,"longitude"),-180,180),accuracy=WeatherService.coordinate(s(input,"accuracy"),0,2000);int radius=((Number)settings.get("radius")).intValue();if(accuracy<=0||accuracy>Math.min(200,radius))throw new ApiException(400,"定位精度不足，请到开阔处重新定位或联系组织者");
        double distance=distance(lat,lon,((Number)settings.get("latitude")).doubleValue(),((Number)settings.get("longitude")).doubleValue());if(distance>radius)throw new ApiException(409,"距离签到点约"+Math.round(distance)+"米，需进入"+radius+"米范围");
        signup.putAll(map("status","checked_in","hours",0,"hoursFinalized",false,"checkedAt",now(),"checkedBy",s(actor,"id"),"checkinMethod","location","distanceMeters",Math.round(distance)));store.save("signup",signup);auth.audit(actor,"event.location-check-in",s(signup,"id"));return ok(signup);
    }
    public static double distance(double lat,double lon,double targetLat,double targetLon){double a=Math.pow(Math.sin(Math.toRadians(targetLat-lat)/2),2)+Math.cos(Math.toRadians(lat))*Math.cos(Math.toRadians(targetLat))*Math.pow(Math.sin(Math.toRadians(targetLon-lon)/2),2);return 6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));}
}
