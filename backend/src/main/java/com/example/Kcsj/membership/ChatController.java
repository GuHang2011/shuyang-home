package com.example.Kcsj.membership;

import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import javax.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import static com.example.Kcsj.membership.MemberStore.*;
import static com.example.Kcsj.membership.MemberData.*;

/** Private member messaging. Only conversation participants can read messages. */
@RestController
@Transactional
@RequestMapping("/chat")
public class ChatController {
    private final MemberStore store;
    private final MemberAuth auth;
    private final MediaService media;private final ForumPolicy policy;
    public ChatController(MemberStore store,MemberAuth auth,MediaService media,ForumPolicy policy){this.store=store;this.auth=auth;this.media=media;this.policy=policy;}
    private Map<String,Object> ok(Object value){return map("code",0,"data",value);}
    private Map<String,Object> member(HttpServletRequest req){Map<String,Object> user=auth.require(req);auth.member(user);return user;}
    private long seq(Map<String,Object> row,String key){try{return Long.parseLong(s(row,key));}catch(Exception e){return 0;}}
    private List<Map<String,Object>> memberships(String room){return store.all("chat_member").stream().filter(m->s(m,"roomId").equals(room)&&b(m,"active")).collect(Collectors.toList());}
    private List<Map<String,Object>> messages(String room){return store.all("chat_message").stream().filter(m->s(m,"roomId").equals(room)).sorted(Comparator.comparingLong(m->seq(m,"sequence"))).collect(Collectors.toList());}
    private Map<String,Object> participation(String room,Map<String,Object> actor){return memberships(room).stream().filter(m->s(m,"userId").equals(s(actor,"id"))).findFirst().orElseThrow(()->new ApiException(403,"仅会话成员可查看和操作"));}
    private void join(String room,Map<String,Object> user){String key=room+":"+s(user,"id");Optional<Map<String,Object>> previous=store.all("chat_member").stream().filter(m->s(m,"id").equals(key)).findFirst();Map<String,Object> row=previous.orElse(map("id",key,"roomId",room,"userId",s(user,"id"),"lastRead",0));row.putAll(map("active",true,"joinedAt",now()));store.save("chat_member",row);}
    @SuppressWarnings("unchecked") private String peer(Map<String,Object> room,Map<String,Object> actor){return ((List<String>)room.get("participants")).stream().filter(id->!id.equals(s(actor,"id"))).findFirst().orElse("");}
    private Map<String,Object> roomView(Map<String,Object> room,Map<String,Object> actor,Map<String,Object> membership){
        List<Map<String,Object>> all=messages(s(room,"id"));Map<String,Object> view=pick(room,"id","type","title","description","ownerId","status","requesterId","blockedBy","updatedAt");
        if(s(room,"type").equals("direct")){Map<String,Object> person=store.get("user",peer(room,actor));view.put("title",s(person,"name"));view.put("peerId",s(person,"id"));view.put("peerAvailable",b(person,"enabled")&&s(person,"status").equals("approved"));}
        view.put("memberCount",memberships(s(room,"id")).size());
        long read=membership==null?0:seq(membership,"lastRead");view.put("lastRead",read);view.put("joined",membership!=null);
        view.put("unread",membership==null?0:all.stream().filter(m->seq(m,"sequence")>read&&!s(m,"senderId").equals(s(actor,"id"))).count());
        if(membership!=null&&!all.isEmpty()){Map<String,Object> last=all.get(all.size()-1);String content=b(last,"recalled")?"一条消息已撤回":last.containsKey("attachment")?"[附件] "+s(last,"content"):s(last,"content");view.put("preview",content.substring(0,Math.min(content.length(),80)));}
        return view;
    }
    @GetMapping("/conversations") public Map<String,Object> conversations(HttpServletRequest req){
        Map<String,Object> actor=member(req);Map<String,Map<String,Object>> mine=new HashMap<>();for(Map<String,Object> m:store.all("chat_member"))if(b(m,"active")&&s(m,"userId").equals(s(actor,"id")))mine.put(s(m,"roomId"),m);
        List<Map<String,Object>> rows=store.all("chat_room").stream().filter(r->mine.containsKey(s(r,"id"))).sorted(Comparator.comparing((Map<String,Object> r)->s(r,"updatedAt")).reversed()).map(r->roomView(r,actor,mine.get(s(r,"id")))).collect(Collectors.toList());return ok(rows);
    }
    @GetMapping("/unread") public Map<String,Object> unread(HttpServletRequest req){
        Map<String,Object> actor=member(req);long count=0;for(Map<String,Object> m:store.all("chat_member"))if(b(m,"active")&&s(m,"userId").equals(s(actor,"id")))count+=messages(s(m,"roomId")).stream().filter(x->seq(x,"sequence")>seq(m,"lastRead")&&!s(x,"senderId").equals(s(actor,"id"))).count();return ok(map("count",count));
    }
    @GetMapping("/groups") public Map<String,Object> groups(HttpServletRequest req){Map<String,Object> actor=member(req);return ok(store.all("chat_room").stream().filter(r->s(r,"type").equals("group")&&s(r,"status").equals("active")).map(r->{Map<String,Object> m=memberships(s(r,"id")).stream().filter(x->s(x,"userId").equals(s(actor,"id"))).findFirst().orElse(null);return roomView(r,actor,m);}).collect(Collectors.toList()));}
    @PostMapping("/groups") public Map<String,Object> createGroup(@RequestBody Map<String,Object> input,HttpServletRequest req){store.lockWrites();Map<String,Object> actor=auth.staff(req);auth.limit("chat-group:"+s(actor,"id"),10);Map<String,Object> room=map("id",id(),"type","group","title",text(input,"title",2,50),"description",text(input,"description",0,500),"ownerId",s(actor,"id"),"status","active","sequence",0,"updatedAt",now());store.save("chat_room",room);join(s(room,"id"),actor);auth.audit(actor,"chat.group-create",s(room,"id"));return ok(roomView(room,actor,participation(s(room,"id"),actor)));}
    @PostMapping("/direct") public Map<String,Object> direct(@RequestBody Map<String,Object> input,HttpServletRequest req){
        store.lockWrites();Map<String,Object> actor=member(req),target=store.get("user",text(input,"recipientId",1,80));
        if(s(actor,"id").equals(s(target,"id")))throw new ApiException(400,"请选择另一位老乡");
        if(policy.blocked(s(actor,"id"),s(target,"id")))throw new ApiException(403,"已拉黑的会员不能发起聊天");
        if(!b(target,"enabled")||!s(target,"status").equals("approved"))throw new ApiException(409,"对方暂时无法接受聊天申请");
        List<String> pair=Arrays.asList(s(actor,"id"),s(target,"id"));
        for(Map<String,Object> room:store.all("chat_room"))if(s(room,"type").equals("direct")&&new HashSet<>((List<?>)room.get("participants")).equals(new HashSet<>(pair)))return ok(roomView(room,actor,participation(s(room,"id"),actor)));
        auth.limit("chat-request:"+s(actor,"id"),10);String content=text(input,"content",5,500);
        Map<String,Object> room=map("id",id(),"type","direct","participants",pair,"requesterId",s(actor,"id"),"status","pending","sequence",1,"updatedAt",now());store.save("chat_room",room);join(s(room,"id"),actor);join(s(room,"id"),target);
        store.save("chat_message",map("id",id(),"roomId",s(room,"id"),"senderId",s(actor,"id"),"senderName",s(actor,"name"),"content",content,"sequence",1,"createdAt",now(),"recalled",false));auth.audit(actor,"chat.request",s(room,"id"));return ok(roomView(room,actor,participation(s(room,"id"),actor)));
    }
    @GetMapping("/conversations/{id}") public Map<String,Object> detail(@PathVariable String id,@RequestParam(defaultValue="0") long before,HttpServletRequest req){
        Map<String,Object> actor=member(req),membership=participation(id,actor),room=store.get("chat_room",id);List<Map<String,Object>> history=messages(id),all=history.stream().filter(m->before<=0||seq(m,"sequence")<before).collect(Collectors.toList());
        int start=Math.max(0,all.size()-50);Map<String,Object> view=roomView(room,actor,membership);view.put("messages",all.subList(start,all.size()).stream().map(m->pick(m,"id","sequence","senderId","senderName","content","attachment","createdAt","recalled")).collect(Collectors.toList()));view.put("hasMore",start>0);
        view.put("recalledIds",history.stream().filter(m->b(m,"recalled")).map(m->s(m,"id")).collect(Collectors.toList()));return ok(view);
    }
    @PostMapping("/conversations/{id}/messages") public Map<String,Object> send(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req){
        store.lockWrites();Map<String,Object> actor=member(req);participation(id,actor);Map<String,Object> room=store.get("chat_room",id);
        String requestId=text(input,"requestId",36,36);try{UUID.fromString(requestId);}catch(Exception e){throw new ApiException(400,"消息请求编号无效");}
        String messageId=s(actor,"id")+":"+requestId,attachmentId=text(input,"attachmentId",0,80),content=text(input,"content",0,2000);
        if(content.isEmpty()&&attachmentId.isEmpty())throw new ApiException(400,"请输入消息或选择附件");
        Optional<Map<String,Object>> existing=store.all("chat_message").stream().filter(m->s(m,"id").equals(messageId)).findFirst();
        if(existing.isPresent()){Map<String,Object> old=existing.get();if(!s(old,"roomId").equals(id)||!s(old,"attachmentId").equals(attachmentId)||(!b(old,"recalled")&&!s(old,"content").equals(content)))throw new ApiException(409,"同一请求不能用于不同消息");return ok(old);}
        if(!s(room,"status").equals("active"))throw new ApiException(409,"会话当前不能发送消息");
        media.chatAccess(id,actor,true);
        if(s(room,"type").equals("direct")){Map<String,Object> target=store.get("user",peer(room,actor));if(!b(target,"enabled")||!s(target,"status").equals("approved"))throw new ApiException(409,"对方账号暂时无法接收消息");}
        auth.limit("chat-send:"+s(actor,"id"),120);long sequence=seq(room,"sequence")+1;
        Map<String,Object> row=map("id",messageId,"roomId",id,"senderId",s(actor,"id"),"senderName",s(actor,"name"),"content",content,"attachmentId",attachmentId,"sequence",sequence,"createdAt",now(),"recalled",false);if(!attachmentId.isEmpty())row.put("attachment",media.bindChat(attachmentId,id,messageId,actor));store.save("chat_message",row);room.putAll(map("sequence",sequence,"updatedAt",now()));store.save("chat_room",room);return ok(row);
    }
    @PostMapping("/conversations/{id}/read") public Map<String,Object> read(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req){store.lockWrites();Map<String,Object> actor=member(req),m=participation(id,actor),room=store.get("chat_room",id);long value=seq(input,"sequence");if(value<0||value>seq(room,"sequence"))throw new ApiException(400,"已读位置无效");m.put("lastRead",Math.max(seq(m,"lastRead"),value));store.save("chat_member",m);return ok(map("read",true));}
    @PostMapping("/messages/{id}/recall") public Map<String,Object> recall(@PathVariable String id,HttpServletRequest req){store.lockWrites();Map<String,Object> actor=member(req),row=store.get("chat_message",id);participation(s(row,"roomId"),actor);if(!s(row,"senderId").equals(s(actor,"id")))throw new ApiException(403,"只能撤回自己的消息");if(b(row,"recalled"))return ok(row);if(Instant.parse(s(row,"createdAt")).plusSeconds(120).isBefore(Instant.now()))throw new ApiException(409,"仅可撤回两分钟内的消息");row.put("recalled",true);row.remove("content");row.remove("attachment");store.save("chat_message",row);return ok(row);}
    @PostMapping("/conversations/{id}/action") public Map<String,Object> action(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req){
        store.lockWrites();Map<String,Object> actor=member(req),room=store.get("chat_room",id);String action=choice(input,"action","accept","reject","cancel","block","unblock","join","leave","close");
        if(s(room,"type").equals("group")){
            if(action.equals("join")){if(!s(room,"status").equals("active"))throw new ApiException(409,"该群聊已结束");if(memberships(id).size()>=200&&!memberships(id).stream().anyMatch(m->s(m,"userId").equals(s(actor,"id"))))throw new ApiException(409,"群聊人数已达200人");join(id,actor);return ok(map("joined",true));}
            Map<String,Object> m=participation(id,actor);
            if(action.equals("leave")){if(s(room,"ownerId").equals(s(actor,"id")))throw new ApiException(409,"群主可结束群聊，不能直接退出");m.put("active",false);store.save("chat_member",m);return ok(map("left",true));}
            if(!action.equals("close")||!s(room,"ownerId").equals(s(actor,"id")))throw new ApiException(403,"仅群主可以结束群聊");room.put("status","closed");
        }else{
            participation(id,actor);String state=s(room,"status");boolean requester=s(room,"requesterId").equals(s(actor,"id"));
            if(action.equals("block")){if(state.equals("blocked"))throw new ApiException(409,"会话已屏蔽");room.putAll(map("previousStatus",state,"status","blocked","blockedBy",s(actor,"id")));}
            else if(action.equals("unblock")){if(!state.equals("blocked")||!s(room,"blockedBy").equals(s(actor,"id")))throw new ApiException(403,"仅屏蔽人可以恢复会话");room.put("status",s(room,"previousStatus"));room.remove("blockedBy");}
            else {if(!state.equals("pending"))throw new ApiException(409,"聊天申请已处理");if(action.equals("cancel")&&requester)room.put("status","cancelled");else if(Arrays.asList("accept","reject").contains(action)&&!requester)room.put("status",action.equals("accept")?"active":"rejected");else throw new ApiException(403,"只能由对方处理聊天申请");}
        }
        room.put("updatedAt",now());store.save("chat_room",room);auth.audit(actor,"chat."+action,id);return ok(roomView(room,actor,participation(id,actor)));
    }
}
