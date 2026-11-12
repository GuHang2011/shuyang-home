package com.example.Kcsj.membership;

import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import jakarta.servlet.http.HttpServletRequest;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import static com.example.Kcsj.membership.MemberStore.*;
import static com.example.Kcsj.membership.MemberData.*;

/** Practical member services. All mutations share the store's transaction lock. */
@RestController @RequestMapping("/life") @Transactional
public class LifeController {
    private final MemberStore store;private final MemberAuth auth;private final ForumPolicy policy;private final BusinessNotifications notifications;
    public LifeController(MemberStore store,MemberAuth auth,ForumPolicy policy,BusinessNotifications notifications){this.store=store;this.auth=auth;this.policy=policy;this.notifications=notifications;}
    private Map<String,Object> member(HttpServletRequest req){Map<String,Object>a=auth.require(req);auth.member(a);return a;}
    private boolean owner(Map<String,Object> row,Map<String,Object> a){return a!=null&&s(row,"ownerId").equals(s(a,"id"));}
    private List<Map<String,Object>> rows(String kind){List<Map<String,Object>> out=store.all(kind);out.sort(Comparator.comparing((Map<String,Object>x)->s(x,"updatedAt")+s(x,"createdAt")).reversed());return out;}
    private Map<String,Object> find(String kind,String id){return store.all(kind).stream().filter(x->s(x,"id").equals(id)).findFirst().orElse(null);}
    private void require(boolean condition,int code,String message){if(!condition)throw new ApiException(code,message);}
    private boolean parentVisible(Map<String,Object> row,Map<String,Object> a){return LifeRules.parentVisible(store,row,a);}
    private boolean readable(Map<String,Object> row,Map<String,Object> a){return owner(row,a)||auth.isStaff(a)||(LifeRules.publicState(row)&&parentVisible(row,a));}
    private Map<String,Object> get(String id,Map<String,Object> a){Map<String,Object> row=store.get("life_entry",id);require(readable(row,a),404,"内容暂不可用，请返回列表");return row;}
    private Map<String,Object> view(Map<String,Object> row,Map<String,Object> a){
        Map<String,Object> out=new LinkedHashMap<>(row);out.remove("selectedApplicationId");out.remove("requestFingerprint");
        if(!owner(row,a)&&!auth.isStaff(a)){out.remove("reviewNote");out.remove("history");}
        out.put("expired",LifeRules.expired(row));out.put("mine",owner(row,a));
        if(s(row,"type").equals("guide"))out.put("stale",LocalDate.parse(s(row,"verifiedOn")).plusDays(90).isBefore(LocalDate.now(ZoneId.of("Asia/Shanghai"))));
        if(a!=null){Map<String,Object>sub=find("life_subscription",auth.digest(s(row,"id")+":"+s(a,"id")));out.put("subscribed",sub!=null&&b(sub,"active"));}
        if(s(row,"type").equals("trip")){Map<String,Object>event=store.get("event",s(row,"referenceId"));out.put("event",pick(event,"id","title","status","location","startsAt","endsAt"));}
        if(s(row,"type").equals("arrival")){Map<String,Object>p=store.get("product",s(row,"referenceId"));out.put("product",pick(p,"id","title","stock","status"));}
        if(s(row,"type").equals("progress")){
            Map<String,Object>p=store.get("crowd_project",s(row,"referenceId"));java.math.BigDecimal pledged=java.math.BigDecimal.ZERO,delivered=java.math.BigDecimal.ZERO;
            for(Map<String,Object>r:store.all("crowd_pledge"))if(s(r,"projectId").equals(s(p,"id"))&&!s(r,"status").equals("cancelled")){pledged=pledged.add(new java.math.BigDecimal(s(r,"quantity")));if(s(r,"status").equals("delivered")&&!s(p,"type").equals("资金意向"))delivered=delivered.add(new java.math.BigDecimal(s(r,"quantity")));}
            out.put("project",map("id",s(p,"id"),"title",s(p,"title"),"type",s(p,"type"),"unit",s(p,"unit"),"goal",p.get("goal"),"pledged",pledged,"delivered",delivered));
        }
        return out;
    }
    private void touch(Map<String,Object> row,Map<String,Object>a,String action,String note){
        row.put("updatedAt",now());row.put("revision",((Number)row.getOrDefault("revision",0)).intValue()+1);
        List<Object> history=new ArrayList<>((List<?>)row.getOrDefault("history",Collections.emptyList()));
        history.add(map("time",now(),"action",action,"note",note,"actor",s(a,"name")));row.put("history",history);
        store.save("life_entry",row);auth.audit(a,"life."+action,s(row,"id"));
    }
    private void notify(String user,String target,String event,String message){notifications.life(user,target,event,message);
    }
    private void followers(Map<String,Object> row,String message){
        if(!LifeRules.publicState(row))return;
        for(Map<String,Object>r:store.all("life_subscription"))if(s(r,"entryId").equals(s(row,"id"))&&b(r,"active"))notify(s(r,"userId"),s(row,"id"),"update-"+row.get("revision"),message);
    }
    @GetMapping("/entries") public Map<String,Object> list(@RequestParam(defaultValue="guide") String type,@RequestParam(defaultValue="public") String scope,HttpServletRequest req){
        require(LifeRules.TYPES.contains(type),400,"服务类型无效");Map<String,Object>a=auth.optional(req);
        if(scope.equals("manage"))auth.staff(req);else if(scope.equals("mine"))auth.require(req);else require(scope.equals("public"),400,"列表范围无效");
        return ApiResponse.ok(rows("life_entry").stream().filter(r->s(r,"type").equals(type)).filter(r->scope.equals("manage")||scope.equals("mine")?scope.equals("manage")||owner(r,a):LifeRules.publicState(r)&&parentVisible(r,a)).map(r->view(r,a)).collect(Collectors.toList()));
    }
    @GetMapping("/entries/{id}") public Map<String,Object> detail(@PathVariable String id,HttpServletRequest req){Map<String,Object>a=auth.optional(req);return ApiResponse.ok(view(get(id,a),a));}
    private void validateParent(String type,Map<String,Object> fields,Map<String,Object>a){
        if(type.equals("guide")||type.equals("trip"))require(auth.isStaff(a),403,"仅组织者或管理员可维护指南和出行卡");
        if(type.equals("arrival")||type.equals("slot"))require(auth.isAdmin(a),403,"仅管理员可维护特产与自提安排");
        if(type.equals("trip"))require(s(store.get("event",s(fields,"referenceId")),"status").equals("published"),409,"请关联已发布活动");
        if(type.equals("arrival"))store.get("product",s(fields,"referenceId"));
        if(type.equals("service"))require(auth.isAdmin(a)||b(a,"directoryVisible"),409,"请先在个人资料中自愿开启名录公开，再发布服务名片");
        if(type.equals("progress")){Map<String,Object>p=store.get("crowd_project",s(fields,"referenceId"));require(s(p,"status").equals("approved")&&(auth.isStaff(a)||s(p,"authorId").equals(s(a,"id"))),403,"仅已通过项目的发起人或组织者可发布进展");}
    }
    @PostMapping("/entries") public Map<String,Object> save(@RequestBody Map<String,Object> input,HttpServletRequest req){
        store.lockWrites();Map<String,Object>a=member(req);String type=choice(input,"type",LifeRules.TYPES.toArray(new String[0])),key=text(input,"id",0,80);
        Map<String,Object>fields=LifeRules.fields(type,input),row;
        validateParent(type,fields,a);
        if(key.isEmpty()){
            String request=text(input,"requestId",36,36);try{UUID.fromString(request);}catch(Exception e){throw new ApiException(400,"提交编号无效");}
            key=auth.digest(s(a,"id")+":"+request);row=find("life_entry",key);if(row!=null){require(s(row,"requestFingerprint").equals(auth.digest(type+fields.toString()+String.valueOf(input.get("photos")))),409,"同一提交编号不能用于不同内容，请重新打开发布表单");return ApiResponse.ok(view(row,a));}
            auth.limit("life-create:"+s(a,"id"),30);row=map("id",key,"type",type,"ownerId",s(a,"id"),"ownerName",s(a,"name"),"createdAt",now(),"requestFingerprint",auth.digest(type+fields.toString()+String.valueOf(input.get("photos"))));
        }else{
            row=store.get("life_entry",key);require(owner(row,a)||auth.isAdmin(a),403,"只能编辑本人内容，管理员可协助维护");require(type.equals(s(row,"type")),400,"不可改变服务类型");
            require(number(input,"revision",1,Integer.MAX_VALUE)==((Number)row.get("revision")).intValue(),409,"内容已更新，请重新打开后编辑");
            require(!Arrays.asList("working","confirming","resolved").contains(s(row,"status")),409,"正在处理或已完成的事项不能改写，请通过处理记录补充");
            if(type.equals("slot"))require(!store.all("life_reservation").stream().anyMatch(r->s(r,"slotId").equals(s(input,"id"))&&activeReservation(r)),409,"已有有效预约，不能修改时段；请新增其他时段");
        }
        row.putAll(fields);row.put("status",auth.isStaff(a)?"open":"pending");row.put("reviewNote","");
        Object raw=input.getOrDefault("photos",Collections.emptyList());require(raw instanceof List&&((List<?>)raw).size()<=6,400,"最多上传6张照片");List<String> photos=new ArrayList<>();
        for(Object id:(List<?>)raw){require(id instanceof String,400,"照片编号无效");Map<String,Object>p=store.get("attachment",String.valueOf(id));require(s(p,"scope").equals("life")&&s(p,"type").equals("image")&&(s(p,"ownerId").equals(s(a,"id"))||auth.isAdmin(a)&&s(p,"lifeId").equals(key))&&(!b(p,"linked")||s(p,"lifeId").equals(key)),403,"只能使用本人为此事项上传的照片");p.putAll(map("linked",true,"lifeId",key));store.save("attachment",p);photos.add(String.valueOf(id));}
        row.put("photos",photos);touch(row,a,"save",text(input,"changeNote",0,300));followers(row,"关注的服务内容有更新，请查看最新安排");return ApiResponse.ok(view(row,a));
    }
    @PostMapping("/entries/{id}/action") public Map<String,Object> action(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req){
        store.lockWrites();Map<String,Object>a=member(req),row=store.get("life_entry",id);String action=choice(input,"action","approve","reject","pause","resume","close","resolve","reopen","release","coordinate"),note=text(input,"note",2,500),state=s(row,"status");
        if(action.equals("approve")||action.equals("reject")){
            require(auth.isStaff(a),403,"仅组织者和管理员可审核");require(state.equals("pending"),409,"内容已处理，请刷新");require(!action.equals("approve")||!LifeRules.expired(row),409,"内容已过期，不能通过");
            row.put("status",action.equals("approve")?"open":"rejected");row.put("reviewNote",note);
        }else{
            require(owner(row,a)||auth.isAdmin(a),403,"仅发布者或管理员可处理事项");
            if(action.equals("resolve")){require(owner(row,a)&&s(row,"type").equals("help")&&state.equals("confirming"),409,"只有求助者可确认已完成的帮助");row.put("status","resolved");}
            if(action.equals("reopen")){require(owner(row,a)&&state.equals("confirming"),409,"仅待确认的帮办可继续处理");row.put("status","working");}
            if(action.equals("pause")){require(state.equals("open"),409,"当前状态不能暂停");row.put("status","paused");}
            if(action.equals("resume")){require(state.equals("paused")&&!LifeRules.expired(row),409,"当前状态不能恢复");row.put("status","open");}
            if(action.equals("close")){
                require(Arrays.asList("open","paused","pending","rejected").contains(state)||s(row,"type").equals("lost")&&state.equals("working"),409,"请先完成正在处理的事项或申请协调");
                if(s(row,"type").equals("slot"))require(!store.all("life_reservation").stream().anyMatch(r->s(r,"slotId").equals(id)&&activeReservation(r)),409,"仍有有效预约，不能关闭该时段");
                row.put("status","closed");
            }
            if(action.equals("release")||action.equals("coordinate")){
                require(s(row,"type").equals("help")&&Arrays.asList("working","confirming").contains(state),409,"仅处理中帮办可释放负责人");
                Map<String,Object>app=store.get("life_application",s(row,"selectedApplicationId"));
                require(action.equals("coordinate")?auth.isAdmin(a):owner(row,a)&&b(app,"releaseRequested"),403,"需要求助者确认退出申请，或管理员协调");
                app.put("status","released");store.save("life_application",app);row.remove("selectedApplicationId");row.put("status","open");notify(s(app,"userId"),id,"released-"+now(),"帮办负责人已释放，可查看处理说明");
            }
        }
        touch(row,a,action,note);notify(s(row,"ownerId"),id,"state-"+row.get("revision"),"你的服务事项状态已更新");
        for(Map<String,Object>app:store.all("life_application"))if(s(app,"entryId").equals(id)&&!s(app,"status").equals("withdrawn"))notify(s(app,"userId"),id,"state-"+row.get("revision"),"你参与的服务事项状态已更新");
        followers(row,"关注的服务事项状态有变化");return ApiResponse.ok(view(row,a));
    }
    @GetMapping("/entries/{id}/applications") public Map<String,Object> applications(@PathVariable String id,HttpServletRequest req){Map<String,Object>a=member(req),row=get(id,a);return ApiResponse.ok(rows("life_application").stream().filter(r->s(r,"entryId").equals(id)&&(owner(row,a)||auth.isAdmin(a)||s(r,"userId").equals(s(a,"id")))).collect(Collectors.toList()));}
    @PostMapping("/entries/{id}/apply") public Map<String,Object> apply(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req){
        store.lockWrites();Map<String,Object>a=member(req),row=get(id,a);require(Arrays.asList("help","job","service","lost").contains(s(row,"type")),400,"此类服务不接受申请");
        require(!owner(row,a),400,"不能申请自己发布的事项");require(s(row,"status").equals("open")&&!LifeRules.expired(row)&&parentVisible(row,a),409,"该事项目前不接受申请");
        Map<String,Object>publisher=store.get("user",s(row,"ownerId"));require(b(publisher,"enabled")&&s(publisher,"status").equals("approved")&&!policy.blocked(s(a,"id"),s(row,"ownerId")),403,"对方暂不能接收申请");
        String key=auth.digest(id+":"+s(a,"id"));Map<String,Object>old=find("life_application",key);require(old==null||Arrays.asList("withdrawn","rejected","released").contains(s(old,"status")),409,"已有申请，请在我的事项查看");
        auth.limit("life-apply:"+s(a,"id"),30);Map<String,Object>app=map("id",key,"entryId",id,"userId",s(a,"id"),"userName",s(a,"name"),"message",text(input,"message",5,1000),"status","submitted","createdAt",now());store.save("life_application",app);
        notify(s(row,"ownerId"),id,"application-"+key+":"+s(app,"createdAt"),"收到一条新的服务申请，请及时处理");return ApiResponse.ok(app);
    }
    @PostMapping("/applications/{id}/action") public Map<String,Object> applicationAction(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req){
        store.lockWrites();Map<String,Object>a=member(req),app=store.get("life_application",id),row=store.get("life_entry",s(app,"entryId"));boolean applicant=s(app,"userId").equals(s(a,"id"));
        String action=choice(input,"action","accept","reject","withdraw","outcome","request-release"),note=text(input,"note",2,1000);
        if(action.equals("withdraw")){require(applicant&&(s(app,"status").equals("submitted")||Arrays.asList("job","service").contains(s(row,"type"))&&s(app,"status").equals("accepted")),409,"仅本人可撤回待处理申请或岗位、服务意向");app.put("status","withdrawn");}
        else if(action.equals("outcome")||action.equals("request-release")){
            require(readable(row,a),404,"内容暂不可用");
            require(applicant&&s(row,"type").equals("help")&&s(row,"selectedApplicationId").equals(id)&&s(app,"status").equals("accepted")&&s(row,"status").equals("working"),403,"仅当前负责人可提交帮办结果或退出申请");
            if(action.equals("outcome"))row.put("status","confirming");else app.put("releaseRequested",true);
        }else{
            require(owner(row,a),403,"仅发布者可处理申请");require(s(app,"status").equals("submitted")&&s(row,"status").equals("open")&&!LifeRules.expired(row),409,"申请或事项已发生变化，请刷新");
            Map<String,Object>candidate=store.get("user",s(app,"userId"));require(b(candidate,"enabled")&&s(candidate,"status").equals("approved")&&!policy.blocked(s(a,"id"),s(candidate,"id")),409,"申请人当前不能参与");
            app.put("status",action.equals("accept")?"accepted":"rejected");
            if(action.equals("accept")&&Arrays.asList("help","lost").contains(s(row,"type"))){require(s(row,"selectedApplicationId").isEmpty(),409,"已有负责人或认领人");row.put("selectedApplicationId",id);row.put("status","working");}
        }
        app.putAll(map("note",note,"updatedAt",now()));store.save("life_application",app);touch(row,a,action,"申请处理已更新");
        notify(applicant?s(row,"ownerId"):s(app,"userId"),s(row,"id"),"application-action-"+row.get("revision"),"服务申请有新进展，请查看处理说明");return ApiResponse.ok(app);
    }
    @GetMapping("/entries/{id}/checklist") public Map<String,Object> checklist(@PathVariable String id,HttpServletRequest req){Map<String,Object>a=member(req),row=get(id,a);require(s(row,"type").equals("guide"),400,"此事项没有材料清单");Map<String,Object>r=find("life_checklist",auth.digest(id+":"+s(a,"id")));return ApiResponse.ok(r==null?map("checked",Collections.emptyList()):r);}
    @PostMapping("/entries/{id}/checklist") public Map<String,Object> checklistSave(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req){
        store.lockWrites();Map<String,Object>a=member(req),row=get(id,a);require(s(row,"type").equals("guide"),400,"此事项没有材料清单");Object raw=input.get("checked");require(raw instanceof List&&((List<?>)raw).size()<=30,400,"清单格式无效");
        List<?> valid=(List<?>)row.get("checklist");require(((List<?>)raw).stream().allMatch(valid::contains),409,"指南清单已更新，请刷新后重新勾选");
        Map<String,Object>r=map("id",auth.digest(id+":"+s(a,"id")),"entryId",id,"userId",s(a,"id"),"checked",new ArrayList<>(new LinkedHashSet<>((List<?>)raw)),"updatedAt",now());store.save("life_checklist",r);return ApiResponse.ok(r);
    }
    @PostMapping("/entries/{id}/subscribe") public Map<String,Object> subscribe(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req){
        store.lockWrites();Map<String,Object>a=member(req);get(id,a);Map<String,Object>r=map("id",auth.digest(id+":"+s(a,"id")),"entryId",id,"userId",s(a,"id"),"active",flag(input,"active"));store.save("life_subscription",r);return ApiResponse.ok(r);
    }
    @PostMapping("/entries/{id}/feedback") public Map<String,Object> feedback(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req){
        store.lockWrites();Map<String,Object>a=member(req);get(id,a);auth.limit("life-feedback:"+s(a,"id"),10);Map<String,Object>r=map("id",id(),"entryId",id,"userId",s(a,"id"),"message",text(input,"message",5,1000),"status","pending","createdAt",now());store.save("life_feedback",r);return ApiResponse.ok(r);
    }
    @GetMapping("/feedback") public Map<String,Object> feedbacks(HttpServletRequest req){Map<String,Object>a=member(req);return ApiResponse.ok(rows("life_feedback").stream().filter(r->auth.isAdmin(a)||s(r,"userId").equals(s(a,"id"))).collect(Collectors.toList()));}
    @PostMapping("/feedback/{id}") public Map<String,Object> feedbackResolve(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req){store.lockWrites();Map<String,Object>a=auth.admin(req),r=store.get("life_feedback",id);r.putAll(map("status","resolved","reply",text(input,"reply",2,1000),"updatedAt",now()));store.save("life_feedback",r);notify(s(r,"userId"),s(r,"entryId"),"feedback-"+id,"你的纠错反馈已有处理结果，请查看我的反馈");auth.audit(a,"life.feedback-resolve",id);return ApiResponse.ok(r);}
    @GetMapping("/notifications") public Map<String,Object> notifications(HttpServletRequest req){Map<String,Object>a=member(req);return ApiResponse.ok(rows("business_notice").stream().filter(r->s(r,"kind").equals("life_entry")&&s(r,"recipientId").equals(s(a,"id"))).limit(200).collect(Collectors.toList()));}
    @PostMapping("/notifications/read") public Map<String,Object> read(@RequestBody Map<String,Object> input,HttpServletRequest req){store.lockWrites();Map<String,Object>a=member(req);String id=text(input,"id",1,80);for(Map<String,Object>r:store.all("business_notice"))if(s(r,"kind").equals("life_entry")&&s(r,"recipientId").equals(s(a,"id"))&&(id.equals("all")||s(r,"id").equals(id))){r.put("read",true);store.save("business_notice",r);}return ApiResponse.ok(true);}
    @GetMapping("/mine") public Map<String,Object> mine(HttpServletRequest req){
        Map<String,Object>a=member(req);Set<String>ids=new HashSet<>();List<Map<String,Object>>applications=rows("life_application").stream().filter(r->s(r,"userId").equals(s(a,"id"))).collect(Collectors.toList());applications.forEach(r->ids.add(s(r,"entryId")));
        for(String kind:Arrays.asList("life_checklist","life_subscription"))for(Map<String,Object>r:store.all(kind))if(s(r,"userId").equals(s(a,"id"))&&(!kind.equals("life_subscription")||b(r,"active")))ids.add(s(r,"entryId"));
        List<Map<String,Object>>entries=rows("life_entry").stream().filter(r->owner(r,a)||ids.contains(s(r,"id"))).map(r->readable(r,a)?view(r,a):map("id",s(r,"id"),"title","内容已撤下或暂不可用","status","unavailable")).collect(Collectors.toList());
        return ApiResponse.ok(map("entries",entries,"applications",applications));
    }
    @GetMapping("/options") public Map<String,Object> options(HttpServletRequest req){
        Map<String,Object>a=member(req);return ApiResponse.ok(map("events",store.all("event").stream().filter(r->s(r,"status").equals("published")).map(r->pick(r,"id","title")).collect(Collectors.toList()),"products",store.all("product").stream().filter(r->auth.isAdmin(a)||s(r,"status").equals("published")).map(r->pick(r,"id","title")).collect(Collectors.toList()),"projects",store.all("crowd_project").stream().filter(r->s(r,"status").equals("approved")&&(auth.isStaff(a)||s(r,"authorId").equals(s(a,"id")))).map(r->pick(r,"id","title")).collect(Collectors.toList())));
    }
    private boolean activeReservation(Map<String,Object> r){Map<String,Object>o=find("order",s(r,"orderId"));return s(r,"status").equals("reserved")&&o!=null&&Arrays.asList("confirmed","ready").contains(s(o,"status"));}
    @GetMapping("/pickup") public Map<String,Object> pickup(HttpServletRequest req){Map<String,Object>a=member(req);List<Map<String,Object>>out=new ArrayList<>();for(Map<String,Object>r:rows("life_reservation"))if(s(r,"userId").equals(s(a,"id"))){Map<String,Object>v=new LinkedHashMap<>(r);v.remove("tokenHash");v.remove("delegateHash");v.put("active",activeReservation(r));v.put("slot",view(store.get("life_entry",s(r,"slotId")),a));v.put("order",pick(store.get("order",s(r,"orderId")),"id","title","status","settlement","quantity","orderNo"));out.add(v);}return ApiResponse.ok(out);}
    @PostMapping("/pickup/reserve") public Map<String,Object> reserve(@RequestBody Map<String,Object> input,HttpServletRequest req){
        store.lockWrites();Map<String,Object>a=member(req);String orderId=text(input,"orderId",1,80),slotId=text(input,"slotId",1,80);Map<String,Object>o=store.get("order",orderId),slot=get(slotId,a);
        require(s(o,"buyerId").equals(s(a,"id")),403,"只能预约本人的订单");require(s(o,"delivery").equals("pickup")&&Arrays.asList("confirmed","ready").contains(s(o,"status")),409,"仅已确认或备妥的自提订单可以预约");require(s(slot,"type").equals("slot")&&s(slot,"status").equals("open")&&instant(slot,"startsAt").isAfter(Instant.now()),409,"时段已开始或不可预约");
        Map<String,Object>previous=find("life_reservation",orderId);if(previous!=null&&activeReservation(previous)&&s(previous,"slotId").equals(slotId))return ApiResponse.ok(true);
        long count=store.all("life_reservation").stream().filter(r->s(r,"slotId").equals(slotId)&&activeReservation(r)).count();require(count<number(slot,"capacity",1,500),409,"该时段已满，请选择其他时段");
        Map<String,Object>r=map("id",orderId,"orderId",orderId,"slotId",slotId,"userId",s(a,"id"),"status","reserved","createdAt",now());store.save("life_reservation",r);notify(s(a,"id"),slotId,"reservation-"+now(),"自提预约已确认，请在我的自提中查看");return ApiResponse.ok(true);
    }
    @PostMapping("/pickup/{id}/cancel") public Map<String,Object> cancelPickup(@PathVariable String id,HttpServletRequest req){store.lockWrites();Map<String,Object>a=member(req),r=store.get("life_reservation",id);require(s(r,"userId").equals(s(a,"id")),403,"只能取消本人预约");require(!s(r,"status").equals("collected"),409,"已交付的预约不能取消");r.put("status","cancelled");r.remove("tokenHash");r.remove("delegateHash");store.save("life_reservation",r);return ApiResponse.ok(true);}
    @PostMapping("/pickup/{id}/credential") public Map<String,Object> credential(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req){
        store.lockWrites();Map<String,Object>a=member(req),r=store.get("life_reservation",id),o=store.get("order",s(r,"orderId"));require(s(r,"userId").equals(s(a,"id")),403,"只能生成本人的取货凭证");require(activeReservation(r)&&s(o,"status").equals("ready"),409,"订单备妥后才可生成取货凭证");
        boolean delegate=flag(input,"delegate");if(b(input,"revoke")){r.remove("delegateHash");r.remove("delegateExpires");store.save("life_reservation",r);return ApiResponse.ok(true);}
        Map<String,Object>slot=store.get("life_entry",s(r,"slotId"));Instant expires=instant(slot,"endsAt");require(expires.isAfter(Instant.now()),409,"预约已过期，请先改约");if(delegate&&expires.isAfter(Instant.now().plusSeconds(7200)))expires=Instant.now().plusSeconds(7200);
        String token=UUID.randomUUID().toString()+UUID.randomUUID().toString();r.put(delegate?"delegateHash":"tokenHash",auth.digest(token));r.put(delegate?"delegateExpires":"tokenExpires",expires.toString());store.save("life_reservation",r);return ApiResponse.ok(map("code",token,"expiresAt",expires.toString(),"delegate",delegate));
    }
    private Map<String,Object> reservationByCode(String code){String hash=auth.digest(code);return store.all("life_reservation").stream().filter(r->s(r,"tokenHash").equals(hash)||s(r,"delegateHash").equals(hash)).findFirst().orElseThrow(()->new ApiException(404,"取货凭证无效或已撤销"));}
    @PostMapping("/pickup/check") public Map<String,Object> checkPickup(@RequestBody Map<String,Object> input,HttpServletRequest req){
        store.lockWrites();Map<String,Object>a=auth.admin(req);String code=text(input,"code",72,72);Map<String,Object>r=reservationByCode(code),o=store.get("order",s(r,"orderId"));
        if(b(input,"confirm")&&s(r,"status").equals("collected"))return ApiResponse.ok(map("collected",true,"order",pick(o,"orderNo","title","quantity","status","settlement")));
        require(activeReservation(r)&&s(o,"status").equals("ready"),409,"订单当前不能交付");boolean delegate=s(r,"delegateHash").equals(auth.digest(code));require(instant(r,delegate?"delegateExpires":"tokenExpires").isAfter(Instant.now()),409,"取货凭证已过期");
        if(b(input,"confirm")){o.putAll(map("status","completed","updatedAt",now()));store.save("order",o);r.putAll(map("status","collected","collectedAt",now(),"collectedBy",s(a,"id")));store.save("life_reservation",r);auth.audit(a,"life.pickup-collected",s(o,"id"));notify(s(r,"userId"),s(r,"slotId"),"collected-"+s(r,"id"),"自提商品已交付，线下结算状态独立记录");}
        return ApiResponse.ok(map("collected",s(r,"status").equals("collected"),"order",pick(o,"orderNo","title","quantity","status","settlement"),"slot",pick(store.get("life_entry",s(r,"slotId")),"title","region","startsAt","endsAt"),"delegate",delegate));
    }
    @PostMapping("/entries/{id}/meeting") public Map<String,Object> meeting(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req){
        store.lockWrites();Map<String,Object>a=member(req),row=get(id,a);require(s(row,"type").equals("trip")&&s(row,"status").equals("open"),409,"出行卡暂不可用");Map<String,Object>e=store.get("event",s(row,"referenceId")),signup=find("signup",s(e,"id")+":"+s(a,"id"));
        require(s(e,"status").equals("published")&&instant(e,"startsAt").isAfter(Instant.now())&&signup!=null&&!s(signup,"status").equals("cancelled"),409,"请先报名未开始的活动");String point=text(input,"point",0,160);require(point.isEmpty()||((List<?>)row.get("meetingPoints")).contains(point),400,"集合点无效");Map<String,Object>r=map("id",auth.digest(id+":"+s(a,"id")),"entryId",id,"userId",s(a,"id"),"userName",s(a,"name"),"point",point);store.save("life_meeting",r);return ApiResponse.ok(r);
    }
    @GetMapping("/entries/{id}/meeting") public Map<String,Object> meetings(@PathVariable String id,HttpServletRequest req){Map<String,Object>a=member(req),row=get(id,a);require(s(row,"type").equals("trip"),400,"不是活动出行卡");List<Map<String,Object>>all=store.all("life_meeting").stream().filter(r->{Map<String,Object>signup=find("signup",s(row,"referenceId")+":"+s(r,"userId"));return s(r,"entryId").equals(id)&&!s(r,"point").isEmpty()&&signup!=null&&!s(signup,"status").equals("cancelled");}).collect(Collectors.toList());return ApiResponse.ok(map("mine",all.stream().filter(r->s(r,"userId").equals(s(a,"id"))).findFirst().orElse(map("point","")),"counts",all.stream().collect(Collectors.groupingBy(r->s(r,"point"),Collectors.counting())),"participants",auth.isStaff(a)?all:Collections.emptyList()));}
}
