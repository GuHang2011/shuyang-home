package com.example.Kcsj;

import com.example.Kcsj.membership.MemberAuth;
import com.example.Kcsj.membership.MemberStore;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpMethod;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static com.example.Kcsj.membership.MemberStore.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:forum-chat-boundaries;DB_CLOSE_DELAY=-1","shuyang.admin-password=","shuyang.data-key="})
@AutoConfigureMockMvc
class ForumChatBoundaryTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired MemberStore store;
    @Autowired MemberAuth auth;
    @Autowired JdbcTemplate jdbc;
    Map<String,Object> admin, a, b, third;

    @BeforeEach void setup() {
        jdbc.update("DELETE FROM syh_record");jdbc.update("DELETE FROM syh_session");jdbc.update("DELETE FROM syh_attachment");
        admin=actor("superadmin");a=actor("member");b=actor("member");third=actor("member");
    }
    Map<String,Object> actor(String role) {
        Map<String,Object> user=map("id",id(),"name","权限边界验收","role",role,"status","approved","enabled",true);
        store.save("user",user);return map("id",s(user,"id"),"token",s(auth.session(user),"token"));
    }
    @SuppressWarnings("unchecked") Map<String,Object> call(String method,String path,Map<String,Object> actor,Object body,int expected) throws Exception {
        MockHttpServletRequestBuilder req=request(HttpMethod.valueOf(method),path).header("Authorization","Bearer "+s(actor,"token"));
        if(body!=null)req.contentType("application/json").content(json.writeValueAsBytes(body));
        String response=mvc.perform(req).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return json.readValue(response,Map.class);
    }
    @SuppressWarnings("unchecked") Map<String,Object> data(Map<String,Object> response){return (Map<String,Object>)response.get("data");}
    String topic() throws Exception {
        String id=s(data(call("POST","/forum/topics",third,map("title","第三人的讨论主题","content","此内容用于自动化权限验收，不是真实论坛帖子。","category","淮新高铁"),200)),"id");
        call("POST","/forum/topics/"+id+"/review",admin,map("status","approved"),200);return id;
    }
    String reply(String topic,Map<String,Object> author) throws Exception {
        String id=s(data(call("POST","/forum/topics/"+topic+"/replies",author,map("content","一条可以被正常引用的验收回复"),200)),"id");
        call("POST","/forum/replies/"+id+"/review",admin,map("status","approved"),200);return id;
    }
    void block(Map<String,Object> owner,Map<String,Object> target,boolean active) throws Exception {
        call("POST","/members/"+s(target,"id")+"/block",owner,map("active",active),200);
    }
    Map<String,Object> group() throws Exception {
        Map<String,Object> room=data(call("POST","/chat/groups",admin,map("title","附件边界验收群","description","临时测试群聊"),200));
        call("POST","/chat/conversations/"+s(room,"id")+"/action",a,map("action","join"),200);return room;
    }
    Map<String,Object> send(String room,Map<String,Object> actor,String attachment,int expected) throws Exception {
        return call("POST","/chat/conversations/"+room+"/messages",actor,map("content","附件验收","attachmentId",attachment,"requestId",UUID.randomUUID().toString()),expected);
    }
    @SuppressWarnings("unchecked") String upload(String room,Map<String,Object> actor,int expected) throws Exception {
        java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(2,2,java.awt.image.BufferedImage.TYPE_INT_RGB),"png",bytes);
        String response=mvc.perform(multipart("/media/upload").file(new MockMultipartFile("file","fixture.png","image/png",bytes.toByteArray())).param("scope","chat").param("roomId",room).header("Authorization","Bearer "+s(actor,"token")))
            .andExpect(status().is(expected)).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return expected==200?s(data(json.readValue(response,Map.class)),"id"):"";
    }
    void media(String attachment,Map<String,Object> actor,int expected) throws Exception {
        mvc.perform(get("/media/"+attachment).header("Authorization","Bearer "+s(actor,"token"))).andExpect(status().is(expected));
    }

    @Test void blockedMemberCannotTargetBlockerByQuotingTheirReplyOnAThirdPartyTopic() throws Exception {
        String topic=topic(),parent=reply(topic,a),path="/forum/topics/"+topic+"/replies";
        block(a,b,true);
        int replies=store.all("forum_reply").size(),audits=store.all("audit").size();
        call("POST",path,b,map("content","不能通过引用楼层绕过对方拉黑","parentId",parent),403);
        assertEquals(replies,store.all("forum_reply").size());assertEquals(audits,store.all("audit").size());
        // The block concerns direct interaction, not participation in another member's topic.
        call("POST",path,b,map("content","仍能正常参与第三人的讨论"),200);
        block(a,b,false);
        assertEquals(parent,s(data(call("POST",path,b,map("content","取消拉黑后可以再次引用","parentId",parent),200)),"parentId"));
    }
    @Test void blockedHiddenAndMutedReplyPathsRemainRejected() throws Exception {
        String topic=topic(),parent=reply(topic,a),path="/forum/topics/"+topic+"/replies";
        block(b,a,true);
        call("POST",path,b,map("content","已隐藏作者的楼层不能引用","parentId",parent),400);
        block(b,a,false);
        call("POST","/forum/replies/"+parent+"/review",admin,map("status","hidden","note","隐藏引用来源验收"),200);
        call("POST",path,b,map("content","知道编号也不能引用隐藏楼层","parentId",parent),400);
        call("POST","/forum/restrictions",admin,map("board","淮新高铁","userId",s(b,"id"),"action","mute","reason","禁言边界验收"),200);
        call("POST",path,b,map("content","禁言后普通回复也应拒绝"),403);
    }
    @Test void leavingGroupRevokesAttachmentAccessAndAttachmentsCannotCrossRoomsOrSenders() throws Exception {
        String room=s(group(),"id"),otherRoom=s(group(),"id"),file=upload(room,a,200);
        send(otherRoom,a,file,403);send(room,admin,file,403);
        assertEquals("",s(store.get("attachment",file),"messageId"));
        send(room,a,file,200);media(file,admin,200);media(file,a,200);
        call("POST","/chat/conversations/"+room+"/action",a,map("action","leave"),200);
        call("GET","/chat/conversations/"+room,a,null,403);media(file,a,403);upload(room,a,403);send(room,a,"",403);
        media(file,admin,200);
    }
    @Test void personalBlockStopsNewMessagesAndUploadsButPreservesPreviouslySharedHistory() throws Exception {
        String room=s(data(call("POST","/chat/direct",a,map("recipientId",s(b,"id"),"content","请接受临时聊天验收申请"),200)),"id");
        call("POST","/chat/conversations/"+room+"/action",b,map("action","accept"),200);
        String file=upload(room,a,200);send(room,a,file,200);
        block(b,a,true);
        send(room,a,"",403);send(room,b,"",403);upload(room,a,403);upload(room,b,403);
        media(file,a,200);media(file,b,200);
        block(b,a,false);send(room,a,"",200);
    }
}
