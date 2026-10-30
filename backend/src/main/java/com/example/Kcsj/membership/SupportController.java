package com.example.Kcsj.membership;

import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import javax.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import static com.example.Kcsj.membership.MemberStore.*;
import static com.example.Kcsj.membership.MemberData.*;

/** Crowdfunding records pledges only; no payment, balance, receipt or disbursement. */
@RestController
@Transactional
public class SupportController {
    private final MemberStore store;
    private final MemberAuth auth;
    private final ForumPolicy policy;
    public SupportController(MemberStore store,MemberAuth auth,ForumPolicy policy) {this.store=store;this.auth=auth;this.policy=policy;}
    private Map<String,Object> ok(Object value) {return map("code",0,"data",value);}
    private List<Map<String,Object>> rows(String kind) {List<Map<String,Object>> rows=store.all(kind);rows.sort(Comparator.comparing((Map<String,Object>x)->s(x,"createdAt")).reversed());return rows;}
    private Map<String,Object> member(HttpServletRequest req) {Map<String,Object> actor=auth.require(req);auth.member(actor);return actor;}
    private BigDecimal amount(Map<String,Object> input,String key) {
        try {BigDecimal value=new BigDecimal(s(input,key));if(value.scale()>2||value.signum()<=0||value.compareTo(new BigDecimal("1000000000"))>0)throw new Exception();return value;}
        catch(Exception e){throw new ApiException(400,"数量须大于0、最多两位小数且不超过10亿："+key);}
    }
    private BigDecimal sum(List<Map<String,Object>> pledges,String status) {return pledges.stream().filter(p->status.isEmpty()?!s(p,"status").equals("cancelled"):s(p,"status").equals(status)).map(p->new BigDecimal(s(p,"quantity"))).reduce(BigDecimal.ZERO,BigDecimal::add);}
    private List<Map<String,Object>> pledges(String id) {return rows("crowd_pledge").stream().filter(p->s(p,"projectId").equals(id)).collect(Collectors.toList());}
    private Map<String,Object> projectView(Map<String,Object> project,Map<String,Object> actor) {
        List<Map<String,Object>> pledges=pledges(s(project,"id"));Map<String,Object> result=new LinkedHashMap<>(project);
        if(actor==null||(!s(project,"authorId").equals(s(actor,"id"))&&!auth.isStaff(actor))){result.remove("reviewNote");result.remove("reviewedBy");}
        result.put("pledgedQuantity",sum(pledges,""));result.put("deliveredQuantity",sum(pledges,"delivered"));
        result.put("ended",s(project,"state").equals("closed")||!instant(project,"endsAt").isAfter(Instant.now()));
        result.put("supporters",pledges.stream().filter(p->!s(p,"status").equals("cancelled")).map(p->s(p,"supporterId")).distinct().count());return result;
    }
    private Map<String,Object> requireProjectOwner(String id,HttpServletRequest req) {Map<String,Object> actor=member(req),project=store.get("crowd_project",id);if(!s(project,"authorId").equals(s(actor,"id"))&&!auth.isStaff(actor))throw new ApiException(403,"仅项目发起人和组织者可处理支持记录");return actor;}
    @GetMapping("/crowdfunding") public Map<String,Object> projects(HttpServletRequest req) {Map<String,Object> actor=auth.optional(req);return ok(rows("crowd_project").stream().filter(p->s(p,"status").equals("approved")).map(p->projectView(p,actor)).collect(Collectors.toList()));}
    @GetMapping("/my/crowdfunding") public Map<String,Object> myProjects(HttpServletRequest req) {Map<String,Object> actor=auth.require(req);return ok(rows("crowd_project").stream().filter(p->s(p,"authorId").equals(s(actor,"id"))).map(p->projectView(p,actor)).collect(Collectors.toList()));}
    @GetMapping("/admin/crowdfunding") public Map<String,Object> manageProjects(HttpServletRequest req) {Map<String,Object> actor=auth.staff(req);return ok(rows("crowd_project").stream().map(p->projectView(p,actor)).collect(Collectors.toList()));}
    @PostMapping("/crowdfunding") public Map<String,Object> createProject(@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=member(req);auth.limit("crowdfunding:"+s(actor,"id"),10);
        String type=choice(input,"type","物资","志愿服务","资金意向");String unit=type.equals("资金意向")?"元":type.equals("志愿服务")?"小时":text(input,"unit",1,10);
        Instant end=instant(input,"endsAt");if(!end.isAfter(Instant.now())||end.isAfter(Instant.now().plusSeconds(180L*86400)))throw new ApiException(400,"支持截止时间须在未来180天内");
        if(!flag(input,"consent"))throw new ApiException(400,"请同意如实说明项目用途及本平台不在线收款的约定");
        Map<String,Object> row=map("id",id(),"authorId",s(actor,"id"),"authorName",s(actor,"name"),"title",text(input,"title",2,80),"description",text(input,"description",10,3000),"purpose",text(input,"purpose",5,1000),
            "type",type,"unit",unit,"goal",amount(input,"goal"),"endsAt",end.toString(),"status","pending","state","open","createdAt",now(),"consentAt",now());
        store.save("crowd_project",row);auth.audit(actor,"crowdfunding.apply",s(row,"id"));return ok(projectView(row,actor));
    }
    @PostMapping("/crowdfunding/{id}/review") public Map<String,Object> reviewProject(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=auth.staff(req),project=store.get("crowd_project",id);String status=choice(input,"status","approved","rejected");
        if(!s(project,"status").equals("pending"))throw new ApiException(409,"项目已处理，请刷新");
        if(status.equals("approved")&&!instant(project,"endsAt").isAfter(Instant.now()))throw new ApiException(409,"项目已过截止时间，不能通过");
        project.putAll(map("status",status,"reviewNote",text(input,"note",status.equals("rejected")?2:0,300),"reviewedBy",s(actor,"id")));store.save("crowd_project",project);auth.audit(actor,"crowdfunding."+status,id);return ok(projectView(project,actor));
    }
    @PostMapping("/crowdfunding/{id}/close") public Map<String,Object> closeProject(@PathVariable String id,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=requireProjectOwner(id,req),project=store.get("crowd_project",id);project.put("state","closed");store.save("crowd_project",project);auth.audit(actor,"crowdfunding.close",id);return ok(projectView(project,actor));
    }
    @PostMapping("/crowdfunding/{id}/pledges") public Map<String,Object> pledge(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=member(req),project=store.get("crowd_project",id);BigDecimal quantity=amount(input,"quantity");
        String requestId=text(input,"requestId",36,36);try{UUID.fromString(requestId);}catch(Exception e){throw new ApiException(400,"请求编号格式错误");}
        String recordId=s(actor,"id")+":"+requestId;Optional<Map<String,Object>> existing=store.all("crowd_pledge").stream().filter(p->s(p,"id").equals(recordId)).findFirst();
        if(existing.isPresent()){Map<String,Object> old=existing.get();if(!s(old,"projectId").equals(id)||new BigDecimal(s(old,"quantity")).compareTo(quantity)!=0)throw new ApiException(409,"同一请求编号不能用于不同认领");return ok(old);}
        if(!s(project,"status").equals("approved")||s(project,"state").equals("closed")||!instant(project,"endsAt").isAfter(Instant.now()))throw new ApiException(409,"项目当前不接收支持");
        if(sum(pledges(id),"").add(quantity).compareTo(new BigDecimal(s(project,"goal")))>0)throw new ApiException(409,"认领数量超过剩余目标，请刷新进度后调整");
        auth.limit("pledge:"+s(actor,"id"),20);
        Map<String,Object> row=map("id",recordId,"projectId",id,"projectTitle",s(project,"title"),"projectType",s(project,"type"),"unit",s(project,"unit"),"supporterId",s(actor,"id"),"supporterName",s(actor,"name"),
            "quantity",quantity,"message",text(input,"message",0,300),"status","pledged","createdAt",now());store.save("crowd_pledge",row);auth.audit(actor,"crowdfunding.pledge",recordId);return ok(row);
    }
    @GetMapping("/my/pledges") public Map<String,Object> myPledges(HttpServletRequest req) {Map<String,Object> actor=auth.require(req);return ok(rows("crowd_pledge").stream().filter(p->s(p,"supporterId").equals(s(actor,"id"))).collect(Collectors.toList()));}
    @GetMapping("/crowdfunding/{id}/pledges") public Map<String,Object> projectPledges(@PathVariable String id,HttpServletRequest req) {requireProjectOwner(id,req);return ok(pledges(id));}
    @PostMapping("/pledges/{id}/cancel") public Map<String,Object> cancelPledge(@PathVariable String id,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=member(req),row=store.get("crowd_pledge",id);if(!s(row,"supporterId").equals(s(actor,"id")))throw new ApiException(403,"只能取消自己的认领");
        if(s(row,"status").equals("delivered"))throw new ApiException(409,"已核实交付的记录不能取消");row.put("status","cancelled");store.save("crowd_pledge",row);auth.audit(actor,"crowdfunding.cancel",id);return ok(row);
    }
    @PostMapping("/pledges/{id}/deliver") public Map<String,Object> deliverPledge(@PathVariable String id,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> row=store.get("crowd_pledge",id),actor=requireProjectOwner(s(row,"projectId"),req);
        if(s(row,"projectType").equals("资金意向"))throw new ApiException(400,"资金仅登记意向，不能标为收款或已交付");
        if(s(row,"status").equals("cancelled"))throw new ApiException(409,"该认领已取消");row.putAll(map("status","delivered","confirmedAt",now(),"confirmedBy",s(actor,"id")));store.save("crowd_pledge",row);auth.audit(actor,"crowdfunding.deliver",id);return ok(row);
    }

    private Map<String,Object> contactView(Map<String,Object> row,Map<String,Object> actor) {
        Map<String,Object> result=new LinkedHashMap<>(row);
        if(!s(row,"status").equals("accepted")){if(!s(row,"requesterId").equals(s(actor,"id")))result.remove("requesterContact");if(!s(row,"recipientId").equals(s(actor,"id")))result.remove("recipientContact");}
        return result;
    }
    @GetMapping("/my/contact-exchanges") public Map<String,Object> contacts(HttpServletRequest req) {
        Map<String,Object> actor=auth.require(req);return ok(rows("contact_exchange").stream().filter(x->s(x,"requesterId").equals(s(actor,"id"))||s(x,"recipientId").equals(s(actor,"id"))).map(x->contactView(x,actor)).collect(Collectors.toList()));
    }
    @PostMapping("/contact-exchanges") public Map<String,Object> requestContact(@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=member(req),target=store.get("user",text(input,"recipientId",1,80));
        if(policy.blocked(s(actor,"id"),s(target,"id")))throw new ApiException(403,"拉黑后不能申请交换联系方式");
        if(s(actor,"id").equals(s(target,"id")))throw new ApiException(400,"不能与自己交换联系方式");
        if(!b(target,"enabled")||!s(target,"status").equals("approved"))throw new ApiException(409,"对方账号暂时无法接受联系申请");
        for(Map<String,Object> row:store.all("contact_exchange"))if(Arrays.asList("pending","accepted").contains(s(row,"status"))&&((s(row,"requesterId").equals(s(actor,"id"))&&s(row,"recipientId").equals(s(target,"id")))||(s(row,"recipientId").equals(s(actor,"id"))&&s(row,"requesterId").equals(s(target,"id")))))throw new ApiException(409,"双方已有联系申请或已完成交换，请在联系方式交换中查看");
        auth.limit("contact:"+s(actor,"id"),10);
        Map<String,Object> row=map("id",id(),"requesterId",s(actor,"id"),"requesterName",s(actor,"name"),"recipientId",s(target,"id"),"recipientName",s(target,"name"),
            "message",text(input,"message",5,500),"requesterContact",text(input,"contact",2,100),"status","pending","createdAt",now());store.save("contact_exchange",row);auth.audit(actor,"contact.request",s(row,"id"));return ok(contactView(row,actor));
    }
    @PostMapping("/contact-exchanges/{id}/action") public Map<String,Object> contactAction(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=member(req),row=store.get("contact_exchange",id);boolean requester=s(row,"requesterId").equals(s(actor,"id")),recipient=s(row,"recipientId").equals(s(actor,"id"));
        if(!requester&&!recipient)throw new ApiException(403,"只能处理自己的联系方式交换");String action=choice(input,"action","accept","reject","cancel","revoke"),state=s(row,"status");
        if(action.equals("revoke")){if(!state.equals("accepted"))throw new ApiException(409,"仅已同意的交换可以撤销展示");row.put("status","revoked");}
        else {
            if(!state.equals("pending"))throw new ApiException(409,"该联系申请已处理");
            if(action.equals("cancel")){if(!requester)throw new ApiException(403,"仅申请人可取消");row.put("status","cancelled");}
            else {if(!recipient)throw new ApiException(403,"仅接收人可同意或拒绝");if(action.equals("accept")){Map<String,Object> source=store.get("user",s(row,"requesterId"));if(!b(source,"enabled"))throw new ApiException(409,"申请人已停用");row.put("recipientContact",text(input,"contact",2,100));row.put("status","accepted");}else row.put("status","rejected");}
        }
        row.put("updatedAt",now());store.save("contact_exchange",row);auth.audit(actor,"contact."+action,id);return ok(contactView(row,actor));
    }
}
