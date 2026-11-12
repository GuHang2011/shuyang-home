package com.example.Kcsj;
import com.example.Kcsj.membership.*;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import java.util.*;
import java.util.concurrent.*;
import static com.example.Kcsj.membership.MemberStore.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:member-card-tests;DB_CLOSE_DELAY=-1","shuyang.admin-password=","shuyang.data-key="})
@AutoConfigureMockMvc
class MemberCardTests {
    @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired MemberStore store;@Autowired MemberAuth auth;@Autowired JdbcTemplate jdbc;
    String member,staff;Map<String,Object> user;
    @BeforeEach void setup(){jdbc.update("DELETE FROM syh_record");jdbc.update("DELETE FROM syh_session");user=map("id",id(),"name","合成会员","memberNo","TEST001","role","member","status","approved","enabled",true,"mustChangePassword",false,"phone","13800000000");store.save("user",user);member=s(auth.session(user),"token");Map<String,Object> operator=map("id",id(),"name","合成组织者","role","organizer","status","approved","enabled",true,"mustChangePassword",false);store.save("user",operator);staff=s(auth.session(operator),"token");}
    @SuppressWarnings("unchecked") Map<String,Object> call(String path,String token,Object body,int expected)throws Exception {org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder req=post(path);if(token!=null)req.header("Authorization","Bearer "+token);if(body!=null)req.contentType("application/json").content(json.writeValueAsBytes(body));Map<String,Object> result=json.readValue(mvc.perform(req).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8),Map.class);return expected==200?(Map<String,Object>)result.get("data"):result;}
    String issue()throws Exception{return s(call("/membership/card-code",member,null,200),"code");}
    Map<String,Object> verify(String code,String token,int status)throws Exception{return call("/membership/verify-card",token,map("code",code),status);}
    @Test void opaqueCodeStoresOnlyHashAndMinimalProofIsReturned()throws Exception {String code=issue();assertTrue(code.matches("SYH-MEMBER:[A-F0-9]{48}"));assertFalse(code.contains("13800000000"));assertFalse(store.all("member_card").toString().contains(code));Map<String,Object> result=verify(code,staff,200);assertEquals("TEST001",result.get("memberNo"));assertEquals(new HashSet<>(Arrays.asList("name","memberNo","status","verifiedAt","demo")),result.keySet());}
    @Test void guestAndUnapprovedCannotIssue()throws Exception {call("/membership/card-code",null,null,401);user.put("status","pending");store.save("user",user);call("/membership/card-code",member,null,403);assertTrue(store.all("member_card").isEmpty());}
    @Test void staffPermissionRequiredForVerification()throws Exception {String code=issue();verify(code,null,401);verify(code,member,403);verify(code,staff,200);}
    @Test void refreshingRevokesOldCodeAndKeepsStorageBounded()throws Exception {String old=issue(),next=issue();assertNotEquals(old,next);verify(old,staff,409);verify(next,staff,200);assertEquals(1,store.all("member_card").size());assertEquals(1,store.all("member_card_owner").size());}
    @Test void expiredCodeCannotVerify()throws Exception {String code=issue();Map<String,Object> row=store.get("member_card",auth.digest(code));row.put("expiresAt","2000-01-01T00:00:00Z");store.save("member_card",row);verify(code,staff,409);}
    @Test void currentMembershipStateAlwaysChecked()throws Exception {String code=issue();for(String key:Arrays.asList("enabled","status","mustChangePassword","memberNo")){Object before=user.get(key);user.put(key,key.equals("enabled")?false:key.equals("status")?"rejected":key.equals("mustChangePassword")?true:"");store.save("user",user);verify(code,staff,409);user.put(key,before);store.save("user",user);}}
    @Test void malformedAndUnknownCodesFailWithoutBusinessChanges()throws Exception {for(String code:Arrays.asList("https://example.com","SYH-CHECKIN:123","SYH-MEMBER:short",""))verify(code,staff,400);verify("SYH-MEMBER:"+String.join("",Collections.nCopies(48,"A")),staff,409);assertTrue(store.all("signup").isEmpty());}
    @Test void noMemberNumberCannotGenerate()throws Exception {user.put("memberNo","");store.save("user",user);call("/membership/card-code",member,null,409);}
    @Test void memberQrIsNotALoginToken()throws Exception {String code=issue();mvc.perform(get("/auth/me").header("Authorization","Bearer "+code)).andExpect(status().isUnauthorized());}
    @Test void simultaneousRefreshLeavesExactlyOneValidCode()throws Exception {ExecutorService pool=Executors.newFixedThreadPool(2);try{Future<String>a=pool.submit(this::issue),b=pool.submit(this::issue);String first=a.get(10,TimeUnit.SECONDS),second=b.get(10,TimeUnit.SECONDS);assertEquals(1,store.all("member_card").size());String active=s(store.all("member_card").get(0),"id");verify(first,staff,auth.digest(first).equals(active)?200:409);verify(second,staff,auth.digest(second).equals(active)?200:409);}finally{pool.shutdownNow();}}
}
