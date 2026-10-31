package com.example.Kcsj;

import com.example.Kcsj.membership.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.http.HttpMethod;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static com.example.Kcsj.membership.MemberStore.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Integration tests use an isolated in-memory database, never the archived counselor data. */
@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:membership-tests;DB_CLOSE_DELAY=-1", "shuyang.admin-password=TestInitialAdmin2026", "shuyang.data-key="})
@AutoConfigureMockMvc
class MembershipTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired MemberStore store;
    @Autowired MemberAuth auth;
    String admin;
    int phoneSequence;
    @BeforeEach void setup() throws Exception {
        jdbc.update("DELETE FROM syh_record");jdbc.update("DELETE FROM syh_session");jdbc.update("DELETE FROM syh_attachment");auth.bootstrap();phoneSequence=0;
        String token=token(call("POST","/auth/login",null,map("username","admin","password","TestInitialAdmin2026"),200));
        admin=token(call("POST","/auth/password",token,map("oldPassword","TestInitialAdmin2026","newPassword","TestChangedAdmin2026"),200));
    }
    @SuppressWarnings("unchecked") Map<String,Object> call(String method,String path,String token,Object body,int expected) throws Exception {
        MockHttpServletRequestBuilder builder=request(HttpMethod.valueOf(method),path).with(req->{req.setRemoteAddr(UUID.randomUUID().toString());return req;});
        if(token!=null)builder.header("Authorization","Bearer "+token);
        if(body!=null)builder.contentType("application/json").content(json.writeValueAsBytes(body));
        String result=mvc.perform(builder).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        return json.readValue(result,Map.class);
    }
    @SuppressWarnings("unchecked") Map<String,Object> data(Map<String,Object> result) {return (Map<String,Object>)result.get("data");}
    String token(Map<String,Object> result) {return s(data(result),"token");}
    @SuppressWarnings("unchecked") Map<String,Object> account(boolean approve) throws Exception {
        String phone="1380000"+String.format("%04d",++phoneSequence);
        Map<String,Object> result=data(call("POST","/auth/register",null,map("phone",phone,"password","TestMemberPassword2026","name","测试老乡","hometown","沭阳沭城","district","苏州吴中","industry","服务业","bio","一起参与公益活动","consent",true,"volunteer",true,"directoryVisible",false,"phoneVisible",false),200));
        Map<String,Object> user=(Map<String,Object>)result.get("user");
        if(approve)call("POST","/admin/members/"+s(user,"id")+"/review",admin,map("status","approved","note",""),200);
        return map("id",s(user,"id"),"token",s(result,"token"),"phone",phone);
    }
    Map<String,Object> event(int capacity,String category) throws Exception {
        return data(call("POST","/events",admin,map("title","测试乡情活动","category",category,"location","测试活动场地","startsAt",Instant.now().plusSeconds(7200).toString(),"endsAt",Instant.now().plusSeconds(14400).toString(),"capacity",capacity,"status","published","description","用于自动验收的测试活动，不是真实活动。"),200));
    }
    @Test void railwayNoticesRequireSourcesAndRespectPublicationPermissions() throws Exception {
        Map<String,Object> notice=map("title","淮新高铁专题验收","content","仅用于测试专题发布与来源校验。","category","淮新高铁","status","published");
        call("POST","/notices",null,notice,401);
        call("POST","/notices",s(account(true),"token"),notice,403);
        call("POST","/notices",admin,notice,400);
        notice.putAll(map("sourceName","测试资料来源","sourceUrl","javascript:alert(1)","sourceDate","2026-10-30"));
        call("POST","/notices",admin,notice,400);
        notice.put("sourceUrl","https://www.ndrc.gov.cn/");notice.put("sourceDate","2026-02-30");
        call("POST","/notices",admin,notice,400);
        notice.put("sourceDate","2026-10-30");
        Map<String,Object> saved=data(call("POST","/notices",admin,notice,200));String id=s(saved,"id");
        assertEquals("https://www.ndrc.gov.cn/",s(saved,"sourceUrl"));
        assertTrue(json.writeValueAsString(call("GET","/notices",null,null,200).get("data")).contains(id));
        notice.put("status","withdrawn");call("PUT","/notices/"+id,admin,notice,200);
        assertFalse(json.writeValueAsString(call("GET","/notices",null,null,200).get("data")).contains(id));
        assertTrue(json.writeValueAsString(call("GET","/notices",admin,null,200).get("data")).contains(id));
    }
    @Test void railwayCommentaryCanBeOriginalWithoutAnExternalArticle() throws Exception {
        Map<String,Object> saved=data(call("POST","/notices",admin,map("title","一凡解读测试","content","这是一条用于验收的个人观察，不是铁路建设消息。","category","一凡说高铁","status","published","sourceName","一凡说高铁","sourceDate","2026-10-30"),200));
        assertEquals("一凡说高铁",s(saved,"category"));assertEquals("",s(saved,"sourceUrl"));
    }
    @Test void newDatabaseHasNoFabricatedMembersOrActivities() throws Exception {
        Map<String,Object> stats=data(call("GET","/home",null,null,200));
        assertEquals(0,((Number)stats.get("members")).intValue());assertEquals(0,((Number)stats.get("events")).intValue());
        call("GET","/admin/members",null,null,401);
    }
    @Test void administratorCanBeInitializedAfterAnEarlyPublicApplication() throws Exception {
        Map<String,Object> me=data(call("GET","/auth/me",admin,null,200));
        store.delete("user",s(me,"id"));account(false);auth.bootstrap();
        String token=token(call("POST","/auth/login",null,map("username","admin","password","TestInitialAdmin2026"),200));
        assertEquals("superadmin",s(data(call("GET","/auth/me",token,null,200)),"role"));
    }
    @Test void applicationRequiresConsentAndCannotEscalateRole() throws Exception {
        Map<String,Object> body=map("phone","13812345678","password","TestMemberPassword2026","name","申请会员","hometown","沭阳","district","苏州","consent",false,"volunteer",false,"directoryVisible",false,"phoneVisible",false,"role","admin","status","approved");
        call("POST","/auth/register",null,body,400);body.put("consent",true);
        Map<String,Object> result=data(call("POST","/auth/register",null,body,200));String token=s(result,"token");
        Map<String,Object> me=data(call("GET","/auth/me",token,null,200));assertEquals("member",s(me,"role"));assertEquals("pending",s(me,"status"));assertFalse(me.containsKey("passwordHash"));
        call("GET","/admin/members",token,null,403);call("POST","/events/"+s(event(2,"乡情聚会"),"id")+"/signup",token,null,403);
        call("POST","/auth/register",null,body,409);
    }
    @Test void rejectedApplicationCanBeCorrectedAndResubmitted() throws Exception {
        Map<String,Object> person=account(false);String id=s(person,"id"),token=s(person,"token");
        call("POST","/admin/members/"+id+"/review",admin,map("status","rejected","note",""),400);
        call("POST","/admin/members/"+id+"/review",admin,map("status","rejected","note","请补充家乡乡镇"),200);
        Map<String,Object> body=data(call("GET","/auth/me",token,null,200));body.put("resubmit",true);body.put("role","admin");
        Map<String,Object> updated=data(call("PUT","/profile",token,body,200));assertEquals("pending",s(updated,"status"));assertEquals("member",s(updated,"role"));
        call("POST","/admin/members/"+id+"/review",admin,map("status","approved","note",""),200);
        call("POST","/admin/members/"+id+"/review",admin,map("status","rejected","note","重复处理"),409);
    }
    @Test void directoryIsOptInAndPhoneIsSeparatelyControlled() throws Exception {
        Map<String,Object> person=account(true);String token=s(person,"token");
        assertEquals(0,((List<?>)call("GET","/members",token,null,200).get("data")).size());
        Map<String,Object> body=data(call("GET","/auth/me",token,null,200));body.put("directoryVisible",true);call("PUT","/profile",token,body,200);
        String directory=json.writeValueAsString(call("GET","/members",token,null,200));assertFalse(directory.contains(s(person,"phone")));assertFalse(directory.contains("passwordHash"));
        body.put("phoneVisible",true);call("PUT","/profile",token,body,200);assertTrue(json.writeValueAsString(call("GET","/members",token,null,200)).contains(s(person,"phone")));
        call("GET","/members",null,null,401);
    }
    @Test void signupIsIdempotentCapacityLimitedAndCancellable() throws Exception {
        String eventId=s(event(1,"乡情聚会"),"id"),a=s(account(true),"token"),b=s(account(true),"token");
        call("POST","/events/"+eventId+"/signup",a,null,200);call("POST","/events/"+eventId+"/signup",a,null,200);
        assertEquals(1,store.all("signup").size());call("POST","/events/"+eventId+"/signup",b,null,409);
        call("POST","/events/"+eventId+"/cancel-signup",a,null,200);call("POST","/events/"+eventId+"/signup",b,null,200);
        call("GET","/events/"+eventId+"/participants",a,null,403);
    }
    @Test void concurrentLastSeatCannotBeOversold() throws Exception {
        String eventId=s(event(1,"乡情聚会"),"id"),a=s(account(true),"token"),b=s(account(true),"token");
        ExecutorService pool=Executors.newFixedThreadPool(2);CountDownLatch start=new CountDownLatch(1);
        try {
            List<Future<Integer>> results=new ArrayList<>();
            for(String token:Arrays.asList(a,b))results.add(pool.submit(()->{start.await();return mvc.perform(request(HttpMethod.POST,"/events/"+eventId+"/signup").header("Authorization","Bearer "+token)).andReturn().getResponse().getStatus();}));
            start.countDown();List<Integer> statuses=Arrays.asList(results.get(0).get(15,TimeUnit.SECONDS),results.get(1).get(15,TimeUnit.SECONDS));
            assertTrue(statuses.contains(200));assertTrue(statuses.contains(409));assertEquals(1,store.all("signup").size());
        } finally {pool.shutdownNow();}
    }
    @Test void checkinRequiresStaffAndCountsHoursOnlyOnce() throws Exception {
        Map<String,Object> event=event(2,"公益志愿"),person=account(true);String path="/events/"+s(event,"id");
        call("POST",path+"/signup",s(person,"token"),null,200);
        Map<String,Object> input=map("userId",s(person,"id"),"hours",1.5);
        call("POST",path+"/check-in",s(person,"token"),input,403);call("POST",path+"/check-in",admin,input,409);
        event.put("startsAt",Instant.now().minusSeconds(7200).toString());event.put("endsAt",Instant.now().minusSeconds(1).toString());store.save("event",event);
        input.put("hours",3);call("POST",path+"/check-in",admin,input,400);input.put("hours",1.5);
        call("POST",path+"/check-in",admin,input,200);call("POST",path+"/check-in",admin,input,200);
        assertEquals(1.5,((Number)data(call("GET","/home",null,null,200)).get("volunteerHours")).doubleValue());
        input.put("hours",1);call("POST",path+"/check-in",admin,input,409);call("POST",path+"/cancel-signup",s(person,"token"),null,409);
        event.put("status","cancelled");call("PUT",path,admin,event,409);
    }
    @Test void eventDraftCancellationAndRegisteredEditsAreEnforced() throws Exception {
        Map<String,Object> event=event(2,"乡情聚会"),person=account(true);String path="/events/"+s(event,"id");
        event.put("status","draft");call("PUT",path,admin,event,200);call("GET",path,null,null,404);call("POST",path+"/signup",s(person,"token"),null,409);
        event.put("status","published");call("PUT",path,admin,event,200);call("POST",path+"/signup",s(person,"token"),null,200);
        String start=s(event,"startsAt");event.put("startsAt",Instant.now().plusSeconds(3600).toString());call("PUT",path,admin,event,409);event.put("startsAt",start);
        event.put("status","cancelled");call("PUT",path,admin,event,200);assertEquals("cancelled",s(store.all("signup").get(0),"status"));
    }
    @Test void postsAreModeratedAndContactsAreNotPublic() throws Exception {
        Map<String,Object> person=account(true),pending=account(false);String token=s(person,"token");
        Map<String,Object> post=data(call("POST","/posts",token,map("title","生活互助测试","content","这是一条待审核的测试信息，正文不含联系方式。","category","生活互助","contact","PRIVATE-CONTACT"),200));String path="/posts/"+s(post,"id");
        assertEquals(0,((List<?>)call("GET","/posts",null,null,200).get("data")).size());
        call("POST",path+"/review",token,map("status","approved","note",""),403);call("POST",path+"/review",admin,map("status","approved","note",""),200);
        assertFalse(json.writeValueAsString(call("GET","/posts",null,null,200)).contains("PRIVATE-CONTACT"));assertFalse(json.writeValueAsString(call("GET","/posts",s(pending,"token"),null,200)).contains("PRIVATE-CONTACT"));assertTrue(json.writeValueAsString(call("GET","/posts",token,null,200)).contains("PRIVATE-CONTACT"));
        call("POST",path+"/close",s(pending,"token"),null,403);call("POST",path+"/close",token,null,200);
        assertEquals(0,((List<?>)call("GET","/posts",null,null,200).get("data")).size());
    }
    @Test void passwordChangesDisableOldSessionsAndDisabledMembersCannotLogin() throws Exception {
        Map<String,Object> person=account(true);String token=s(person,"token");
        String changed=token(call("POST","/auth/password",token,map("oldPassword","TestMemberPassword2026","newPassword","NewMemberPassword2026"),200));
        call("GET","/auth/me",token,null,401);call("GET","/auth/me",changed,null,200);
        call("POST","/admin/members/"+s(person,"id")+"/access",admin,map("role","member","enabled",false),200);
        call("GET","/auth/me",changed,null,401);call("POST","/auth/login",null,map("username",s(person,"phone"),"password","NewMemberPassword2026"),403);
        Map<String,Object> me=data(call("GET","/auth/me",admin,null,200));call("POST","/admin/members/"+s(me,"id")+"/access",admin,map("role","member","enabled",false),409);
    }
    @Test void organizerCannotGrantRolesAndResetPasswordForcesRotation() throws Exception {
        Map<String,Object> person=account(true);String id=s(person,"id");
        call("POST","/admin/members/"+id+"/access",admin,map("role","organizer","enabled",true),200);
        String token=token(call("POST","/auth/login",null,map("username",s(person,"phone"),"password","TestMemberPassword2026"),200));
        call("GET","/admin/members",token,null,200);call("POST","/admin/members/"+id+"/access",token,map("role","admin","enabled",true),403);
        call("POST","/admin/members/"+id+"/reset-password",admin,map("password","TemporaryPassword2026"),200);call("GET","/auth/me",token,null,401);
        String temporary=token(call("POST","/auth/login",null,map("username",s(person,"phone"),"password","TemporaryPassword2026"),200));
        call("GET","/admin/members",temporary,null,403);call("POST","/auth/password",temporary,map("oldPassword","TemporaryPassword2026","newPassword","FinalPassword2026"),200);
    }
    Map<String,Object> topic(String token) throws Exception {
        return data(call("POST","/forum/topics",token,map("title","论坛验收话题","category","乡情闲聊","content","分享在苏州生活的经验，这是自动验收测试内容。"),200));
    }
    Map<String,Object> resource(String token,boolean approve) throws Exception {
        Map<String,Object> result=data(call("POST","/resources",token,map("title","技能互换测试","category","技能服务","offering","可以帮忙拍摄活动照片","seeking","希望获得基础剪辑指导","district","苏州吴中","contact","PRIVATE-OWNER-CONTACT"),200));
        if(approve)call("POST","/resources/"+s(result,"id")+"/review",admin,map("status","approved","note",""),200);return result;
    }
    Map<String,Object> exchange(String resource,String token) throws Exception {
        return data(call("POST","/resources/"+resource+"/requests",token,map("message","我可以提供基础视频剪辑指导","contact","PRIVATE-REQUESTER-CONTACT"),200));
    }
    @Test void forumTopicsAndRepliesRequireModerationAndRespectLock() throws Exception {
        Map<String,Object> writer=account(true),reader=account(true),topic=topic(s(writer,"token"));String path="/forum/topics/"+s(topic,"id");
        assertEquals(0,((List<?>)call("GET","/forum/topics",null,null,200).get("data")).size());call("GET",path,null,null,404);call("GET",path,s(writer,"token"),null,200);
        call("POST",path+"/review",s(writer,"token"),map("status","approved","note",""),403);call("POST",path+"/review",admin,map("status","approved","note",""),200);
        Map<String,Object> reply=data(call("POST",path+"/replies",s(reader,"token"),map("content","谢谢分享，欢迎更多老乡一起交流。"),200));
        assertEquals(0,((List<?>)data(call("GET",path,null,null,200)).get("replies")).size());assertEquals(1,((List<?>)data(call("GET",path,s(reader,"token"),null,200)).get("replies")).size());
        call("POST","/forum/replies/"+s(reply,"id")+"/review",admin,map("status","approved","note",""),200);
        assertEquals(1,((List<?>)data(call("GET",path,null,null,200)).get("replies")).size());
        call("POST",path+"/lock",s(reader,"token"),null,403);call("POST",path+"/lock",s(writer,"token"),null,200);call("POST",path+"/replies",s(reader,"token"),map("content","关闭后不能回复"),409);
        call("POST",path+"/review",admin,map("status","hidden","note","内容需要复核"),200);call("GET",path,null,null,404);
    }
    @Test void lockingAPendingForumTopicCannotPublishIt() throws Exception {
        Map<String,Object> writer=account(true),topic=topic(s(writer,"token"));String path="/forum/topics/"+s(topic,"id");
        call("POST",path+"/lock",s(writer,"token"),null,200);call("GET",path,null,null,404);
        assertEquals(0,((List<?>)call("GET","/forum/topics",null,null,200).get("data")).size());
        call("GET","/admin/forum",s(writer,"token"),null,403);
    }
    @Test void resourcesRequireApprovalAndContactsArePrivate() throws Exception {
        Map<String,Object> owner=account(true),resource=resource(s(owner,"token"),false),pending=account(false);String path="/resources/"+s(resource,"id");
        assertEquals(0,((List<?>)call("GET","/resources",null,null,200).get("data")).size());
        call("POST",path+"/review",admin,map("status","approved","note",""),200);
        assertFalse(json.writeValueAsString(call("GET","/resources",null,null,200)).contains("PRIVATE-OWNER-CONTACT"));assertFalse(json.writeValueAsString(call("GET","/resources",s(pending,"token"),null,200)).contains("PRIVATE-OWNER-CONTACT"));
        call("POST",path+"/requests",s(pending,"token"),map("message","我也想申请资源交换","contact","测试联系方式"),403);
        call("POST",path+"/requests",s(owner,"token"),map("message","不能申请自己的资源","contact","测试联系方式"),400);
        call("POST",path+"/review",admin,map("status","hidden","note","下架复核资料"),200);
        assertEquals(0,((List<?>)call("GET","/resources",null,null,200).get("data")).size());
    }
    @Test void exchangeIsPrivateAndNeedsBothPartiesToComplete() throws Exception {
        Map<String,Object> owner=account(true),requester=account(true),other=account(true),resource=resource(s(owner,"token"),true);
        Map<String,Object> row=exchange(s(resource,"id"),s(requester,"token"));String path="/exchanges/"+s(row,"id")+"/action";
        assertEquals(s(row,"id"),s(exchange(s(resource,"id"),s(requester,"token")),"id"));
        assertEquals(0,((List<?>)call("GET","/my/exchanges",s(other,"token"),null,200).get("data")).size());
        call("POST",path,s(other,"token"),map("action","accept"),403);call("POST",path,s(requester,"token"),map("action","accept"),403);
        call("POST",path,s(owner,"token"),map("action","accept"),200);call("POST",path,s(requester,"token"),map("action","cancel"),409);
        Map<String,Object> first=data(call("POST",path,s(owner,"token"),map("action","confirm"),200));assertEquals("accepted",s(first,"status"));
        Map<String,Object> second=data(call("POST",path,s(requester,"token"),map("action","confirm"),200));assertEquals("completed",s(second,"status"));
        call("POST",path,s(requester,"token"),map("action","confirm"),200);assertEquals("exchanged",s(store.get("resource",s(resource,"id")),"availability"));
    }
    @Test void concurrentExchangeAcceptsOnlyOneApplicant() throws Exception {
        Map<String,Object> owner=account(true),a=account(true),b=account(true),resource=resource(s(owner,"token"),true);
        Map<String,Object> one=exchange(s(resource,"id"),s(a,"token")),two=exchange(s(resource,"id"),s(b,"token"));
        ExecutorService pool=Executors.newFixedThreadPool(2);CountDownLatch start=new CountDownLatch(1);
        try {
            List<Future<Integer>> results=new ArrayList<>();
            for(Map<String,Object> row:Arrays.asList(one,two))results.add(pool.submit(()->{start.await();return mvc.perform(request(HttpMethod.POST,"/exchanges/"+s(row,"id")+"/action").header("Authorization","Bearer "+s(owner,"token")).contentType("application/json").content("{\"action\":\"accept\"}")).andReturn().getResponse().getStatus();}));
            start.countDown();List<Integer> statuses=Arrays.asList(results.get(0).get(15,TimeUnit.SECONDS),results.get(1).get(15,TimeUnit.SECONDS));assertTrue(statuses.contains(200));assertTrue(statuses.contains(409));
            assertEquals(1,store.all("exchange").stream().filter(x->s(x,"status").equals("accepted")).count());assertEquals(1,store.all("exchange").stream().filter(x->s(x,"status").equals("unavailable")).count());
        }finally{pool.shutdownNow();}
    }
    @Test void exchangeCancellationAndResourceClosureReleasePendingRequests() throws Exception {
        Map<String,Object> owner=account(true),requester=account(true),resource=resource(s(owner,"token"),true),row=exchange(s(resource,"id"),s(requester,"token"));
        call("POST","/exchanges/"+s(row,"id")+"/action",s(owner,"token"),map("action","cancel"),403);
        call("POST","/exchanges/"+s(row,"id")+"/action",s(requester,"token"),map("action","cancel"),200);
        Map<String,Object> again=exchange(s(resource,"id"),s(requester,"token"));assertNotEquals(s(row,"id"),s(again,"id"));
        call("POST","/resources/"+s(resource,"id")+"/close",s(owner,"token"),null,200);assertEquals("unavailable",s(store.get("exchange",s(again,"id")),"status"));
    }
    @SuppressWarnings("unchecked") List<Map<String,Object>> list(String path,String token) throws Exception {return (List<Map<String,Object>>)call("GET",path,token,null,200).get("data");}
    Map<String,Object> proposalBody() {return map("title","会员发起的活动","category","乡情聚会","description","一起交流在苏州的生活经验，仅用于测试。","location","测试活动室","capacity",5,"startsAt",Instant.now().plusSeconds(7200).toString(),"endsAt",Instant.now().plusSeconds(10800).toString());}
    @Test void memberActivityIsPublishedOnlyAfterReviewAndPreservesInitiator() throws Exception {
        Map<String,Object> person=account(true);String token=s(person,"token");Map<String,Object> input=proposalBody();
        call("POST","/events",token,input,403);call("POST","/event-proposals",s(account(false),"token"),input,403);
        Map<String,Object> row=data(call("POST","/event-proposals",token,input,200));String path="/event-proposals/"+s(row,"id")+"/review";
        assertEquals(0,list("/events",null).size());assertEquals(1,list("/my/event-proposals",token).size());
        call("POST",path,token,map("status","approved"),403);call("POST",path,admin,map("status","rejected","note",""),400);
        Map<String,Object> approved=data(call("POST",path,admin,map("status","approved"),200));
        call("POST",path,admin,map("status","approved"),409);assertEquals(1,list("/events",null).size());assertEquals(s(person,"id"),s(store.get("event",s(approved,"eventId")),"initiatorId"));
        input.put("endsAt",Instant.parse(s(input,"startsAt")).plusSeconds(7*86400+1).toString());call("POST","/event-proposals",token,input,400);
    }
    @Test void disabledInitiatorCannotHaveActivityApproved() throws Exception {
        Map<String,Object> person=account(true),row=data(call("POST","/event-proposals",s(person,"token"),proposalBody(),200));
        call("POST","/admin/members/"+s(person,"id")+"/access",admin,map("role","member","enabled",false),200);
        call("POST","/event-proposals/"+s(row,"id")+"/review",admin,map("status","approved"),409);assertEquals(0,list("/events",null).size());
    }
    Map<String,Object> adBody() {return map("title","测试合作广告","sponsor","测试合作方","content","这是用于验证审核排期的广告测试内容。","placement","home","url","https://example.com/info","contact","公开联系方式","consent",true,"startsAt",Instant.now().minusSeconds(60).toString(),"endsAt",Instant.now().plusSeconds(3600).toString());}
    @Test void advertisementsRequireConsentReviewAndActiveWindow() throws Exception {
        String token=s(account(true),"token"),other=s(account(true),"token");Map<String,Object> input=adBody();
        input.put("consent",false);call("POST","/ads",token,input,400);input.put("consent",true);input.put("url","javascript:alert(1)");call("POST","/ads",token,input,400);
        input.put("url","https://user:password@example.com");call("POST","/ads",token,input,400);input.put("url","https://example.com");
        Map<String,Object> row=data(call("POST","/ads",token,input,200));String path="/ads/"+s(row,"id");assertEquals(0,list("/ads",null).size());
        call("POST",path+"/review",token,map("status","approved"),403);call("POST",path+"/review",admin,map("status","approved","note","INTERNAL-REVIEW"),200);
        assertEquals(1,list("/ads",null).size());assertFalse(json.writeValueAsString(list("/ads",null)).contains("INTERNAL-REVIEW"));
        row=store.get("advertisement",s(row,"id"));row.put("startsAt",Instant.now().plusSeconds(120).toString());store.save("advertisement",row);assertEquals(0,list("/ads",null).size());
        row.put("startsAt",Instant.now().minusSeconds(120).toString());row.put("endsAt",Instant.now().minusSeconds(1).toString());store.save("advertisement",row);assertEquals(0,list("/ads",null).size());
        call("POST",path+"/withdraw",other,null,403);call("POST",path+"/withdraw",token,null,200);assertEquals("withdrawn",s(list("/my/ads",token).get(0),"status"));
    }
    Map<String,Object> pollBody() {return map("title","测试活动时间投票","description","选择下次交流时间","options",Arrays.asList("周六","周日"),"maxChoices",1,"startsAt",Instant.now().minusSeconds(60).toString(),"endsAt",Instant.now().plusSeconds(3600).toString());}
    @SuppressWarnings("unchecked") String option(Map<String,Object> poll,int index) {return s(((List<Map<String,Object>>)poll.get("options")).get(index),"id");}
    @Test void pollBallotsAreImmutablePrivateAndEligibilityChecked() throws Exception {
        String a=s(account(true),"token"),b=s(account(true),"token"),pending=s(account(false),"token");Map<String,Object> input=pollBody();
        call("POST","/polls",a,input,403);input.put("options",Arrays.asList("重复","重复"));call("POST","/polls",admin,input,400);
        Map<String,Object> poll=data(call("POST","/polls",admin,pollBody(),200));String path="/polls/"+s(poll,"id");Object choice=map("choices",Arrays.asList(option(poll,0)));
        call("POST",path+"/vote",pending,choice,403);call("POST",path+"/vote",null,choice,401);
        call("POST",path+"/vote",a,map("choices",Arrays.asList(option(poll,0),option(poll,1))),400);call("POST",path+"/vote",a,map("choices",Arrays.asList("wrong-option")),400);
        assertFalse(data(call("GET",path,a,null,200)).containsKey("counts"));call("POST",path+"/vote",a,choice,200);call("POST",path+"/vote",a,choice,200);
        call("POST",path+"/vote",a,map("choices",Arrays.asList(option(poll,1))),409);assertEquals(1,store.all("poll_vote").size());
        assertEquals(1,((Number)data(call("GET",path,a,null,200)).get("totalVotes")).intValue());Map<String,Object> other=data(call("GET",path,b,null,200));assertFalse(other.containsKey("counts"));assertEquals(0,((List<?>)other.get("myChoices")).size());
        call("POST",path+"/close",a,null,403);call("POST",path+"/close",admin,null,200);assertTrue(data(call("GET",path,b,null,200)).containsKey("counts"));assertFalse(data(call("GET",path,null,null,200)).containsKey("counts"));call("POST",path+"/vote",b,choice,409);
    }
    List<Integer> concurrentPosts(String path,List<String> tokens,Object body) throws Exception {
        ExecutorService pool=Executors.newFixedThreadPool(tokens.size());CountDownLatch start=new CountDownLatch(1);String content=json.writeValueAsString(body);
        try {List<Future<Integer>> futures=new ArrayList<>();for(String token:tokens)futures.add(pool.submit(()->{start.await();return mvc.perform(request(HttpMethod.POST,path).header("Authorization","Bearer "+token).contentType("application/json").content(content)).andReturn().getResponse().getStatus();}));start.countDown();List<Integer> result=new ArrayList<>();for(Future<Integer> future:futures)result.add(future.get(15,TimeUnit.SECONDS));return result;}finally{pool.shutdownNow();}
    }
    @Test void pollConcurrentRetryCountsOnceAndFuturePollRejectsVoting() throws Exception {
        String token=s(account(true),"token");Map<String,Object> poll=data(call("POST","/polls",admin,pollBody(),200));String path="/polls/"+s(poll,"id")+"/vote";Object vote=map("choices",Arrays.asList(option(poll,0)));
        assertEquals(Arrays.asList(200,200),concurrentPosts(path,Arrays.asList(token,token),vote));assertEquals(1,store.all("poll_vote").size());
        poll.put("startsAt",Instant.now().plusSeconds(600).toString());store.save("poll",poll);call("POST",path,s(account(true),"token"),vote,409);
    }
    Map<String,Object> projectBody(String type) {return map("title","测试爱心项目","type",type,"unit","件","goal",10,"purpose","帮助有需要的老乡，此为测试","description","仅用于自动验收的项目介绍与执行安排。","endsAt",Instant.now().plusSeconds(86400).toString(),"consent",true);}
    Map<String,Object> project(String token,String type) throws Exception {Map<String,Object> row=data(call("POST","/crowdfunding",token,projectBody(type),200));call("POST","/crowdfunding/"+s(row,"id")+"/review",admin,map("status","approved"),200);return row;}
    @Test void crowdfundingModerationPledgesPrivacyCancellationAndDelivery() throws Exception {
        String owner=s(account(true),"token"),supporter=s(account(true),"token"),other=s(account(true),"token");Map<String,Object> input=projectBody("物资");
        input.put("consent",false);call("POST","/crowdfunding",owner,input,400);input.put("consent",true);Map<String,Object> row=data(call("POST","/crowdfunding",owner,input,200));String path="/crowdfunding/"+s(row,"id");
        assertEquals(0,list("/crowdfunding",null).size());call("POST",path+"/review",owner,map("status","approved"),403);
        Map<String,Object> pledge=map("quantity",3,"message","PRIVATE-PLEDGE-NOTE","requestId",UUID.randomUUID().toString());call("POST",path+"/pledges",supporter,pledge,409);call("POST",path+"/review",admin,map("status","approved"),200);
        Map<String,Object> one=data(call("POST",path+"/pledges",supporter,pledge,200));assertEquals(s(one,"id"),s(data(call("POST",path+"/pledges",supporter,pledge,200)),"id"));pledge.put("quantity",4);call("POST",path+"/pledges",supporter,pledge,409);
        call("GET",path+"/pledges",other,null,403);assertEquals(1,list(path+"/pledges",owner).size());assertFalse(json.writeValueAsString(list("/crowdfunding",null)).contains("PRIVATE-PLEDGE-NOTE"));
        String pledgePath="/pledges/"+s(one,"id");call("POST",pledgePath+"/deliver",supporter,null,403);call("POST",pledgePath+"/cancel",other,null,403);call("POST",pledgePath+"/cancel",supporter,null,200);assertEquals(0,((Number)list("/crowdfunding",null).get(0).get("pledgedQuantity")).intValue());
        pledge.put("requestId",UUID.randomUUID().toString());one=data(call("POST",path+"/pledges",supporter,pledge,200));pledgePath="/pledges/"+s(one,"id");call("POST",pledgePath+"/deliver",owner,null,200);call("POST",pledgePath+"/deliver",owner,null,200);call("POST",pledgePath+"/cancel",supporter,null,409);assertEquals(4,((Number)list("/crowdfunding",null).get(0).get("deliveredQuantity")).intValue());
        call("POST",path+"/close",other,null,403);call("POST",path+"/close",owner,null,200);pledge.put("requestId",UUID.randomUUID().toString());call("POST",path+"/pledges",supporter,pledge,409);
    }
    @Test void financialIntentionsNeverBecomePaymentsAndVolunteerUnitsAreHours() throws Exception {
        String owner=s(account(true),"token"),supporter=s(account(true),"token");Map<String,Object> project=project(owner,"资金意向");String path="/crowdfunding/"+s(project,"id")+"/pledges";
        assertEquals("元",s(project,"unit"));Map<String,Object> pledge=map("quantity","1.125","requestId",UUID.randomUUID().toString());call("POST",path,supporter,pledge,400);pledge.put("quantity",0);call("POST",path,supporter,pledge,400);pledge.put("quantity","1.25");
        Map<String,Object> row=data(call("POST",path,supporter,pledge,200));call("POST","/pledges/"+s(row,"id")+"/deliver",owner,null,400);call("POST","/pledges/"+s(row,"id")+"/deliver",admin,null,400);assertEquals("pledged",s(list("/my/pledges",supporter).get(0),"status"));
        assertEquals("小时",s(project(owner,"志愿服务"),"unit"));
    }
    @Test void concurrentPledgesCannotExceedTargetAndExpiredProjectsRejectSupport() throws Exception {
        String owner=s(account(true),"token"),a=s(account(true),"token"),b=s(account(true),"token");Map<String,Object> project=project(owner,"物资");String path="/crowdfunding/"+s(project,"id")+"/pledges";
        List<Integer> results=concurrentPosts(path,Arrays.asList(a,b),map("quantity",6,"requestId",UUID.randomUUID().toString()));assertTrue(results.contains(200));assertTrue(results.contains(409));assertEquals(1,store.all("crowd_pledge").size());
        project.put("endsAt",Instant.now().minusSeconds(1).toString());project.put("status","approved");store.save("crowd_project",project);call("POST",path,a,map("quantity",1,"requestId",UUID.randomUUID().toString()),409);
    }
    Map<String,Object> contact(String from,Map<String,Object> to) throws Exception {return data(call("POST","/contact-exchanges",from,map("recipientId",s(to,"id"),"message","希望交流公益活动的组织经验","contact","PRIVATE-REQUESTER"),200));}
    @Test void contactExchangeRequiresReciprocalConsentAndNeverLeaksToOthers() throws Exception {
        Map<String,Object> a=account(true),b=account(true);String at=s(a,"token"),bt=s(b,"token"),other=s(account(true),"token");Map<String,Object> row=contact(at,b);String path="/contact-exchanges/"+s(row,"id")+"/action";
        assertFalse(json.writeValueAsString(list("/my/contact-exchanges",bt)).contains("PRIVATE-REQUESTER"));assertEquals(0,list("/my/contact-exchanges",other).size());assertEquals(0,list("/my/contact-exchanges",admin).size());
        call("POST","/contact-exchanges",bt,map("recipientId",s(a,"id"),"message","另一个方向的重复申请","contact","PRIVATE-RECIPIENT"),409);
        call("POST",path,other,map("action","accept","contact","PRIVATE-OTHER"),403);call("POST",path,at,map("action","accept","contact","PRIVATE-REQUESTER"),403);call("POST",path,bt,map("action","accept","contact",""),400);
        call("POST",path,bt,map("action","accept","contact","PRIVATE-RECIPIENT"),200);assertTrue(json.writeValueAsString(list("/my/contact-exchanges",at)).contains("PRIVATE-RECIPIENT"));assertTrue(json.writeValueAsString(list("/my/contact-exchanges",bt)).contains("PRIVATE-REQUESTER"));
        call("POST",path,at,map("action","revoke"),200);assertFalse(json.writeValueAsString(list("/my/contact-exchanges",at)).contains("PRIVATE-RECIPIENT"));assertFalse(json.writeValueAsString(list("/my/contact-exchanges",bt)).contains("PRIVATE-REQUESTER"));
        assertFalse(json.writeValueAsString(list("/admin/audit",admin)).contains("PRIVATE-"));
    }
    @Test void contactRejectCancelSelfAndUnapprovedRecipientsAreEnforced() throws Exception {
        Map<String,Object> a=account(true),b=account(true),pending=account(false);String at=s(a,"token"),bt=s(b,"token");
        call("POST","/contact-exchanges",at,map("recipientId",s(a,"id"),"message","不能申请自己联系方式","contact","test"),400);call("POST","/contact-exchanges",at,map("recipientId",s(pending,"id"),"message","不能联系未审核会员","contact","test"),409);
        Map<String,Object> row=contact(at,b);String path="/contact-exchanges/"+s(row,"id")+"/action";call("POST",path,bt,map("action","cancel"),403);call("POST",path,at,map("action","cancel"),200);call("POST",path,bt,map("action","accept","contact","test"),409);
        row=contact(at,b);path="/contact-exchanges/"+s(row,"id")+"/action";call("POST",path,bt,map("action","reject"),200);assertFalse(json.writeValueAsString(list("/my/contact-exchanges",bt)).contains("PRIVATE-REQUESTER"));
    }
    Map<String,Object> chatRequest(Map<String,Object> a,Map<String,Object> b) throws Exception {return data(call("POST","/chat/direct",s(a,"token"),map("recipientId",s(b,"id"),"content","老乡你好，想一起聊聊活动安排。"),200));}
    Map<String,Object> chatMessage(String path,String token,String content) throws Exception {return data(call("POST",path+"/messages",token,map("content",content,"requestId",UUID.randomUUID().toString()),200));}
    @Test void bundledStickerPacksHaveValidImagesAndRejectUnknownArtwork() throws Exception {
        List<Map<String,Object>> packs=list("/chat/sticker-packs",null);assertEquals(2,packs.size());Set<String> ids=new HashSet<>();
        for(Map<String,Object> pack:packs)for(Object value:(List<?>)pack.get("stickers")) {
            Map<String,Object> sticker=(Map<String,Object>)value;assertTrue(ids.add(s(sticker,"id")));assertFalse(s(sticker,"label").isEmpty());
            byte[] png=mvc.perform(request(HttpMethod.GET,"/chat/stickers/"+s(sticker,"id")+".png")).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
            java.awt.image.BufferedImage image=javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(png));assertNotNull(image);assertEquals(320,image.getWidth());
        }
        assertEquals(12,ids.size());mvc.perform(request(HttpMethod.GET,"/chat/stickers/missing.png")).andExpect(status().isNotFound());
    }
    @Test void directStickersRespectConsentValidationAndRetryIdentity() throws Exception {
        Map<String,Object> a=account(true),b=account(true),other=account(true),room=chatRequest(a,b);String path="/chat/conversations/"+s(room,"id"),at=s(a,"token"),bt=s(b,"token");
        Map<String,Object> body=map("stickerId","hello","content","","requestId",UUID.randomUUID().toString());
        call("POST",path+"/messages",at,body,409);call("POST",path+"/action",bt,map("action","accept"),200);
        call("POST",path+"/messages",s(other,"token"),body,403);call("GET",path,admin,null,403);
        assertEquals(Arrays.asList(200,200),concurrentPosts(path+"/messages",Arrays.asList(at,at),body));assertEquals(2,store.all("chat_message").size());
        Map<String,Object> sent=data(call("POST",path+"/messages",at,body,200));assertEquals("[表情] 老乡好",s(sent,"content"));assertEquals(true,sent.get("stickerOnly"));assertEquals("hello",s((Map<String,Object>)sent.get("sticker"),"id"));
        assertEquals("[表情] 老乡好",s(list("/chat/conversations",bt).get(0),"preview"));
        body.put("stickerId","thanks");call("POST",path+"/messages",at,body,409);
        call("POST",path+"/messages",at,map("stickerId","https://example.com/x","requestId",UUID.randomUUID().toString()),400);
        call("POST",path+"/messages",at,map("stickerId","hello","attachmentId","attachment","requestId",UUID.randomUUID().toString()),400);
        Map<String,Object> caption=data(call("POST",path+"/messages",bt,map("stickerId","thanks","content","一起参加活动吧","requestId",UUID.randomUUID().toString()),200));assertEquals("一起参加活动吧",s(caption,"content"));assertFalse(caption.containsKey("stickerOnly"));
        call("POST",path+"/action",bt,map("action","block"),200);call("POST",path+"/messages",at,map("stickerId","hello","requestId",UUID.randomUUID().toString()),409);
    }
    @Test void recalledStickersDoNotReappearInHistoryPreviewOrRetries() throws Exception {
        Map<String,Object> a=account(true),b=account(true),room=chatRequest(a,b);String path="/chat/conversations/"+s(room,"id"),at=s(a,"token"),bt=s(b,"token");call("POST",path+"/action",bt,map("action","accept"),200);
        Map<String,Object> body=map("stickerId","hug","requestId",UUID.randomUUID().toString()),sent=data(call("POST",path+"/messages",at,body,200));
        String recall="/chat/messages/"+s(sent,"id")+"/recall";call("POST",recall,bt,null,403);call("POST",recall,at,null,200);
        Map<String,Object> retry=data(call("POST",path+"/messages",at,body,200));assertEquals(true,retry.get("recalled"));assertFalse(retry.containsKey("sticker"));assertFalse(retry.containsKey("content"));
        assertEquals("一条消息已撤回",s(list("/chat/conversations",bt).get(0),"preview"));
        assertFalse(json.writeValueAsString(data(call("GET",path,bt,null,200))).contains("抱抱"));
        Map<String,Object> expired=store.get("chat_message",s(data(call("POST",path+"/messages",at,map("stickerId","care","requestId",UUID.randomUUID().toString()),200)),"id"));expired.put("createdAt",Instant.now().minusSeconds(121).toString());store.save("chat_message",expired);call("POST","/chat/messages/"+s(expired,"id")+"/recall",at,null,409);
    }
    @Test void groupStickersRemainPrivateAndCannotBeSentAfterLeavingOrClosure() throws Exception {
        String token=s(account(true),"token");Map<String,Object> room=data(call("POST","/chat/groups",admin,map("title","表情测试群","description","隔离测试"),200));String path="/chat/conversations/"+s(room,"id");
        call("POST",path+"/messages",admin,map("stickerId","meet","requestId",UUID.randomUUID().toString()),200);
        assertFalse(json.writeValueAsString(list("/chat/groups",token)).contains("期待相聚"));call("GET",path,token,null,403);
        call("POST",path+"/action",token,map("action","join"),200);assertTrue(json.writeValueAsString(data(call("GET",path,token,null,200))).contains("期待相聚"));
        call("POST",path+"/messages",token,map("stickerId","great","requestId",UUID.randomUUID().toString()),200);call("POST",path+"/action",token,map("action","leave"),200);
        call("POST",path+"/messages",token,map("stickerId","hello","requestId",UUID.randomUUID().toString()),403);call("GET",path,token,null,403);
        call("POST",path+"/action",admin,map("action","close"),200);call("POST",path+"/messages",admin,map("stickerId","hello","requestId",UUID.randomUUID().toString()),409);
    }
    @Test void privateChatRequiresAcceptanceAndNoAdministratorBypass() throws Exception {
        Map<String,Object> a=account(true),b=account(true),other=account(true),room=chatRequest(a,b);String path="/chat/conversations/"+s(room,"id"),at=s(a,"token"),bt=s(b,"token");
        assertEquals(s(room,"id"),s(chatRequest(a,b),"id"));assertEquals(0,list("/chat/conversations",s(other,"token")).size());call("GET",path,admin,null,403);call("GET",path,s(other,"token"),null,403);
        call("POST",path+"/messages",at,map("content","还未同意","requestId",UUID.randomUUID().toString()),409);call("POST",path+"/action",at,map("action","accept"),403);
        assertEquals(1,((Number)data(call("GET","/chat/unread",bt,null,200)).get("count")).intValue());
        call("POST",path+"/action",bt,map("action","accept"),200);chatMessage(path,at,"PRIVATE-CHAT-CONTENT");
        Map<String,Object> view=data(call("GET",path,bt,null,200));assertEquals(2,((List<?>)view.get("messages")).size());call("POST",path+"/read",bt,map("sequence",999),400);call("POST",path+"/read",bt,map("sequence",2),200);
        assertEquals(0,((Number)data(call("GET","/chat/unread",bt,null,200)).get("count")).intValue());assertFalse(json.writeValueAsString(list("/admin/audit",admin)).contains("PRIVATE-CHAT-CONTENT"));
        call("POST",path+"/action",bt,map("action","block"),200);call("POST",path+"/messages",at,map("content","屏蔽后","requestId",UUID.randomUUID().toString()),409);call("POST",path+"/action",at,map("action","unblock"),403);call("POST",path+"/action",bt,map("action","unblock"),200);chatMessage(path,at,"恢复后可以继续聊天");
    }
    @Test void chatSendRetryCountsOnceAndOnlySenderCanRecallWithinTwoMinutes() throws Exception {
        Map<String,Object> a=account(true),b=account(true),room=chatRequest(a,b);String path="/chat/conversations/"+s(room,"id"),at=s(a,"token"),bt=s(b,"token");call("POST",path+"/action",bt,map("action","accept"),200);
        Map<String,Object> body=map("content","并发消息不能重复","requestId",UUID.randomUUID().toString());assertEquals(Arrays.asList(200,200),concurrentPosts(path+"/messages",Arrays.asList(at,at),body));assertEquals(2,store.all("chat_message").size());
        Map<String,Object> row=chatMessage(path,at,"可撤回的消息");String recall="/chat/messages/"+s(row,"id")+"/recall";call("POST",recall,bt,null,403);call("POST",recall,at,null,200);assertFalse(json.writeValueAsString(data(call("GET",path,bt,null,200))).contains("可撤回的消息"));
        row=chatMessage(path,at,"超时的消息");row.put("createdAt",Instant.now().minusSeconds(121).toString());store.save("chat_message",row);call("POST","/chat/messages/"+s(row,"id")+"/recall",at,null,409);
        body.put("content","重复编号不同内容");call("POST",path+"/messages",at,body,409);
    }
    @Test void groupMembershipIsVoluntaryAndHistoryIsProtectedAfterLeaving() throws Exception {
        String token=s(account(true),"token"),other=s(account(true),"token");Map<String,Object> input=map("title","测试老乡交流群","description","自愿加入后可见群聊记录");call("POST","/chat/groups",token,input,403);Map<String,Object> group=data(call("POST","/chat/groups",admin,input,200));String path="/chat/conversations/"+s(group,"id");
        chatMessage(path,admin,"ONLY-GROUP-MEMBERS-CAN-READ");call("GET",path,token,null,403);assertFalse(json.writeValueAsString(list("/chat/groups",token)).contains("ONLY-GROUP-MEMBERS-CAN-READ"));
        call("POST",path+"/action",token,map("action","join"),200);assertTrue(json.writeValueAsString(data(call("GET",path,token,null,200))).contains("ONLY-GROUP-MEMBERS-CAN-READ"));chatMessage(path,token,"我自愿加入交流");
        call("POST",path+"/action",token,map("action","close"),403);call("POST",path+"/action",admin,map("action","leave"),409);call("POST",path+"/action",token,map("action","leave"),200);call("GET",path,token,null,403);
        call("POST",path+"/action",admin,map("action","close"),200);call("POST",path+"/action",other,map("action","join"),409);call("POST",path+"/messages",admin,map("content","已结束","requestId",UUID.randomUUID().toString()),409);
    }
    @Test void chatHistoryPaginatesAndUnapprovedAccountsCannotChat() throws Exception {
        Map<String,Object> a=account(true),b=account(true);call("GET","/chat/conversations",s(account(false),"token"),null,403);
        Map<String,Object> room=chatRequest(a,b);String path="/chat/conversations/"+s(room,"id"),at=s(a,"token"),bt=s(b,"token");call("POST",path+"/action",bt,map("action","accept"),200);
        for(int i=0;i<52;i++)chatMessage(path,at,"顺序消息"+i);
        Map<String,Object> view=data(call("GET",path,bt,null,200));assertEquals(50,((List<?>)view.get("messages")).size());assertEquals(true,view.get("hasMore"));Map<String,Object> earlier=data(call("GET",path+"?before=4",bt,null,200));assertEquals(3,((List<?>)earlier.get("messages")).size());assertEquals(false,earlier.get("hasMore"));
        Map<?,?> first=(Map<?,?>)((List<?>)earlier.get("messages")).get(0);String recalledId=String.valueOf(first.get("id"));
        call("POST","/chat/messages/"+recalledId+"/recall",at,null,200);
        view=data(call("GET",path,bt,null,200));assertTrue(((List<?>)view.get("recalledIds")).contains(recalledId));
        assertFalse(((List<?>)view.get("messages")).stream().anyMatch(m->recalledId.equals(((Map<?,?>)m).get("id"))));
        assertFalse(json.writeValueAsString(data(call("GET",path+"?before=4",bt,null,200))).contains("老乡你好，想一起聊聊活动安排。"));
    }
    byte[] testImage() throws Exception {java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(2,2,java.awt.image.BufferedImage.TYPE_INT_RGB),"png",out);return out.toByteArray();}
    Map<String,Object> upload(String token,String scope,String room,String filename,byte[] content,int expected) throws Exception {
        String result=mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart("/media/upload").file(new org.springframework.mock.web.MockMultipartFile("file",filename,"application/octet-stream",content)).param("scope",scope).param("roomId",room).header("Authorization","Bearer "+token)).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);return json.readValue(result,Map.class);
    }
    void mediaStatus(String id,String token,int expected) throws Exception {MockHttpServletRequestBuilder builder=request(HttpMethod.GET,"/media/"+id);if(token!=null)builder.header("Authorization","Bearer "+token);mvc.perform(builder).andExpect(status().is(expected));}
    @Test void superadminProtectsManagementRolesAndModeratorScope() throws Exception {
        Map<String,Object> ordinary=account(true),moderator=account(true),member=account(true),root=data(call("GET","/auth/me",admin,null,200));
        call("POST","/admin/members/"+s(ordinary,"id")+"/access",admin,map("role","admin","enabled",true),200);
        String normal=token(call("POST","/auth/login",null,map("username",s(ordinary,"phone"),"password","TestMemberPassword2026"),200));
        call("POST","/admin/members/"+s(member,"id")+"/access",normal,map("role","superadmin","enabled",true),403);
        call("POST","/admin/members/"+s(root,"id")+"/reset-password",normal,map("password","UnauthorizedReset2026"),403);
        call("POST","/admin/members/"+s(root,"id")+"/access",admin,map("role","admin","enabled",true),409);
        call("POST","/admin/members/"+s(moderator,"id")+"/access",admin,map("role","moderator","enabled",true,"forumBoards",Arrays.asList("乡情闲聊")),200);
        String mod=token(call("POST","/auth/login",null,map("username",s(moderator,"phone"),"password","TestMemberPassword2026"),200));
        call("GET","/admin/members",mod,null,403);Map<String,Object> allowed=topic(s(member,"token")),other=data(call("POST","/forum/topics",s(member,"token"),map("title","其他板块话题","category","苏州生活","content","其他板块中的测试内容，防止版主越权。"),200));
        call("POST","/forum/topics/"+s(allowed,"id")+"/review",mod,map("status","approved","note",""),200);call("POST","/forum/topics/"+s(other,"id")+"/review",mod,map("status","approved","note",""),403);
    }
    @Test void forumFloorsQuotesForwardingAndDeletionRespectVisibility() throws Exception {
        String token=s(account(true),"token");Map<String,Object> original=topic(token);String path="/forum/topics/"+s(original,"id");call("POST",path+"/review",admin,map("status","approved","note",""),200);
        Map<String,Object> first=data(call("POST",path+"/replies",token,map("content","第一层引用测试"),200));call("POST","/forum/replies/"+s(first,"id")+"/review",admin,map("status","approved","note",""),200);
        Map<String,Object> second=data(call("POST",path+"/replies",token,map("content","第二层回复测试","parentId",s(first,"id")),200));assertEquals(1,first.get("floor"));assertEquals(2,second.get("floor"));call("POST","/forum/replies/"+s(second,"id")+"/review",admin,map("status","approved","note",""),200);
        Map<String,Object> forwarded=data(call("POST","/forum/topics",token,map("title","转发一条值得讨论的话题","category","乡情闲聊","content","分享原帖供大家一起交流讨论。","forwardedTopicId",s(original,"id")),200));String target="/forum/topics/"+s(forwarded,"id");call("POST",target+"/review",admin,map("status","approved","note",""),200);
        assertTrue(json.writeValueAsString(call("GET",target,null,null,200)).contains("分享在苏州生活的经验"));call("POST",path+"/review",admin,map("status","hidden","note","内容暂时隐藏"),200);assertFalse(json.writeValueAsString(call("GET",target,null,null,200)).contains("分享在苏州生活的经验"));
        call("POST","/forum/replies/"+s(first,"id")+"/delete",token,map("note","作者删除回复"),200);assertFalse(json.writeValueAsString(call("GET",path,token,null,200)).contains("第一层引用测试"));
    }
    @Test void kickedSourceBoardHidesForwardedContentWithoutHidingTargetTopic() throws Exception {
        Map<String,Object> sourceOwner=account(true),forwarder=account(true);String sourceToken=s(sourceOwner,"token"),forwarderToken=s(forwarder,"token");
        Map<String,Object> source=topic(sourceToken);String sourcePath="/forum/topics/"+s(source,"id");call("POST",sourcePath+"/review",admin,map("status","approved","note",""),200);
        Map<String,Object> forwarded=data(call("POST","/forum/topics",forwarderToken,map("title","跨板块转发测试","category","苏州生活","content","转发内容仍可见，但原板块被移出后不应泄露原文。","forwardedTopicId",s(source,"id")),200));String target="/forum/topics/"+s(forwarded,"id");call("POST",target+"/review",admin,map("status","approved","note",""),200);
        call("POST","/forum/restrictions",admin,map("board","乡情闲聊","userId",s(forwarder,"id"),"action","kick","reason","测试移出板块"),200);
        String body=json.writeValueAsString(call("GET",target,forwarderToken,null,200));assertTrue(body.contains("跨板块转发测试"));assertFalse(body.contains("分享在苏州生活的经验"));assertTrue(body.contains("unavailable"));
    }
    @Test void boardRestrictionsAndPersonalBlocksPreventFurtherContact() throws Exception {
        Map<String,Object> a=account(true),b=account(true);String at=s(a,"token"),bt=s(b,"token");
        call("POST","/forum/restrictions",admin,map("board","乡情闲聊","userId",s(b,"id"),"action","mute","reason","测试板块禁言"),200);
        call("POST","/forum/topics",bt,map("title","禁言时发帖","category","乡情闲聊","content","这条测试帖子应该被后端拒绝。"),403);
        call("POST","/forum/restrictions",admin,map("board","乡情闲聊","userId",s(b,"id"),"action","restore","reason","恢复正常参与"),200);topic(bt);
        call("POST","/members/"+s(b,"id")+"/block",at,map("active",true),200);call("POST","/chat/direct",bt,map("recipientId",s(a,"id"),"content","拉黑后不可申请私聊"),403);
        call("POST","/members/"+s(b,"id")+"/block",at,map("active",false),200);chatRequest(b,a);
    }
    @Test void privateAttachmentsRequireMembershipAndRecallRevokesDownloads() throws Exception {
        Map<String,Object> a=account(true),b=account(true),other=account(true),room=chatRequest(a,b);String path="/chat/conversations/"+s(room,"id"),at=s(a,"token"),bt=s(b,"token");
        upload(at,"chat",s(room,"id"),"photo.png",testImage(),409);call("POST",path+"/action",bt,map("action","accept"),200);
        Map<String,Object> file=data(upload(at,"chat",s(room,"id"),"photo.png",testImage(),200));String id=s(file,"id");mediaStatus(id,bt,403);mediaStatus(id,null,401);
        Map<String,Object> message=data(call("POST",path+"/messages",at,map("content","","attachmentId",id,"requestId",UUID.randomUUID().toString()),200));mediaStatus(id,bt,200);mediaStatus(id,s(other,"token"),403);mediaStatus(id,admin,403);
        call("POST","/chat/messages/"+s(message,"id")+"/recall",at,null,200);mediaStatus(id,bt,404);mediaStatus(id,at,404);
        upload(at,"chat",s(room,"id"),"bad.svg","<svg/>".getBytes(),400);upload(at,"chat",s(room,"id"),"fake.jpg","not an image".getBytes(),400);
    }
    @Test void galleryOnlyPublishesRealImagesAndHidesWithdrawnPhotos() throws Exception {
        String token=s(account(true),"token");upload(token,"album","","photo.png",testImage(),403);Map<String,Object> image=data(upload(admin,"album","","photo.png",testImage(),200));String id=s(image,"id");mediaStatus(id,null,404);
        Map<String,Object> album=data(call("POST","/albums",admin,map("title","测试活动相册","description","真实上传图片的测试","date","2026-10-27","location","测试地点","status","published"),200));
        Map<String,Object> photo=data(call("POST","/albums/"+s(album,"id")+"/photos",admin,map("mediaId",id,"caption","活动照片","status","published"),200));mediaStatus(id,null,200);
        call("POST","/album-photos/"+s(photo,"id"),admin,map("status","hidden","caption","撤下照片"),200);mediaStatus(id,null,404);
    }
    @Test void locationCheckinValidatesDistanceAndTimeWithoutStoringCoordinates() throws Exception {
        Map<String,Object> a=account(true),event=event(2,"公益志愿");String at=s(a,"token"),path="/events/"+s(event,"id");call("POST",path+"/signup",at,null,200);
        event.put("startsAt",Instant.now().minusSeconds(60).toString());event.put("endsAt",Instant.now().plusSeconds(7200).toString());store.save("event",event);
        Map<String,Object> settings=map("enabled",true,"latitude",31.3,"longitude",120.6,"radius",200,"opensAt",Instant.now().minusSeconds(60).toString(),"closesAt",Instant.now().plusSeconds(600).toString());call("PUT",path+"/checkin-config",at,settings,403);call("PUT",path+"/checkin-config",admin,settings,200);
        call("POST",path+"/self-check-in",at,map("latitude",32.3,"longitude",120.6,"accuracy",10),409);call("POST",path+"/self-check-in",at,map("latitude",31.3,"longitude",120.6,"accuracy",500),400);call("POST",path+"/self-check-in",at,map("latitude",31.3,"longitude",120.6,"accuracy",10,"code","invalid"),409);
        Map<String,Object> result=data(call("POST",path+"/self-check-in",at,map("latitude",31.3,"longitude",120.6,"accuracy",10),200));assertEquals("checked_in",s(result,"status"));assertFalse(result.containsKey("latitude"));assertEquals(0,result.get("hours"));
        call("POST",path+"/self-check-in",at,map(),200);call("POST",path+"/check-in",admin,map("userId",s(a,"id"),"hours",1),200);assertEquals(1.0,((Number)store.get("signup",s(event,"id")+":"+s(a,"id")).get("hours")).doubleValue());
    }
    Map<String,Object> product(int stock) throws Exception {String image=s(data(upload(admin,"product","","product.png",testImage(),200)),"id");return data(call("POST","/products",admin,map("title","测试家乡特产","category","家乡美食","description","这是隔离测试中的特产，不是真实销售商品。","specification","500克每袋","origin","江苏沭阳","seller","测试供货商","sellerContact","13812345678","afterSales","收到商品有疑问请联系卖家协商处理。","price","12.50","shippingFee","5.00","stock",stock,"images",Arrays.asList(image),"status","published"),200));}
    Map<String,Object> orderBody(String product,String request){return map("productId",product,"requestId",request,"quantity",1,"delivery","shipping","name","测试买家","phone","13812345678","address","测试收货地址，不是真实地址","consent",true);}
    @Test void shopReservesStockAtomicallyAndCancellationReturnsItOnce() throws Exception {
        Map<String,Object> product=product(1),a=account(true),b=account(true);Map<String,Object> body=orderBody(s(product,"id"),UUID.randomUUID().toString());List<Integer> results=concurrentPosts("/orders",Arrays.asList(s(a,"token"),s(b,"token")),body);assertTrue(results.contains(200));assertTrue(results.contains(409));assertEquals(1,store.all("order").size());Map<String,Object> order=store.all("order").get(0);String token=s(order,"buyerId").equals(s(a,"id"))?s(a,"token"):s(b,"token"),other=token.equals(s(a,"token"))?s(b,"token"):s(a,"token");
        call("POST","/orders",token,body,200);assertEquals(1,store.all("order").size());assertEquals(0,list("/orders",other).size());assertEquals(1750L,((Number)order.get("totalCents")).longValue());String path="/orders/"+s(order,"id")+"/action";call("POST",path,other,map("action","cancel"),403);call("POST",path,token,map("action","cancel"),200);call("POST",path,token,map("action","cancel"),200);assertEquals(1,store.get("product",s(product,"id")).get("stock"));
    }
    @Test void shopOfflineSettlementAndFulfillmentRequireExplicitStaffConfirmation() throws Exception {
        Map<String,Object> p=product(2),a=account(true);String token=s(a,"token");Map<String,Object> order=data(call("POST","/orders",token,orderBody(s(p,"id"),UUID.randomUUID().toString()),200));String path="/orders/"+s(order,"id")+"/action";
        call("POST",path,token,map("action","settle","verified",true,"note","声称已经付款"),403);call("POST",path,admin,map("action","confirm"),200);call("POST",path,admin,map("action","settle","verified",true,"note","已核实线下结算记录"),200);call("POST",path,token,map("action","cancel"),409);call("POST",path,admin,map("action","ship","note","测试物流运单号123456"),200);Map<String,Object> done=data(call("POST",path,token,map("action","receive"),200));assertEquals("completed",s(done,"status"));assertEquals("confirmed",s(done,"settlement"));
    }
    @Test void staleProductEditorCannotOverwriteStockReservedByNewOrders() throws Exception {
        Map<String,Object> p=product(2);p.put("price","12.50");p.put("shippingFee","5.00");String token=s(account(true),"token");
        call("POST","/orders",token,orderBody(s(p,"id"),UUID.randomUUID().toString()),200);
        call("POST","/products",admin,p,409);assertEquals(1,store.get("product",s(p,"id")).get("stock"));
    }
    byte[] testAudio() {
        java.nio.ByteBuffer wav=java.nio.ByteBuffer.allocate(1644).order(java.nio.ByteOrder.LITTLE_ENDIAN);
        wav.put("RIFF".getBytes(java.nio.charset.StandardCharsets.US_ASCII)).putInt(1636).put("WAVEfmt ".getBytes(java.nio.charset.StandardCharsets.US_ASCII)).putInt(16).putShort((short)1).putShort((short)1).putInt(8000).putInt(16000).putShort((short)2).putShort((short)16).put("data".getBytes(java.nio.charset.StandardCharsets.US_ASCII)).putInt(1600);
        return wav.array();
    }
    @Test void forumAudioRejectsInvalidFormatsOversizeAndWrongScope() throws Exception {
        String token=s(account(true),"token");
        upload(token,"forum","","fake.mp3","not an audio recording".getBytes(),400);
        assertEquals("image",s(data(upload(token,"forum","","photo.png",testImage(),200)),"type"));
        upload(token,"forum","","sound.wav",new byte[10*1024*1024+1],413);
        upload(s(account(false),"token"),"forum","","sound.wav",testAudio(),403);
        Map<String,Object> audio=data(upload(token,"forum","","sound.wav",testAudio(),200));assertEquals("audio",s(audio,"type"));assertEquals("audio/wav",s(audio,"mime"));
        mediaStatus(s(audio,"id"),null,404);mediaStatus(s(audio,"id"),admin,404);mediaStatus(s(audio,"id"),token,200);
        upload(admin,"album","","sound.wav",testAudio(),400);
    }
    @Test void topicAudioFollowsReviewDeletionBoardRestrictionsAndBlocks() throws Exception {
        Map<String,Object> a=account(true),b=account(true);String at=s(a,"token"),bt=s(b,"token");
        String audio=s(data(upload(at,"forum","","topic.wav",testAudio(),200)),"id");
        Map<String,Object> topic=data(call("POST","/forum/topics",at,map("title","语音乡情分享","category","乡情闲聊","content","","audioId",audio),200));String path="/forum/topics/"+s(topic,"id");
        assertTrue(topic.get("audio") instanceof Map);mediaStatus(audio,null,404);mediaStatus(audio,bt,404);mediaStatus(audio,admin,200);mediaStatus(audio,at,200);
        call("POST",path+"/review",admin,map("status","approved","note",""),200);mediaStatus(audio,null,200);
        call("POST",path+"/review",admin,map("status","hidden","note","隐藏语音内容"),200);mediaStatus(audio,null,404);mediaStatus(audio,at,200);
        call("POST",path+"/review",admin,map("status","approved","note",""),200);
        call("POST","/forum/restrictions",admin,map("board","乡情闲聊","userId",s(b,"id"),"action","kick","reason","移出板块验收"),200);mediaStatus(audio,bt,404);
        call("POST","/forum/restrictions",admin,map("board","乡情闲聊","userId",s(b,"id"),"action","restore","reason","恢复板块验收"),200);
        call("POST","/members/"+s(a,"id")+"/block",bt,map("active",true),200);mediaStatus(audio,bt,404);
        call("POST",path+"/delete",at,map("note","删除语音话题"),200);mediaStatus(audio,null,404);mediaStatus(audio,at,404);mediaStatus(audio,admin,404);assertFalse(store.get("forum_topic",s(topic,"id")).containsKey("audio"));
    }
    @Test void replyAudioCannotBeStolenReusedOrReadThroughHiddenParent() throws Exception {
        Map<String,Object> a=account(true),b=account(true);String at=s(a,"token"),bt=s(b,"token");
        Map<String,Object> parent=topic(bt);String path="/forum/topics/"+s(parent,"id");call("POST",path+"/review",admin,map("status","approved","note",""),200);
        String audio=s(data(upload(at,"forum","","reply.wav",testAudio(),200)),"id");
        call("POST",path+"/replies",bt,map("content","","audioId",audio),403);
        Map<String,Object> reply=data(call("POST",path+"/replies",at,map("content","","audioId",audio),200));String replyPath="/forum/replies/"+s(reply,"id");
        mediaStatus(audio,null,404);mediaStatus(audio,bt,404);mediaStatus(audio,at,200);mediaStatus(audio,admin,200);
        call("POST",path+"/replies",at,map("content","重复使用已发音频","audioId",audio),403);
        call("POST",replyPath+"/review",admin,map("status","approved","note",""),200);mediaStatus(audio,null,200);
        call("POST",path+"/review",admin,map("status","hidden","note","隐藏整条话题"),200);mediaStatus(audio,null,404);mediaStatus(audio,at,404);
        call("POST",path+"/review",admin,map("status","approved","note",""),200);mediaStatus(audio,null,200);
        call("POST",replyPath+"/delete",at,map("note","删除语音回复"),200);mediaStatus(audio,null,404);mediaStatus(audio,admin,404);
        assertFalse(json.writeValueAsString(call("GET",path,null,null,200)).contains(audio));
    }
    @Test void forumPhotosFollowReviewBlocksRestrictionsAndDeletion() throws Exception {
        Map<String,Object> a=account(true),b=account(true);String at=s(a,"token"),bt=s(b,"token");
        String photo=s(data(upload(at,"forum","","moment.png",testImage(),200)),"id");
        mediaStatus(photo,null,404);mediaStatus(photo,bt,404);mediaStatus(photo,at,200);
        Map<String,Object> topic=data(call("POST","/forum/topics",at,map("title","照片乡情分享","category","乡情闲聊","content","","photoIds",Arrays.asList(photo)),200));
        String path="/forum/topics/"+s(topic,"id");assertEquals(1,((List<?>)topic.get("photos")).size());
        mediaStatus(photo,null,404);mediaStatus(photo,bt,404);mediaStatus(photo,admin,200);
        call("POST",path+"/review",admin,map("status","approved","note",""),200);mediaStatus(photo,null,200);
        call("POST",path+"/review",admin,map("status","hidden","note","隐藏照片内容"),200);mediaStatus(photo,null,404);mediaStatus(photo,at,200);
        call("POST",path+"/review",admin,map("status","approved","note",""),200);
        call("POST","/forum/restrictions",admin,map("board","乡情闲聊","userId",s(b,"id"),"action","kick","reason","移出版块验收"),200);mediaStatus(photo,bt,404);
        call("POST","/forum/restrictions",admin,map("board","乡情闲聊","userId",s(b,"id"),"action","restore","reason","恢复板块验收"),200);
        call("POST","/members/"+s(a,"id")+"/block",bt,map("active",true),200);mediaStatus(photo,bt,404);
        call("POST",path+"/delete",at,map("note","删除照片话题"),200);mediaStatus(photo,null,404);mediaStatus(photo,at,404);mediaStatus(photo,admin,404);
        assertFalse(store.get("forum_topic",s(topic,"id")).containsKey("photos"));
    }
    @Test void forumPhotosRejectInvalidListsTheftReuseAndWrongAttachmentKinds() throws Exception {
        String at=s(account(true),"token"),bt=s(account(true),"token");
        String photo=s(data(upload(at,"forum","","moment.png",testImage(),200)),"id"), foreign=s(data(upload(bt,"forum","","other.png",testImage(),200)),"id");
        Map<String,Object> body=map("title","验证照片权限","category","乡情闲聊","content","","photoIds",Arrays.asList(photo,foreign));
        call("POST","/forum/topics",at,body,403);assertFalse(b(store.get("attachment",photo),"linked"));
        body.put("photoIds",Arrays.asList(photo,photo));call("POST","/forum/topics",at,body,400);
        body.put("photoIds",Collections.nCopies(10,photo));call("POST","/forum/topics",at,body,400);
        body.put("photoIds",photo);call("POST","/forum/topics",at,body,400);
        String audio=s(data(upload(at,"forum","","voice.wav",testAudio(),200)),"id");body.put("photoIds",Arrays.asList(audio));call("POST","/forum/topics",at,body,403);
        body.put("photoIds",Collections.emptyList());body.put("audioId",photo);call("POST","/forum/topics",at,body,403);body.remove("audioId");
        String album=s(data(upload(admin,"album","","album.png",testImage(),200)),"id");body.put("photoIds",Arrays.asList(album));call("POST","/forum/topics",admin,body,403);
        body.put("photoIds",Arrays.asList(photo));call("POST","/forum/topics",at,body,200);call("POST","/forum/topics",at,body,403);
        upload(at,"forum","","bad.png","not an image".getBytes(),400);upload(at,"forum","","large.jpg",new byte[8*1024*1024+1],413);
        upload(s(account(false),"token"),"forum","","pending.png",testImage(),403);
    }
    @Test void replyPhotosAndForwardedPhotosRespectParentVisibility() throws Exception {
        String at=s(account(true),"token"),bt=s(account(true),"token");Map<String,Object> parent=topic(bt);String path="/forum/topics/"+s(parent,"id");
        call("POST",path+"/review",admin,map("status","approved","note",""),200);
        String photo=s(data(upload(at,"forum","","reply.png",testImage(),200)),"id");
        Map<String,Object> reply=data(call("POST",path+"/replies",at,map("content","","photoIds",Arrays.asList(photo)),200));String replyPath="/forum/replies/"+s(reply,"id");
        mediaStatus(photo,null,404);call("POST",replyPath+"/review",admin,map("status","approved","note",""),200);mediaStatus(photo,null,200);
        call("POST",path+"/review",admin,map("status","hidden","note","隐藏整条话题"),200);mediaStatus(photo,null,404);mediaStatus(photo,at,404);
        call("POST",path+"/review",admin,map("status","approved","note",""),200);mediaStatus(photo,null,200);
        call("POST",replyPath+"/delete",at,map("note","删除照片回复"),200);mediaStatus(photo,null,404);mediaStatus(photo,admin,404);
        assertFalse(json.writeValueAsString(call("GET",path,null,null,200)).contains(photo));
        String originalPhoto=s(data(upload(at,"forum","","original.png",testImage(),200)),"id");
        Map<String,Object> original=data(call("POST","/forum/topics",at,map("title","分享家乡照片","category","乡情闲聊","content","","photoIds",Arrays.asList(originalPhoto)),200));
        String originalPath="/forum/topics/"+s(original,"id");call("POST",originalPath+"/review",admin,map("status","approved","note",""),200);
        Map<String,Object> forward=data(call("POST","/forum/topics",bt,map("title","转发家乡照片","category","乡情闲聊","content","这是一段关于家乡照片的转发说明","forwardedTopicId",s(original,"id")),200));
        String forwardPath="/forum/topics/"+s(forward,"id");call("POST",forwardPath+"/review",admin,map("status","approved","note",""),200);
        assertTrue(json.writeValueAsString(call("GET",forwardPath,null,null,200)).contains(originalPhoto));
        call("POST",originalPath+"/review",admin,map("status","hidden","note","隐藏原帖照片"),200);
        assertFalse(json.writeValueAsString(call("GET",forwardPath,null,null,200)).contains(originalPhoto));mediaStatus(originalPhoto,null,404);
    }
    @Test void noticesCanBeWithdrawnAndInputValidationReturnsClientErrors() throws Exception {
        Map<String,Object> person=account(true);call("POST","/notices",s(person,"token"),map(),403);
        Map<String,Object> notice=data(call("POST","/notices",admin,map("title","平台公告测试","content","欢迎所有老乡自愿参与活动。","category","平台公告","status","published"),200));
        assertEquals(1,((List<?>)call("GET","/notices",null,null,200).get("data")).size());notice.put("status","withdrawn");call("PUT","/notices/"+s(notice,"id"),admin,notice,200);assertEquals(0,((List<?>)call("GET","/notices",null,null,200).get("data")).size());
        call("POST","/events",admin,map("startsAt","invalid","endsAt","invalid"),400);
        call("GET","/admin/audit",s(person,"token"),null,403);assertFalse(((List<?>)call("GET","/admin/audit",admin,null,200).get("data")).isEmpty());
    }
}
