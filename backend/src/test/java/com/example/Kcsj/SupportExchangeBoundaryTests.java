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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static com.example.Kcsj.membership.MemberStore.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:support-exchange-boundaries;DB_CLOSE_DELAY=-1","shuyang.admin-password=","shuyang.data-key="})
@AutoConfigureMockMvc
class SupportExchangeBoundaryTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired MemberStore store;
    @Autowired MemberAuth auth;
    @Autowired JdbcTemplate jdbc;
    Map<String,Object> admin, owner, supporter, other;

    @BeforeEach void setup() {
        jdbc.update("DELETE FROM syh_record");jdbc.update("DELETE FROM syh_session");
        admin=actor("superadmin");owner=actor("member");supporter=actor("member");other=actor("member");
    }
    Map<String,Object> actor(String role) {
        Map<String,Object> user=map("id",id(),"name","支持交换边界验收","role",role,"status","approved","enabled",true);
        store.save("user",user);return map("id",s(user,"id"),"token",s(auth.session(user),"token"));
    }
    MockHttpServletRequestBuilder req(String method,String path,Map<String,Object> actor,Object body) throws Exception {
        MockHttpServletRequestBuilder req=request(HttpMethod.valueOf(method),path).header("Authorization","Bearer "+s(actor,"token"));
        if(body!=null)req.contentType("application/json").content(json.writeValueAsBytes(body));return req;
    }
    @SuppressWarnings("unchecked") Map<String,Object> call(String method,String path,Map<String,Object> actor,Object body,int expected) throws Exception {
        String response=mvc.perform(req(method,path,actor,body)).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return json.readValue(response,Map.class);
    }
    @SuppressWarnings("unchecked") Map<String,Object> data(Map<String,Object> response){return (Map<String,Object>)response.get("data");}
    String project(String type) throws Exception {
        String id=s(data(call("POST","/crowdfunding",owner,map("title","支持边界验收项目","description","此项目仅用于自动化接口测试，不是真实众筹。","purpose","验证容量和重复操作","type",type,"unit","份","goal",10,"endsAt",Instant.now().plusSeconds(86400).toString(),"consent",true),200)),"id");
        call("POST","/crowdfunding/"+id+"/review",admin,map("status","approved"),200);return id;
    }
    Map<String,Object> pledgeBody(int quantity){return map("quantity",quantity,"message","合成测试认领","requestId",UUID.randomUUID().toString());}
    Map<String,Object> pledge(String project,Map<String,Object> actor,Map<String,Object> body,int expected) throws Exception {
        return call("POST","/crowdfunding/"+project+"/pledges",actor,body,expected);
    }
    String resource() throws Exception {
        String id=s(data(call("POST","/resources",owner,map("title","交换边界验收资源","offering","测试活动摄影服务","seeking","测试视频剪辑指导","category","技能服务","district","苏州","contact","合成联系信息"),200)),"id");
        call("POST","/resources/"+id+"/review",admin,map("status","approved"),200);return id;
    }
    Map<String,Object> exchange(String resource,Map<String,Object> actor,int expected) throws Exception {
        return call("POST","/resources/"+resource+"/requests",actor,map("message","提供测试视频剪辑指导","contact","合成申请人信息"),expected);
    }
    Map<String,Object> action(String exchange,Map<String,Object> actor,String action,int expected) throws Exception {
        return call("POST","/exchanges/"+exchange+"/action",actor,map("action",action),expected);
    }
    long audits(String action,String target) {return store.all("audit").stream().filter(row->s(row,"action").equals(action)&&s(row,"target").equals(target)).count();}

    @Test void repeatedDeliveryPreservesFirstVerifierTimestampAndAudit() throws Exception {
        String project=project("物资"),id=s(data(pledge(project,supporter,pledgeBody(4),200)),"id"),path="/pledges/"+id+"/deliver";
        call("POST",path,owner,null,200);Map<String,Object> first=store.get("crowd_pledge",id);
        call("POST",path,admin,null,200);
        assertEquals(first,store.get("crowd_pledge",id),"Another authorized verifier must not replace the first confirmation");
        call("POST",path,owner,null,200);
        assertEquals(first,store.get("crowd_pledge",id),"Retries must retain the original verifier, timestamp and business version");
        assertEquals(1,audits("crowdfunding.deliver",id));
        call("POST",path,other,null,403);call("POST",path,supporter,null,403);
        call("POST","/pledges/"+id+"/cancel",supporter,null,409);
    }
    @Test void repeatedCancellationPreservesTerminalRecordWithoutExtraAudit() throws Exception {
        String project=project("物资"),id=s(data(pledge(project,supporter,pledgeBody(4),200)),"id"),path="/pledges/"+id+"/cancel";
        call("POST",path,supporter,null,200);Map<String,Object> first=store.get("crowd_pledge",id);
        call("POST",path,supporter,null,200);
        assertEquals(first,store.get("crowd_pledge",id));assertEquals(1,audits("crowdfunding.cancel",id));
        call("POST",path,other,null,403);call("POST",path,owner,null,403);
        call("POST","/pledges/"+id+"/deliver",owner,null,409);
    }
    @Test void retryOfAcceptedExchangeReturnsExistingApplicationWithoutAnotherReservation() throws Exception {
        String resource=resource(),exchange=s(data(exchange(resource,supporter,200)),"id");
        assertEquals(exchange,s(data(exchange(resource,supporter,200)),"id"));
        action(exchange,owner,"accept",200);Map<String,Object> first=store.get("exchange",exchange);
        assertEquals(exchange,s(data(exchange(resource,supporter,200)),"id"));
        assertEquals(first,store.get("exchange",exchange));assertEquals(1,store.all("exchange").size());assertEquals(1,audits("exchange.request",exchange));
        exchange(resource,other,409);action(exchange,other,"confirm",403);action(exchange,supporter,"cancel",409);
        assertEquals("reserved",s(store.get("resource",resource),"availability"));
        action(exchange,owner,"confirm",200);action(exchange,supporter,"confirm",200);
        exchange(resource,supporter,409);assertEquals("exchanged",s(store.get("resource",resource),"availability"));
    }
    @Test void concurrentPledgesAndCancelledRetriesDoNotOverbookOrRestoreCancelledQuantity() throws Exception {
        String project=project("物资"),path="/crowdfunding/"+project+"/pledges";
        Map<String,Object> a=pledgeBody(6),b=pledgeBody(6);
        ExecutorService pool=Executors.newFixedThreadPool(2);CountDownLatch ready=new CountDownLatch(1);
        try {
            Future<Integer> one=pool.submit(()->{ready.await();return mvc.perform(req("POST",path,supporter,a)).andReturn().getResponse().getStatus();});
            Future<Integer> two=pool.submit(()->{ready.await();return mvc.perform(req("POST",path,other,b)).andReturn().getResponse().getStatus();});
            ready.countDown();assertEquals(new HashSet<>(Arrays.asList(200,409)),new HashSet<>(Arrays.asList(one.get(15,TimeUnit.SECONDS),two.get(15,TimeUnit.SECONDS))));
        } finally {pool.shutdownNow();}
        Map<String,Object> original=store.all("crowd_pledge").get(0);
        Map<String,Object> winner=s(original,"supporterId").equals(s(supporter,"id"))?supporter:other,body=winner==supporter?a:b;
        String id=s(original,"id");call("POST","/pledges/"+id+"/cancel",winner,null,200);call("POST","/pledges/"+id+"/cancel",winner,null,200);
        pledge(project,owner,pledgeBody(10),200);
        assertEquals("cancelled",s(data(pledge(project,winner,body,200)),"status"));
        pledge(project,winner,pledgeBody(1),409);assertEquals(2,store.all("crowd_pledge").size());
        call("POST","/crowdfunding/"+project+"/close",owner,null,200);pledge(project,winner,pledgeBody(1),409);
    }
    @Test void cancelledExchangeCannotBeAcceptedAndClosureInvalidatesNewPendingRequest() throws Exception {
        String resource=resource(),exchange=s(data(exchange(resource,supporter,200)),"id");
        action(exchange,owner,"cancel",403);action(exchange,supporter,"cancel",200);action(exchange,owner,"accept",409);
        String next=s(data(exchange(resource,supporter,200)),"id");assertNotEquals(exchange,next);
        call("POST","/resources/"+resource+"/close",other,null,403);
        call("POST","/resources/"+resource+"/close",owner,null,200);
        assertEquals("unavailable",s(store.get("exchange",next),"status"));action(next,owner,"accept",409);exchange(resource,supporter,409);
    }
}
