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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.http.HttpMethod;
import java.time.Instant;
import java.util.*;
import static com.example.Kcsj.membership.MemberStore.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:broadcast-tests;DB_CLOSE_DELAY=-1","shuyang.admin-password=TestInitialAdmin2026","shuyang.data-key="})
@AutoConfigureMockMvc
class BroadcastForumTests {
    @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired JdbcTemplate jdbc;@Autowired MemberStore store;@Autowired MemberAuth auth;
    String admin;int sequence;
    @BeforeEach void setup() throws Exception {
        jdbc.update("DELETE FROM syh_record");jdbc.update("DELETE FROM syh_session");jdbc.update("DELETE FROM syh_attachment");auth.bootstrap();sequence=0;
        String token=s(data(call("POST","/auth/login",null,map("username","admin","password","TestInitialAdmin2026"),200)),"token");
        admin=s(data(call("POST","/auth/password",token,map("oldPassword","TestInitialAdmin2026","newPassword","ChangedBroadcast2026"),200)),"token");
    }
    @SuppressWarnings("unchecked") Map<String,Object> call(String method,String path,String token,Object body,int expected) throws Exception {
        MockHttpServletRequestBuilder req=request(HttpMethod.valueOf(method),path).with(r->{r.setRemoteAddr(UUID.randomUUID().toString());return r;});
        if(token!=null)req.header("Authorization","Bearer "+token);if(body!=null)req.contentType("application/json").content(json.writeValueAsBytes(body));
        return json.readValue(mvc.perform(req).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8),Map.class);
    }
    @SuppressWarnings("unchecked") Map<String,Object> data(Map<String,Object> value){return (Map<String,Object>)value.get("data");}
    @SuppressWarnings("unchecked") List<Map<String,Object>> list(Map<String,Object> value){return (List<Map<String,Object>>)value.get("data");}
    Map<String,Object> member(String role) throws Exception {
        Map<String,Object> result=data(call("POST","/auth/register",null,map("phone","1380000"+String.format("%04d",++sequence),"password","TestMemberPassword2026","name","广播测试会员","hometown","沭阳沭城","district","苏州吴中","consent",true,"volunteer",false,"directoryVisible",false,"phoneVisible",false),200));
        Map<String,Object> user=(Map<String,Object>)result.get("user");user=store.get("user",s(user,"id"));user.putAll(map("role",role,"status","approved","forumBoards",Arrays.asList("乡情闲聊")));store.save("user",user);
        return map("id",s(user,"id"),"token",s(result,"token"));
    }
    Map<String,Object> topic(String board,String state) {
        Map<String,Object> row=map("id",id(),"authorId","synthetic-author","authorName","测试作者","title","合成论坛话题","content","仅用于自动化验证的论坛内容","category",board,"status",state,"createdAt",now());store.save("forum_topic",row);return row;
    }
    Map<String,Object> promote(Map<String,Object> row,boolean pinned,boolean hot) throws Exception {
        return data(call("PUT","/forum/topics/"+s(row,"id")+"/promotion",admin,map("revision",ForumPromotion.revision(row),"pinned",pinned,"hot",hot),200));
    }
    Map<String,Object> input(String status) {return map("requestId",id(),"title","测试全站广播","content","活动安排以本条文字通知为准。","audioId","","startsAt",Instant.now().minusSeconds(5).toString(),"endsAt",Instant.now().plusSeconds(3600).toString(),"status",status);}
    Map<String,Object> create(Map<String,Object> input) throws Exception {return data(call("POST","/admin/broadcasts",admin,input,200));}
    List<?> active() throws Exception{return (List<?>)data(call("GET","/broadcasts",null,null,200)).get("items");}
    byte[] wav(){byte[] value=new byte[48];System.arraycopy("RIFF".getBytes(),0,value,0,4);System.arraycopy("WAVE".getBytes(),0,value,8,4);return value;}
    @SuppressWarnings("unchecked") Map<String,Object> upload(String token,String scope,String name,byte[] content,int expected) throws Exception {
        return json.readValue(mvc.perform(multipart("/media/upload").file(new MockMultipartFile("file",name,"audio/wav",content)).param("scope",scope).header("Authorization","Bearer "+token)).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8),Map.class);
    }
    void audio(String id,String token,int expected) throws Exception {MockHttpServletRequestBuilder req=get("/media/"+id);if(token!=null)req.header("Authorization","Bearer "+token);mvc.perform(req).andExpect(status().is(expected));}

    @Test void promotionRespectsRolesBoardsAndApprovedState() throws Exception {
        Map<String,Object> member=member("member"),moderator=member("moderator"),pending=topic("乡情闲聊","pending"),other=topic("苏州生活","approved"),allowed=topic("乡情闲聊","approved");
        String route="/forum/topics/"+s(allowed,"id")+"/promotion";Map<String,Object> body=map("revision",0,"pinned",true);
        call("PUT",route,null,body,401);call("PUT",route,s(member,"token"),body,403);
        call("PUT","/forum/topics/"+s(other,"id")+"/promotion",s(moderator,"token"),body,403);
        call("PUT","/forum/topics/"+s(pending,"id")+"/promotion",admin,body,409);
        assertEquals(true,data(call("PUT",route,s(moderator,"token"),body,200)).get("pinned"));
    }
    @Test void promotionValidatesBooleansAndRejectsStaleUpdates() throws Exception {
        Map<String,Object> row=topic("乡情闲聊","approved");String route="/forum/topics/"+s(row,"id")+"/promotion";
        call("PUT",route,admin,map("revision",0,"pinned","true"),400);call("PUT",route,admin,map("revision",0),400);
        Map<String,Object> next=promote(row,true,true);call("PUT",route,admin,map("revision",0,"pinned",false),409);
        assertEquals(true,store.get("forum_topic",s(row,"id")).get("pinned"));
        Map<String,Object> unpin=promote(next,false,true);assertEquals(false,unpin.get("pinned"));assertEquals(true,unpin.get("hot"));
    }
    @Test void pinLimitIsPerBoardAndPinnedTopicsSortFirst() throws Exception {
        Map<String,Object> first=null;for(int i=0;i<3;i++){Map<String,Object> row=topic("乡情闲聊","approved");if(i==0)first=promote(row,true,false);else promote(row,true,false);}
        Map<String,Object> extra=topic("乡情闲聊","approved");call("PUT","/forum/topics/"+s(extra,"id")+"/promotion",admin,map("revision",0,"pinned",true),409);
        promote(topic("苏州生活","approved"),true,false);List<Map<String,Object>> topics=list(call("GET","/forum/topics",null,null,200));
        assertTrue(topics.subList(0,4).stream().allMatch(r->b(r,"pinned")));assertEquals(s(extra,"id"),s(topics.get(4),"id"));
        promote(first,false,false);promote(extra,true,false);
    }
    @Test void hidingOrDeletingClearsPromotionAndRestorationDoesNotRepromote() throws Exception {
        Map<String,Object> row=promote(topic("乡情闲聊","approved"),true,true);String route="/forum/topics/"+s(row,"id");
        call("POST",route+"/review",admin,map("status","hidden","note","测试隐藏"),200);assertFalse(b(store.get("forum_topic",s(row,"id")),"hot"));
        call("POST",route+"/review",admin,map("status","approved"),200);assertFalse(b(store.get("forum_topic",s(row,"id")),"pinned"));
        promote(store.get("forum_topic",s(row,"id")),true,true);call("POST",route+"/delete",admin,map("note","测试删除"),200);assertFalse(b(store.get("forum_topic",s(row,"id")),"hot"));
    }
    @Test void promotedTopicsStillRespectBlockAndBoardRestrictions() throws Exception {
        Map<String,Object> viewer=member("member"),author=member("member"),row=topic("乡情闲聊","approved");row.put("authorId",s(author,"id"));store.save("forum_topic",row);promote(row,true,true);
        call("POST","/members/"+s(author,"id")+"/block",s(viewer,"token"),map("active",true),200);assertTrue(list(call("GET","/forum/topics",s(viewer,"token"),null,200)).isEmpty());
        call("POST","/members/"+s(author,"id")+"/block",s(viewer,"token"),map("active",false),200);
        call("POST","/forum/restrictions",admin,map("userId",s(viewer,"id"),"board","乡情闲聊","action","kick","reason","测试权限隔离"),200);assertTrue(list(call("GET","/forum/topics",s(viewer,"token"),null,200)).isEmpty());assertEquals(1,list(call("GET","/forum/topics",null,null,200)).size());
    }
    @Test void createTopicCannotForgePromotion() throws Exception {
        Map<String,Object> author=member("member");Map<String,Object> row=data(call("POST","/forum/topics",s(author,"token"),map("title","伪造推荐测试","content","这是一段测试内容不能直接成为置顶热帖。","category","乡情闲聊","pinned",true,"hot",true),200));
        assertFalse(b(row,"pinned"));assertFalse(b(row,"hot"));assertEquals("pending",s(row,"status"));
    }
    @Test void onlyAdminsCanManageOrUploadBroadcasts() throws Exception {
        call("GET","/admin/broadcasts",null,null,401);
        for(String role:Arrays.asList("member","moderator","organizer")){String token=s(member(role),"token");call("GET","/admin/broadcasts",token,null,403);call("POST","/admin/broadcasts",token,input("published"),403);upload(token,"broadcast","voice.wav",wav(),403);}
    }
    @Test void publicFeedExcludesDraftScheduledExpiredAndWithdrawn() throws Exception {
        create(input("draft"));Map<String,Object> later=input("published");later.put("startsAt",Instant.now().plusSeconds(120).toString());create(later);
        Map<String,Object> current=create(input("published"));assertEquals(1,active().size());
        call("POST","/admin/broadcasts/"+s(current,"id")+"/withdraw",admin,map("revision",current.get("revision")),200);assertTrue(active().isEmpty());
        Map<String,Object> expired=create(input("published")),stored=store.get("broadcast",s(expired,"id"));stored.put("endsAt",Instant.now().minusSeconds(1).toString());store.save("broadcast",stored);assertTrue(active().isEmpty());
        String exposed=json.writeValueAsString(call("GET","/broadcasts",null,null,200));assertFalse(exposed.contains("requestPayload"));assertFalse(exposed.contains("createdBy"));
    }
    @Test void broadcastTimeBoundariesAreStartInclusiveAndEndExclusive() {
        Instant start=Instant.parse("2026-11-04T00:00:00Z"),end=start.plusSeconds(60);Map<String,Object> row=map("status","published","startsAt",start.toString(),"endsAt",end.toString());
        assertEquals("scheduled",Broadcasts.state(row,start.minusNanos(1)));assertEquals("active",Broadcasts.state(row,start));assertEquals("expired",Broadcasts.state(row,end));
    }
    @Test void invalidBroadcastPayloadCannotCreateRecords() throws Exception {
        for(Map<String,Object> change:Arrays.asList(map("title",""),map("content",""),map("endsAt",Instant.now().minusSeconds(1).toString()),map("startsAt","invalid"),map("status","active"),map("requestId","not-uuid"))){Map<String,Object> body=input("published");body.putAll(change);call("POST","/admin/broadcasts",admin,body,400);}
        assertTrue(store.all("broadcast").isEmpty());
    }
    @Test void createReplayIsIdempotentAndDifferentIntentIsRejected() throws Exception {
        Map<String,Object> body=input("published"),first=create(body),retry=create(body);assertEquals(first.get("id"),retry.get("id"));assertEquals(1,store.all("broadcast").size());
        body.put("title","不同的广播内容");call("POST","/admin/broadcasts",admin,body,409);
    }
    @Test void staleEditCannotOverwriteOrWithdrawNewerBroadcast() throws Exception {
        Map<String,Object> body=input("published"),created=create(body);body.put("revision",created.get("revision"));body.put("title","已更新的通知标题");
        Map<String,Object> changed=data(call("PUT","/admin/broadcasts/"+s(created,"id"),admin,body,200));
        call("PUT","/admin/broadcasts/"+s(created,"id"),admin,body,409);call("POST","/admin/broadcasts/"+s(created,"id")+"/withdraw",admin,map("revision",created.get("revision")),409);
        assertEquals("已更新的通知标题",s(store.get("broadcast",s(created,"id")),"title"));assertEquals("active",s(changed,"state"));
    }
    @Test void broadcastAudioPublicationAndWithdrawalApplyToDirectDownloads() throws Exception {
        String id=s(data(upload(admin,"broadcast","voice.wav",wav(),200)),"id");audio(id,admin,200);audio(id,null,404);
        Map<String,Object> body=input("draft");body.put("audioId",id);Map<String,Object> row=create(body);audio(id,null,404);
        body.putAll(map("status","published","startsAt",Instant.now().plusSeconds(60).toString(),"revision",row.get("revision")));row=data(call("PUT","/admin/broadcasts/"+s(row,"id"),admin,body,200));audio(id,null,404);
        body.put("startsAt",Instant.now().minusSeconds(1).toString());
        body.putAll(map("status","published","revision",row.get("revision")));row=data(call("PUT","/admin/broadcasts/"+s(row,"id"),admin,body,200));audio(id,null,200);
        Map<String,Object> expired=store.get("broadcast",s(row,"id"));expired.put("endsAt",Instant.now().minusSeconds(1).toString());store.save("broadcast",expired);audio(id,null,404);
        call("POST","/admin/broadcasts/"+s(row,"id")+"/withdraw",admin,map("revision",row.get("revision")),200);audio(id,null,404);audio(id,admin,200);
    }
    @Test void audioScopeOwnershipReuseAndReplacementAreEnforced() throws Exception {
        String other=s(member("admin"),"token");String foreign=s(data(upload(other,"broadcast","voice.wav",wav(),200)),"id"),forum=s(data(upload(admin,"forum","voice.wav",wav(),200)),"id");
        for(String invalid:Arrays.asList(foreign,forum)){Map<String,Object> body=input("published");body.put("audioId",invalid);call("POST","/admin/broadcasts",admin,body,403);}
        upload(admin,"broadcast","picture.png",wav(),400);
        String first=s(data(upload(admin,"broadcast","voice.wav",wav(),200)),"id"),second=s(data(upload(admin,"broadcast","next.wav",wav(),200)),"id");
        Map<String,Object> body=input("published");body.put("audioId",first);Map<String,Object> row=create(body);
        Map<String,Object> reuse=input("published");reuse.put("audioId",first);call("POST","/admin/broadcasts",admin,reuse,403);
        body.putAll(map("audioId",second,"revision",row.get("revision")));call("PUT","/admin/broadcasts/"+s(row,"id"),admin,body,200);audio(first,null,404);audio(second,null,200);
    }
}
