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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.http.HttpMethod;
import java.util.*;
import java.time.*;
import java.nio.ByteBuffer;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import static com.example.Kcsj.membership.MemberStore.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:people-display-tests;DB_CLOSE_DELAY=-1","shuyang.admin-password=","shuyang.data-key="})
@AutoConfigureMockMvc
class PeopleDisplayTests {
    @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired MemberStore store;@Autowired MemberAuth auth;@Autowired JdbcTemplate jdbc;
    Map<String,Object> owner,peer,admin,pending;
    @BeforeEach void setup(){jdbc.update("DELETE FROM syh_record");jdbc.update("DELETE FROM syh_session");jdbc.update("DELETE FROM syh_attachment");owner=person("member",true);peer=person("member",true);admin=person("superadmin",true);pending=person("member",false);}
    Map<String,Object> person(String role,boolean approved){Map<String,Object>p=map("id",id(),"name","测试乡友","phone","13800000000","role",role,"status",approved?"approved":"pending","enabled",true,"directoryVisible",true,"phoneVisible",false);store.save("user",p);p.put("token",auth.session(p).get("token"));return p;}
    @SuppressWarnings("unchecked") Map<String,Object> call(String method,String path,Map<String,Object> actor,Object body,int code)throws Exception{MockHttpServletRequestBuilder b=request(HttpMethod.valueOf(method),path);if(actor!=null)b.header("Authorization","Bearer "+s(actor,"token"));if(body!=null)b.contentType("application/json").content(json.writeValueAsBytes(body));return json.readValue(mvc.perform(b).andExpect(status().is(code)).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8),Map.class);}
    @SuppressWarnings("unchecked") Map<String,Object> data(Map<String,Object>result){return (Map<String,Object>)result.get("data");}
    @SuppressWarnings("unchecked") List<Map<String,Object>> list(Map<String,Object>actor)throws Exception{return (List<Map<String,Object>>)call("GET","/address-book",actor,null,200).get("data");}
    Map<String,Object> target(Map<String,Object>actor)throws Exception{return list(actor).stream().filter(r->s(r,"id").equals(s(peer,"id"))).findFirst().get();}
    void changePeer(String field,Object value){Map<String,Object>p=store.get("user",s(peer,"id"));p.put(field,value);store.save("user",p);}
    void saveContact()throws Exception{call("PUT","/address-book/"+s(peer,"id"),owner,map("group","活动伙伴","note","只有我能看到的备注","favorite",true),200);}
    @Test void directoryRequiresMembershipAndAnnotationsStayPrivate()throws Exception{
        call("GET","/address-book",null,null,401);call("GET","/address-book",pending,null,403);
        assertFalse(target(owner).containsKey("phone"));saveContact();assertEquals("活动伙伴",target(owner).get("group"));
        assertFalse(json.writeValueAsString(list(admin)).contains("只有我能看到的备注"));
        call("DELETE","/address-book/"+s(peer,"id"),admin,null,200);assertEquals(true,target(owner).get("saved"));
        call("DELETE","/address-book/"+s(peer,"id"),owner,null,200);assertEquals(false,target(owner).get("saved"));
    }
    @Test void currentPhoneConsentAndDirectoryWithdrawalAreHonored()throws Exception{
        changePeer("phoneVisible",true);assertEquals("13800000000",target(owner).get("phone"));saveContact();
        changePeer("phoneVisible",false);assertFalse(target(owner).containsKey("phone"));
        changePeer("directoryVisible",false);Map<String,Object>row=target(owner);assertEquals(false,row.get("available"));assertEquals("联系人暂不可用",row.get("name"));assertFalse(row.containsKey("phone"));assertEquals("活动伙伴",row.get("group"));
        call("PUT","/address-book/"+s(peer,"id"),admin,map("group","","note","","favorite",false),404);
    }
    @Test void acceptedExchangeAndRevocationAreReflectedWithoutCopyingContacts()throws Exception{
        changePeer("directoryVisible",false);String exchange=id();store.save("contact_exchange",map("id",exchange,"requesterId",s(owner,"id"),"recipientId",s(peer,"id"),"requesterContact","自己的微信","recipientContact","对方授权微信","status","accepted"));
        assertEquals("对方授权微信",target(owner).get("contact"));saveContact();
        Map<String,Object>x=store.get("contact_exchange",exchange);x.put("status","revoked");store.save("contact_exchange",x);
        assertEquals(false,target(owner).get("available"));assertFalse(json.writeValueAsString(target(owner)).contains("对方授权微信"));
    }
    @Test void blockingAndDisabledAccountsHideContactDetails()throws Exception{
        changePeer("phoneVisible",true);saveContact();String block=id();store.save("member_block",map("id",block,"ownerId",s(peer,"id"),"targetId",s(owner,"id"),"active",true));
        assertEquals(false,target(owner).get("available"));assertFalse(target(owner).containsKey("phone"));store.delete("member_block",block);
        changePeer("enabled",false);assertEquals(false,target(owner).get("available"));
    }
    byte[] image()throws Exception{ByteArrayOutputStream out=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(2,2,BufferedImage.TYPE_INT_RGB),"png",out);return out.toByteArray();}
    byte[] mp4(){return ByteBuffer.allocate(42).putInt(24).put("ftyp".getBytes()).put("isom".getBytes()).putInt(0).put("isommp42".getBytes()).putInt(9).put("moov".getBytes()).put((byte)0).putInt(9).put("mdat".getBytes()).put((byte)1).array();}
    @SuppressWarnings("unchecked") Map<String,Object> upload(Map<String,Object>a,String name,byte[]bytes,int code)throws Exception{return json.readValue(mvc.perform(multipart("/media/upload").file(new MockMultipartFile("file",name,"application/octet-stream",bytes)).param("scope","display").header("Authorization","Bearer "+s(a,"token"))).andExpect(status().is(code)).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8),Map.class);}
    Map<String,Object> slide(String mediaId,String state){return map("title","活动现场回顾","caption","只用于测试的素材","mediaId",mediaId,"position",0,"seconds",5,"status",state,"consent",true);}
    @Test void onlyStaffCanUploadAndPublishConsentedDisplayAssets()throws Exception{
        upload(owner,"test.png",image(),403);String mediaId=s(data(upload(admin,"test.png",image(),200)),"id");
        Map<String,Object>f=slide(mediaId,"published");call("POST","/display/slides",owner,f,403);f.put("consent",false);call("POST","/display/slides",admin,f,400);
        f.put("status","draft");Map<String,Object>saved=data(call("POST","/display/slides",admin,f,200));
        mvc.perform(get("/media/"+mediaId)).andExpect(status().isNotFound());assertTrue(((List<?>)data(call("GET","/display",null,null,200)).get("slides")).isEmpty());
        saved.put("consent",true);saved.put("status","published");call("POST","/display/slides",admin,saved,200);mvc.perform(get("/media/"+mediaId)).andExpect(status().isOk());
        saved.put("status","draft");call("POST","/display/slides",admin,saved,200);mvc.perform(get("/media/"+mediaId)).andExpect(status().isNotFound());
    }
    @Test void videoValidationRangeAndRemovalProtectPublicAccess()throws Exception{
        upload(admin,"fake.mp4","this is not a video".getBytes(),400);String mediaId=s(data(upload(admin,"test.mp4",mp4(),200)),"id");
        Map<String,Object>saved=data(call("POST","/display/slides",admin,slide(mediaId,"published"),200));
        mvc.perform(get("/media/"+mediaId).header("Range","bytes=0-7")).andExpect(status().isPartialContent()).andExpect(header().string("Content-Range","bytes 0-7/42")).andExpect(header().string("Content-Type","video/mp4")).andExpect(header().string("Cache-Control",org.hamcrest.Matchers.containsString("no-store"))).andExpect(content().bytes(Arrays.copyOfRange(mp4(),0,8)));
        mvc.perform(get("/media/"+mediaId).header("Range","bytes=-4")).andExpect(status().isPartialContent()).andExpect(content().bytes(Arrays.copyOfRange(mp4(),38,42)));
        mvc.perform(get("/media/"+mediaId).header("Range","bytes=100-200")).andExpect(status().is(416));
        call("DELETE","/display/slides/"+s(saved,"id"),admin,null,200);mvc.perform(get("/media/"+mediaId).header("Range","bytes=0-7")).andExpect(status().isNotFound());
    }
    @Test void anotherStaffCannotPublishAnUnlinkedUploadOrPrivateChatAttachment()throws Exception{
        String mediaId=s(data(upload(admin,"test.png",image(),200)),"id");Map<String,Object>other=person("admin",true);call("POST","/display/slides",other,slide(mediaId,"published"),403);
        String privateId=id();store.save("attachment",map("id",privateId,"ownerId",s(admin,"id"),"scope","chat","type","image"));call("POST","/display/slides",admin,slide(privateId,"published"),400);
    }
    @Test void publicDashboardContainsOnlyPublishedAggregates()throws Exception{
        String publicId=id(),draftId=id();store.save("event",map("id",publicId,"title","公开活动","location","测试会场","category","公益志愿","status","published","startsAt",Instant.now().plusSeconds(3600).toString(),"endsAt",Instant.now().plusSeconds(7200).toString()));
        store.save("event",map("id",draftId,"title","保密草稿活动","category","内部","status","draft"));
        store.save("signup",map("id",id(),"eventId",publicId,"userId",s(owner,"id"),"status","checked_in","hours",3));store.save("signup",map("id",id(),"eventId",draftId,"status","checked_in","hours",99));
        store.save("chat_message",map("id",id(),"text","不能公开的私聊"));Map<String,Object>result=data(call("GET","/display",null,null,200));assertEquals(1,result.get("events"));assertEquals(3.0,((Number)result.get("hours")).doubleValue());assertEquals(6,((List<?>)result.get("months")).size());
        String raw=json.writeValueAsString(result);assertFalse(raw.contains("13800000000"));assertFalse(raw.contains("保密草稿活动"));assertFalse(raw.contains("不能公开的私聊"));call("GET","/display/slides",owner,null,403);
    }
}
