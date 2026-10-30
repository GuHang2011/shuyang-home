package com.example.Kcsj.membership;

import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import javax.servlet.http.HttpServletRequest;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import static com.example.Kcsj.membership.MemberStore.*;
import static com.example.Kcsj.membership.MemberData.*;

@RestController
@Transactional
public class MemberController {
    private final MemberStore store;
    private final MemberAuth auth;
    public MemberController(MemberStore store,MemberAuth auth) {this.store=store;this.auth=auth;}
    private Map<String,Object> ok(Object data) {return map("code",0,"data",data);}
    private List<Map<String,Object>> recent(String kind) {
        List<Map<String,Object>> rows=store.all(kind);
        rows.sort(Comparator.comparing((Map<String,Object> x)->s(x,"createdAt")).reversed());return rows;
    }
    @GetMapping("/health") public Map<String,Object> health() {return ok(map("status","up","application","shuyang-home"));}
    @PostMapping("/auth/register") public Map<String,Object> register(@RequestBody Map<String,Object> input,HttpServletRequest req) {return ok(auth.register(input,req.getRemoteAddr()));}
    @PostMapping("/auth/login") public Map<String,Object> login(@RequestBody Map<String,Object> input,HttpServletRequest req) {return ok(auth.login(input,req.getRemoteAddr()));}
    @GetMapping("/auth/me") public Map<String,Object> me(HttpServletRequest req) {return ok(self(auth.require(req)));}
    @PostMapping("/auth/password") public Map<String,Object> password(@RequestBody Map<String,Object> input,HttpServletRequest req) {return ok(auth.changePassword(req,input));}
    @PostMapping("/auth/logout") public Map<String,Object> logout(HttpServletRequest req) {auth.logout(req);return ok(true);}

    @GetMapping("/home") public Map<String,Object> home() {
        long members=store.all("user").stream().filter(x->s(x,"status").equals("approved")&&b(x,"enabled")&&!s(x,"phone").isEmpty()).count();
        long events=store.all("event").stream().filter(x->s(x,"status").equals("published")).count();
        double hours=store.all("signup").stream().mapToDouble(x->x.get("hours") instanceof Number?((Number)x.get("hours")).doubleValue():0).sum();
        return ok(map("members",members,"events",events,"volunteerHours",hours,"phone","13862597517",
            "address","苏州市木渎镇兵圣路200号","slogan","乡情相聚，守望相助"));
    }
    @PutMapping("/profile") public Map<String,Object> profileUpdate(@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> user=auth.require(req);user.putAll(profile(input));
        if(b(input,"resubmit")&&s(user,"status").equals("rejected")) {user.put("status","pending");user.put("reviewNote","");}
        store.save("user",user);auth.audit(user,"profile.update",s(user,"id"));return ok(self(user));
    }
    @GetMapping("/members") public Map<String,Object> directory(HttpServletRequest req) {
        auth.member(auth.require(req));
        List<Map<String,Object>> result=new ArrayList<>();
        for(Map<String,Object> user:recent("user")) if(b(user,"enabled")&&s(user,"status").equals("approved")&&b(user,"directoryVisible")) {
            Map<String,Object> entry=pick(user,"id","memberNo","name","hometown","district","industry","bio","volunteer");
            if(b(user,"phoneVisible")) entry.put("phone",s(user,"phone"));result.add(entry);
        }
        return ok(result);
    }
    @GetMapping("/admin/members") public Map<String,Object> members(HttpServletRequest req) {
        auth.staff(req);return ok(recent("user").stream().map(MemberData::self).collect(Collectors.toList()));
    }
    @PostMapping("/admin/members/{id}/review") public Map<String,Object> review(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=auth.staff(req),user=store.get("user",id);
        if(!s(user,"status").equals("pending")) throw new ApiException(409,"该申请已处理，请刷新列表");
        String status=choice(input,"status","approved","rejected");String note=text(input,"note",status.equals("rejected")?2:0,300);
        user.putAll(map("status",status,"reviewNote",note,"reviewedAt",now(),"reviewedBy",s(actor,"id")));
        if(status.equals("approved")&&s(user,"memberNo").isEmpty()) user.put("memberNo","SY"+id.replace("-","").toUpperCase(Locale.ROOT));
        store.save("user",user);auth.audit(actor,"membership."+status,id);return ok(self(user));
    }
    @PostMapping("/admin/members/{id}/access") public Map<String,Object> access(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=auth.admin(req),user=store.get("user",id);
        String role=choice(input,"role","member","organizer","moderator","admin","superadmin");boolean enabled=flag(input,"enabled");
        if(!auth.isSuper(actor)&&(!s(user,"role").equals("member")||!role.equals("member")))throw new ApiException(403,"仅超级管理员可以设置管理角色或处理管理账号");
        if(!s(user,"status").equals("approved")&&!role.equals("member")) throw new ApiException(400,"未通过审核的申请者不能授予管理角色");
        if(s(user,"role").equals("superadmin")&&b(user,"enabled")&&(!role.equals("superadmin")||!enabled)) {
            long admins=store.all("user").stream().filter(x->s(x,"role").equals("superadmin")&&b(x,"enabled")).count();
            if(admins<=1) throw new ApiException(409,"至少保留一名启用的超级管理员");
        }
        if(role.equals("moderator")){Object raw=input.get("forumBoards");if(!(raw instanceof List)||((List<?>)raw).isEmpty()||!ForumPolicy.BOARDS.containsAll((List<?>)raw))throw new ApiException(400,"请选择版主负责的板块");user.put("forumBoards",new ArrayList<>(new LinkedHashSet<>((List<?>)raw)));}else user.remove("forumBoards");
        user.put("role",role);user.put("enabled",enabled);store.save("user",user);store.revoke(id);
        auth.audit(actor,"account.access",id);return ok(self(user));
    }
    @PostMapping("/admin/members/{id}/reset-password") public Map<String,Object> resetPassword(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=auth.admin(req),user=store.get("user",id);
        if(!auth.isSuper(actor)&&!s(user,"role").equals("member"))throw new ApiException(403,"普通管理员只能重置普通会员密码");
        String next=text(input,"password",12,128);auth.passwordPolicy(next);
        user.put("passwordHash",auth.hashPassword(next));user.put("mustChangePassword",true);
        store.save("user",user);store.revoke(id);auth.audit(actor,"account.reset-password",id);return ok(true);
    }
    @GetMapping("/admin/audit") public Map<String,Object> audit(HttpServletRequest req) {
        auth.admin(req);List<Map<String,Object>> logs=store.all("audit");logs.sort(Comparator.comparing((Map<String,Object>x)->s(x,"time")).reversed());
        return ok(logs.stream().limit(200).collect(Collectors.toList()));
    }

    private List<Map<String,Object>> registrations(String eventId) {
        return store.all("signup").stream().filter(x->s(x,"eventId").equals(eventId)&&!s(x,"status").equals("cancelled")).collect(Collectors.toList());
    }
    private Map<String,Object> eventView(Map<String,Object> event,Map<String,Object> actor) {
        Map<String,Object> result=new LinkedHashMap<>(event);List<Map<String,Object>> rows=registrations(s(event,"id"));
        result.put("registered",rows.size());result.put("mySignup",actor==null?null:rows.stream().filter(x->s(x,"userId").equals(s(actor,"id"))).findFirst().orElse(null));return result;
    }
    @GetMapping("/events") public Map<String,Object> events(HttpServletRequest req) {
        Map<String,Object> actor=auth.optional(req);return ok(recent("event").stream().filter(x->!s(x,"status").equals("draft")||auth.isStaff(actor)).map(x->eventView(x,actor)).collect(Collectors.toList()));
    }
    @GetMapping("/events/{id}") public Map<String,Object> event(@PathVariable String id,HttpServletRequest req) {
        Map<String,Object> actor=auth.optional(req),event=store.get("event",id);
        if(s(event,"status").equals("draft")&&!auth.isStaff(actor)) throw new ApiException(404,"活动不存在");return ok(eventView(event,actor));
    }
    @PostMapping("/events") public Map<String,Object> createEvent(@RequestBody Map<String,Object> input,HttpServletRequest req) {return saveEvent(null,input,req);}
    @PostMapping("/event-proposals") public Map<String,Object> proposeEvent(@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=auth.require(req);auth.member(actor);auth.limit("event-proposal:"+s(actor,"id"),10);
        Instant start=instant(input,"startsAt"),end=instant(input,"endsAt");
        if(!start.isAfter(Instant.now())||!end.isAfter(start)||Duration.between(start,end).compareTo(Duration.ofDays(7))>0)throw new ApiException(400,"活动须在未来开始，结束晚于开始，最长7天");
        Map<String,Object> row=map("id",id(),"authorId",s(actor,"id"),"authorName",s(actor,"name"),"title",text(input,"title",2,80),"category",choice(input,"category","乡情聚会","公益志愿","交流分享","家乡文化"),
            "description",text(input,"description",10,5000),"location",text(input,"location",2,150),"capacity",number(input,"capacity",1,10000),"startsAt",start.toString(),"endsAt",end.toString(),"status","pending","createdAt",now());
        store.save("event_proposal",row);auth.audit(actor,"event.propose",s(row,"id"));return ok(row);
    }
    @GetMapping("/my/event-proposals") public Map<String,Object> myProposals(HttpServletRequest req) {Map<String,Object> actor=auth.require(req);return ok(recent("event_proposal").stream().filter(x->s(x,"authorId").equals(s(actor,"id"))).collect(Collectors.toList()));}
    @GetMapping("/admin/event-proposals") public Map<String,Object> adminProposals(HttpServletRequest req) {auth.staff(req);return ok(recent("event_proposal"));}
    @SuppressWarnings("unchecked") @PostMapping("/event-proposals/{id}/review") public Map<String,Object> reviewProposal(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=auth.staff(req),row=store.get("event_proposal",id);
        if(!s(row,"status").equals("pending"))throw new ApiException(409,"该活动申请已处理");
        String status=choice(input,"status","approved","rejected"),note=text(input,"note",status.equals("rejected")?2:0,300);
        if(status.equals("approved")){Map<String,Object> initiator=store.get("user",s(row,"authorId"));if(!b(initiator,"enabled")||!s(initiator,"status").equals("approved"))throw new ApiException(409,"发起人当前不能发起活动");Map<String,Object> eventInput=new LinkedHashMap<>(row);eventInput.put("status","published");Map<String,Object> event=(Map<String,Object>)saveEvent(null,eventInput,req).get("data");row.put("eventId",s(event,"id"));Map<String,Object> saved=store.get("event",s(event,"id"));saved.putAll(map("initiatorId",s(row,"authorId"),"initiatorName",s(row,"authorName")));store.save("event",saved);}
        row.putAll(map("status",status,"reviewNote",note,"reviewedBy",s(actor,"id")));store.save("event_proposal",row);auth.audit(actor,"event.proposal-"+status,id);return ok(row);
    }
    @PutMapping("/events/{id}") public Map<String,Object> updateEvent(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req) {return saveEvent(id,input,req);}
    private Map<String,Object> saveEvent(String eventId,Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=auth.staff(req);
        Instant start=instant(input,"startsAt"),end=instant(input,"endsAt");
        if(!end.isAfter(start)||Duration.between(start,end).compareTo(Duration.ofDays(7))>0) throw new ApiException(400,"结束时间须晚于开始时间，活动最长7天");
        String category=choice(input,"category","乡情聚会","公益志愿","交流分享","家乡文化");
        String status=choice(input,"status","draft","published","cancelled");
        int capacity=number(input,"capacity",1,10000);
        Map<String,Object> event=eventId==null?map("id",id(),"createdAt",now(),"createdBy",s(actor,"id")):store.get("event",eventId);
        List<Map<String,Object>> rows=registrations(s(event,"id"));
        if(rows.size()>capacity) throw new ApiException(409,"人数上限不能少于已报名人数");
        if(!rows.isEmpty()&&(!s(event,"startsAt").equals(start.toString())||!s(event,"endsAt").equals(end.toString())||!s(event,"category").equals(category)||status.equals("draft")))
            throw new ApiException(409,"已有报名的活动不能修改时间、类型或转为草稿；可取消后重新发布");
        if(status.equals("cancelled")&&rows.stream().anyMatch(x->s(x,"status").equals("checked_in"))) throw new ApiException(409,"已有签到记录的活动不能取消");
        if(status.equals("published")&&(eventId==null||!s(event,"status").equals("published"))&&!start.isAfter(Instant.now())) throw new ApiException(400,"发布活动的开始时间须晚于当前时间");
        event.putAll(map("title",text(input,"title",2,80),"description",text(input,"description",10,5000),"location",text(input,"location",2,150),
            "category",category,"status",status,"capacity",capacity,"startsAt",start.toString(),"endsAt",end.toString(),"updatedAt",now()));
        store.save("event",event);
        if(status.equals("cancelled")) for(Map<String,Object> row:rows) {row.put("status","cancelled");store.save("signup",row);}
        auth.audit(actor,"event.save",s(event,"id"));return ok(eventView(event,actor));
    }
    @PostMapping("/events/{id}/signup") public Map<String,Object> signup(@PathVariable String id,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=auth.require(req);auth.member(actor);Map<String,Object> event=store.get("event",id);
        if(!s(event,"status").equals("published")||!instant(event,"startsAt").isAfter(Instant.now())) throw new ApiException(409,"活动已开始或已关闭报名");
        String signupId=id+":"+s(actor,"id");List<Map<String,Object>> rows=registrations(id);
        Optional<Map<String,Object>> existing=rows.stream().filter(x->s(x,"id").equals(signupId)).findFirst();
        if(existing.isPresent()) return ok(existing.get());
        if(rows.size()>=number(event,"capacity",1,10000)) throw new ApiException(409,"本次活动名额已满");
        Map<String,Object> signup=map("id",signupId,"eventId",id,"userId",s(actor,"id"),"status","registered","hours",0,"createdAt",now());
        store.save("signup",signup);auth.audit(actor,"event.signup",id);return ok(signup);
    }
    @PostMapping("/events/{id}/cancel-signup") public Map<String,Object> cancelSignup(@PathVariable String id,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=auth.require(req);Map<String,Object> event=store.get("event",id);
        Map<String,Object> signup=store.get("signup",id+":"+s(actor,"id"));
        if(s(signup,"status").equals("cancelled")) return ok(signup);
        if(s(signup,"status").equals("checked_in")||!instant(event,"startsAt").isAfter(Instant.now())) throw new ApiException(409,"已签到或已开始的活动无法取消报名，请联系组织者");
        signup.put("status","cancelled");store.save("signup",signup);auth.audit(actor,"event.cancel-signup",id);return ok(signup);
    }
    @GetMapping("/events/{id}/participants") public Map<String,Object> participants(@PathVariable String id,HttpServletRequest req) {
        auth.staff(req);store.get("event",id);
        return ok(registrations(id).stream().map(row->{Map<String,Object> result=new LinkedHashMap<>(row);Map<String,Object> user=store.get("user",s(row,"userId"));result.put("name",s(user,"name"));result.put("phone",s(user,"phone"));return result;}).collect(Collectors.toList()));
    }
    @PostMapping("/events/{id}/check-in") public Map<String,Object> checkIn(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=auth.staff(req),event=store.get("event",id);
        if(!s(event,"status").equals("published")||instant(event,"startsAt").isAfter(Instant.now())) throw new ApiException(409,"活动开始后才能签到");
        Map<String,Object> row=store.get("signup",id+":"+text(input,"userId",1,80));
        if(s(row,"status").equals("cancelled")) throw new ApiException(409,"该报名已取消");
        double hours;
        try {hours=Double.parseDouble(s(input,"hours"));} catch(Exception e) {throw new ApiException(400,"请输入有效服务时长");}
        double max=Math.min(24,Duration.between(instant(event,"startsAt"),instant(event,"endsAt")).toMinutes()/60.0);
        if(!Double.isFinite(hours)||hours<0||hours>max||hours*4!=Math.rint(hours*4)||(!s(event,"category").equals("公益志愿")&&hours!=0)) throw new ApiException(400,"志愿时长须为0.25小时的倍数，且不超过活动时长及24小时；普通活动填0");
        if(s(row,"status").equals("checked_in")&&!(s(row,"checkinMethod").equals("location")&&!b(row,"hoursFinalized"))) {
            if(((Number)row.get("hours")).doubleValue()!=hours) throw new ApiException(409,"该签到已核定，不能重复变更时长");return ok(row);
        }
        row.putAll(map("status","checked_in","hours",hours,"hoursFinalized",true,"checkedAt",s(row,"checkedAt").isEmpty()?now():s(row,"checkedAt"),"checkedBy",s(actor,"id")));store.save("signup",row);auth.audit(actor,"event.check-in",s(row,"id"));return ok(row);
    }
    @GetMapping("/my/signups") public Map<String,Object> mySignups(HttpServletRequest req) {
        Map<String,Object> actor=auth.require(req);return ok(recent("signup").stream().filter(x->s(x,"userId").equals(s(actor,"id"))).map(x->{Map<String,Object> result=new LinkedHashMap<>(x);result.put("event",store.get("event",s(x,"eventId")));return result;}).collect(Collectors.toList()));
    }

    private Map<String,Object> postView(Map<String,Object> post,Map<String,Object> actor) {
        Map<String,Object> result=new LinkedHashMap<>(post);
        boolean owner=actor!=null&&s(actor,"id").equals(s(post,"authorId"));
        if(actor==null||(!owner&&!s(actor,"status").equals("approved"))) result.remove("contact");
        if(!owner&&!auth.isStaff(actor)) {result.remove("reviewNote");result.remove("reviewedBy");}
        return result;
    }
    @GetMapping("/posts") public Map<String,Object> posts(HttpServletRequest req) {
        Map<String,Object> actor=auth.optional(req);
        return ok(recent("post").stream().filter(x->s(x,"status").equals("approved")).map(x->postView(x,actor)).collect(Collectors.toList()));
    }
    @GetMapping("/my/posts") public Map<String,Object> myPosts(HttpServletRequest req) {
        Map<String,Object> actor=auth.require(req);return ok(recent("post").stream().filter(x->s(x,"authorId").equals(s(actor,"id"))).map(x->postView(x,actor)).collect(Collectors.toList()));
    }
    @GetMapping("/admin/posts") public Map<String,Object> pendingPosts(HttpServletRequest req) {auth.staff(req);return ok(recent("post"));}
    @PostMapping("/posts") public Map<String,Object> createPost(@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=auth.require(req);auth.member(actor);auth.limit("post:"+s(actor,"id"),20);
        Map<String,Object> post=map("id",id(),"title",text(input,"title",2,80),"content",text(input,"content",10,3000),
            "category",choice(input,"category","求职招聘","资源合作","生活互助","家乡分享"),"contact",text(input,"contact",0,80),
            "authorId",s(actor,"id"),"authorName",s(actor,"name"),"status","pending","createdAt",now(),"reviewNote","");
        store.save("post",post);auth.audit(actor,"post.create",s(post,"id"));return ok(post);
    }
    @PostMapping("/posts/{id}/close") public Map<String,Object> closePost(@PathVariable String id,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=auth.require(req),post=store.get("post",id);
        if(!s(post,"authorId").equals(s(actor,"id"))&&!auth.isStaff(actor)) throw new ApiException(403,"只能关闭自己发布的信息");
        post.put("status","closed");store.save("post",post);auth.audit(actor,"post.close",id);return ok(post);
    }
    @PostMapping("/posts/{id}/review") public Map<String,Object> reviewPost(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=auth.staff(req),post=store.get("post",id);
        if(!s(post,"status").equals("pending")) throw new ApiException(409,"该信息已处理，请刷新列表");
        String status=choice(input,"status","approved","rejected");post.putAll(map("status",status,"reviewNote",text(input,"note",status.equals("rejected")?2:0,300),"reviewedBy",s(actor,"id")));
        store.save("post",post);auth.audit(actor,"post."+status,id);return ok(post);
    }
    @GetMapping("/notices") public Map<String,Object> notices(HttpServletRequest req) {
        Map<String,Object> actor=auth.optional(req);return ok(recent("notice").stream().filter(x->s(x,"status").equals("published")||auth.isStaff(actor)).collect(Collectors.toList()));
    }
    @PostMapping("/notices") public Map<String,Object> createNotice(@RequestBody Map<String,Object> input,HttpServletRequest req) {return saveNotice(null,input,req);}
    @PutMapping("/notices/{id}") public Map<String,Object> updateNotice(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req) {return saveNotice(id,input,req);}
    private Map<String,Object> saveNotice(String id,Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=auth.staff(req),notice=id==null?map("id",id(),"createdAt",now()):store.get("notice",id);
        notice.putAll(map("title",text(input,"title",2,80),"content",text(input,"content",5,5000),"category",choice(input,"category","平台公告","家乡文化"),"status",choice(input,"status","published","withdrawn"),"updatedAt",now()));
        store.save("notice",notice);auth.audit(actor,"notice.save",s(notice,"id"));return ok(notice);
    }
}
