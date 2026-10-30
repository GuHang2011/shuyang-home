package com.example.Kcsj.membership;

import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import javax.servlet.http.HttpServletRequest;
import java.net.URI;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import static com.example.Kcsj.membership.MemberStore.*;
import static com.example.Kcsj.membership.MemberData.*;

/** Manually reviewed advertising and one ballot per approved member. No payments. */
@RestController
@Transactional
public class EngagementController {
    private final MemberStore store;
    private final MemberAuth auth;
    public EngagementController(MemberStore store,MemberAuth auth) {this.store=store;this.auth=auth;}
    private Map<String,Object> ok(Object data) {return map("code",0,"data",data);}
    private List<Map<String,Object>> rows(String kind) {
        List<Map<String,Object>> rows=store.all(kind);rows.sort(Comparator.comparing((Map<String,Object>x)->s(x,"createdAt")).reversed());return rows;
    }
    private Map<String,Object> member(HttpServletRequest req) {Map<String,Object> actor=auth.require(req);auth.member(actor);return actor;}
    private boolean live(Map<String,Object> row) {Instant now=Instant.now();return s(row,"status").equals("approved")&&!instant(row,"startsAt").isAfter(now)&&instant(row,"endsAt").isAfter(now);}
    private void window(Map<String,Object> input,int days) {
        Instant start=instant(input,"startsAt"),end=instant(input,"endsAt");
        if(!end.isAfter(start)||!end.isAfter(Instant.now())||Duration.between(start,end).compareTo(Duration.ofDays(days))>0)throw new ApiException(400,"请选择有效起止时间，最长"+days+"天，结束时间须晚于当前时间");
    }
    private String targetUrl(Map<String,Object> input) {
        String value=text(input,"url",0,500);if(value.isEmpty())return value;
        try {URI uri=new URI(value);if(!"https".equals(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null)throw new Exception();}
        catch(Exception e){throw new ApiException(400,"跳转链接必须是完整的HTTPS地址，且不能包含账号凭据");}return value;
    }
    private Map<String,Object> publicAd(Map<String,Object> row) {return pick(row,"id","title","sponsor","content","placement","url","contact","startsAt","endsAt");}
    @GetMapping("/ads") public Map<String,Object> ads() {return ok(rows("advertisement").stream().filter(this::live).map(this::publicAd).collect(Collectors.toList()));}
    @GetMapping("/my/ads") public Map<String,Object> myAds(HttpServletRequest req) {Map<String,Object> actor=auth.require(req);return ok(rows("advertisement").stream().filter(x->s(x,"authorId").equals(s(actor,"id"))).collect(Collectors.toList()));}
    @GetMapping("/admin/ads") public Map<String,Object> manageAds(HttpServletRequest req) {auth.staff(req);return ok(rows("advertisement"));}
    @PostMapping("/ads") public Map<String,Object> createAd(@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=member(req);auth.limit("ad:"+s(actor,"id"),10);window(input,180);
        if(!flag(input,"consent"))throw new ApiException(400,"请确认广告内容真实并同意公开展示所填联系信息");
        Map<String,Object> row=map("id",id(),"authorId",s(actor,"id"),"authorName",s(actor,"name"),"title",text(input,"title",2,60),"sponsor",text(input,"sponsor",2,60),
            "content",text(input,"content",10,800),"placement",choice(input,"placement","home","events"),"url",targetUrl(input),"contact",text(input,"contact",0,80),
            "startsAt",instant(input,"startsAt").toString(),"endsAt",instant(input,"endsAt").toString(),"status","pending","reviewNote","","consentAt",now(),"createdAt",now());
        store.save("advertisement",row);auth.audit(actor,"ad.apply",s(row,"id"));return ok(row);
    }
    @PostMapping("/ads/{id}/review") public Map<String,Object> reviewAd(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=auth.staff(req),row=store.get("advertisement",id);String status=choice(input,"status","approved","rejected");
        if(!s(row,"status").equals("pending"))throw new ApiException(409,"该广告已处理，请刷新列表");
        if(status.equals("approved"))window(row,180);
        row.putAll(map("status",status,"reviewNote",text(input,"note",status.equals("rejected")?2:0,300),"reviewedBy",s(actor,"id"),"reviewedAt",now()));
        store.save("advertisement",row);auth.audit(actor,"ad."+status,id);return ok(row);
    }
    @PostMapping("/ads/{id}/withdraw") public Map<String,Object> withdraw(@PathVariable String id,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=auth.require(req),row=store.get("advertisement",id);
        if(!s(row,"authorId").equals(s(actor,"id"))&&!auth.isStaff(actor))throw new ApiException(403,"只能撤下自己申请的广告");
        row.put("status","withdrawn");store.save("advertisement",row);auth.audit(actor,"ad.withdraw",id);return ok(row);
    }
    private boolean ended(Map<String,Object> poll) {return s(poll,"status").equals("closed")||!instant(poll,"endsAt").isAfter(Instant.now());}
    @SuppressWarnings("unchecked") private Map<String,Object> pollView(Map<String,Object> poll,Map<String,Object> actor) {
        List<Map<String,Object>> ballots=store.all("poll_vote").stream().filter(v->s(v,"pollId").equals(s(poll,"id"))).collect(Collectors.toList());
        Map<String,Object> mine=actor==null?null:ballots.stream().filter(v->s(v,"userId").equals(s(actor,"id"))).findFirst().orElse(null);
        boolean canSee=auth.isStaff(actor)||(actor!=null&&s(actor,"status").equals("approved")&&(mine!=null||ended(poll)));
        Map<String,Object> result=new LinkedHashMap<>(poll);result.put("myChoices",mine==null?Collections.emptyList():mine.get("choices"));result.put("hasVoted",mine!=null);result.put("ended",ended(poll));result.put("resultsVisible",canSee);
        if(canSee){Map<String,Long> counts=new LinkedHashMap<>();for(Map<String,Object> option:(List<Map<String,Object>>)poll.get("options"))counts.put(s(option,"id"),ballots.stream().filter(v->((List<String>)v.get("choices")).contains(s(option,"id"))).count());result.put("counts",counts);result.put("totalVotes",ballots.size());}
        return result;
    }
    @GetMapping("/polls") public Map<String,Object> polls(HttpServletRequest req) {Map<String,Object> actor=auth.optional(req);return ok(rows("poll").stream().map(p->pollView(p,actor)).collect(Collectors.toList()));}
    @GetMapping("/polls/{id}") public Map<String,Object> poll(@PathVariable String id,HttpServletRequest req) {return ok(pollView(store.get("poll",id),auth.optional(req)));}
    @PostMapping("/polls") public Map<String,Object> createPoll(@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=auth.staff(req);window(input,180);
        if(!(input.get("options") instanceof List))throw new ApiException(400,"请填写投票选项");
        List<?> options=(List<?>)input.get("options");if(options.size()<2||options.size()>10)throw new ApiException(400,"投票须包含2至10个选项");
        List<Map<String,Object>> values=new ArrayList<>();Set<String> unique=new HashSet<>();
        for(Object raw:options){if(!(raw instanceof String))throw new ApiException(400,"选项必须为文字");String value=((String)raw).trim();if(value.isEmpty()||value.length()>80||!unique.add(value))throw new ApiException(400,"选项须为1至80字且不能重复");values.add(map("id",id(),"text",value));}
        int max=number(input,"maxChoices",1,options.size());
        Map<String,Object> row=map("id",id(),"title",text(input,"title",2,80),"description",text(input,"description",0,2000),"options",values,"maxChoices",max,
            "startsAt",instant(input,"startsAt").toString(),"endsAt",instant(input,"endsAt").toString(),"status","published","authorName",s(actor,"name"),"createdAt",now());
        store.save("poll",row);auth.audit(actor,"poll.create",s(row,"id"));return ok(pollView(row,actor));
    }
    @SuppressWarnings("unchecked") @PostMapping("/polls/{id}/vote") public Map<String,Object> vote(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=member(req),poll=store.get("poll",id);
        if(ended(poll)||instant(poll,"startsAt").isAfter(Instant.now()))throw new ApiException(409,"投票尚未开始或已经结束");
        if(!(input.get("choices") instanceof List))throw new ApiException(400,"请选择投票选项");
        List<?> raw=(List<?>)input.get("choices");Set<String> choices=new TreeSet<>();for(Object value:raw){if(!(value instanceof String))throw new ApiException(400,"选项格式错误");choices.add((String)value);}
        Set<String> allowed=((List<Map<String,Object>>)poll.get("options")).stream().map(o->s(o,"id")).collect(Collectors.toSet());
        if(choices.size()!=raw.size()||choices.isEmpty()||choices.size()>number(poll,"maxChoices",1,10)||!allowed.containsAll(choices))throw new ApiException(400,"请选择有效选项，且不要超过允许的数量");
        String ballotId=id+":"+s(actor,"id");Optional<Map<String,Object>> existing=store.all("poll_vote").stream().filter(v->s(v,"id").equals(ballotId)).findFirst();
        if(existing.isPresent()){if(!new TreeSet<>((List<String>)existing.get().get("choices")).equals(choices))throw new ApiException(409,"你已提交投票，不能重复修改选择");return ok(pollView(poll,actor));}
        store.save("poll_vote",map("id",ballotId,"pollId",id,"userId",s(actor,"id"),"choices",new ArrayList<>(choices),"createdAt",now()));
        auth.audit(actor,"poll.vote",id);return ok(pollView(poll,actor));
    }
    @PostMapping("/polls/{id}/close") public Map<String,Object> closePoll(@PathVariable String id,HttpServletRequest req) {
        store.lockWrites();Map<String,Object> actor=auth.staff(req),poll=store.get("poll",id);poll.put("status","closed");store.save("poll",poll);auth.audit(actor,"poll.close",id);return ok(pollView(poll,actor));
    }
}
