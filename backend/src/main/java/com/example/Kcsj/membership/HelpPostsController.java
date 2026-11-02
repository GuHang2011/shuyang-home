package com.example.Kcsj.membership;

import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import javax.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.*;
import static com.example.Kcsj.membership.MemberStore.*;
import static com.example.Kcsj.membership.MemberData.*;

@RestController @Transactional
public class HelpPostsController {
    private final MemberStore store;private final MemberAuth auth;
    public HelpPostsController(MemberStore store,MemberAuth auth){this.store=store;this.auth=auth;}
    public static Map<String,Object> fields(Map<String,Object> input) {
        int days=input.containsKey("validDays")?number(input,"validDays",7,90):30;
        if(!Arrays.asList(7,30,90).contains(days))throw new ApiException(400,"有效期请选择7、30或90天");
        return map("title",text(input,"title",2,80),"content",text(input,"content",10,3000),
            "category",choice(input,"category","求职招聘","资源合作","生活互助","家乡分享"),"contact",text(input,"contact",0,80),
            "district",text(input,"district",0,50),"validDays",days,"expiresAt",Instant.now().plusSeconds(days*86400L).toString());
    }
    private Map<String,Object> own(String id,Map<String,Object> input,Map<String,Object> actor) {
        auth.member(actor);Map<String,Object> post=store.get("post",id);
        if(!s(post,"authorId").equals(s(actor,"id")))throw new ApiException(403,"只能修改本人发布的互助");
        if(s(post,"status").equals("closed"))throw new ApiException(409,"信息已关闭或下架，不能重新公开");
        requireRevision(post,input);return post;
    }
    public static void requireRevision(Map<String,Object> post,Map<String,Object> input) {
        if(!input.containsKey("editRevision")||number(input,"editRevision",0,Integer.MAX_VALUE)!=HelpPostState.revision(post))
            throw new ApiException(409,"信息已变化，请刷新后再操作");
    }
    @SuppressWarnings("unchecked") public static void history(Map<String,Object> post) {
        List<Map<String,Object>> versions=new ArrayList<>();
        if(post.get("history") instanceof List)versions.addAll((List<Map<String,Object>>)post.get("history"));
        versions.add(pick(post,"title","content","category","contact","district","expiresAt","editRevision","updatedAt"));
        post.put("history",versions);
    }
    @PutMapping("/help-posts/{id}") public Map<String,Object> edit(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=auth.require(req),post=own(id,input,actor),draft=fields(input);
        auth.limit("post-edit:"+s(actor,"id"),30);history(post);
        if(s(post,"status").equals("approved")){post.put("editDraft",draft);post.put("draftStatus","pending");post.put("draftNote","");}
        else {post.putAll(draft);post.put("status","pending");post.put("reviewNote","");}
        post.put("editRevision",HelpPostState.revision(post)+1);post.put("updatedAt",now());
        store.save("post",post);auth.audit(actor,"post.edit-submit",id);return map("code",0,"data",HelpPostState.view(post,true));
    }
    @PostMapping("/help-posts/{id}/progress") public Map<String,Object> progress(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=auth.require(req),post=own(id,input,actor);
        if(!s(post,"status").equals("approved"))throw new ApiException(409,"审核通过后才能更新互助进度");
        String next=choice(input,"progress","open","helping","resolved"),current=HelpPostState.state(post);
        if(current.equals("expired")&&!next.equals("resolved"))throw new ApiException(409,"信息已过期，请编辑续期并重新审核");
        String note=text(input,"note",current.equals("resolved")&&!next.equals("resolved")?5:0,300);
        if(!current.equals(next)) {post.put("progress",next);post.put("resolutionNote",note);post.put("updatedAt",now());post.put("editRevision",HelpPostState.revision(post)+1);store.save("post",post);auth.audit(actor,"post.progress-"+next,id);}
        return map("code",0,"data",HelpPostState.view(post,true));
    }
    @SuppressWarnings("unchecked") public static void review(Map<String,Object> post,Map<String,Object> input,Map<String,Object> actor) {
        if(!HelpPostState.needsReview(post))throw new ApiException(409,"该信息已处理，请刷新列表");
        if(HelpPostState.revision(post)>0)requireRevision(post,input);
        String status=choice(input,"status","approved","rejected"),note=text(input,"note",status.equals("rejected")?2:0,300);
        if(s(post,"draftStatus").equals("pending")) {
            if(status.equals("approved")){history(post);post.putAll((Map<String,Object>)post.get("editDraft"));post.remove("editDraft");}
            post.put("draftStatus",status);post.put("draftNote",note);
        } else {post.put("status",status);post.put("reviewNote",note);}
        post.put("reviewedBy",s(actor,"id"));post.put("updatedAt",now());post.put("editRevision",HelpPostState.revision(post)+1);
    }
}
