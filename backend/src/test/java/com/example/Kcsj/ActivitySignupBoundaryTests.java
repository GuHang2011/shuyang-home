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
import static com.example.Kcsj.membership.MemberStore.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:activity-signup-boundaries;DB_CLOSE_DELAY=-1","shuyang.admin-password=","shuyang.data-key="})
@AutoConfigureMockMvc
class ActivitySignupBoundaryTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired MemberStore store;
    @Autowired MemberAuth auth;
    @Autowired JdbcTemplate jdbc;
    Map<String,Object> admin, organizer, member, other;

    @BeforeEach void setup() {
        jdbc.update("DELETE FROM syh_record");jdbc.update("DELETE FROM syh_session");
        admin=actor("superadmin");organizer=actor("organizer");member=actor("member");other=actor("member");
    }
    Map<String,Object> actor(String role) {
        Map<String,Object> user=map("id",id(),"name","活动边界验收","role",role,"status","approved","enabled",true);
        store.save("user",user);return map("id",s(user,"id"),"token",s(auth.session(user),"token"));
    }
    @SuppressWarnings("unchecked") Map<String,Object> call(String method,String path,Map<String,Object> actor,Object body,int expected) throws Exception {
        MockHttpServletRequestBuilder req=request(HttpMethod.valueOf(method),path).header("Authorization","Bearer "+s(actor,"token"));
        if(body!=null)req.contentType("application/json").content(json.writeValueAsBytes(body));
        String response=mvc.perform(req).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return json.readValue(response,Map.class);
    }
    @SuppressWarnings("unchecked") Map<String,Object> data(Map<String,Object> response){return (Map<String,Object>)response.get("data");}
    String event() throws Exception {
        return s(data(call("POST","/events",admin,map("title","活动报名边界验收","description","隔离测试活动，不是真实举办的活动。","location","合成测试地点","category","公益志愿","status","published","capacity",2,"startsAt",Instant.now().plusSeconds(3600).toString(),"endsAt",Instant.now().plusSeconds(10800).toString()),200)),"id");
    }
    void start(String event) {
        Map<String,Object> row=store.get("event",event);row.put("startsAt",Instant.now().minusSeconds(3600).toString());row.put("endsAt",Instant.now().plusSeconds(3600).toString());store.save("event",row);
    }
    String signupId(String event){return event+":"+s(member,"id");}
    long audits(String action,String target){return store.all("audit").stream().filter(row->s(row,"action").equals(action)&&s(row,"target").equals(target)).count();}

    @Test void signupRetryAfterStartReturnsExistingRegistrationWithoutAnotherWrite() throws Exception {
        String event=event(),path="/events/"+event;
        call("POST",path+"/signup",member,null,200);Map<String,Object> original=store.get("signup",signupId(event));
        start(event);call("POST",path+"/signup",member,null,200);
        assertEquals(original,store.get("signup",signupId(event)));assertEquals(1,store.all("signup").size());assertEquals(1,audits("event.signup",event));
        call("POST",path+"/signup",other,null,409);call("POST",path+"/cancel-signup",member,null,409);
        assertEquals(1,data(call("GET",path,member,null,200)).get("registered"));
    }

    @Test void signupRetryAfterFinalizationPreservesHoursAndAttendance() throws Exception {
        String event=event(),path="/events/"+event;
        call("POST",path+"/signup",member,null,200);start(event);
        call("POST",path+"/check-in",admin,map("userId",s(member,"id"),"hours",1.5),200);
        Map<String,Object> original=store.get("signup",signupId(event));
        assertEquals("checked_in",s(data(call("POST",path+"/signup",member,null,200)),"status"));
        assertEquals(original,store.get("signup",signupId(event)));assertEquals(1,audits("event.signup",event));assertEquals(1,audits("event.check-in",signupId(event)));
        assertEquals(1.5,((Number)data(call("GET","/home",member,null,200)).get("volunteerHours")).doubleValue());
    }

    @Test void cancelledRegistrationCannotRejoinAfterStartOrEventCancellation() throws Exception {
        String event=event(),path="/events/"+event;
        call("POST",path+"/signup",member,null,200);call("POST",path+"/cancel-signup",member,null,200);
        Map<String,Object> cancelled=store.get("signup",signupId(event));start(event);
        call("POST",path+"/signup",member,null,409);call("POST",path+"/cancel-signup",member,null,200);
        assertEquals(cancelled,store.get("signup",signupId(event)));assertEquals(0,data(call("GET",path,member,null,200)).get("registered"));
        String next=event(),nextPath="/events/"+next;call("POST",nextPath+"/signup",member,null,200);
        Map<String,Object> closed=store.get("event",next);closed.put("status","cancelled");call("PUT",nextPath,admin,closed,200);
        call("POST",nextPath+"/signup",member,null,409);call("POST",nextPath+"/signup",other,null,409);
        assertEquals("cancelled",s(store.get("signup",signupId(next)),"status"));assertEquals(0,data(call("GET",nextPath,member,null,200)).get("registered"));
    }

    @Test void locationAttendanceFinalizationRetainsFirstCheckinAndVerifierOnRetry() throws Exception {
        String event=event(),path="/events/"+event;
        call("POST",path+"/signup",member,null,200);start(event);
        call("PUT",path+"/checkin-config",admin,map("enabled",true,"latitude",31.3,"longitude",120.6,"radius",200,"opensAt",Instant.now().minusSeconds(3600).toString(),"closesAt",Instant.now().plusSeconds(600).toString()),200);
        call("POST",path+"/self-check-in",member,map("latitude",31.3,"longitude",120.6,"accuracy",10),200);
        String checkedAt=s(store.get("signup",signupId(event)),"checkedAt");Map<String,Object> input=map("userId",s(member,"id"),"hours",1);
        call("POST",path+"/check-in",other,input,403);call("POST",path+"/check-in",organizer,input,200);
        Map<String,Object> finalized=store.get("signup",signupId(event));assertEquals(checkedAt,s(finalized,"checkedAt"));assertEquals(s(organizer,"id"),s(finalized,"checkedBy"));assertEquals(true,finalized.get("hoursFinalized"));
        call("POST",path+"/check-in",admin,input,200);call("POST",path+"/self-check-in",member,map(),200);
        assertEquals(finalized,store.get("signup",signupId(event)));assertEquals(1,audits("event.check-in",signupId(event)));assertEquals(1,audits("event.location-check-in",signupId(event)));
        call("POST",path+"/check-in",admin,map("userId",s(member,"id"),"hours",0.5),409);call("POST",path+"/cancel-signup",member,null,409);
        assertEquals(1.0,((Number)data(call("GET","/home",member,null,200)).get("volunteerHours")).doubleValue());
    }
}
