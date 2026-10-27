package com.example.Kcsj.membership;

import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import javax.servlet.http.HttpServletRequest;
import java.util.*;
import java.util.stream.Collectors;
import static com.example.Kcsj.membership.MemberStore.*;
import static com.example.Kcsj.membership.MemberData.*;

/** Forum moderation and bilateral resource exchange share membership authorization. */
@RestController
@Transactional
public class CommunityController {
    private final MemberStore store;
    private final MemberAuth auth;
    private final ForumPolicy policy;
    private final MediaService media;
    public CommunityController(MemberStore store,MemberAuth auth,ForumPolicy policy,MediaService media) {this.store=store;this.auth=auth;this.policy=policy;this.media=media;}
    private Map<String,Object> ok(Object data) {return map("code",0,"data",data);}
    private List<Map<String,Object>> rows(String kind) {
        List<Map<String,Object>> rows=store.all(kind);rows.sort(Comparator.comparing((Map<String,Object>x)->s(x,"createdAt")).reversed());return rows;
    }
    private boolean owner(Map<String,Object> row,Map<String,Object> actor) {return actor!=null&&s(row,"authorId").equals(s(actor,"id"));}
    private boolean visible(Map<String,Object> row,Map<String,Object> actor) {return s(row,"status").equals("approved")||owner(row,actor)||policy.moderates(actor,s(row,"category"));}
    private Map<String,Object> publicRow(Map<String,Object> row,Map<String,Object> actor) {
        Map<String,Object> result=new LinkedHashMap<>(row);
        if(actor==null||(!owner(row,actor)&&!s(actor,"status").equals("approved")))result.remove("contact");
        if(!owner(row,actor)&&!auth.isStaff(actor)){result.remove("reviewNote");result.remove("reviewedBy");}
        return result;
    }
    private Map<String,Object> author(Map<String,Object> actor) {return map("id",id(),"authorId",s(actor,"id"),"authorName",s(actor,"name"),"status","pending","createdAt",now(),"reviewNote","");}
    private Map<String,Object> approvedMember(HttpServletRequest req) {Map<String,Object> actor=auth.require(req);auth.member(actor);return actor;}
    private Map<String,Object> moderate(String kind,String id,Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=auth.require(req),row=store.get(kind,id);
        if(kind.startsWith("forum_")){Map<String,Object> topic=kind.equals("forum_topic")?row:store.get("forum_topic",s(row,"topicId"));policy.requireModerator(actor,s(topic,"category"));}else if(!auth.isStaff(actor))throw new ApiException(403,"仅组织者可以审核资源");
        String next=choice(input,"status","approved","rejected","hidden");String current=s(row,"status");
        if(!((current.equals("pending")&&(next.equals("approved")||next.equals("rejected")))||(current.equals("approved")&&next.equals("hidden"))||(current.equals("hidden")&&next.equals("approved"))))throw new ApiException(409,"内容已被处理，请刷新列表");
        row.putAll(map("status",next,"reviewNote",text(input,"note",next.equals("approved")?0:2,300),"reviewedBy",s(actor,"id")));
        store.save(kind,row);auth.audit(actor,kind+"."+next,id);return ok(row);
    }
    private Map<String,Object> topicView(Map<String,Object> topic,Map<String,Object> actor) {
        Map<String,Object> result=publicRow(topic,actor);result.put("canModerate",policy.moderates(actor,s(topic,"category")));
        if(!s(topic,"forwardedTopicId").isEmpty()){Optional<Map<String,Object>> source=store.all("forum_topic").stream().filter(r->s(r,"id").equals(s(topic,"forwardedTopicId"))&&s(r,"status").equals("approved")&&policy.canRead(actor,s(r,"category"))&&!policy.hiddenAuthor(actor,s(r,"authorId"))).findFirst();result.put("forwarded",source.isPresent()?pick(source.get(),"id","title","content","authorName","audio"):map("unavailable",true));}
        result.put("replyCount",store.all("forum_reply").stream().filter(r->s(r,"topicId").equals(s(topic,"id"))&&s(r,"status").equals("approved")).count());return result;
    }
    private Map<String,Object> replyView(Map<String,Object> reply,Map<String,Object> actor,Map<String,Object> topic){
        Map<String,Object> view=publicRow(reply,actor);view.put("canModerate",policy.moderates(actor,s(topic,"category")));view.put("category",s(topic,"category"));
        if(!s(reply,"parentId").isEmpty()){Map<String,Object> parent=store.get("forum_reply",s(reply,"parentId"));view.put("quoted",s(parent,"status").equals("approved")&&!policy.hiddenAuthor(actor,s(parent,"authorId"))?pick(parent,"floor","content","authorName","audio"):map("unavailable",true));}return view;
    }
    @GetMapping("/forum/topics") public Map<String,Object> topics(HttpServletRequest req) {
        Map<String,Object> actor=auth.optional(req);return ok(rows("forum_topic").stream().filter(x->s(x,"status").equals("approved")&&policy.canRead(actor,s(x,"category"))&&!policy.hiddenAuthor(actor,s(x,"authorId"))).map(x->topicView(x,actor)).collect(Collectors.toList()));
    }
    @GetMapping("/my/forum") public Map<String,Object> myTopics(HttpServletRequest req) {
        Map<String,Object> actor=auth.require(req);return ok(rows("forum_topic").stream().filter(x->owner(x,actor)).map(x->topicView(x,actor)).collect(Collectors.toList()));
    }
    @GetMapping("/forum/topics/{id}") public Map<String,Object> topic(@PathVariable String id,HttpServletRequest req) {
        Map<String,Object> actor=auth.optional(req),topic=store.get("forum_topic",id);
        policy.participating(actor,s(topic,"category"),false);
        if(s(topic,"status").equals("deleted")||policy.hiddenAuthor(actor,s(topic,"authorId"))||!visible(topic,actor))throw new ApiException(404,"话题不存在或尚未公开");
        return ok(map("topic",topicView(topic,actor),"replies",rows("forum_reply").stream().filter(x->s(x,"topicId").equals(id)&&(visible(x,actor)||policy.moderates(actor,s(topic,"category")))&&!policy.hiddenAuthor(actor,s(x,"authorId"))).sorted(Comparator.comparing(x->s(x,"createdAt"))).map(x->replyView(x,actor,topic)).collect(Collectors.toList())));
    }
    @PostMapping("/forum/topics") public Map<String,Object> createTopic(@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=approvedMember(req);auth.limit("forum:"+s(actor,"id"),20);Map<String,Object> topic=author(actor);
        String audioId=text(input,"audioId",0,80);
        topic.putAll(map("title",text(input,"title",2,80),"content",text(input,"content",audioId.isEmpty()?10:0,5000),"category",choice(input,"category","乡情闲聊","苏州生活","创业交流","家乡故事"),"locked",false));
        policy.participating(actor,s(topic,"category"),true);
        String forward=text(input,"forwardedTopicId",0,80);if(!forward.isEmpty()){Map<String,Object> source=store.get("forum_topic",forward);policy.participating(actor,s(source,"category"),false);if(!policy.canRead(actor,s(source,"category"))||!s(source,"status").equals("approved")||policy.hiddenAuthor(actor,s(source,"authorId")))throw new ApiException(404,"原帖不可转发");topic.put("forwardedTopicId",forward);}
        if(!audioId.isEmpty())topic.put("audio",media.bindForum(audioId,"forum_topic",s(topic,"id"),actor));
        store.save("forum_topic",topic);auth.audit(actor,"forum.create",s(topic,"id"));return ok(topic);
    }
    @PostMapping("/forum/topics/{id}/replies") public Map<String,Object> reply(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=approvedMember(req),topic=store.get("forum_topic",id);
        if(!s(topic,"status").equals("approved")||b(topic,"locked"))throw new ApiException(409,"话题尚未公开或已关闭回复");
        policy.participating(actor,s(topic,"category"),true);if(policy.blocked(s(actor,"id"),s(topic,"authorId")))throw new ApiException(403,"拉黑后不能向对方的话题回复");
        String audioId=text(input,"audioId",0,80);
        auth.limit("reply:"+s(actor,"id"),30);Map<String,Object> reply=author(actor);reply.putAll(map("topicId",id,"content",text(input,"content",audioId.isEmpty()?2:0,2000)));
        List<Map<String,Object>> history=store.all("forum_reply").stream().filter(r->s(r,"topicId").equals(id)).sorted(Comparator.comparing(r->s(r,"createdAt"))).collect(Collectors.toList());int floor=0;for(Map<String,Object> old:history){floor++;if(!old.containsKey("floor")){old.put("floor",floor);store.save("forum_reply",old);}}
        reply.put("floor",floor+1);String parent=text(input,"parentId",0,80);if(!parent.isEmpty()){Map<String,Object> quoted=store.get("forum_reply",parent);if(!s(quoted,"topicId").equals(id)||!s(quoted,"status").equals("approved")||policy.hiddenAuthor(actor,s(quoted,"authorId")))throw new ApiException(400,"引用的楼层已不可用");reply.put("parentId",parent);}
        if(!audioId.isEmpty())reply.put("audio",media.bindForum(audioId,"forum_reply",s(reply,"id"),actor));
        store.save("forum_reply",reply);auth.audit(actor,"forum.reply",s(reply,"id"));return ok(reply);
    }
    @PostMapping("/forum/topics/{id}/lock") public Map<String,Object> lock(@PathVariable String id,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=auth.require(req),topic=store.get("forum_topic",id);
        if(!owner(topic,actor)&&!policy.moderates(actor,s(topic,"category")))throw new ApiException(403,"只有作者或组织者可以关闭话题");
        topic.put("locked",true);store.save("forum_topic",topic);auth.audit(actor,"forum.lock",id);return ok(topic);
    }
    @GetMapping("/admin/forum") public Map<String,Object> manageForum(HttpServletRequest req) {
        Map<String,Object> actor=auth.require(req);if(!ForumPolicy.BOARDS.stream().anyMatch(b->policy.moderates(actor,b)))throw new ApiException(403,"仅版主可以查看管理队列");
        return ok(map("topics",rows("forum_topic").stream().filter(r->policy.moderates(actor,s(r,"category"))).collect(Collectors.toList()),"replies",rows("forum_reply").stream().filter(r->policy.moderates(actor,s(store.get("forum_topic",s(r,"topicId")),"category"))).collect(Collectors.toList())));
    }
    @PostMapping("/forum/topics/{id}/review") public Map<String,Object> reviewTopic(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req) {return moderate("forum_topic",id,input,req);}
    @PostMapping("/forum/replies/{id}/review") public Map<String,Object> reviewReply(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req) {return moderate("forum_reply",id,input,req);}

    @GetMapping("/resources") public Map<String,Object> resources(HttpServletRequest req) {
        Map<String,Object> actor=auth.optional(req);return ok(rows("resource").stream().filter(x->s(x,"status").equals("approved")).map(x->publicRow(x,actor)).collect(Collectors.toList()));
    }
    @GetMapping("/my/resources") public Map<String,Object> myResources(HttpServletRequest req) {
        Map<String,Object> actor=auth.require(req);return ok(rows("resource").stream().filter(x->owner(x,actor)).collect(Collectors.toList()));
    }
    @PostMapping("/resources") public Map<String,Object> createResource(@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=approvedMember(req);auth.limit("resource:"+s(actor,"id"),20);Map<String,Object> resource=author(actor);
        resource.putAll(map("title",text(input,"title",2,80),"offering",text(input,"offering",5,2000),"seeking",text(input,"seeking",5,2000),
            "category",choice(input,"category","技能服务","闲置物品","场地设备","信息渠道"),"district",text(input,"district",2,80),"contact",text(input,"contact",0,80),"availability","available"));
        store.save("resource",resource);auth.audit(actor,"resource.create",s(resource,"id"));return ok(resource);
    }
    @GetMapping("/admin/resources") public Map<String,Object> manageResources(HttpServletRequest req) {auth.staff(req);return ok(map("resources",rows("resource"),"exchanges",rows("exchange")));}
    @PostMapping("/resources/{id}/review") public Map<String,Object> reviewResource(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req) {return moderate("resource",id,input,req);}
    @PostMapping("/resources/{id}/close") public Map<String,Object> closeResource(@PathVariable String id,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=auth.require(req),resource=store.get("resource",id);
        if(!owner(resource,actor)&&!auth.isStaff(actor))throw new ApiException(403,"只能关闭自己的资源");
        if(s(resource,"availability").equals("reserved"))throw new ApiException(409,"资源正在交换中，请先处理交换记录");
        resource.put("availability","closed");store.save("resource",resource);
        for(Map<String,Object> exchange:store.all("exchange"))if(s(exchange,"resourceId").equals(id)&&s(exchange,"status").equals("pending")){exchange.put("status","unavailable");store.save("exchange",exchange);}
        auth.audit(actor,"resource.close",id);return ok(resource);
    }
    @PostMapping("/resources/{id}/requests") public Map<String,Object> requestExchange(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=approvedMember(req),resource=store.get("resource",id);
        if(owner(resource,actor))throw new ApiException(400,"不能向自己的资源发起交换");
        if(!s(resource,"status").equals("approved")||!s(resource,"availability").equals("available"))throw new ApiException(409,"资源当前不可申请交换");
        Map<String,Object> target=store.get("user",s(resource,"authorId"));if(!b(target,"enabled"))throw new ApiException(409,"资源发布者暂时无法回应");
        String message=text(input,"message",5,1000),contact=text(input,"contact",2,80);
        for(Map<String,Object> row:store.all("exchange"))if(s(row,"resourceId").equals(id)&&s(row,"requesterId").equals(s(actor,"id"))&&Arrays.asList("pending","accepted").contains(s(row,"status")))return ok(row);
        auth.limit("exchange:"+s(actor,"id"),20);
        Map<String,Object> exchange=map("id",id(),"resourceId",id,"resourceTitle",s(resource,"title"),"ownerId",s(resource,"authorId"),"ownerName",s(resource,"authorName"),
            "requesterId",s(actor,"id"),"requesterName",s(actor,"name"),"message",message,"contact",contact,"ownerContact",s(resource,"contact"),"status","pending","ownerConfirmed",false,"requesterConfirmed",false,"createdAt",now());
        store.save("exchange",exchange);auth.audit(actor,"exchange.request",s(exchange,"id"));return ok(exchange);
    }
    @GetMapping("/my/exchanges") public Map<String,Object> myExchanges(HttpServletRequest req) {
        Map<String,Object> actor=auth.require(req);return ok(rows("exchange").stream().filter(x->s(x,"requesterId").equals(s(actor,"id"))||s(x,"ownerId").equals(s(actor,"id"))).collect(Collectors.toList()));
    }
    @PostMapping("/exchanges/{id}/action") public Map<String,Object> exchangeAction(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=approvedMember(req),row=store.get("exchange",id),resource=store.get("resource",s(row,"resourceId"));
        boolean isOwner=s(row,"ownerId").equals(s(actor,"id")),isRequester=s(row,"requesterId").equals(s(actor,"id"));
        if(!isOwner&&!isRequester)throw new ApiException(403,"只能处理自己参与的交换");
        String action=choice(input,"action","accept","reject","cancel","confirm");String state=s(row,"status");
        if(action.equals("accept")||action.equals("reject")) {
            if(!isOwner)throw new ApiException(403,"仅资源发布者可接受或拒绝交换");
            if(!state.equals("pending"))throw new ApiException(409,"申请已处理，请刷新记录");
            if(action.equals("accept")) {
                if(!s(resource,"availability").equals("available")||!s(resource,"status").equals("approved"))throw new ApiException(409,"资源当前不可交换");
                Map<String,Object> requester=store.get("user",s(row,"requesterId"));if(!b(requester,"enabled")||!s(requester,"status").equals("approved"))throw new ApiException(409,"申请者账号状态不允许交换");
                resource.put("availability","reserved");store.save("resource",resource);row.put("status","accepted");
                for(Map<String,Object> other:store.all("exchange"))if(!s(other,"id").equals(id)&&s(other,"resourceId").equals(s(resource,"id"))&&s(other,"status").equals("pending")){other.put("status","unavailable");store.save("exchange",other);}
            } else row.put("status","rejected");
        } else if(action.equals("cancel")) {
            if(!isRequester)throw new ApiException(403,"仅申请者可取消申请");
            if(!state.equals("pending"))throw new ApiException(409,"只能取消尚未接受的申请");row.put("status","cancelled");
        } else {
            if(state.equals("completed"))return ok(row);
            if(!state.equals("accepted"))throw new ApiException(409,"接受交换后才可确认完成");
            row.put(isOwner?"ownerConfirmed":"requesterConfirmed",true);
            if(b(row,"ownerConfirmed")&&b(row,"requesterConfirmed")){row.put("status","completed");resource.put("availability","exchanged");store.save("resource",resource);}
        }
        row.put("updatedAt",now());store.save("exchange",row);auth.audit(actor,"exchange."+action,id);return ok(row);
    }
}
