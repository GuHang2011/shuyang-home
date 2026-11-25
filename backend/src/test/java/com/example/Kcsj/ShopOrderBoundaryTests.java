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
import java.util.*;
import java.util.concurrent.*;
import static com.example.Kcsj.membership.MemberStore.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:shop-order-boundaries;DB_CLOSE_DELAY=-1","shuyang.admin-password=","shuyang.data-key="})
@AutoConfigureMockMvc
class ShopOrderBoundaryTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired MemberStore store;
    @Autowired MemberAuth auth;
    @Autowired JdbcTemplate jdbc;
    Map<String,Object> admin, secondAdmin, buyer, other;

    @BeforeEach void setup() {
        jdbc.update("DELETE FROM syh_record");jdbc.update("DELETE FROM syh_session");
        admin=actor("superadmin");secondAdmin=actor("admin");buyer=actor("member");other=actor("member");
    }
    Map<String,Object> actor(String role) {
        Map<String,Object> user=map("id",id(),"name","商城边界验收","role",role,"status","approved","enabled",true);
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
    String product(int stock) {
        Map<String,Object> row=map("id",id(),"title","合成测试特产","specification","500克每袋","seller","测试供货商","sellerContact","仅供测试联系","afterSales","仅供自动测试的售后说明","status","published","stock",stock,"stockRevision",1,"priceCents",1250,"shippingCents",500);
        store.save("product",row);return s(row,"id");
    }
    Map<String,Object> orderBody(String product,String delivery,int quantity) {
        return map("productId",product,"requestId",UUID.randomUUID().toString(),"quantity",quantity,"delivery",delivery,"name","合成买家","phone","13800000001","address",delivery.equals("shipping")?"合成测试收货地址":"","consent",true);
    }
    String order(String product,String delivery) throws Exception {return s(data(call("POST","/orders",buyer,orderBody(product,delivery,2),200)),"id");}
    Map<String,Object> action(String id,Map<String,Object> actor,String action,String note,int expected) throws Exception {
        return data(call("POST","/orders/"+id+"/action",actor,map("action",action,"note",note,"verified",action.equals("settle")),expected));
    }
    long audits(String action,String id){return store.all("audit").stream().filter(r->s(r,"action").equals("shop."+action)&&s(r,"target").equals(id)).count();}
    void unchanged(String id,Map<String,Object> original,Map<String,Object> originalProduct,String action,long notifications) {
        assertEquals(original,store.get("order",id));assertEquals(originalProduct,store.get("product",s(original,"productId")));
        assertEquals(1,audits(action,id));assertTrue(notifications>0);assertEquals(notifications,store.all("business_notice").size());
    }

    @Test void repeatedConfirmationKeepsFirstRecordAndDoesNotRegressFulfilledOrder() throws Exception {
        String product=product(5),order=order(product,"shipping");
        action(order,admin,"confirm","",200);Map<String,Object> original=store.get("order",order),stock=store.get("product",product);long notices=store.all("business_notice").size();
        action(order,secondAdmin,"confirm","",200);unchanged(order,original,stock,"confirm",notices);
        action(order,buyer,"confirm","",403);action(order,admin,"ship","合成物流单号12345",200);
        original=store.get("order",order);notices=store.all("business_notice").size();action(order,admin,"confirm","",200);unchanged(order,original,stock,"confirm",notices);
        action(order,buyer,"cancel","",409);
    }
    @Test void repeatedSettlementRequiresSameVerifiedRecordAndDoesNotRewriteIt() throws Exception {
        String product=product(5),order=order(product,"shipping");action(order,admin,"confirm","",200);action(order,admin,"settle","合成线下收款记录",200);
        Map<String,Object> original=store.get("order",order),stock=store.get("product",product);long notices=store.all("business_notice").size();
        action(order,secondAdmin,"settle","合成线下收款记录",200);unchanged(order,original,stock,"settle",notices);
        action(order,admin,"settle","不同的收款记录",409);action(order,buyer,"settle","合成线下收款记录",403);
        call("POST","/orders/"+order+"/action",admin,map("action","settle","note","合成线下收款记录","verified",false),400);
        action(order,buyer,"cancel","",409);assertEquals(3,store.get("product",product).get("stock"));
    }
    @Test void repeatedShippingAndReceiptPreserveFulfillmentAndNeverReturnStock() throws Exception {
        String product=product(5),order=order(product,"shipping");action(order,admin,"confirm","",200);action(order,admin,"ship","合成物流单号12345",200);
        Map<String,Object> original=store.get("order",order),stock=store.get("product",product);long notices=store.all("business_notice").size();
        action(order,secondAdmin,"ship","合成物流单号12345",200);unchanged(order,original,stock,"ship",notices);
        action(order,admin,"ship","另一个物流单号67890",409);action(order,admin,"ready","合成取货地点说明",400);
        action(order,other,"receive","",403);action(order,admin,"receive","",409);action(order,buyer,"receive","",200);
        original=store.get("order",order);notices=store.all("business_notice").size();action(order,buyer,"receive","",200);unchanged(order,original,stock,"receive",notices);
        action(order,admin,"ship","合成物流单号12345",200);unchanged(order,original,stock,"ship",notices);action(order,buyer,"cancel","",409);
    }
    @Test void repeatedPickupReadyAndReceiptUseTheSameDeliveryBoundary() throws Exception {
        String product=product(5),order=order(product,"pickup");action(order,admin,"confirm","",200);action(order,admin,"ready","合成社区地点明天自提",200);
        Map<String,Object> original=store.get("order",order),stock=store.get("product",product);long notices=store.all("business_notice").size();
        action(order,secondAdmin,"ready","合成社区地点明天自提",200);unchanged(order,original,stock,"ready",notices);
        action(order,admin,"ready","其他社区地点后天自提",409);action(order,admin,"ship","合成物流单号12345",400);
        action(order,buyer,"receive","",200);original=store.get("order",order);notices=store.all("business_notice").size();
        action(order,buyer,"receive","",200);unchanged(order,original,stock,"receive",notices);action(order,admin,"ready","合成社区地点明天自提",200);unchanged(order,original,stock,"ready",notices);
        assertEquals(2500,original.get("totalCents"));
    }
    @Test void repeatedCancellationOrRefundRestoresStockOnlyOnceAndStaleOrderRetryStaysCancelled() throws Exception {
        for(boolean refund:Arrays.asList(false,true)) {
            String product=product(5);Map<String,Object> body=orderBody(product,"shipping",2);String order=s(data(call("POST","/orders",buyer,body,200)),"id");
            if(refund){action(order,admin,"confirm","",200);action(order,admin,"settle","合成线下收款记录",200);action(order,buyer,"refund","合成线下退款记录",403);}
            String action=refund?"refund":"cancel",note=refund?"合成线下退款记录":"";Map<String,Object> actor=refund?admin:buyer;
            action(order,actor,action,note,200);Map<String,Object> original=store.get("order",order),stock=store.get("product",product);long notices=store.all("business_notice").size();
            action(order,actor,action,note,200);unchanged(order,original,stock,action,notices);assertEquals(5,stock.get("stock"));
            assertEquals("cancelled",s(data(call("POST","/orders",buyer,body,200)),"status"));unchanged(order,original,stock,action,notices);
            Map<String,Object> changed=new LinkedHashMap<>(body);changed.put("quantity",1);call("POST","/orders",buyer,changed,409);
            action(order,admin,"confirm","",409);action(order,admin,"ship","合成物流单号12345",409);action(order,buyer,"receive","",409);
            action(order,other,"cancel","",403);
        }
    }
    @Test void simultaneousCancellationOnlyReleasesInventoryOnce() throws Exception {
        String product=product(5),order=order(product,"shipping"),path="/orders/"+order+"/action";Map<String,Object> body=map("action","cancel");
        ExecutorService pool=Executors.newFixedThreadPool(2);CountDownLatch ready=new CountDownLatch(1);
        try {
            Future<Integer> one=pool.submit(()->{ready.await();return mvc.perform(req("POST",path,buyer,body)).andReturn().getResponse().getStatus();});
            Future<Integer> two=pool.submit(()->{ready.await();return mvc.perform(req("POST",path,admin,body)).andReturn().getResponse().getStatus();});
            ready.countDown();assertEquals(200,one.get(15,TimeUnit.SECONDS));assertEquals(200,two.get(15,TimeUnit.SECONDS));
        } finally {pool.shutdownNow();}
        assertEquals(5,store.get("product",product).get("stock"));assertEquals(3,store.get("product",product).get("stockRevision"));assertEquals(1,audits("cancel",order));
    }
    @Test void cancelledUnpaidOrderCannotBeMisreportedAsSuccessfullyRefunded() throws Exception {
        String product=product(5),order=order(product,"shipping");action(order,buyer,"cancel","",200);
        Map<String,Object> original=store.get("order",order),stock=store.get("product",product);long notices=store.all("business_notice").size();
        action(order,admin,"refund","管理员合成退款说明",409);action(order,buyer,"refund","管理员合成退款说明",403);
        action(order,admin,"cancel","",200);unchanged(order,original,stock,"cancel",notices);
        assertEquals("unconfirmed",s(store.get("order",order),"settlement"));assertEquals(0,audits("refund",order));
    }
    @Test void refundRetryRequiresAdminAndMatchingOriginalNote() throws Exception {
        String product=product(5),order=order(product,"shipping");action(order,admin,"confirm","",200);action(order,admin,"settle","合成线下收款记录",200);action(order,admin,"refund","首次核实的退款记录",200);
        Map<String,Object> original=store.get("order",order),stock=store.get("product",product);long notices=store.all("business_notice").size();
        action(order,secondAdmin,"refund","首次核实的退款记录",200);unchanged(order,original,stock,"refund",notices);
        action(order,secondAdmin,"refund","不同的线下退款记录",409);action(order,buyer,"refund","首次核实的退款记录",403);
        action(order,buyer,"cancel","",200);unchanged(order,original,stock,"refund",notices);
        assertEquals("refunded",s(original,"settlement"));assertEquals(5,stock.get("stock"));
    }
    Map<String,Object> quotedOrder(String product,String delivery) {
        Map<String,Object> body=orderBody(product,delivery,2);body.put("expectedUnitCents",1250);body.put("expectedShippingCents",delivery.equals("shipping")?500:0);return body;
    }
    void rejectedWithoutWrites(Map<String,Object> body,int expected) throws Exception {
        Map<String,Object> product=store.get("product",s(body,"productId"));List<Map<String,Object>> orders=store.all("order"),audit=store.all("audit"),notices=store.all("business_notice");
        call("POST","/orders",buyer,body,expected);
        assertEquals(product,store.get("product",s(body,"productId")));assertEquals(orders,store.all("order"));assertEquals(audit,store.all("audit"));assertEquals(notices,store.all("business_notice"));
    }
    @Test void changedUnitPriceRequiresReconfirmationBeforeReservingInventory() throws Exception {
        String product=product(5);Map<String,Object> body=quotedOrder(product,"shipping"),current=store.get("product",product);
        // Simulate an administrator's price change between viewing the product and submitting.
        current.put("priceCents",1500);store.save("product",current);rejectedWithoutWrites(body,409);
        body.put("expectedUnitCents",1500);Map<String,Object> saved=data(call("POST","/orders",buyer,body,200));
        assertEquals(3500L,((Number)saved.get("totalCents")).longValue());assertEquals(3,store.get("product",product).get("stock"));
    }
    @Test void changedShippingFeeRequiresReconfirmationButDoesNotAffectPickup() throws Exception {
        String product=product(5);Map<String,Object> body=quotedOrder(product,"shipping"),current=store.get("product",product);
        current.put("shippingCents",700);store.save("product",current);rejectedWithoutWrites(body,409);
        Map<String,Object> pickup=data(call("POST","/orders",buyer,quotedOrder(product,"pickup"),200));
        assertEquals(0,pickup.get("shippingCents"));assertEquals(2500L,((Number)pickup.get("totalCents")).longValue());
        body.put("expectedShippingCents",700);assertEquals(3200L,((Number)data(call("POST","/orders",buyer,body,200)).get("totalCents")).longValue());
    }
    @Test void successfulRequestReplayPrecedesPriceChecksAndReturnsOriginalAmounts() throws Exception {
        String product=product(5);Map<String,Object> body=quotedOrder(product,"shipping"),saved=data(call("POST","/orders",buyer,body,200));String order=s(saved,"id");
        Map<String,Object> changed=store.get("product",product);changed.put("priceCents",1800);changed.put("shippingCents",800);changed.put("status","withdrawn");store.save("product",changed);
        Map<String,Object> original=store.get("order",order);assertEquals(original,data(call("POST","/orders",buyer,body,200)));assertEquals(changed,store.get("product",product));assertEquals(1,audits("order",order));
        assertEquals(3000L,((Number)original.get("totalCents")).longValue());action(order,buyer,"cancel","",200);Map<String,Object> cancelled=store.get("order",order),stock=store.get("product",product);
        assertEquals(cancelled,data(call("POST","/orders",buyer,body,200)));assertEquals(stock,store.get("product",product));assertEquals(1,store.all("order").size());
    }
    @Test void legacyOrdersRemainCompatibleButPartialOrFractionalQuotesAreRejected() throws Exception {
        String product=product(5);Map<String,Object> body=orderBody(product,"shipping",2),current=store.get("product",product);current.put("priceCents",1500);store.save("product",current);
        assertEquals(3500L,((Number)data(call("POST","/orders",buyer,body,200)).get("totalCents")).longValue());
        Map<String,Object> invalid=quotedOrder(product,"shipping");invalid.remove("expectedShippingCents");rejectedWithoutWrites(invalid,400);
        invalid.put("expectedShippingCents",500);invalid.put("expectedUnitCents",1500.5);rejectedWithoutWrites(invalid,400);
        invalid.put("expectedUnitCents",1500);invalid.put("expectedShippingCents",-1);rejectedWithoutWrites(invalid,400);
    }
}
