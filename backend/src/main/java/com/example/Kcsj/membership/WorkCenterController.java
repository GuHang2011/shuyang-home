package com.example.Kcsj.membership;

import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import javax.servlet.http.HttpServletRequest;
import java.util.*;
import java.util.stream.Collectors;
import static com.example.Kcsj.membership.MemberStore.*;
import static com.example.Kcsj.membership.MemberData.*;

@RestController @Transactional
public class WorkCenterController {
    private final MemberStore store;private final MemberAuth auth;private final WorkCenter work;
    public WorkCenterController(MemberStore store,MemberAuth auth,WorkCenter work){this.store=store;this.auth=auth;this.work=work;}
    private Map<String,Object> ok(Object value){return map("code",0,"data",value);}
    private List<Map<String,Object>> notices(Map<String,Object> a){return store.all("business_notice").stream().filter(n->s(n,"recipientId").equals(s(a,"id"))).sorted(Comparator.comparingLong((Map<String,Object> n)->((Number)n.get("sequence")).longValue()).reversed()).collect(Collectors.toList());}
    @GetMapping("/work/items") public Map<String,Object> items(@RequestParam(defaultValue="false") boolean manage,@RequestParam(defaultValue="all") String filter,@RequestParam(defaultValue="all") String kind,@RequestParam(defaultValue="1") int page,HttpServletRequest req){return ok(work.list(auth.require(req),manage,filter,kind,page));}
    @GetMapping("/work/target") public Map<String,Object> target(@RequestParam String kind,@RequestParam String id,@RequestParam(defaultValue="false") boolean manage,HttpServletRequest req){return ok(work.target(auth.require(req),kind,id,manage));}
    @GetMapping("/work/summary") public Map<String,Object> summary(HttpServletRequest req){
        Map<String,Object> actor=auth.require(req);Map<String,Object> mine=work.list(actor,false,"action","all",1);
        return ok(map("action",mine.get("total"),"unread",notices(actor).stream().filter(n->!b(n,"read")).count(),"canManage",work.manager(actor),"pending",work.manager(actor)?work.list(actor,true,"all","all",1).get("total"):0));
    }
    @GetMapping("/work/notices") public Map<String,Object> inbox(@RequestParam(defaultValue="false") boolean unread,@RequestParam(defaultValue="1") int page,HttpServletRequest req){
        if(page<1||page>100000)throw new ApiException(400,"页码无效");List<Map<String,Object>> all=notices(auth.require(req));
        List<Map<String,Object>> rows=all.stream().filter(n->!unread||!b(n,"read")).collect(Collectors.toList());int pages=Math.max(1,(rows.size()+19)/20),actual=Math.min(page,pages),from=(actual-1)*20;
        return ok(map("items",rows.subList(from,Math.min(from+20,rows.size())).stream().map(n->pick(n,"id","message","kind","targetId","createdAt","read")).collect(Collectors.toList()),"total",rows.size(),"page",actual,"pages",pages,"through",all.isEmpty()?0:all.get(0).get("sequence")));
    }
    @PostMapping("/work/notices/{id}/read") public Map<String,Object> read(@PathVariable String id,HttpServletRequest req){
        store.lockWrites();Map<String,Object> actor=auth.require(req),n=store.get("business_notice",id);if(!s(n,"recipientId").equals(s(actor,"id")))throw new ApiException(404,"通知不存在");
        if(!b(n,"read")){n.put("read",true);store.save("business_notice",n);}return ok(true);
    }
    @PostMapping("/work/notices/read-through") public Map<String,Object> readAll(@RequestBody Map<String,Object> input,HttpServletRequest req){
        store.lockWrites();List<Map<String,Object>> rows=notices(auth.require(req));long through;
        try{through=Long.parseLong(s(input,"through"));}catch(Exception e){throw new ApiException(400,"通知范围无效");}
        long last=rows.isEmpty()?0:((Number)rows.get(0).get("sequence")).longValue();if(through<0||through>last)throw new ApiException(400,"请刷新通知后重试");
        for(Map<String,Object> n:rows)if(((Number)n.get("sequence")).longValue()<=through&&!b(n,"read")){n.put("read",true);store.save("business_notice",n);}return ok(true);
    }
}
