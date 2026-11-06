package com.example.Kcsj.membership;

import org.springframework.stereotype.Service;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import static com.example.Kcsj.membership.MemberStore.*;
import static com.example.Kcsj.membership.MemberData.*;

/** Read models only: original controllers remain the authority for all mutations. */
@Service
public class WorkCenter {
    private final MemberStore store;private final MemberAuth auth;private final ForumPolicy forum;
    public WorkCenter(MemberStore store,MemberAuth auth,ForumPolicy forum){this.store=store;this.auth=auth;this.forum=forum;}
    public static final Map<String,String> KINDS=new LinkedHashMap<>();
    static {
        KINDS.put("life_entry","生活服务");KINDS.put("user","入会申请");KINDS.put("signup","活动报名");KINDS.put("post","互助信息");KINDS.put("order","特产订单");
        KINDS.put("exchange","资源交换");KINDS.put("contact_exchange","联系方式交换");KINDS.put("crowd_pledge","爱心认领");
        KINDS.put("event_proposal","活动申请");KINDS.put("forum_topic","论坛主题");KINDS.put("forum_reply","论坛回帖");
        KINDS.put("resource","资源发布");KINDS.put("advertisement","合作广告");KINDS.put("crowd_project","众筹项目");
    }
    private boolean mine(Map<String,Object> r,Map<String,Object> a,String... keys){for(String k:keys)if(s(r,k).equals(s(a,"id")))return true;return false;}
    private boolean approved(Map<String,Object> a){return s(a,"status").equals("approved");}
    private Map<String,Object> related(String kind,String id){try{return store.get(kind,id);}catch(ApiException e){if(e.status!=404)throw e;return Collections.emptyMap();}}
    private String board(String kind,Map<String,Object> r){return kind.equals("forum_reply")?s(related("forum_topic",s(r,"topicId")),"category"):s(r,"category");}
    public boolean manager(Map<String,Object> a){return auth.isStaff(a)||ForumPolicy.BOARDS.stream().anyMatch(b->forum.moderates(a,b));}
    public boolean permitted(String kind,Map<String,Object> r,Map<String,Object> a,boolean manage) {
        if(!KINDS.containsKey(kind))return false;
        if(manage) {
            if(!approved(a))return false;
            if(kind.startsWith("forum_"))return forum.moderates(a,board(kind,r));
            if(kind.equals("life_entry"))return auth.isStaff(a);
            if(kind.equals("order"))return auth.isAdmin(a);
            return auth.isStaff(a)&&Arrays.asList("user","post","event_proposal","resource","advertisement","crowd_project").contains(kind);
        }
        if(kind.equals("user"))return s(r,"id").equals(s(a,"id"));
        if(!approved(a))return false;
        if(kind.equals("life_entry"))return lifeLinked(r,a);
        if(kind.equals("signup"))return mine(r,a,"userId");
        if(kind.equals("order"))return mine(r,a,"buyerId");
        if(kind.equals("exchange"))return mine(r,a,"ownerId","requesterId");
        if(kind.equals("contact_exchange"))return mine(r,a,"recipientId","requesterId");
        if(kind.equals("crowd_pledge"))return mine(r,a,"supporterId");
        if(kind.startsWith("forum_"))return mine(r,a,"authorId")&&forum.canRead(a,board(kind,r));
        return mine(r,a,"authorId");
    }
    private boolean lifeReadable(Map<String,Object> r,Map<String,Object> a){return mine(r,a,"ownerId")||auth.isStaff(a)||LifeRules.publicState(r)&&LifeRules.parentVisible(store,r,a);}
    private boolean lifeLinked(Map<String,Object> r,Map<String,Object> a){
        if(mine(r,a,"ownerId"))return true;
        for(String k:Arrays.asList("life_application","life_subscription","life_checklist","life_meeting"))
            for(Map<String,Object> link:store.all(k))if(s(link,"entryId").equals(s(r,"id"))&&mine(link,a,"userId")&&(!k.equals("life_subscription")||b(link,"active")))return true;
        return store.all("business_notice").stream().anyMatch(n->s(n,"kind").equals("life_entry")&&s(n,"targetId").equals(s(r,"id"))&&mine(n,a,"recipientId"));
    }
    private boolean pending(String kind,Map<String,Object> r) {
        if(kind.equals("order"))return Arrays.asList("pending","confirmed").contains(s(r,"status"));
        return kind.equals("post")?HelpPostState.needsReview(r):s(r,"status").equals("pending");
    }
    private boolean before(String value){return !value.isEmpty()&&Instant.parse(value).isBefore(Instant.now());}
    private String time(Map<String,Object> r){return s(r,"updatedAt").isEmpty()?s(r,"createdAt"):s(r,"updatedAt");}
    private String label(String state) {
        Map<String,String> labels=new HashMap<>();
        String[][] pairs={{"pending","待审核"},{"approved","已通过"},{"rejected","已退回"},{"closed","已关闭"},{"hidden","已下架"},{"deleted","已删除"},{"withdrawn","已撤下"},
            {"open","还需要帮助"},{"helping","处理中"},{"resolved","已解决"},{"expired","已过期"},{"registered","已报名"},{"checked_in","已签到"},{"cancelled","已取消"},
            {"confirmed","已确认"},{"shipped","已发货"},{"ready","待自提"},{"completed","已完成"},{"accepted","已接受"},{"revoked","已撤销展示"},{"unavailable","已失效"},{"pledged","已认领"},{"delivered","已核实交付"}};
        for(String[] p:pairs)labels.put(p[0],p[1]);return labels.getOrDefault(state,state);
    }
    private String section(String kind,Map<String,Object> r,Map<String,Object> a) {
        String status=s(r,"status");
        if(kind.equals("life_entry")){
            if(!lifeReadable(r,a)||LifeRules.expired(r)||Arrays.asList("resolved","closed").contains(status))return "done";
            boolean owner=mine(r,a,"ownerId");
            if(status.equals("pending"))return "waiting";
            if(status.equals("confirming"))return owner?"action":"waiting";
            if(status.equals("rejected"))return owner?"action":"done";
            if(status.equals("working"))return owner?"waiting":"action";
            if(owner&&store.all("life_application").stream().anyMatch(x->s(x,"entryId").equals(s(r,"id"))&&s(x,"status").equals("submitted")))return "action";
            return "upcoming";
        }
        if(kind.equals("user"))return status.equals("rejected")?"action":status.equals("pending")?"waiting":"done";
        if(kind.equals("signup")){Map<String,Object> event=related("event",s(r,"eventId"));return event.isEmpty()||s(event,"status").equals("cancelled")||Arrays.asList("cancelled","checked_in").contains(status)||before(s(event,"endsAt"))?"done":"upcoming";}
        if(kind.equals("post")) {
            if(status.equals("rejected")||s(r,"draftStatus").equals("rejected"))return "action";
            if(HelpPostState.needsReview(r))return "waiting";
            return Arrays.asList("resolved","expired","closed").contains(HelpPostState.state(r))?"done":"action";
        }
        if(kind.equals("order"))return Arrays.asList("completed","cancelled").contains(status)?"done":Arrays.asList("ready","shipped").contains(status)?"action":"waiting";
        if(kind.equals("contact_exchange"))return status.equals("pending")?(mine(r,a,"recipientId")?"action":"waiting"):"done";
        if(kind.equals("exchange")) {
            if(status.equals("pending"))return mine(r,a,"ownerId")?"action":"waiting";
            if(status.equals("accepted"))return b(r,mine(r,a,"ownerId")?"ownerConfirmed":"requesterConfirmed")?"waiting":"action";
            return "done";
        }
        if(kind.equals("crowd_pledge"))return status.equals("pledged")?"waiting":"done";
        return status.equals("pending")?"waiting":"done";
    }
    private Map<String,Object> item(String kind,Map<String,Object> r,Map<String,Object> a,boolean manage) {
        String title=s(r,"title"),state=s(r,"status"),deadline="";
        if(kind.equals("life_entry")){if(!lifeReadable(r,a)){title="服务内容暂不可用";state="unavailable";}else if(LifeRules.expired(r))state="expired";else if(state.equals("open"))state="可参与";else if(state.equals("working"))state="处理中";else if(state.equals("confirming"))state="待求助者确认";}
        if(kind.equals("user"))title=manage?s(r,"name")+"的入会申请":"我的入会申请";
        if(kind.equals("signup")){Map<String,Object> event=related("event",s(r,"eventId"));title=event.isEmpty()?"关联活动已不可用":s(event,"title");deadline=s(event,"startsAt");if(event.isEmpty())state="unavailable";else if(state.equals("registered")&&before(s(event,"endsAt")))state="活动已结束";}
        if(kind.equals("post")&&state.equals("approved"))state=s(r,"draftStatus").equals("pending")?"修改待审核":s(r,"draftStatus").equals("rejected")?"修改已退回":HelpPostState.state(r);
        if(kind.equals("order")&&state.equals("pending"))state="待确认";
        if(kind.equals("exchange"))title=s(r,"resourceTitle");
        if(kind.equals("contact_exchange"))title=mine(r,a,"requesterId")?"与"+s(r,"recipientName")+"交换联系方式":"来自"+s(r,"requesterName")+"的联系申请";
        if(kind.equals("crowd_pledge"))title=s(r,"projectTitle");
        if(kind.equals("forum_reply"))title="回帖："+s(related("forum_topic",s(r,"topicId")),"title");
        if(title.isEmpty())title=KINDS.get(kind);
        return map("id",s(r,"id"),"kind",kind,"kindLabel",KINDS.get(kind),"title",title,"state",label(state),"section",manage?"action":section(kind,r,a),
            "updatedAt",time(r),"createdAt",s(r,"createdAt"),"deadline",deadline,"waitingSince",kind.equals("post")&&s(r,"draftStatus").equals("pending")?time(r):s(r,"createdAt"));
    }
    public Map<String,Object> list(Map<String,Object> actor,boolean manage,String filter,String kind,int page) {
        if(manage&&!manager(actor))throw new ApiException(403,"你没有管理待办权限");
        if(!kind.equals("all")&&!KINDS.containsKey(kind))throw new ApiException(400,"事项类型无效");
        if(!Arrays.asList("all","action","waiting","upcoming","done","overdue").contains(filter)||page<1||page>100000)throw new ApiException(400,"筛选或页码无效");
        List<Map<String,Object>> items=new ArrayList<>();
        for(String k:KINDS.keySet())for(Map<String,Object> row:store.all(k))if(permitted(k,row,actor,manage)&&(!manage||pending(k,row)))items.add(item(k,row,actor,manage));
        Map<String,Object> counts=map("all",items.size());for(String section:Arrays.asList("action","waiting","upcoming","done"))counts.put(section,items.stream().filter(i->s(i,"section").equals(section)).count());
        List<Map<String,Object>> filtered=items.stream().filter(i->kind.equals("all")||s(i,"kind").equals(kind)).filter(i->filter.equals("all")||s(i,"section").equals(filter)||filter.equals("overdue")&&!s(i,"waitingSince").isEmpty()&&Instant.parse(s(i,"waitingSince")).isBefore(Instant.now().minusSeconds(86400))).collect(Collectors.toList());
        Comparator<Map<String,Object>> order=manage?Comparator.comparing(i->s(i,"waitingSince")):Comparator.comparingInt((Map<String,Object> i)->Arrays.asList("action","waiting","upcoming","done").indexOf(s(i,"section"))).thenComparing(i->s(i,"deadline").isEmpty()?"9999":s(i,"deadline")).thenComparing((Map<String,Object> i)->s(i,"updatedAt"),Comparator.reverseOrder());
        filtered.sort(order.thenComparing(i->s(i,"kind")+s(i,"id")));
        int pages=Math.max(1,(filtered.size()+19)/20),actual=Math.min(page,pages),from=(actual-1)*20;
        return map("items",filtered.subList(from,Math.min(from+20,filtered.size())),"total",filtered.size(),"page",actual,"pages",pages,"counts",counts);
    }
    private Map<String,Object> action(String label,String url,Map<String,Object> body,String field,String hint,int min){
        return map("label",label,"url",url,"body",body,"field",field,"hint",hint,"min",min,"max",field.equals("contact")?100:300);
    }
    private void field(List<Map<String,Object>> fields,String label,Object value){if(value!=null&&!String.valueOf(value).isEmpty())fields.add(map("label",label,"value",String.valueOf(value)));}
    @SuppressWarnings("unchecked") public Map<String,Object> target(Map<String,Object> actor,String kind,String id,boolean manage) {
        if(!KINDS.containsKey(kind))throw new ApiException(404,"事项不可用");Map<String,Object> r=store.get(kind,id);
        if(!permitted(kind,r,actor,manage))throw new ApiException(404,"事项不存在或你已无权查看");
        Map<String,Object> result=item(kind,r,actor,manage),display=new LinkedHashMap<>(r);
        List<Map<String,Object>> fields=new ArrayList<>(),actions=new ArrayList<>();String status=s(r,"status");
        if(kind.equals("life_entry")){
            result.put("navigate","life");result.put("lifeTab",lifeReadable(r,actor)?"":"tasks");
            if(lifeReadable(r,actor)){field(fields,"地区",r.get("region"));field(fields,"内容",r.get("content"));}
            else field(fields,"说明","内容正在审核或已撤下。已有申请可在生活服务中撤回。");
            result.put("fields",fields);result.put("actions",actions);result.put("manage",manage);return result;
        }
        if(kind.equals("post")&&manage&&s(r,"draftStatus").equals("pending")){display.putAll((Map<String,Object>)r.get("editDraft"));field(fields,"本次审核","发布者提交的修改；审核通过前公开内容保持原版本");result.put("title",s(display,"title"));}
        if(kind.equals("user")){for(String[] f:new String[][]{{"name","姓名"},{"hometown","家乡"},{"district","现居地"},{"industry","行业"},{"bio","介绍"},{"reviewNote","审核说明"}})field(fields,f[1],r.get(f[0]));if(!manage)result.put("navigate","profile");}
        else if(kind.equals("signup")){
            Map<String,Object> event=related("event",s(r,"eventId"));if(event.isEmpty())field(fields,"记录说明","关联活动已不可用，请联系组织者核对；其他事项可正常处理。");field(fields,"集合地点",event.get("location"));field(fields,"开始时间（北京时间）",event.get("startsAt"));field(fields,"结束时间（北京时间）",event.get("endsAt"));field(fields,"活动介绍",event.get("description"));field(fields,"已核定志愿时长",r.get("hours"));
            if(status.equals("registered")&&s(event,"status").equals("published")&&!before(s(event,"startsAt")))actions.add(action("取消报名","/events/"+s(r,"eventId")+"/cancel-signup",map(),"","",0));
            if(status.equals("registered")&&s(event,"status").equals("published")){result.put("navigate","checkin");result.put("event",pick(event,"id","title","startsAt","endsAt","location"));}
        } else if(kind.equals("order")) {
            for(String[] f:new String[][]{{"orderNo","订单编号"},{"specification","规格"},{"quantity","数量"},{"name","收货人"},{"phone","联系手机"},{"address","收货地址"},{"fulfillment","履约信息"},{"seller","卖家"},{"sellerContact","售后联系"},{"afterSales","售后说明"},{"settlementNote","结算说明"}})field(fields,f[1],r.get(f[0]));
            field(fields,"合计（元）",r.get("totalCents") instanceof Number?java.math.BigDecimal.valueOf(((Number)r.get("totalCents")).longValue(),2).toPlainString():"");field(fields,"结算方式","线下结算，平台不在线扣款");
            if(manage&&status.equals("pending"))actions.add(action("确认订单","/orders/"+id+"/action",map("action","confirm"),"","",0));
            if(manage&&status.equals("confirmed")){boolean shipping=s(r,"delivery").equals("shipping");actions.add(action(shipping?"登记发货":"通知自提","/orders/"+id+"/action",map("action",shipping?"ship":"ready"),"note",shipping?"物流与单号":"自提地点和时间",5));}
            if(!manage&&Arrays.asList("ready","shipped").contains(status))actions.add(action("确认已收货","/orders/"+id+"/action",map("action","receive"),"","请确认已实际收到商品",0));
            if(Arrays.asList("pending","confirmed").contains(status)&&!s(r,"settlement").equals("confirmed"))actions.add(action("取消订单","/orders/"+id+"/action",map("action","cancel"),"","",0));
        } else if(kind.equals("exchange")||kind.equals("contact_exchange")) {
            boolean resource=kind.equals("exchange"),receiver=mine(r,actor,resource?"ownerId":"recipientId");String url=(resource?"/exchanges/":"/contact-exchanges/")+id+"/action";
            field(fields,"申请来意",r.get("message"));field(fields,"申请人",r.get("requesterName"));field(fields,resource?"资源主人":"接收人",r.get(resource?"ownerName":"recipientName"));
            if(resource){field(fields,"申请人联系方式",r.get("contact"));field(fields,"资源主人联系方式",r.get("ownerContact"));field(fields,"主人已确认交付",b(r,"ownerConfirmed")?"是":"否");field(fields,"申请人已确认交付",b(r,"requesterConfirmed")?"是":"否");}
            else if(status.equals("accepted")){field(fields,"对方联系方式",r.get(receiver?"requesterContact":"recipientContact"));}
            if(status.equals("pending")) {
                if(receiver){actions.add(action("接受申请",url,map("action","accept"),resource?"":"contact",resource?"":"本次愿意分享的联系方式",resource?0:2));actions.add(action("拒绝申请",url,map("action","reject"),"","",0));}
                else actions.add(action("取消申请",url,map("action","cancel"),"","",0));
            }
            if(status.equals("accepted")) {
                if(resource&&!b(r,receiver?"ownerConfirmed":"requesterConfirmed"))actions.add(action("确认已交付",url,map("action","confirm"),"","仅在实际交接完成后确认",0));
                else if(!resource)actions.add(action("撤销联系方式展示",url,map("action","revoke"),"","无法收回对方已经保存的信息",0));
            }
        } else if(kind.equals("crowd_pledge")) {
            field(fields,"认领数量",s(r,"quantity")+s(r,"unit"));field(fields,"留言",r.get("message"));
            if(s(r,"projectType").equals("资金意向"))field(fields,"说明","仅记录意向，不表示收款或实际交付");
            if(status.equals("pledged"))actions.add(action("取消认领","/pledges/"+id+"/cancel",map(),"","",0));
        } else {
            for(String[] f:new String[][]{{"authorName","发布者"},{"category","分类"},{"district","片区"},{"content","内容"},{"description","介绍"},{"offering","可以提供"},{"seeking","希望获得"},{"purpose","用途"},{"goal","目标数量"},{"unit","单位"},{"location","地点"},{"capacity","人数上限"},{"startsAt","开始时间（北京时间）"},{"endsAt","结束时间（北京时间）"},{"expiresAt","有效期至（北京时间）"},{"sponsor","广告主"},{"placement","展示位置"},{"url","原文网址"},{"contact","联系信息"},{"reviewNote","审核说明"},{"draftNote","修改审核说明"},{"resolutionNote","进度说明"}})field(fields,f[1],display.get(f[0]));
            if(kind.startsWith("forum_")) { // Inspect media in the existing forum before making a decision.
                result.put("navigate","forum");if(kind.equals("forum_reply"))result.put("topicId",s(r,"topicId"));field(fields,"附件提示","图片、语音、引用及转发内容请到原论坛查看后审核");
            }
            if(kind.equals("post")&&!manage&&!status.equals("closed")) {
                Map<String,Object> edit=new LinkedHashMap<>(r);if(r.get("editDraft") instanceof Map)edit.putAll((Map<String,Object>)r.get("editDraft"));
                edit.put("editRevision",HelpPostState.revision(r));result.put("editForm",pick(edit,"title","category","content","contact","district","validDays","editRevision"));
                if(status.equals("approved"))for(String progress:Arrays.asList("open","helping","resolved"))if(!progress.equals(HelpPostState.state(r))&&(!HelpPostState.state(r).equals("expired")||progress.equals("resolved")))
                    actions.add(action(label(progress),"/help-posts/"+id+"/progress",map("progress",progress,"editRevision",HelpPostState.revision(r)),"note",HelpPostState.state(r).equals("resolved")?"重新打开原因（至少5字）":"进度说明（选填）",HelpPostState.state(r).equals("resolved")?5:0));
            }
        }
        if(manage&&pending(kind,r)&&!kind.equals("order")) {
            Map<String,String> urls=new HashMap<>();urls.put("user","/admin/members/");urls.put("post","/posts/");urls.put("event_proposal","/event-proposals/");urls.put("resource","/resources/");urls.put("advertisement","/ads/");urls.put("crowd_project","/crowdfunding/");
            // Forum moderation stays in the full forum viewer, where attachments and context are visible.
            if(urls.containsKey(kind))for(String next:Arrays.asList("approved","rejected"))actions.add(action(next.equals("approved")?"审核通过":"退回补充",urls.get(kind)+id+"/review",map("status",next,"editRevision",HelpPostState.revision(r)),"note",next.equals("approved")?"审核说明（选填）":"退回原因（至少2字）",next.equals("approved")?0:2));
        }
        result.put("manage",manage);result.put("fields",fields);result.put("actions",actions);return result;
    }
}
