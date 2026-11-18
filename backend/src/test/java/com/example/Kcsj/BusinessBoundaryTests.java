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
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import static com.example.Kcsj.membership.MemberStore.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:business-boundary-tests;DB_CLOSE_DELAY=-1","shuyang.admin-password=","shuyang.data-key="})
@AutoConfigureMockMvc
class BusinessBoundaryTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired MemberStore store;
    @Autowired MemberAuth auth;
    @Autowired JdbcTemplate jdbc;
    String admin, member, other;

    @BeforeEach void setup() {
        jdbc.update("DELETE FROM syh_record");jdbc.update("DELETE FROM syh_session");
        admin=actor("superadmin");member=actor("member");other=actor("member");
    }
    String actor(String role) {
        Map<String,Object> user=map("id",id(),"name","边界验收会员","role",role,"status","approved","enabled",true);
        store.save("user",user);return s(auth.session(user),"token");
    }
    @SuppressWarnings("unchecked") Map<String,Object> call(String method,String path,String token,Object body,int expected) throws Exception {
        MockHttpServletRequestBuilder req=request(HttpMethod.valueOf(method),path).header("Authorization","Bearer "+token);
        if(body!=null)req.contentType("application/json").content(json.writeValueAsBytes(body));
        String response=mvc.perform(req).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return json.readValue(response,Map.class);
    }
    @SuppressWarnings("unchecked") Map<String,Object> data(Map<String,Object> response){return (Map<String,Object>)response.get("data");}
    Map<String,Object> event() throws Exception {
        Instant start=Instant.now().plusSeconds(1800);
        return data(call("POST","/events",admin,map("title","签到边界验收","category","乡情聚会","location","原活动场地","description","用于自动测试的活动，不是真实活动。","capacity",10,"status","published","startsAt",start.toString(),"endsAt",start.plusSeconds(3600).toString()),200));
    }
    Map<String,Object> settings(double latitude,double longitude) {
        return map("enabled",true,"latitude",latitude,"longitude",longitude,"radius",200,"opensAt",Instant.now().minusSeconds(60).toString(),"closesAt",Instant.now().plusSeconds(3600).toString());
    }
    void configure(String path) throws Exception {call("PUT",path+"/checkin-config",admin,settings(31.3,120.6),200);call("POST",path+"/checkin-code",admin,null,200);}

    @Test void eventReschedulingInvalidatesOldCheckinWindowAndCode() throws Exception {
        Map<String,Object> event=event();String path="/events/"+s(event,"id");configure(path);
        event.put("startsAt",Instant.now().plusSeconds(86400).toString());event.put("endsAt",Instant.now().plusSeconds(90000).toString());
        call("PUT",path,admin,event,200);call("POST",path+"/signup",member,null,200);
        call("POST",path+"/self-check-in",member,map("latitude",31.3,"longitude",120.6,"accuracy",10),409);
        assertFalse(b(data(call("GET",path+"/checkin-config",member,null,200)),"enabled"));
        call("POST",path+"/checkin-code",admin,null,409);
        assertTrue(store.all("event_checkin").isEmpty());
    }
    @Test void changingEventVenueRequiresNewLocationConfiguration() throws Exception {
        Map<String,Object> event=event();String path="/events/"+s(event,"id");configure(path);
        call("POST",path+"/signup",member,null,200);
        event.put("location","新的活动场地");call("PUT",path,admin,event,200);
        call("POST",path+"/self-check-in",member,map("latitude",31.3,"longitude",120.6,"accuracy",10),409);
        call("PUT",path+"/checkin-config",admin,settings(32.3,120.6),200);
        call("POST",path+"/self-check-in",member,map("latitude",31.3,"longitude",120.6,"accuracy",10),409);
        assertEquals("checked_in",s(data(call("POST",path+"/self-check-in",member,map("latitude",32.3,"longitude",120.6,"accuracy",10),200)),"status"));
    }
    @Test void editingEventDescriptionPreservesExistingCheckinSetup() throws Exception {
        Map<String,Object> event=event();String path="/events/"+s(event,"id");configure(path);
        Map<String,Object> before=store.get("event_checkin",s(event,"id"));
        event.put("description","仅补充活动介绍，签到时间和地点均不变。");call("PUT",path,admin,event,200);
        assertEquals(before,store.get("event_checkin",s(event,"id")));
        call("POST",path+"/signup",member,null,200);
        call("POST",path+"/self-check-in",member,map("latitude",31.3,"longitude",120.6,"accuracy",10),200);
    }
    @Test void successfulBallotCanBeReplayedAfterDeadlineWithoutNewVotesOrChanges() throws Exception {
        for(boolean closeManually:Arrays.asList(true,false)) {
            Map<String,Object> poll=data(call("POST","/polls",admin,map("title","截止重试验收","description","模拟首次响应丢失后的重试","options",Arrays.asList("选项甲","选项乙"),"maxChoices",1,"startsAt",Instant.now().minusSeconds(60).toString(),"endsAt",Instant.now().plusSeconds(3600).toString()),200));
            String path="/polls/"+s(poll,"id");List<?> options=(List<?>)poll.get("options");
            Object vote=map("choices",Arrays.asList(((Map<?,?>)options.get(0)).get("id")));
            call("POST",path+"/vote",member,vote,200);
            if(closeManually)call("POST",path+"/close",admin,null,200);
            else {Map<String,Object> saved=store.get("poll",s(poll,"id"));saved.put("endsAt",Instant.now().minusSeconds(1).toString());store.save("poll",saved);}
            int count=store.all("poll_vote").size();long audits=store.all("audit").stream().filter(r->s(r,"action").equals("poll.vote")).count();
            Map<String,Object> replay=data(call("POST",path+"/vote",member,vote,200));
            assertTrue(b(replay,"hasVoted"));assertTrue(b(replay,"ended"));assertEquals(1,((Number)replay.get("totalVotes")).intValue());
            call("POST",path+"/vote",member,map("choices",Arrays.asList(((Map<?,?>)options.get(1)).get("id"))),409);
            call("POST",path+"/vote",other,vote,409);
            assertEquals(count,store.all("poll_vote").size());assertEquals(audits,store.all("audit").stream().filter(r->s(r,"action").equals("poll.vote")).count());
        }
    }
    @Test void pickupSlotLengthRejectsEvenOneSecondBeyondTwentyFourHours() throws Exception {
        Instant start=Instant.now().plusSeconds(3600);
        Map<String,Object> form=map("type","slot","requestId",id(),"title","时段边界验收","content","用于验证自提时段最长一天的测试说明","region","苏州吴中","category","自提","deadline","","startsAt",start.toString(),"endsAt",start.plus(Duration.ofDays(1)).plusSeconds(1).toString(),"capacity",5,"photos",Collections.emptyList());
        call("POST","/life/entries",admin,form,400);assertTrue(store.all("life_entry").isEmpty());
        form.put("endsAt",start.plus(Duration.ofDays(1)).toString());call("POST","/life/entries",admin,form,200);
        assertEquals(1,store.all("life_entry").size());
    }
}
