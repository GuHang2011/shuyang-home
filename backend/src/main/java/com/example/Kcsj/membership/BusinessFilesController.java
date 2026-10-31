package com.example.Kcsj.membership;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import javax.servlet.http.HttpServletRequest;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;
import static com.example.Kcsj.membership.MemberStore.*;
import static com.example.Kcsj.membership.MemberData.*;

/** Explicit business imports, never raw database restore or account provisioning. */
@RestController @Transactional @RequestMapping("/data-files")
public class BusinessFilesController {
    private final MemberStore store;private final MemberAuth auth;private final BusinessWorkbook workbook;private final ObjectMapper json;
    private static final String JOB="file_import";
    private static final Map<String,String> LABELS=new LinkedHashMap<>();
    static {LABELS.put("members","会员资料");LABELS.put("signups","活动报名");LABELS.put("orders","订单履约");}
    public BusinessFilesController(MemberStore store,MemberAuth auth,BusinessWorkbook workbook,ObjectMapper json){this.store=store;this.auth=auth;this.workbook=workbook;this.json=json;}
    private Map<String,Object> ok(Object data){return map("code",0,"data",data);}
    private Map<String,Object> access(String kind,HttpServletRequest req){if(!LABELS.containsKey(kind))throw new ApiException(400,"请选择有效的数据类型");return kind.equals("signups")?auth.staff(req):auth.admin(req);}
    private List<String> headers(String kind){
        if(kind.equals("members"))return Arrays.asList("会员编号","姓名","家乡","现居地","行业","个人简介");
        if(kind.equals("signups"))return Arrays.asList("会员编号","操作");
        return Arrays.asList("订单号","操作","履约说明");
    }
    @GetMapping("/options") public Map<String,Object> options(HttpServletRequest req){
        Map<String,Object> actor=auth.staff(req);List<Map<String,Object>> kinds=new ArrayList<>();
        for(String kind:LABELS.keySet())if(auth.isAdmin(actor)||kind.equals("signups"))kinds.add(map("id",kind,"label",LABELS.get(kind),"headers",headers(kind)));
        return ok(map("kinds",kinds,"events",store.all("event").stream().sorted(Comparator.comparing((Map<String,Object> r)->s(r,"startsAt")).reversed()).map(r->pick(r,"id","title","startsAt","status")).collect(Collectors.toList())));
    }
    @GetMapping("/template") public Map<String,Object> template(@RequestParam String kind,HttpServletRequest req){access(kind,req);return ok(workbook.write(LABELS.get(kind)+"-导入模板.xlsx",headers(kind),Collections.emptyList()));}
    @GetMapping("/report") public Map<String,Object> report(@RequestParam String kind,@RequestParam(defaultValue="") String eventId,@RequestParam(defaultValue="") String query,@RequestParam(defaultValue="all") String status,HttpServletRequest req){access(kind,req);return ok(buildReport(kind,eventId,query,status));}
    @GetMapping("/export") @SuppressWarnings("unchecked") public Map<String,Object> export(@RequestParam String kind,@RequestParam(defaultValue="") String eventId,@RequestParam(defaultValue="") String query,@RequestParam(defaultValue="all") String status,HttpServletRequest req){
        Map<String,Object> actor=access(kind,req),report=buildReport(kind,eventId,query,status);
        Map<String,Object> file=workbook.write(LABELS.get(kind)+"-"+LocalDate.now(ZoneId.of("Asia/Shanghai"))+".xlsx",(List<String>)report.get("headers"),(List<List<String>>)report.get("rows"));
        auth.audit(actor,"files.export-"+kind,"rows:"+report.get("total"));return ok(file);
    }
    private String time(Object raw){try{return DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(ZoneId.of("Asia/Shanghai")).format(Instant.parse(String.valueOf(raw)));}catch(Exception e){return "";}}
    private String label(String value){
        String[] keys={"pending","approved","rejected","registered","checked_in","cancelled","confirmed","shipped","ready","completed","unconfirmed","refunded","shipping","pickup"};
        String[] names={"待审核","已通过","已退回","已报名","已签到","已取消","已确认","已发货","待自提","已完成","未确认","已退款","快递配送","到店自提"};
        for(int i=0;i<keys.length;i++)if(keys[i].equals(value))return names[i];return value;
    }
    private List<String> cells(Object... values){List<String> result=new ArrayList<>();for(Object value:values)result.add(value==null?"":String.valueOf(value));return result;}
    private String money(Object cents){return cents instanceof Number?java.math.BigDecimal.valueOf(((Number)cents).longValue(),2).toPlainString():"0.00";}
    private Map<String,Object> buildReport(String kind,String eventId,String query,String status){
        if(query.length()>80)throw new ApiException(400,"搜索条件最多80字");
        List<String> states=kind.equals("members")?Arrays.asList("all","pending","approved","rejected","disabled"):kind.equals("signups")?Arrays.asList("all","registered","checked_in","cancelled"):Arrays.asList("all","pending","confirmed","shipped","ready","completed","cancelled");
        if(!states.contains(status))throw new ApiException(400,"筛选状态无效");
        String title=LABELS.get(kind);List<String> columns;List<List<String>> rows=new ArrayList<>();List<Map<String,Object>> source;
        Map<String,Map<String,Object>> users=new HashMap<>();if(kind.equals("signups"))for(Map<String,Object> user:store.all("user"))users.put(s(user,"id"),user);
        if(kind.equals("members")){columns=Arrays.asList("会员编号","姓名","手机号","家乡","现居地","行业","个人简介","审核状态","账号状态","申请时间（北京时间）");source=store.all("user").stream().filter(r->s(r,"role").equals("member")).collect(Collectors.toList());}
        else if(kind.equals("signups")){Map<String,Object> event=store.get("event",eventId);title+=" · "+s(event,"title");columns=Arrays.asList("会员编号","姓名","手机号","报名状态","志愿时长（小时）","报名时间（北京时间）");source=store.all("signup").stream().filter(r->s(r,"eventId").equals(eventId)).collect(Collectors.toList());}
        else {columns=Arrays.asList("订单号","商品","规格","数量","总额（元）","收货人","手机号","地址","配送方式","订单状态","结算状态","履约说明","下单时间（北京时间）");source=store.all("order");}
        source.sort(Comparator.comparing((Map<String,Object> r)->s(r,"createdAt")).reversed().thenComparing(r->s(r,"id")));
        for(Map<String,Object> row:source){
            if(!status.equals("all")&&!(status.equals("disabled")?!b(row,"enabled"):s(row,"status").equals(status)))continue;
            List<String> values;
            if(kind.equals("members"))values=cells(s(row,"memberNo"),s(row,"name"),s(row,"phone"),s(row,"hometown"),s(row,"district"),s(row,"industry"),s(row,"bio"),label(s(row,"status")),b(row,"enabled")?"已启用":"已停用",time(row.get("createdAt")));
            else if(kind.equals("signups")){Map<String,Object> user=users.getOrDefault(s(row,"userId"),Collections.emptyMap());values=cells(s(user,"memberNo"),s(user,"name"),s(user,"phone"),label(s(row,"status")),row.get("hours"),time(row.get("createdAt")));}
            else values=cells(s(row,"orderNo"),s(row,"title"),s(row,"specification"),row.get("quantity"),money(row.get("totalCents")),s(row,"name"),s(row,"phone"),s(row,"address"),label(s(row,"delivery")),s(row,"status").equals("pending")?"待确认":label(s(row,"status")),label(s(row,"settlement")),s(row,"fulfillment"),time(row.get("createdAt")));
            if(!query.trim().isEmpty()&&!String.join(" ",values).toLowerCase(Locale.ROOT).contains(query.trim().toLowerCase(Locale.ROOT)))continue;
            rows.add(values);if(rows.size()>5000)throw new ApiException(400,"结果超过5000条，请缩小筛选范围后导出或打印");
        }
        return map("title",title,"headers",columns,"rows",rows,"total",rows.size(),"generatedAt",time(now()),"filter",map("query",query.trim(),"status",status.equals("all")?"全部":status.equals("disabled")?"已停用":kind.equals("orders")&&status.equals("pending")?"待确认":label(status)));
    }
    private static class Plan {
        final List<Map<String,Object>> lines=new ArrayList<>(),writes=new ArrayList<>();
        final List<Object> snapshot=new ArrayList<>();int invalid=0;
    }
    private Map<String,Object> by(Map<String,Map<String,Object>> index,String key,String message){Map<String,Object> row=index.get(key);if(row==null)throw new ApiException(400,message);return row;}
    private Map<String,Map<String,Object>> index(String type,String key){Map<String,Map<String,Object>> result=new HashMap<>();for(Map<String,Object> row:store.all(type))if(!s(row,key).isEmpty())result.put(s(row,key),row);return result;}
    @SuppressWarnings("unchecked") private Plan plan(String kind,String eventId,List<Map<String,Object>> lines){
        Plan plan=new Plan();Set<String> seen=new HashSet<>();Map<String,Map<String,Object>> users=index("user","memberNo"),orders=kind.equals("orders")?index("order","orderNo"):Collections.emptyMap();
        Map<String,Object> event=kind.equals("signups")?store.get("event",eventId):Collections.emptyMap();
        Map<String,Map<String,Object>> signups=kind.equals("signups")?index("signup","id"):Collections.emptyMap();
        long count=signups.values().stream().filter(r->s(r,"eventId").equals(eventId)&&!s(r,"status").equals("cancelled")).count();
        if(kind.equals("signups")){plan.snapshot.add(event);plan.snapshot.add(count);}
        for(Map<String,Object> line:lines){
            Map<String,Object> values=(Map<String,Object>)line.get("values"),view=map("line",line.get("line"),"values",values,"error","","changed",false);plan.lines.add(view);
            try {
                String key=text(values,kind.equals("orders")?"订单号":"会员编号",1,80);
                if(!seen.add(key))throw new ApiException(400,"文件中编号重复，请合并为一行");
                Map<String,Object> before,after;String type;
                if(kind.equals("members")){
                    before=by(users,key,"会员编号不存在，请从会员报表复制编号");
                    if(!s(before,"role").equals("member"))throw new ApiException(400,"仅支持普通会员的基本资料更新");
                    after=new LinkedHashMap<>(before);type="user";
                    after.putAll(map("name",text(values,"姓名",2,30),"hometown",text(values,"家乡",2,50),"district",text(values,"现居地",2,50),"industry",text(values,"行业",0,50),"bio",text(values,"个人简介",0,300)));
                    plan.snapshot.add(before);
                }else if(kind.equals("signups")){
                    Map<String,Object> user=by(users,key,"会员编号不存在，请确认会员已经审核通过");
                    if(!b(user,"enabled")||!s(user,"status").equals("approved"))throw new ApiException(400,"会员未通过审核或已停用");
                    if(!s(event,"status").equals("published")||!instant(event,"startsAt").isAfter(Instant.now()))throw new ApiException(400,"活动已开始或已关闭报名");
                    String action=choice(values,"操作","报名","取消报名"),signupId=eventId+":"+s(user,"id");type="signup";
                    before=signups.getOrDefault(signupId,Collections.emptyMap());after=new LinkedHashMap<>(before);
                    plan.snapshot.add(user);plan.snapshot.add(before);
                    if(action.equals("报名")){
                        if(before.isEmpty()||s(before,"status").equals("cancelled")){count++;after=map("id",signupId,"eventId",eventId,"userId",s(user,"id"),"status","registered","hours",0);}
                    }else{
                        if(before.isEmpty())throw new ApiException(400,"该会员没有报名记录");
                        if(s(before,"status").equals("checked_in"))throw new ApiException(400,"已签到的报名不能取消");
                        if(!s(before,"status").equals("cancelled")){count--;after.put("status","cancelled");}
                    }
                }else{
                    before=by(orders,key,"订单号不存在，请从订单报表复制订单号");after=new LinkedHashMap<>(before);type="order";
                    String action=choice(values,"操作","发货","备妥自提"),note=text(values,"履约说明",5,300),next=action.equals("发货")?"shipped":"ready";
                    if(action.equals("发货")!=s(before,"delivery").equals("shipping"))throw new ApiException(400,"操作与订单配送方式不符");
                    if(!s(before,"status").equals("confirmed")&&!(s(before,"status").equals(next)&&s(before,"fulfillment").equals(note)))throw new ApiException(400,"仅已确认订单可履约；已处理订单不可覆盖");
                    after.put("status",next);after.put("fulfillment",note);plan.snapshot.add(before);
                }
                boolean changed=!before.equals(after);view.put("changed",changed);view.put("name",kind.equals("orders")?s(before,"title"):kind.equals("members")?s(before,"name"):s(users.get(key),"name"));
                if(changed)plan.writes.add(map("type",type,"row",after));
            }catch(ApiException e){view.put("error",e.getMessage());plan.invalid++;}
        }
        if(kind.equals("signups")&&count>number(event,"capacity",1,10000)){
            for(Map<String,Object> line:plan.lines)if(s(line,"error").isEmpty()&&s((Map<String,Object>)line.get("values"),"操作").equals("报名")){line.put("error","导入后将超过活动名额，请减少报名或先取消其他报名");plan.invalid++;}
        }
        return plan;
    }
    private String fingerprint(Plan plan){try{return auth.digest(json.writeValueAsString(plan.snapshot));}catch(Exception e){throw new IllegalStateException(e);}}
    private void cleanup(){for(Map<String,Object> job:store.all(JOB))if(Instant.parse(s(job,"expiresAt")).isBefore(Instant.now()))store.delete(JOB,s(job,"id"));}
    @PostMapping("/preview") public Map<String,Object> preview(@RequestBody Map<String,Object> input,HttpServletRequest req){
        String kind=text(input,"kind",1,20),eventId=text(input,"eventId",0,80);access(kind,req);
        List<Map<String,Object>> lines=workbook.read(text(input,"filename",1,180),text(input,"base64",1,((BusinessWorkbook.MAX_BYTES+2)/3)*4),headers(kind));
        store.lockWrites();Map<String,Object> actor=access(kind,req);cleanup();auth.limit("file-preview:"+s(actor,"id"),60);Plan plan=plan(kind,eventId,lines);
        Map<String,Object> result=map("lines",plan.lines,"total",lines.size(),"invalid",plan.invalid,"changes",plan.writes.size(),"token","","expiresAt","");
        // Selecting a new file invalidates the preceding pending confirmation, even if invalid.
        for(Map<String,Object> old:store.all(JOB))if(s(old,"ownerId").equals(s(actor,"id"))&&!b(old,"committed"))store.delete(JOB,s(old,"id"));
        if(plan.invalid==0){
            String token=id(),expires=Instant.now().plusSeconds(600).toString();
            store.save(JOB,map("id",token,"ownerId",s(actor,"id"),"kind",kind,"eventId",eventId,"lines",lines,"fingerprint",fingerprint(plan),"expiresAt",expires,"committed",false));result.put("token",token);result.put("expiresAt",expires);
        }
        return ok(result);
    }
    @PostMapping("/commit") @SuppressWarnings("unchecked") public Map<String,Object> commit(@RequestBody Map<String,Object> input,HttpServletRequest req){
        store.lockWrites();Map<String,Object> actor=auth.staff(req);String token=text(input,"token",36,36);Map<String,Object> job=store.all(JOB).stream().filter(r->s(r,"id").equals(token)).findFirst().orElseThrow(()->new ApiException(409,"预览已失效，请重新选择文件"));
        if(!s(job,"ownerId").equals(s(actor,"id")))throw new ApiException(403,"只能提交本人预览的文件");
        String kind=s(job,"kind");access(kind,req);
        if(Instant.parse(s(job,"expiresAt")).isBefore(Instant.now()))throw new ApiException(409,"预览已超过有效期，请重新选择文件");
        if(!flag(input,"confirmed"))throw new ApiException(400,"请确认已经核对文件和会员意愿");
        if(b(job,"committed"))return ok(map("count",job.get("count"),"replayed",true));
        Plan plan=plan(kind,s(job,"eventId"),(List<Map<String,Object>>)job.get("lines"));
        if(plan.invalid>0||!fingerprint(plan).equals(s(job,"fingerprint")))throw new ApiException(409,"数据已变化或业务条件已失效，请重新预览后提交");
        for(Map<String,Object> change:plan.writes){Map<String,Object> row=(Map<String,Object>)change.get("row");if(s(change,"type").equals("signup")&&!row.containsKey("createdAt"))row.put("createdAt",now());row.put("updatedAt",now());store.save(s(change,"type"),row);}
        int count=plan.writes.size();store.save(JOB,map("id",token,"ownerId",s(actor,"id"),"kind",kind,"count",count,"committed",true,"expiresAt",Instant.now().plusSeconds(86400).toString()));
        auth.audit(actor,"files.import-"+kind,"batch:"+token+";rows:"+count);cleanup();return ok(map("count",count,"replayed",false));
    }
}
