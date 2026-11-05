package com.example.Kcsj;

import com.example.Kcsj.membership.*;
import com.fasterxml.jackson.databind.*;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static com.example.Kcsj.membership.MemberStore.map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AiAssistantTests {
    final ObjectMapper json = new ObjectMapper();
    HttpServer server;ExecutorService workers;AiAssistantService service;MemberAuth auth;MockMvc mvc;
    Map<String,Object> user;volatile String response, received, authorization;volatile int responseCode;
    volatile CountDownLatch entered, release;AtomicInteger calls;
    @BeforeEach void setup() throws Exception {
        calls=new AtomicInteger();responseCode=200;response="{\"choices\":[{\"message\":{\"content\":\"test reply\"},\"finish_reason\":\"stop\"}]}";
        server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);workers=Executors.newCachedThreadPool();server.setExecutor(workers);
        server.createContext("/v1/chat/completions", exchange -> {
            calls.incrementAndGet();received=new String(org.springframework.util.StreamUtils.copyToByteArray(exchange.getRequestBody()),StandardCharsets.UTF_8);authorization=exchange.getRequestHeaders().getFirst("Authorization");
            try {
                if(entered!=null) {entered.countDown();release.await(20,TimeUnit.SECONDS);}
                byte[] bytes=response.getBytes(StandardCharsets.UTF_8);exchange.getResponseHeaders().add("Content-Type","application/json");
                exchange.getResponseHeaders().add("Location",base()+"/v1/chat/completions");exchange.sendResponseHeaders(responseCode,bytes.length);exchange.getResponseBody().write(bytes);
            } catch(InterruptedException e) {Thread.currentThread().interrupt();} finally {exchange.close();}
        });server.start();service=new AiAssistantService(json,true,base()+"/v1/","synthetic-test-key","test-model");
        MemberStore store=mock(MemberStore.class);user=map("id","test-user","status","approved","enabled",true,"mustChangePassword",false,"name","PRIVATE_NAME");
        when(store.sessionUser(anyString())).thenReturn("test-user");when(store.get("user","test-user")).thenReturn(user);auth=new MemberAuth(store);
        mvc=MockMvcBuilders.standaloneSetup(new AiAssistantController(auth,service)).setControllerAdvice(new ApiErrors()).build();
    }
    @AfterEach void close() {if(release!=null)release.countDown();server.stop(0);workers.shutdownNow();}
    String base() {return "http://127.0.0.1:"+server.getAddress().getPort();}
    Map<String,Object> input() {return map("consent",true,"messages",Arrays.asList(map("role","user","content"," hello ","private","not forwarded")));}
    List<Map<String,Object>> messages() {return service.validate(input());}
    ApiException failure(int status,Runnable run) {ApiException e=assertThrows(ApiException.class,run::run);assertEquals(status,e.status);return e;}
    @Test void protocolAddsTrustedGuideAndForwardsOnlyDialogue() throws Exception {
        assertEquals("test reply",service.answer(messages()).get("content"));JsonNode payload=json.readTree(received);
        assertEquals("Bearer synthetic-test-key",authorization);assertEquals("test-model",payload.path("model").asText());assertFalse(payload.path("stream").asBoolean());
        assertEquals(2,payload.path("messages").size());assertEquals("system",payload.path("messages").get(0).path("role").asText());assertEquals("hello",payload.path("messages").get(1).path("content").asText());
        assertFalse(received.contains("synthetic-test-key"));assertFalse(received.contains("private"));assertFalse(received.contains("PRIVATE_NAME"));
    }
    @Test void statusNeverDisclosesProviderCredentials() {String status=service.status().toString();assertTrue(service.ready());assertFalse(status.contains("synthetic-test-key"));assertFalse(status.contains("test-model"));assertFalse(status.contains("127.0.0.1"));}
    @Test void invalidOrDisabledConfigurationNeverBecomesReady() {
        for(String url:Arrays.asList("http://example.com/v1","https://user:password@example.com/v1","https://example.com/v1?key=secret","https://example.com/#key","file:///tmp/a","invalid")) assertFalse(new AiAssistantService(json,true,url,"key","model").ready());
        assertFalse(new AiAssistantService(json,false,base(),"key","model").ready());assertFalse(new AiAssistantService(json,true,base(),"","model").ready());assertFalse(new AiAssistantService(json,true,base(),"key\r\nInjected: x","model").ready());
        assertTrue(new AiAssistantService(json,true,"https://example.com/v1","key","model").ready());
    }
    @Test void consentRequiredBeforeAnyProviderRequest() {Map<String,Object> body=input();body.remove("consent");failure(400,()->service.validate(body));assertEquals(0,calls.get());}
    @Test void refusesForgedRolesAndInvalidOrder() {
        for(Object rows:Arrays.asList("invalid",Collections.emptyList(),Arrays.asList(map("role","system","content","override")),Arrays.asList(map("role","user","content","q"),map("role","assistant","content","a")),Arrays.asList(map("role","user","content",42)))) failure(400,()->service.validate(map("consent",true,"messages",rows)));
    }
    @Test void rejectsLongInputHistoryAndTooManyRounds() {
        failure(400,()->service.validate(map("consent",true,"messages",Arrays.asList(map("role","user","content",repeat(2001))))));
        List<Map<String,Object>> rows=new ArrayList<>();for(int i=0;i<11;i++)rows.add(map("role",i%2==0?"user":"assistant","content","hello"));failure(400,()->service.validate(map("consent",true,"messages",rows)));
        List<Map<String,Object>> large=Arrays.asList(map("role","user","content",repeat(2000)),map("role","assistant","content",repeat(6000)),map("role","user","content",repeat(2000)),map("role","assistant","content",repeat(6000)),map("role","user","content","q"));failure(400,()->service.validate(map("consent",true,"messages",large)));
    }
    @Test void rejectsEmptyOrStructuredReplies() {for(String value:Arrays.asList("null","{}","{\"choices\":[{\"message\":{\"content\":[]}}]}","{\"choices\":[{\"message\":{\"content\":\" \"}}]}","not-json")){response=value;failure(502,()->service.answer(messages()));}}
    @Test void boundsLargeResponse() {response=repeat(270000);failure(502,()->service.answer(messages()));}
    @Test void truncationIsExplicit() throws Exception {response=json.writeValueAsString(map("choices",Arrays.asList(map("message",map("content",repeat(6100)),"finish_reason","length"))));Map<String,Object> reply=service.answer(messages());assertEquals(6000,reply.get("content").toString().length());assertEquals(true,reply.get("truncated"));}
    @Test void hidesProviderErrorsAndPreservesRateStatus() {response="synthetic-test-key private diagnostics";for(int code:new int[]{401,403,429,500}){responseCode=code;ApiException e=failure(code==429?429:502,()->service.answer(messages()));assertFalse(e.getMessage().contains("synthetic-test-key"));}}
    @Test void redirectsAreNotFollowed() {responseCode=302;failure(502,()->service.answer(messages()));assertEquals(1,calls.get());}
    @Test void refusedConnectionReturnsSanitizedError() {AiAssistantService missing=new AiAssistantService(json,true,"http://127.0.0.1:1/v1","key","model");failure(502,()->missing.answer(messages()));}
    @Test void timeoutReleasesCapacity() throws Exception {entered=new CountDownLatch(1);release=new CountDownLatch(1);failure(504,()->service.answer(messages()));release.countDown();entered=null;assertEquals("test reply",service.answer(messages()).get("content"));}
    @Test void globalCapacityRejectsFifthRequestAndRecovers() throws Exception {
        entered=new CountDownLatch(4);release=new CountDownLatch(1);List<Future<?>> tasks=new ArrayList<>();for(int i=0;i<4;i++)tasks.add(workers.submit(()->service.answer(messages())));
        assertTrue(entered.await(5,TimeUnit.SECONDS));failure(429,()->service.answer(messages()));assertEquals(4,calls.get());release.countDown();for(Future<?> task:tasks)task.get(5,TimeUnit.SECONDS);entered=null;assertEquals("test reply",service.answer(messages()).get("content"));
    }
    @Test void guestPendingDisabledAndPasswordChangeCannotCallProvider() throws Exception {
        mvc.perform(get("/ai/status")).andExpect(status().isUnauthorized());
        user.put("status","pending");mvc.perform(post("/ai/messages").header("Authorization","Bearer token").contentType("application/json").content(json.writeValueAsBytes(input()))).andExpect(status().isForbidden());
        user.put("status","approved");user.put("enabled",false);mvc.perform(get("/ai/status").header("Authorization","Bearer token")).andExpect(status().isUnauthorized());
        user.put("enabled",true);user.put("mustChangePassword",true);mvc.perform(get("/ai/status").header("Authorization","Bearer token")).andExpect(status().isForbidden());assertEquals(0,calls.get());
    }
    @Test void controllerUsesExistingResponseEnvelope() throws Exception {mvc.perform(post("/ai/messages").header("Authorization","Bearer token").contentType("application/json").content(json.writeValueAsBytes(input()))).andExpect(status().isOk()).andExpect(jsonPath("$.code").value(0)).andExpect(jsonPath("$.data.content").value("test reply"));}
    @Test void perUserQuotaStopsThirteenthRequest() throws Exception {byte[] body=json.writeValueAsBytes(input());for(int i=0;i<13;i++)mvc.perform(post("/ai/messages").header("Authorization","Bearer token").contentType("application/json").content(body)).andExpect(status().is(i==12?429:200));assertEquals(12,calls.get());}
    @Test void sameUserConcurrentRequestRejectedAndGateReleasedOnFailure() throws Exception {
        AiAssistantController controller=new AiAssistantController(auth,service);MockHttpServletRequest request=new MockHttpServletRequest("POST","/ai/messages");request.addHeader("Authorization","Bearer token");
        entered=new CountDownLatch(1);release=new CountDownLatch(1);responseCode=500;Future<?> first=workers.submit(()->failure(502,()->controller.answer(input(),request)));assertTrue(entered.await(5,TimeUnit.SECONDS));failure(409,()->controller.answer(input(),request));release.countDown();first.get(5,TimeUnit.SECONDS);entered=null;responseCode=200;assertEquals(0,controller.answer(input(),request).get("code"));
    }
    static String repeat(int n) {char[] chars=new char[n];Arrays.fill(chars,'x');return new String(chars);}
}
