package com.example.Kcsj.membership;

import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import javax.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;
import static com.example.Kcsj.membership.MemberStore.*;
import static com.example.Kcsj.membership.MemberData.*;

@RestController @Transactional
public class ShopController {
    private final MemberStore store;private final MemberAuth auth;private final MediaService media;
    public ShopController(MemberStore store,MemberAuth auth,MediaService media){this.store=store;this.auth=auth;this.media=media;}
    private Map<String,Object> ok(Object row){return map("code",0,"data",row);}
    private int revision(Map<String,Object> row){return row.get("stockRevision") instanceof Number?((Number)row.get("stockRevision")).intValue():0;}
    private int cents(Map<String,Object> input,String field){try{BigDecimal value=new BigDecimal(s(input,field));int n=value.movePointRight(2).intValueExact();if(n<0||n>10000000)throw new Exception();return n;}catch(Exception e){throw new ApiException(400,"价格须为0至100000元且最多两位小数");}}
    @GetMapping("/products") public Map<String,Object> products(@RequestParam(defaultValue="false") boolean manage,HttpServletRequest req){Map<String,Object> actor=auth.optional(req);if(manage&&!auth.isAdmin(actor))throw new ApiException(403,"仅管理员可管理商品");return ok(store.all("product").stream().filter(p->manage||s(p,"status").equals("published")).sorted(Comparator.comparing((Map<String,Object> p)->s(p,"updatedAt")).reversed()).collect(Collectors.toList()));}
    @PostMapping("/products") public Map<String,Object> save(@RequestBody Map<String,Object> input,HttpServletRequest req){
        store.lockWrites();Map<String,Object> actor=auth.admin(req);String id=text(input,"id",0,80);Map<String,Object> row=id.isEmpty()?map("id",id(),"createdAt",now()):store.get("product",id);
        if(!id.isEmpty()&&revision(input)!=revision(row))throw new ApiException(409,"商品库存或资料已变化，请刷新商品后重新编辑");
        row.put("stockRevision",revision(row)+1);
        Object raw=input.get("images");if(!(raw instanceof List)||((List<?>)raw).size()>8)throw new ApiException(400,"每个商品最多8张图片");List<String> images=new ArrayList<>();for(Object item:(List<?>)raw){if(!(item instanceof String))throw new ApiException(400,"图片编号无效");images.add(media.bindImage((String)item,"product",actor));}
        int price=cents(input,"price"),shipping=cents(input,"shippingFee");if(price<1)throw new ApiException(400,"商品价格须大于0");String state=choice(input,"status","draft","published","withdrawn");if(state.equals("published")&&images.isEmpty())throw new ApiException(400,"上架商品至少需要一张真实商品图片");
        row.putAll(map("title",text(input,"title",2,80),"category",choice(input,"category","家乡美食","农副产品","手工文创","其他特产"),"description",text(input,"description",10,5000),"specification",text(input,"specification",2,150),"origin",text(input,"origin",2,100),"seller",text(input,"seller",2,100),"sellerContact",text(input,"sellerContact",5,80),"afterSales",text(input,"afterSales",10,1000),"priceCents",price,"shippingCents",shipping,"stock",number(input,"stock",0,1000000),"images",images,"status",state,"updatedAt",now()));store.save("product",row);auth.audit(actor,"shop.product-save",s(row,"id"));return ok(row);
    }
    @PostMapping("/orders") public Map<String,Object> order(@RequestBody Map<String,Object> input,HttpServletRequest req){
        store.lockWrites();Map<String,Object> actor=auth.require(req);auth.member(actor);if(!flag(input,"consent"))throw new ApiException(400,"请确认下单与线下结算说明");String request=text(input,"requestId",36,36);try{UUID.fromString(request);}catch(Exception e){throw new ApiException(400,"订单请求编号无效");}
        String productId=text(input,"productId",1,80),method=choice(input,"delivery","shipping","pickup"),name=text(input,"name",2,30),phone=text(input,"phone",11,11),address=text(input,"address",method.equals("shipping")?5:0,300);if(!phone.matches("1[3-9][0-9]{9}"))throw new ApiException(400,"请填写有效手机号");int quantity=number(input,"quantity",1,99);String fingerprint=auth.digest(productId+"|"+quantity+"|"+method+"|"+name+"|"+phone+"|"+address),orderId=s(actor,"id")+":"+request;
        Optional<Map<String,Object>> previous=store.all("order").stream().filter(o->s(o,"id").equals(orderId)).findFirst();if(previous.isPresent()){if(!s(previous.get(),"fingerprint").equals(fingerprint))throw new ApiException(409,"同一请求不能用于不同订单");return ok(previous.get());}
        Map<String,Object> product=store.get("product",productId);if(!s(product,"status").equals("published"))throw new ApiException(409,"商品已下架");int stock=((Number)product.get("stock")).intValue();if(quantity>stock)throw new ApiException(409,"库存不足，请调整数量");auth.limit("shop-order:"+s(actor,"id"),20);
        int unit=((Number)product.get("priceCents")).intValue(),shipping=method.equals("shipping")?((Number)product.get("shippingCents")).intValue():0;
        Map<String,Object> row=map("id",orderId,"orderNo","SY"+UUID.randomUUID().toString().replace("-","").substring(0,16).toUpperCase(Locale.ROOT),"buyerId",s(actor,"id"),"productId",productId,"title",s(product,"title"),"specification",s(product,"specification"),"seller",s(product,"seller"),"sellerContact",s(product,"sellerContact"),"afterSales",s(product,"afterSales"),"unitCents",unit,"quantity",quantity,"shippingCents",shipping,"totalCents",((long)unit)*quantity+shipping,"delivery",method,"name",name,"phone",phone,"address",address,"status","pending","settlement","unconfirmed","fingerprint",fingerprint,"createdAt",now());
        product.put("stock",stock-quantity);product.put("stockRevision",revision(product)+1);store.save("product",product);store.save("order",row);auth.audit(actor,"shop.order",orderId);return ok(row);
    }
    @GetMapping("/orders") public Map<String,Object> orders(@RequestParam(defaultValue="false") boolean manage,HttpServletRequest req){Map<String,Object> actor=auth.require(req);if(manage&&!auth.isAdmin(actor))throw new ApiException(403,"仅管理员可处理订单");return ok(store.all("order").stream().filter(o->manage||s(o,"buyerId").equals(s(actor,"id"))).sorted(Comparator.comparing((Map<String,Object> o)->s(o,"createdAt")).reversed()).collect(Collectors.toList()));}
    @PostMapping("/orders/{id}/action") public Map<String,Object> action(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req){
        store.lockWrites();Map<String,Object> actor=auth.require(req),row=store.get("order",id);boolean admin=auth.isAdmin(actor),buyer=s(row,"buyerId").equals(s(actor,"id"));if(!admin&&!buyer)throw new ApiException(403,"只能处理本人的订单");String action=choice(input,"action","confirm","cancel","settle","refund","ship","ready","receive"),state=s(row,"status");
        if(action.equals("cancel")||action.equals("refund")){
            if(state.equals("cancelled"))return ok(row);if(!Arrays.asList("pending","confirmed").contains(state))throw new ApiException(409,"已进入履约流程，请联系卖家处理售后");
            if(action.equals("refund")){if(!admin||!s(row,"settlement").equals("confirmed"))throw new ApiException(403,"仅管理员可登记已核实的线下退款");row.put("settlement","refunded");row.put("settlementNote",text(input,"note",5,300));}else if(s(row,"settlement").equals("confirmed"))throw new ApiException(409,"请先由管理员核实线下退款");
            Map<String,Object> product=store.get("product",s(row,"productId"));product.put("stock",((Number)product.get("stock")).intValue()+((Number)row.get("quantity")).intValue());product.put("stockRevision",revision(product)+1);store.save("product",product);row.put("status","cancelled");
        }else if(action.equals("receive")){if(!buyer||!Arrays.asList("shipped","ready").contains(state))throw new ApiException(409,"本人收到商品后才可确认收货");row.put("status","completed");}
        else {
            if(!admin)throw new ApiException(403,"仅管理员可以确认、结算或发货");
            if(action.equals("confirm")){if(!state.equals("pending"))throw new ApiException(409,"订单已处理");row.put("status","confirmed");}
            if(action.equals("settle")){if(!Arrays.asList("confirmed","shipped","ready","completed").contains(state)||s(row,"settlement").equals("confirmed"))throw new ApiException(409,"请先确认订单，勿重复登记结算");if(!flag(input,"verified"))throw new ApiException(400,"须核实线下结算");row.put("settlement","confirmed");row.put("settlementNote",text(input,"note",5,300));}
            if(action.equals("ship")||action.equals("ready")){if(!state.equals("confirmed"))throw new ApiException(409,"确认订单后才能履约");if(action.equals("ship")!=s(row,"delivery").equals("shipping"))throw new ApiException(400,"操作与配送方式不符");row.put("fulfillment",text(input,"note",5,300));row.put("status",action.equals("ship")?"shipped":"ready");}
        }
        row.put("updatedAt",now());store.save("order",row);auth.audit(actor,"shop."+action,id);return ok(row);
    }
}
