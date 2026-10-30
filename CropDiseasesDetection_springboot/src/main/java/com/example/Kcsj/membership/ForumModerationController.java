package com.example.Kcsj.membership;

import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import javax.servlet.http.HttpServletRequest;
import java.util.*;
import java.util.stream.Collectors;
import static com.example.Kcsj.membership.MemberStore.*;
import static com.example.Kcsj.membership.MemberData.*;

@RestController @Transactional
public class ForumModerationController {
    private final MemberStore store;private final MemberAuth auth;private final ForumPolicy policy;
    public ForumModerationController(MemberStore store,MemberAuth auth,ForumPolicy policy){this.store=store;this.auth=auth;this.policy=policy;}
    private Map<String,Object> ok(Object row){return map("code",0,"data",row);}
    @GetMapping("/my/blocks") public Map<String,Object> blocks(HttpServletRequest req){Map<String,Object> actor=auth.require(req);return ok(store.all("member_block").stream().filter(r->s(r,"ownerId").equals(s(actor,"id"))&&b(r,"active")).map(r->map("id",s(r,"targetId"),"name",s(store.get("user",s(r,"targetId")),"name"))).collect(Collectors.toList()));}
    @PostMapping("/members/{id}/block") public Map<String,Object> block(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req){store.lockWrites();Map<String,Object> actor=auth.require(req);auth.member(actor);store.get("user",id);if(s(actor,"id").equals(id))throw new ApiException(400,"不能拉黑自己");boolean active=flag(input,"active");store.save("member_block",map("id",s(actor,"id")+":"+id,"ownerId",s(actor,"id"),"targetId",id,"active",active,"createdAt",now()));auth.audit(actor,"member.block-"+active,id);return ok(true);}
    @PostMapping("/forum/{kind}/{id}/delete") public Map<String,Object> delete(@PathVariable String kind,@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req){
        store.lockWrites();String table=kind.equals("topics")?"forum_topic":kind.equals("replies")?"forum_reply":"";if(table.isEmpty())throw new ApiException(404,"内容不存在");Map<String,Object> actor=auth.require(req),row=store.get(table,id),topic=kind.equals("topics")?row:store.get("forum_topic",s(row,"topicId"));
        if(!s(row,"authorId").equals(s(actor,"id")))policy.requireModerator(actor,s(topic,"category"));
        row.putAll(map("status","deleted","content","","reviewNote",text(input,"note",2,300),"reviewedBy",s(actor,"id")));if(table.equals("forum_topic")){row.put("title","已删除的话题");row.put("locked",true);}row.remove("audio");row.remove("photos");store.save(table,row);auth.audit(actor,"forum.delete",id);return ok(true);
    }
    @GetMapping("/forum/restrictions") public Map<String,Object> restrictions(HttpServletRequest req){Map<String,Object> actor=auth.require(req);if(!ForumPolicy.BOARDS.stream().anyMatch(b->policy.moderates(actor,b)))throw new ApiException(403,"仅版主可查看");return ok(store.all("forum_restriction").stream().filter(r->policy.moderates(actor,s(r,"board"))&&b(r,"active")).collect(Collectors.toList()));}
    @PostMapping("/forum/restrictions") public Map<String,Object> restrict(@RequestBody Map<String,Object> input,HttpServletRequest req){
        store.lockWrites();Map<String,Object> actor=auth.require(req);String board=choice(input,"board",ForumPolicy.BOARDS.toArray(new String[0]));policy.requireModerator(actor,board);Map<String,Object> target=store.get("user",text(input,"userId",1,80));
        if(s(target,"id").equals(s(actor,"id"))||auth.isStaff(target)||policy.moderates(target,board))throw new ApiException(403,"不能通过板块限制处理自己或管理人员");
        String action=choice(input,"action","mute","kick","restore");Map<String,Object> row=map("id",s(target,"id")+":"+board,"userId",s(target,"id"),"name",s(target,"name"),"board",board,"action",action,"active",!action.equals("restore"),"reason",text(input,"reason",2,300),"operatorId",s(actor,"id"),"createdAt",now());store.save("forum_restriction",row);auth.audit(actor,"forum."+action,s(target,"id"));return ok(row);
    }
}
