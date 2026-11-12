package com.example.Kcsj;

import com.example.Kcsj.membership.*;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.http.HttpMethod;
import java.util.*;
import static com.example.Kcsj.membership.MemberStore.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:rail-forum-tests;DB_CLOSE_DELAY=-1","shuyang.admin-password=TestInitialAdmin2026","shuyang.data-key="})
@AutoConfigureMockMvc
class RailwayForumTests {
    @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired JdbcTemplate jdbc;@Autowired MemberStore store;@Autowired MemberAuth auth;
    String admin;int sequence;
    @BeforeEach void setup() throws Exception {
        jdbc.update("DELETE FROM syh_record");jdbc.update("DELETE FROM syh_session");jdbc.update("DELETE FROM syh_attachment");auth.bootstrap();sequence=0;
        String token=s(data(call("POST","/auth/login",null,map("username","admin","password","TestInitialAdmin2026"),200)),"token");
        admin=s(data(call("POST","/auth/password",token,map("oldPassword","TestInitialAdmin2026","newPassword","ChangedRailForum2026"),200)),"token");
    }
    @SuppressWarnings("unchecked") Map<String,Object> call(String method,String path,String token,Object body,int expected) throws Exception {
        MockHttpServletRequestBuilder req=request(HttpMethod.valueOf(method),path).with(r->{r.setRemoteAddr(UUID.randomUUID().toString());return r;});
        if(token!=null)req.header("Authorization","Bearer "+token);if(body!=null)req.contentType("application/json").content(json.writeValueAsBytes(body));
        return json.readValue(mvc.perform(req).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8),Map.class);
    }
    @SuppressWarnings("unchecked") Map<String,Object> data(Map<String,Object> value){return (Map<String,Object>)value.get("data");}
    @SuppressWarnings("unchecked") List<Map<String,Object>> list(Map<String,Object> value){return (List<Map<String,Object>>)value.get("data");}
    @SuppressWarnings("unchecked") Map<String,Object> member(String board) throws Exception {
        Map<String,Object> result=data(call("POST","/auth/register",null,map("phone","1390000"+String.format("%04d",++sequence),"password","TestMemberPassword2026","name","高铁测试会员","hometown","沭阳沭城","district","苏州吴中","consent",true,"volunteer",false,"directoryVisible",false,"phoneVisible",false),200));
        String key=s((Map<String,Object>)result.get("user"),"id");Map<String,Object> user=store.get("user",key);user.put("status","approved");store.save("user",user);
        String token=s(result,"token");
        if(board!=null){call("POST","/admin/members/"+key+"/access",admin,map("role","moderator","enabled",true,"forumBoards",Arrays.asList(board)),200);token=s(data(call("POST","/auth/login",null,map("username",s(user,"phone"),"password","TestMemberPassword2026"),200)),"token");}
        return map("id",key,"token",token);
    }
    Map<String,Object> input(){return map("title","高铁资料核对讨论","content","这里是用于验证高铁论坛的合成内容，不代表实际项目进展。","category","淮新高铁","discussionType","资料分享","sourceName","江苏省交通运输厅","sourceUrl","https://jtyst.jiangsu.gov.cn/");}
    Map<String,Object> post(String token,Map<String,Object> input) throws Exception{return data(call("POST","/forum/topics",token,input,200));}
    void review(String id,String token,String status) throws Exception{call("POST","/forum/topics/"+id+"/review",token,map("status",status,"note","测试审核说明"),200);}

    @Test void railwayTopicStoresMetadataAndRemainsPendingUntilReviewed() throws Exception {
        String token=s(member(null),"token");Map<String,Object> row=post(token,input());assertEquals("pending",row.get("status"));assertEquals("资料分享",row.get("discussionType"));assertTrue(list(call("GET","/forum/topics",null,null,200)).isEmpty());
        call("GET","/forum/topics/"+s(row,"id"),null,null,404);review(s(row,"id"),admin,"approved");
        Map<String,Object> visible=list(call("GET","/forum/topics",null,null,200)).get(0);assertEquals("https://jtyst.jiangsu.gov.cn/",visible.get("sourceUrl"));
        Map<String,Object> plain=input();plain.remove("discussionType");plain.remove("sourceName");plain.remove("sourceUrl");assertEquals("进展讨论",post(token,plain).get("discussionType"));
    }
    @Test void invalidTypeSourcePairsAndUnsafeLinksAreRejectedWithoutSaving() throws Exception {
        String token=s(member(null),"token");
        List<Map<String,Object>> changes=Arrays.asList(map("discussionType","通车确认"),map("discussionType",true),map("sourceName",""),map("sourceUrl",""),map("sourceName",String.join("",Collections.nCopies(101,"字"))),map("sourceUrl",String.join("",Collections.nCopies(1001,"x"))),map("sourceUrl","javascript:alert(1)"),map("sourceUrl","//example.org/path"),map("sourceUrl","https://user:password@example.org/path"),map("sourceUrl","https://example.org:99999/path"),map("sourceUrl","https://example.org/<script>"),map("sourceUrl","https://example.org/\npath"));
        for(Map<String,Object> change:changes){Map<String,Object> body=input();body.putAll(change);call("POST","/forum/topics",token,body,400);}assertTrue(store.all("forum_topic").isEmpty());
    }
    @Test void railwayModeratorCanOnlyManageAssignedBoard() throws Exception {
        Map<String,Object> railModerator=member("淮新高铁"),otherModerator=member("乡情闲聊"),author=member(null);String railToken=s(railModerator,"token");
        Map<String,Object> rail=post(s(author,"token"),input()),otherInput=input();otherInput.put("category","乡情闲聊");Map<String,Object> other=post(s(author,"token"),otherInput);
        call("POST","/forum/topics/"+s(rail,"id")+"/review",s(otherModerator,"token"),map("status","approved"),403);
        call("POST","/forum/topics/"+s(other,"id")+"/review",railToken,map("status","approved"),403);review(s(rail,"id"),railToken,"approved");
        call("PUT","/forum/topics/"+s(rail,"id")+"/promotion",railToken,map("revision",0,"pinned",true,"hot",true),200);
        Map<String,Object> queue=data(call("GET","/admin/forum",railToken,null,200));assertTrue(json.writeValueAsString(queue).contains(s(rail,"id")));assertFalse(json.writeValueAsString(queue).contains(s(other,"id")));
    }
    @Test void restrictionsAndBlocksApplyToRailTopicsWithoutAffectingOtherBoards() throws Exception {
        Map<String,Object> author=member(null),reader=member(null),moderator=member("淮新高铁");Map<String,Object> rail=post(s(author,"token"),input());review(s(rail,"id"),admin,"approved");
        String viewer=s(reader,"token");call("POST","/forum/restrictions",s(moderator,"token"),map("board","淮新高铁","userId",reader.get("id"),"action","kick","reason","测试板块隔离"),200);
        assertTrue(list(call("GET","/forum/topics",viewer,null,200)).isEmpty());call("GET","/forum/topics/"+s(rail,"id"),viewer,null,403);call("POST","/forum/topics",viewer,input(),403);
        Map<String,Object> normal=input();normal.put("category","乡情闲聊");Map<String,Object> saved=post(viewer,normal);assertFalse(saved.containsKey("sourceUrl"));assertFalse(saved.containsKey("discussionType"));
        call("POST","/forum/restrictions",s(moderator,"token"),map("board","淮新高铁","userId",reader.get("id"),"action","restore","reason","恢复测试参与"),200);
        call("POST","/members/"+s(author,"id")+"/block",viewer,map("active",true),200);assertTrue(list(call("GET","/forum/topics",viewer,null,200)).isEmpty());call("GET","/forum/topics/"+s(rail,"id"),viewer,null,404);
    }
    @Test void forwardingKeepsSourceMetadataThenRedactsHiddenAndDeletedSources() throws Exception {
        String token=s(member(null),"token");Map<String,Object> original=post(token,input());review(s(original,"id"),admin,"approved");Map<String,Object> body=input();body.put("forwardedTopicId",original.get("id"));Map<String,Object> forward=post(token,body);review(s(forward,"id"),admin,"approved");
        String route="/forum/topics/"+s(forward,"id");assertTrue(json.writeValueAsString(data(call("GET",route,null,null,200)).get("topic")).contains("sourceUrl"));
        review(s(original,"id"),admin,"hidden");Map<String,Object> topic=(Map<String,Object>)data(call("GET",route,null,null,200)).get("topic");Map<String,Object> quote=(Map<String,Object>)topic.get("forwarded");assertEquals(Collections.singletonMap("unavailable",true),quote);
        call("POST",route+"/delete",token,map("note","清理测试话题"),200);Map<String,Object> deleted=store.get("forum_topic",s(forward,"id"));for(String key:Arrays.asList("sourceUrl","sourceName","discussionType","forwardedTopicId"))assertFalse(deleted.containsKey(key));
        call("GET",route,null,null,404);
    }
    @Test void repliesRemainReviewedAndRailwayModeratorCanHideThem() throws Exception {
        String token=s(member(null),"token"),moderator=s(member("淮新高铁"),"token");Map<String,Object> rail=post(token,input());review(s(rail,"id"),moderator,"approved");
        Map<String,Object> reply=data(call("POST","/forum/topics/"+s(rail,"id")+"/replies",token,map("content","合成测试回复"),200));assertEquals("pending",reply.get("status"));
        assertEquals(Collections.emptyList(),data(call("GET","/forum/topics/"+s(rail,"id"),null,null,200)).get("replies"));
        call("POST","/forum/replies/"+s(reply,"id")+"/review",moderator,map("status","approved"),200);
        call("POST","/forum/replies/"+s(reply,"id")+"/review",moderator,map("status","hidden","note","测试隐藏回复"),200);
        assertEquals(Collections.emptyList(),data(call("GET","/forum/topics/"+s(rail,"id"),null,null,200)).get("replies"));
    }
}
