package com.example.Kcsj.membership;

import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import javax.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import static com.example.Kcsj.membership.MemberStore.*;
import static com.example.Kcsj.membership.MemberData.*;

@RestController @Transactional
public class BroadcastController {
    private final MemberStore store;private final MemberAuth auth;private final MediaService media;
    public BroadcastController(MemberStore store,MemberAuth auth,MediaService media){this.store=store;this.auth=auth;this.media=media;}
    private Map<String,Object> ok(Object value){return map("code",0,"data",value);}
    private Map<String,Object> admin(HttpServletRequest req){Map<String,Object> actor=auth.require(req);if(!auth.isAdmin(actor))throw new ApiException(403,"仅管理员可以管理全站广播");return actor;}
    @GetMapping("/broadcasts") public Map<String,Object> active() {
        Instant time=Instant.now();return ok(map("serverTime",time.toString(),"items",store.all("broadcast").stream()
            .filter(row->Broadcasts.state(row,time).equals("active"))
            .sorted(Comparator.comparing((Map<String,Object> row)->s(row,"startsAt")).reversed().thenComparing(row->s(row,"id")))
            .map(row->Broadcasts.view(row,time)).collect(Collectors.toList())));
    }
    @GetMapping("/admin/broadcasts") public Map<String,Object> list(HttpServletRequest req) {
        admin(req);Instant time=Instant.now();return ok(store.all("broadcast").stream()
            .sorted(Comparator.comparing((Map<String,Object> row)->s(row,"createdAt")).reversed())
            .map(row->Broadcasts.view(row,time)).collect(Collectors.toList()));
    }
    private Instant date(Map<String,Object> input,String field){try{return Instant.parse(text(input,field,1,40));}catch(Exception e){throw new ApiException(400,"请填写有效的广播生效和到期时间");}}
    private void revision(Map<String,Object> input,Map<String,Object> row){if(!(input.get("revision") instanceof Number)||((Number)input.get("revision")).doubleValue()!=Broadcasts.revision(row))throw new ApiException(409,"广播已被其他管理员修改，请重新加载后编辑");}
    @PostMapping("/admin/broadcasts") public Map<String,Object> create(@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=admin(req);
        // A stable draft ID makes retrying a lost create response safe.
        String key=text(input,"requestId",1,80);try{if(!UUID.fromString(key).toString().equals(key))throw new IllegalArgumentException();}catch(Exception e){throw new ApiException(400,"广播请求编号无效");}
        Optional<Map<String,Object>> previous=store.all("broadcast").stream().filter(row->s(row,"requestId").equals(key)&&s(row,"createdBy").equals(s(actor,"id"))).findFirst();
        if(previous.isPresent()){
            if(!Objects.equals(previous.get().get("requestPayload"),input))throw new ApiException(409,"该次提交已经保存，请刷新列表后编辑原广播");
            return ok(Broadcasts.view(previous.get(),Instant.now()));
        }
        Map<String,Object> row=map("id",id(),"createdBy",s(actor,"id"),"requestId",key,"requestPayload",new LinkedHashMap<>(input),"createdAt",now(),"revision",0);
        return save(row,input,actor);
    }
    @PutMapping("/admin/broadcasts/{id}") public Map<String,Object> update(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=admin(req),row=store.get("broadcast",id);revision(input,row);return save(row,input,actor);
    }
    private Map<String,Object> save(Map<String,Object> row,Map<String,Object> input,Map<String,Object> actor) {
        String title=text(input,"title",2,60),content=text(input,"content",2,1000),status=choice(input,"status","draft","published");
        Instant starts=s(input,"startsAt").isEmpty()?Instant.now():date(input,"startsAt"),ends=date(input,"endsAt");
        if(!ends.isAfter(starts)||!ends.isAfter(Instant.now()))throw new ApiException(400,"到期时间须晚于生效时间和当前时间");
        String audioId=text(input,"audioId",0,80);
        String oldAudio=row.get("audio") instanceof Map?s((Map<String,Object>)row.get("audio"),"id"):"";
        if(!audioId.equals(oldAudio)){if(audioId.isEmpty())row.remove("audio");else row.put("audio",media.bindBroadcast(audioId,s(row,"id"),actor));}
        row.putAll(map("title",title,"content",content,"startsAt",starts.toString(),"endsAt",ends.toString(),"status",status,"updatedAt",now(),"revision",Broadcasts.revision(row)+1));
        store.save("broadcast",row);auth.audit(actor,"broadcast."+status,s(row,"id"));return ok(Broadcasts.view(row,Instant.now()));
    }
    @PostMapping("/admin/broadcasts/{id}/withdraw") public Map<String,Object> withdraw(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=admin(req),row=store.get("broadcast",id);revision(input,row);
        row.putAll(map("status","withdrawn","revision",Broadcasts.revision(row)+1,"updatedAt",now()));store.save("broadcast",row);auth.audit(actor,"broadcast.withdraw",id);return ok(Broadcasts.view(row,Instant.now()));
    }
}
