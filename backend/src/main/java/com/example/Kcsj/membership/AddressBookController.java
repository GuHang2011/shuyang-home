package com.example.Kcsj.membership;

import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import javax.servlet.http.HttpServletRequest;
import java.util.*;
import static com.example.Kcsj.membership.MemberStore.*;
import static com.example.Kcsj.membership.MemberData.*;

/** Private annotations, with contact details projected from current consent on every read. */
@RestController @RequestMapping("/address-book") @Transactional
public class AddressBookController {
    private final MemberStore store;private final MemberAuth auth;private final ForumPolicy policy;
    public AddressBookController(MemberStore store,MemberAuth auth,ForumPolicy policy){this.store=store;this.auth=auth;this.policy=policy;}
    private Map<String,Object> member(HttpServletRequest req){Map<String,Object>a=auth.require(req);auth.member(a);return a;}
    private String key(String owner,String target){return auth.digest("address:"+owner+":"+target);}
    private Map<String,Object> shared(Map<String,Object> user,Map<String,Object> actor){
        String uid=s(user,"id"),aid=s(actor,"id");
        if(!b(user,"enabled")||!s(user,"status").equals("approved")||policy.blocked(uid,aid))return Collections.emptyMap();
        String contact="";
        for(Map<String,Object>x:store.all("contact_exchange"))if(s(x,"status").equals("accepted")){
            if(s(x,"requesterId").equals(aid)&&s(x,"recipientId").equals(uid))contact=s(x,"recipientContact");
            else if(s(x,"recipientId").equals(aid)&&s(x,"requesterId").equals(uid))contact=s(x,"requesterContact");
        }
        if(!b(user,"directoryVisible")&&contact.isEmpty())return Collections.emptyMap();
        Map<String,Object>out=pick(user,"id","name");
        if(b(user,"directoryVisible")){out.putAll(pick(user,"hometown","district","industry","bio","volunteer"));if(b(user,"phoneVisible"))out.put("phone",s(user,"phone"));}
        out.put("contact",contact);out.put("available",true);return out;
    }
    @GetMapping public Map<String,Object> list(HttpServletRequest req){
        Map<String,Object>a=member(req);Map<String,Map<String,Object>> saved=new LinkedHashMap<>();
        for(Map<String,Object>r:store.all("address_contact"))if(s(r,"ownerId").equals(s(a,"id")))saved.put(s(r,"memberId"),r);
        List<Map<String,Object>>result=new ArrayList<>();Set<String>found=new HashSet<>();
        for(Map<String,Object>u:store.all("user")){
            String id=s(u,"id");if(id.equals(s(a,"id")))continue;Map<String,Object>view=shared(u,a),record=saved.get(id);
            if(view.isEmpty()&&record==null)continue;
            if(view.isEmpty())view=map("id",id,"name","联系人暂不可用","available",false);
            if(record!=null)view.putAll(pick(record,"group","note","favorite","updatedAt"));
            view.put("saved",record!=null);result.add(view);found.add(id);
        }
        for(Map.Entry<String,Map<String,Object>>r:saved.entrySet())if(!found.contains(r.getKey())){Map<String,Object>v=pick(r.getValue(),"group","note","favorite","updatedAt");v.putAll(map("id",r.getKey(),"name","联系人暂不可用","available",false,"saved",true));result.add(v);}
        return ApiResponse.ok(result);
    }
    @PutMapping("/{id}") public Map<String,Object> save(@PathVariable String id,@RequestBody Map<String,Object>input,HttpServletRequest req){
        store.lockWrites();Map<String,Object>a=member(req);String key=key(s(a,"id"),id);
        boolean existing=store.all("address_contact").stream().anyMatch(r->s(r,"id").equals(key));
        if(id.equals(s(a,"id")))throw new ApiException(400,"无需将自己加入通讯录");
        if(!existing&&shared(store.get("user",id),a).isEmpty())throw new ApiException(404,"对方未公开资料或尚未同意交换联系方式");
        if(!existing&&store.all("address_contact").stream().filter(r->s(r,"ownerId").equals(s(a,"id"))).count()>=500)throw new ApiException(409,"最多保存500位联系人，请先整理通讯录");
        Map<String,Object>row=map("id",key,"ownerId",s(a,"id"),"memberId",id,"group",text(input,"group",0,30),"note",text(input,"note",0,300),"favorite",flag(input,"favorite"),"updatedAt",now());
        store.save("address_contact",row);return ApiResponse.ok(true);
    }
    @DeleteMapping("/{id}") public Map<String,Object> remove(@PathVariable String id,HttpServletRequest req){store.lockWrites();Map<String,Object>a=member(req);store.delete("address_contact",key(s(a,"id"),id));return ApiResponse.ok(true);}
}
