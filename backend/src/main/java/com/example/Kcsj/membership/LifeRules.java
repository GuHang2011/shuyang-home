package com.example.Kcsj.membership;

import java.net.URI;
import java.time.*;
import java.util.*;
import static com.example.Kcsj.membership.MemberStore.*;
import static com.example.Kcsj.membership.MemberData.*;

/** Validation and public visibility shared by services and their attachments. */
public final class LifeRules {
    private LifeRules() {}
    public static final List<String> TYPES = Arrays.asList("guide", "help", "job", "service", "lost", "trip", "arrival", "progress", "slot");
    public static boolean publicState(Map<String,Object> row) {
        return Arrays.asList("open", "working", "confirming", "resolved", "paused", "closed").contains(s(row,"status"));
    }
    public static boolean expired(Map<String,Object> row) {
        return !s(row,"deadline").isEmpty() && !LocalDate.parse(s(row,"deadline")).isAfter(LocalDate.now(ZoneId.of("Asia/Shanghai")).minusDays(1));
    }
    public static boolean parentVisible(MemberStore store,Map<String,Object> row,Map<String,Object> actor){
        String type=s(row,"type"),kind=type.equals("trip")?"event":type.equals("arrival")?"product":type.equals("progress")?"crowd_project":type.equals("service")?"user":"";
        if(kind.isEmpty())return true;
        String id=type.equals("service")?s(row,"ownerId"):s(row,"referenceId");
        Optional<Map<String,Object>>p=store.all(kind).stream().filter(x->s(x,"id").equals(id)).findFirst();if(!p.isPresent())return false;
        if(type.equals("service"))return actor!=null&&s(actor,"status").equals("approved")&&b(p.get(),"enabled")&&b(p.get(),"directoryVisible")&&s(p.get(),"status").equals("approved");
        return s(p.get(),"status").equals(type.equals("progress")?"approved":"published");
    }
    public static String date(Map<String,Object> input,String key,boolean required) {
        String value=text(input,key,required?10:0,10);
        if(!value.isEmpty())try{LocalDate.parse(value);}catch(Exception e){throw new ApiException(400,"请输入有效日期："+key);}
        return value;
    }
    public static String url(Map<String,Object> input,String key) {
        String value=text(input,key,1,500);
        try{URI uri=new URI(value);if(!Arrays.asList("http","https").contains(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null)throw new Exception();}
        catch(Exception e){throw new ApiException(400,"请输入完整的 HTTP/HTTPS 来源网址");}
        return value;
    }
    public static List<String> lines(Map<String,Object> input,String key) {
        String value=text(input,key,1,3000);List<String> list=new ArrayList<>();
        for(String line:value.split("\\r?\\n")){String item=line.trim();if(!item.isEmpty()&&!list.contains(item))list.add(item);}
        if(list.isEmpty()||list.size()>30||list.stream().anyMatch(x->x.length()>160))throw new ApiException(400,"清单需为1至30项，每项不超过160字");
        return list;
    }
    public static Map<String,Object> fields(String type,Map<String,Object> input) {
        Map<String,Object> out=map("title",text(input,"title",2,80),"content",text(input,"content",5,4000),"region",text(input,"region",2,80),"category",text(input,"category",1,40),"deadline",date(input,"deadline",false));
        if(type.equals("guide")){
            out.putAll(map("sourceUrl",url(input,"sourceUrl"),"sourceName",text(input,"sourceName",2,80),"verifiedOn",date(input,"verifiedOn",true),"checklist",lines(input,"checklistText")));
            if(LocalDate.parse(s(out,"verifiedOn")).isAfter(LocalDate.now(ZoneId.of("Asia/Shanghai"))))throw new ApiException(400,"核验日期不能在未来");
        }
        if(type.equals("help"))out.put("method",choice(input,"method","线上","线下","均可"));
        if(type.equals("job"))out.putAll(map("employer",text(input,"employer",2,100),"salary",text(input,"salary",2,100),"schedule",text(input,"schedule",2,150),"employment",choice(input,"employment","全职","兼职","临时","实习"),"publisher",choice(input,"publisher","企业直招","受委托发布","信息转发"),"benefits",text(input,"benefits",0,300)));
        if(type.equals("service"))out.putAll(map("availability",text(input,"availability",2,150),"pricing",text(input,"pricing",2,300)));
        if(type.equals("lost"))out.putAll(map("lostType",choice(input,"lostType","寻物","招领"),"occurredOn",date(input,"occurredOn",true)));
        if(type.equals("trip"))out.putAll(map("referenceId",text(input,"referenceId",1,80),"meeting",text(input,"meeting",2,500),"transport",text(input,"transport",2,800),"contact",text(input,"contact",2,150),"meetingPoints",lines(input,"meetingPointsText")));
        if(type.equals("arrival"))out.putAll(map("referenceId",text(input,"referenceId",1,80),"expectedOn",date(input,"expectedOn",true)));
        if(type.equals("progress"))out.putAll(map("referenceId",text(input,"referenceId",1,80),"milestone",choice(input,"milestone","计划安排","执行进展","延期说明","结项说明"),"plannedOn",date(input,"plannedOn",true)));
        if(type.equals("slot")){
            Instant start=instant(input,"startsAt"),end=instant(input,"endsAt");
            if(!start.isAfter(Instant.now())||!end.isAfter(start)||Duration.between(start,end).toDays()>1)throw new ApiException(400,"请选择未来且不超过一天的自提时段");
            out.putAll(map("startsAt",start.toString(),"endsAt",end.toString(),"capacity",number(input,"capacity",1,500)));
        }
        if(Arrays.asList("help","job","lost").contains(type)&&s(out,"deadline").isEmpty())throw new ApiException(400,"请填写截止日期");
        if(expired(out))throw new ApiException(400,"截止日期不能早于今天");
        return out;
    }
}
