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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Instant;
import java.util.*;
import static com.example.Kcsj.membership.MemberStore.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:work-tests;DB_CLOSE_DELAY=-1", "shuyang.admin-password=TestInitialAdmin2026", "shuyang.data-key="})
@AutoConfigureMockMvc
class WorkCenterTests {
    @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired JdbcTemplate jdbc;
    @Autowired MemberStore store; @Autowired MemberAuth auth; @Autowired PlatformTransactionManager transactions;
    String admin; int sequence;
    @BeforeEach void setup() throws Exception {
        jdbc.update("DELETE FROM syh_record");jdbc.update("DELETE FROM syh_session");jdbc.update("DELETE FROM syh_attachment");auth.bootstrap();sequence=0;
        String initial=s(data(call("POST","/auth/login",null,map("username","admin","password","TestInitialAdmin2026"),200)),"token");
        admin=s(data(call("POST","/auth/password",initial,map("oldPassword","TestInitialAdmin2026","newPassword","TestChangedAdmin2026"),200)),"token");
    }
    @SuppressWarnings("unchecked") Map<String,Object> call(String method,String path,String token,Object body,int expected) throws Exception {
        MockHttpServletRequestBuilder req=request(HttpMethod.valueOf(method),path).with(r->{r.setRemoteAddr(UUID.randomUUID().toString());return r;});
        if(token!=null)req.header("Authorization","Bearer "+token);if(body!=null)req.contentType("application/json").content(json.writeValueAsBytes(body));
        return json.readValue(mvc.perform(req).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8),Map.class);
    }
    @SuppressWarnings("unchecked") Map<String,Object> data(Map<String,Object> r){return (Map<String,Object>)r.get("data");}
    @SuppressWarnings("unchecked") List<Map<String,Object>> rows(Map<String,Object> r){return (List<Map<String,Object>>)r.get("items");}
    @SuppressWarnings("unchecked") Map<String,Object> account(boolean approved) throws Exception {
        Map<String,Object> r=data(call("POST","/auth/register",null,map("phone","1380000"+String.format("%04d",++sequence),"password","TestMemberPassword2026","name","事项测试会员","hometown","沭阳沭城","district","苏州吴中","industry","服务业","bio","参与公益互助活动","consent",true,"volunteer",true,"directoryVisible",false,"phoneVisible",false),200));
        String id=s((Map<String,Object>)r.get("user"),"id");if(approved)call("POST","/admin/members/"+id+"/review",admin,map("status","approved","note",""),200);
        return map("id",id,"token",s(r,"token"));
    }
    Map<String,Object> input(){return map("title","寻找同行伙伴","content","希望寻找一起参加社区志愿活动的老乡。","category","生活互助","contact","测试联络信息","district","苏州吴中","validDays",30);}
    Map<String,Object> post(Map<String,Object> a) throws Exception {Map<String,Object> p=data(call("POST","/posts",s(a,"token"),input(),200));return data(call("POST","/posts/"+s(p,"id")+"/review",admin,map("status","approved"),200));}
    Map<String,Object> event() throws Exception {return data(call("POST","/events",admin,map("title","事项测试活动","category","公益志愿","location","测试场地","startsAt",Instant.now().plusSeconds(7200).toString(),"endsAt",Instant.now().plusSeconds(14400).toString(),"capacity",20,"status","published","description","仅用于集成测试的活动资料。"),200));}
    Map<String,Object> inbox(Map<String,Object> a) throws Exception{return data(call("GET","/work/notices",s(a,"token"),null,200));}
    Map<String,Object> target(Map<String,Object> a,String kind,String id) throws Exception{return data(call("GET","/work/target?kind="+kind+"&id="+id,s(a,"token"),null,200));}
    void clearNotices(){jdbc.update("DELETE FROM syh_record WHERE kind='business_notice'");}

    @Test void pendingAndOrdinaryAccountsCannotAccessOtherMembersOrManagement() throws Exception {
        Map<String,Object> a=account(true),b=account(false);Map<String,Object> p=post(a);
        call("GET","/work/items",null,null,401);call("GET","/work/items?manage=true",s(a,"token"),null,403);
        call("GET","/work/target?kind=post&id="+s(p,"id"),s(b,"token"),null,404);
        Map<String,Object> mine=data(call("GET","/work/items",s(b,"token"),null,200));assertEquals(1,mine.get("total"));assertEquals("user",s(rows(mine).get(0),"kind"));
        String details=json.writeValueAsString(target(a,"user",s(a,"id")));assertFalse(details.contains("passwordHash"));assertFalse(details.contains("consentVersion"));
    }
    @Test void managersAreRestrictedToTheirExistingRolesAndBoards() throws Exception {
        Map<String,Object> a=account(true),b=account(true);Map<String,Object> u=store.get("user",s(a,"id"));u.putAll(map("role","moderator","forumBoards",Arrays.asList("乡情闲聊")));store.save("user",u);
        for(String board:ForumPolicy.BOARDS)store.save("forum_topic",map("id",board,"category",board,"authorId",s(b,"id"),"status","pending","title",board,"content","论坛待审核内容","createdAt",now()));
        store.save("order",map("id","private-order","buyerId",s(b,"id"),"status","pending","title","测试订单","createdAt",now()));
        Map<String,Object> list=data(call("GET","/work/items?manage=true",s(a,"token"),null,200));assertEquals(1,list.get("total"));
        call("GET","/work/target?manage=true&kind=order&id=private-order",s(a,"token"),null,404);
        Map<String,Object> detail=data(call("GET","/work/target?manage=true&kind=forum_topic&id=乡情闲聊",s(a,"token"),null,200));assertEquals(true,detail.get("manage"));assertEquals("forum",detail.get("navigate"));assertTrue(((List<?>)detail.get("actions")).isEmpty());
        u.put("role","organizer");store.save("user",u);call("GET","/work/target?manage=true&kind=order&id=private-order",s(a,"token"),null,404);
        u.put("role","member");store.save("user",u);call("GET","/work/items?manage=true",s(a,"token"),null,403);
    }
    @Test void notificationReadSnapshotPreservesNewAndOtherMembersMessages() throws Exception {
        Map<String,Object> a=account(true),b=account(true);Map<String,Object> old=inbox(a);String first=s(rows(old).get(0),"id");
        call("POST","/work/notices/"+first+"/read",s(b,"token"),null,404);
        Map<String,Object> p=post(a);call("POST","/work/notices/read-through",s(a,"token"),map("through",old.get("through")),200);
        assertEquals(1,rows(inbox(a)).stream().filter(n->!b(n,"read")).count());assertFalse(b(rows(inbox(b)).get(0),"read"));
        call("POST","/work/notices/read-through",s(a,"token"),map("through",Long.MAX_VALUE),400);
        assertEquals(s(p,"id"),s(rows(inbox(a)).get(0),"targetId"));
    }
    @Test void businessFailureRollsBackBothStateAndNotification() throws Exception {
        Map<String,Object> a=account(false);clearNotices();
        assertThrows(IllegalStateException.class,()->new TransactionTemplate(transactions).execute(status->{store.lockWrites();Map<String,Object> u=store.get("user",s(a,"id"));u.put("status","approved");store.save("user",u);throw new IllegalStateException("test rollback");}));
        assertEquals("pending",s(store.get("user",s(a,"id")),"status"));assertEquals(0,inbox(a).get("total"));
    }
    @Test void duplicateSavesAndEventCancellationProduceOnlyOneNotification() throws Exception {
        Map<String,Object> a=account(true),e=event();clearNotices();String url="/events/"+s(e,"id");
        call("POST",url+"/signup",s(a,"token"),null,200);call("POST",url+"/signup",s(a,"token"),null,200);assertEquals(1,inbox(a).get("total"));
        Map<String,Object> signup=store.all("signup").get(0);store.save("signup",signup);assertEquals(1,inbox(a).get("total"));
        @SuppressWarnings("unchecked") Map<String,Object> checkinEvent=(Map<String,Object>)target(a,"signup",s(signup,"id")).get("event");
        assertEquals(s(e,"startsAt"),s(checkinEvent,"startsAt"));assertEquals(s(e,"endsAt"),s(checkinEvent,"endsAt"));assertEquals(s(e,"location"),s(checkinEvent,"location"));
        e.put("location","更新后的集合场地");call("PUT",url,admin,e,200);assertEquals(2,inbox(a).get("total"));
        e.put("status","cancelled");call("PUT",url,admin,e,200);assertEquals(3,inbox(a).get("total"));
        assertEquals("已取消",target(a,"signup",s(signup,"id")).get("state"));
    }
    @Test void reviewedEditsKeepPublishedVersionAndDoNotLeakDrafts() throws Exception {
        Map<String,Object> a=account(true),b=account(true),p=post(a),edit=input();edit.putAll(map("title","审核中的新标题","content","这段新内容要在审核后才能公开展示。","contact","未公开的新联络方式","editRevision",p.get("editRevision")));
        Map<String,Object> draft=data(call("PUT","/help-posts/"+s(p,"id"),s(a,"token"),edit,200));
        String publicRows=json.writeValueAsString(call("GET","/posts",null,null,200));assertTrue(publicRows.contains("寻找同行伙伴"));assertFalse(publicRows.contains("审核中的新标题"));assertFalse(publicRows.contains("editDraft"));assertFalse(publicRows.contains("history"));assertFalse(publicRows.contains("测试联络信息"));
        String memberRows=json.writeValueAsString(call("GET","/posts",s(b,"token"),null,200));assertFalse(memberRows.contains("未公开的新联络方式"));
        call("POST","/posts/"+s(p,"id")+"/review",admin,map("status","approved","editRevision",p.get("editRevision")),409);
        call("POST","/posts/"+s(p,"id")+"/review",admin,map("status","approved","editRevision",draft.get("editRevision")),200);
        assertTrue(json.writeValueAsString(call("GET","/posts",null,null,200)).contains("审核中的新标题"));
    }
    @Test void rejectedEditKeepsOriginalAndClosingCannotBeBypassed() throws Exception {
        Map<String,Object> a=account(true),p=post(a),edit=input();edit.putAll(map("title","退回版本","editRevision",p.get("editRevision")));
        Map<String,Object> draft=data(call("PUT","/help-posts/"+s(p,"id"),s(a,"token"),edit,200));
        Map<String,Object> rejected=data(call("POST","/posts/"+s(p,"id")+"/review",admin,map("status","rejected","note","请补充真实内容","editRevision",draft.get("editRevision")),200));assertEquals("寻找同行伙伴",s(rejected,"title"));
        call("POST","/posts/"+s(p,"id")+"/close",admin,null,200);
        edit.put("editRevision",HelpPostState.revision(store.get("post",s(p,"id"))));call("PUT","/help-posts/"+s(p,"id"),s(a,"token"),edit,409);
        call("POST","/posts/"+s(p,"id")+"/review",admin,map("status","approved","editRevision",edit.get("editRevision")),409);
        assertEquals("closed",HelpPostState.state(store.get("post",s(p,"id"))));
    }
    @Test void progressUsesRevisionAndExpiredPostsRequireReviewedRenewal() throws Exception {
        Map<String,Object> a=account(true),p=post(a);String url="/help-posts/"+s(p,"id")+"/progress";
        Map<String,Object> resolved=data(call("POST",url,s(a,"token"),map("progress","resolved","editRevision",p.get("editRevision"),"note","已找到帮助"),200));
        call("POST",url,s(a,"token"),map("progress","helping","editRevision",p.get("editRevision")),409);
        call("POST",url,s(a,"token"),map("progress","open","editRevision",resolved.get("editRevision")),400);
        call("POST",url,s(a,"token"),map("progress","open","editRevision",resolved.get("editRevision"),"note","仍有后续事项需要帮助"),200);
        p=store.get("post",s(p,"id"));p.put("expiresAt",Instant.now().minusSeconds(1).toString());store.save("post",p);
        call("POST",url,s(a,"token"),map("progress","helping","editRevision",p.get("editRevision")),409);
        assertEquals("expired",HelpPostState.state(p));assertEquals(1,((List<?>)target(a,"post",s(p,"id")).get("actions")).size());
        p.remove("expiresAt");assertEquals("open",HelpPostState.state(p));p.put("status","closed");assertEquals("closed",HelpPostState.state(p));
    }
    @Test void vanishedRelatedRecordDoesNotHideOtherTasks() throws Exception {
        Map<String,Object> a=account(true),e=event();call("POST","/events/"+s(e,"id")+"/signup",s(a,"token"),null,200);String signup=s(store.all("signup").get(0),"id");store.delete("event",s(e,"id"));
        Map<String,Object> list=data(call("GET","/work/items",s(a,"token"),null,200));assertEquals(2,list.get("total"));Map<String,Object> detail=target(a,"signup",signup);assertEquals("已失效",detail.get("state"));assertTrue(((List<?>)detail.get("actions")).isEmpty());assertFalse(detail.containsKey("navigate"));
    }
    @Test void contactRevocationImmediatelyRemovesCounterpartContactFromTarget() throws Exception {
        Map<String,Object> a=account(true),b=account(true);Map<String,Object> exchange=map("id","contact-test","requesterId",s(a,"id"),"recipientId",s(b,"id"),"requesterContact","A-secret","recipientContact","B-secret","status","accepted","createdAt",now());store.save("contact_exchange",exchange);
        assertTrue(json.writeValueAsString(target(a,"contact_exchange","contact-test")).contains("B-secret"));exchange.put("status","revoked");store.save("contact_exchange",exchange);
        assertFalse(json.writeValueAsString(target(a,"contact_exchange","contact-test")).contains("B-secret"));
    }
    @Test void importedSignupProducesOneNoticeAndCommitRetryDoesNotDuplicateIt() throws Exception {
        Map<String,Object> a=account(true),e=event();clearNotices();
        Map<String,Object> file=new BusinessWorkbook().write("test.xlsx",Arrays.asList("会员编号","操作"),Arrays.asList(Arrays.asList(s(store.get("user",s(a,"id")),"memberNo"),"报名")));
        file.put("kind","signups");file.put("eventId",s(e,"id"));Map<String,Object> preview=data(call("POST","/data-files/preview",admin,file,200));assertEquals(0,preview.get("invalid"));
        Map<String,Object> confirmation=map("token",s(preview,"token"),"confirmed",true);call("POST","/data-files/commit",admin,confirmation,200);call("POST","/data-files/commit",admin,confirmation,200);
        assertEquals(1,inbox(a).get("total"));assertEquals("signup",s(rows(inbox(a)).get(0),"kind"));
    }
    @Test void managementPaginationCountsAndOldestFirstShareTheSamePermissionFilter() throws Exception {
        Map<String,Object> a=account(true);for(int i=0;i<25;i++)store.save("post",map("id","queued-"+i,"authorId",s(a,"id"),"title","待审信息"+i,"status","pending","createdAt",Instant.now().minusSeconds(200000-i*60).toString()));
        Map<String,Object> first=data(call("GET","/work/items?manage=true&kind=post",admin,null,200));assertEquals(25,first.get("total"));assertEquals(20,rows(first).size());assertEquals("queued-0",s(rows(first).get(0),"id"));
        Map<String,Object> last=data(call("GET","/work/items?manage=true&kind=post&page=2",admin,null,200));assertEquals(5,rows(last).size());assertEquals("queued-20",s(rows(last).get(0),"id"));
        Map<String,Object> overdue=data(call("GET","/work/items?manage=true&kind=post&filter=overdue",admin,null,200));assertEquals(25,overdue.get("total"));
    }
    @Test void replyTargetCarriesTopicContextAndBoardRemovalRevokesAccess() throws Exception {
        Map<String,Object> a=account(true);store.save("forum_topic",map("id","topic-context","authorId",s(a,"id"),"title","相关主题","category","乡情闲聊","status","approved"));
        store.save("forum_reply",map("id","reply-context","authorId",s(a,"id"),"topicId","topic-context","content","回复说明","status","pending"));
        assertEquals("topic-context",target(a,"forum_reply","reply-context").get("topicId"));
        store.save("forum_restriction",map("id","restriction","userId",s(a,"id"),"board","乡情闲聊","action","kick","active",true));
        call("GET","/work/target?kind=forum_reply&id=reply-context",s(a,"token"),null,404);
    }
}
