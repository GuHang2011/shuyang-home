package com.example.Kcsj.membership;

import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import jakarta.servlet.http.HttpServletRequest;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import static com.example.Kcsj.membership.MemberStore.*;
import static com.example.Kcsj.membership.MemberData.*;

/** Public event display: aggregate counts and explicitly published display assets only. */
@RestController @RequestMapping("/display") @Transactional
public class DisplayController {
    private final MemberStore store;private final MemberAuth auth;
    public DisplayController(MemberStore store,MemberAuth auth){this.store=store;this.auth=auth;}
    private List<Map<String,Object>> slides(boolean manage){return store.all("display_slide").stream().filter(r->manage||s(r,"status").equals("published")).sorted(Comparator.comparingInt((Map<String,Object>r)->((Number)r.get("position")).intValue()).thenComparing(r->s(r,"id"))).map(r->pick(r,"id","title","caption","mediaId","type","status","position","seconds","updatedAt")).collect(Collectors.toList());}
    @GetMapping public Map<String,Object> display(){
        ZoneId zone=ZoneId.of("Asia/Shanghai");YearMonth month=YearMonth.now(zone);List<Map<String,Object>>months=new ArrayList<>();Map<String,Integer> counts=new LinkedHashMap<>();
        for(int i=5;i>=0;i--){String key=month.minusMonths(i).toString();counts.put(key,0);}
        List<Map<String,Object>>events=store.all("event").stream().filter(e->s(e,"status").equals("published")).collect(Collectors.toList());
        Map<String,Long>categories=new TreeMap<>();Set<String>publicEvents=new HashSet<>();
        for(Map<String,Object>e:events){publicEvents.add(s(e,"id"));String category=s(e,"category");categories.put(category,categories.getOrDefault(category,0L)+1);
            try{String key=YearMonth.from(Instant.parse(s(e,"startsAt")).atZone(zone)).toString();if(counts.containsKey(key))counts.put(key,counts.get(key)+1);}catch(Exception ignored){}
        }
        counts.forEach((k,v)->months.add(map("label",k,"value",v)));
        long members=store.all("user").stream().filter(u->b(u,"enabled")&&s(u,"status").equals("approved")&&!s(u,"phone").isEmpty()).count();
        double hours=store.all("signup").stream().filter(r->publicEvents.contains(s(r,"eventId"))&&s(r,"status").equals("checked_in")).mapToDouble(r->r.get("hours") instanceof Number?Math.max(0,((Number)r.get("hours")).doubleValue()):0).sum();
        List<Map<String,Object>>upcoming=events.stream().filter(e->{try{return instant(e,"endsAt").isAfter(Instant.now());}catch(Exception ex){return false;}}).sorted(Comparator.comparing(e->s(e,"startsAt"))).limit(4).map(e->pick(e,"id","title","location","startsAt")).collect(Collectors.toList());
        return ApiResponse.ok(map("members",members,"events",events.size(),"hours",Math.round(hours*10)/10.0,"months",months,"categories",categories.entrySet().stream().map(e->map("label",e.getKey(),"value",e.getValue())).collect(Collectors.toList()),"upcoming",upcoming,"slides",slides(false),"updatedAt",now()));
    }
    @GetMapping("/slides") public Map<String,Object> manage(HttpServletRequest req){auth.staff(req);return ApiResponse.ok(slides(true));}
    @PostMapping("/slides") public Map<String,Object> save(@RequestBody Map<String,Object>input,HttpServletRequest req){
        store.lockWrites();Map<String,Object>a=auth.staff(req);String id=text(input,"id",0,80);boolean create=id.isEmpty();Map<String,Object>row=create?map("id",id(),"createdAt",now()):store.get("display_slide",id);
        if(create&&store.all("display_slide").size()>=30)throw new ApiException(409,"最多保留30条素材，请先移除旧素材");
        String mediaId=text(input,"mediaId",1,80);Map<String,Object>media=store.get("attachment",mediaId);
        if(!s(media,"scope").equals("display")||!Arrays.asList("image","video").contains(s(media,"type")))throw new ApiException(400,"请选择大屏专用照片或视频");
        if(!s(row,"mediaId").equals(mediaId)&&(!s(media,"ownerId").equals(s(a,"id"))||b(media,"linked")))throw new ApiException(403,"请上传本人的未发布大屏素材");
        String state=choice(input,"status","draft","published");
        if(state.equals("published")&&!b(input,"consent"))throw new ApiException(400,"请确认素材可公开展示");
        row.putAll(map("title",text(input,"title",2,80),"caption",text(input,"caption",0,300),"mediaId",mediaId,"type",s(media,"type"),"status",state,"position",number(input,"position",0,999),"seconds",number(input,"seconds",5,60),"updatedAt",now()));
        media.put("linked",true);store.save("attachment",media);store.save("display_slide",row);auth.audit(a,"display.save",s(row,"id"));return ApiResponse.ok(row);
    }
    @DeleteMapping("/slides/{id}") public Map<String,Object> remove(@PathVariable String id,HttpServletRequest req){store.lockWrites();Map<String,Object>a=auth.staff(req);store.get("display_slide",id);store.delete("display_slide",id);auth.audit(a,"display.remove",id);return ApiResponse.ok(true);}
}
