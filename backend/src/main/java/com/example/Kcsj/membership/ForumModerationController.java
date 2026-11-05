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
    @PutMapping("/forum/topics/{id}/promotion") public Map<String,Object> promote(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=auth.require(req),row=store.get("forum_topic",id);
        policy.requireModerator(actor,s(row,"category"));
        if(!s(row,"status").equals("approved"))throw new ApiException(409,"仅已公开的话题可以置顶或设为热帖");
        if(!(input.get("revision") instanceof Number)||((Number)input.get("revision")).doubleValue()!=ForumPromotion.revision(row))throw new ApiException(409,"话题推荐状态已更新，请刷新后重试");
        if(!input.containsKey("pinned")&&!input.containsKey("hot"))throw new ApiException(400,"请选择置顶或热帖状态");
        for(String key:Arrays.asList("pinned","hot"))if(input.containsKey(key)&&!(input.get(key) instanceof Boolean))throw new ApiException(400,"推荐状态必须为布尔值");
        boolean pinned=input.containsKey("pinned")?b(input,"pinned"):b(row,"pinned"),hot=input.containsKey("hot")?b(input,"hot"):b(row,"hot");
        if(pinned&&!b(row,"pinned")&&store.all("forum_topic").stream().filter(r->s(r,"category").equals(s(row,"category"))&&s(r,"status").equals("approved")&&b(r,"pinned")).count()>=3)throw new ApiException(409,"每个板块最多置顶3条话题，请先取消其他置顶");
        if(pinned!=b(row,"pinned")||hot!=b(row,"hot")) {
            String pinnedAt=pinned?(b(row,"pinned")?s(row,"pinnedAt"):now()):"";
            row.putAll(map("pinned",pinned,"hot",hot,"pinnedAt",pinnedAt,"promotionRevision",ForumPromotion.revision(row)+1));
            store.save("forum_topic",row);auth.audit(actor,"forum.promotion",id);
        }
        return ApiResponse.ok(row);
    }
    @GetMapping("/my/blocks") public Map<String,Object> blocks(HttpServletRequest req){Map<String,Object> actor=auth.require(req);return ApiResponse.ok(store.all("member_block").stream().filter(r->s(r,"ownerId").equals(s(actor,"id"))&&b(r,"active")).map(r->map("id",s(r,"targetId"),"name",s(store.get("user",s(r,"targetId")),"name"))).collect(Collectors.toList()));}
    @PostMapping("/members/{id}/block") public Map<String,Object> block(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req){store.lockWrites();Map<String,Object> actor=auth.require(req);auth.member(actor);store.get("user",id);if(s(actor,"id").equals(id))throw new ApiException(400,"不能拉黑自己");boolean active=flag(input,"active");store.save("member_block",map("id",s(actor,"id")+":"+id,"ownerId",s(actor,"id"),"targetId",id,"active",active,"createdAt",now()));auth.audit(actor,"member.block-"+active,id);return ApiResponse.ok(true);}
    @PostMapping("/forum/{kind}/{id}/delete") public Map<String,Object> delete(@PathVariable String kind,@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req){
        store.lockWrites();String table=kind.equals("topics")?"forum_topic":kind.equals("replies")?"forum_reply":"";if(table.isEmpty())throw new ApiException(404,"内容不存在");Map<String,Object> actor=auth.require(req),row=store.get(table,id),topic=kind.equals("topics")?row:store.get("forum_topic",s(row,"topicId"));
        if(!s(row,"authorId").equals(s(actor,"id")))policy.requireModerator(actor,s(topic,"category"));
        row.putAll(map("status","deleted","content","","reviewNote",text(input,"note",2,300),"reviewedBy",s(actor,"id")));if(table.equals("forum_topic")){ForumPromotion.clear(row);row.put("title","已删除的话题");row.put("locked",true);}row.remove("audio");row.remove("photos");store.save(table,row);auth.audit(actor,"forum.delete",id);return ApiResponse.ok(true);
    }
    @GetMapping("/forum/restrictions") public Map<String,Object> restrictions(HttpServletRequest req){Map<String,Object> actor=auth.require(req);if(!ForumPolicy.BOARDS.stream().anyMatch(b->policy.moderates(actor,b)))throw new ApiException(403,"仅版主可查看");return ApiResponse.ok(store.all("forum_restriction").stream().filter(r->policy.moderates(actor,s(r,"board"))&&b(r,"active")).collect(Collectors.toList()));}
    @PostMapping("/forum/restrictions") public Map<String,Object> restrict(@RequestBody Map<String,Object> input,HttpServletRequest req){
        store.lockWrites();Map<String,Object> actor=auth.require(req);String board=choice(input,"board",ForumPolicy.BOARDS.toArray(new String[0]));policy.requireModerator(actor,board);Map<String,Object> target=store.get("user",text(input,"userId",1,80));
        if(s(target,"id").equals(s(actor,"id"))||auth.isStaff(target)||policy.moderates(target,board))throw new ApiException(403,"不能通过板块限制处理自己或管理人员");
        String action=choice(input,"action","mute","kick","restore");Map<String,Object> row=map("id",s(target,"id")+":"+board,"userId",s(target,"id"),"name",s(target,"name"),"board",board,"action",action,"active",!action.equals("restore"),"reason",text(input,"reason",2,300),"operatorId",s(actor,"id"),"createdAt",now());store.save("forum_restriction",row);auth.audit(actor,"forum."+action,s(target,"id"));return ApiResponse.ok(row);
    }
}
