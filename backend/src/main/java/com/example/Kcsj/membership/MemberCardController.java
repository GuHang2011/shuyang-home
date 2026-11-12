package com.example.Kcsj.membership;

import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import static com.example.Kcsj.membership.MemberStore.*;

/** Short-lived membership proof, independent of login sessions and activity check-in. */
@RestController
@RequestMapping("/membership")
public class MemberCardController {
    private final MemberStore store;private final MemberAuth auth;private final SecureRandom random=new SecureRandom();
    public MemberCardController(MemberStore store,MemberAuth auth) {this.store=store;this.auth=auth;}
    @PostMapping("card-code") @Transactional
    public Map<String,Object> issue(HttpServletRequest request) {
        store.lockWrites();Map<String,Object> user=auth.require(request);auth.member(user);auth.limit("member-card:"+s(user,"id"),30);
        if(s(user,"memberNo").isEmpty())throw new ApiException(409,"会员编号尚未生成，请联系管理员");
        Map<String,Object> previous=null;
        try {previous=store.get("member_card_owner",s(user,"id"));} catch(ApiException e) {if(e.status!=404)throw e;}
        if(previous!=null)store.delete("member_card",s(previous,"codeHash"));
        byte[] bytes=new byte[24];random.nextBytes(bytes);StringBuilder token=new StringBuilder("SYH-MEMBER:");for(byte b:bytes)token.append(String.format("%02X",b));
        String code=token.toString(),hash=auth.digest(code);Instant now=Instant.now(),expiry=now.plusSeconds(600);
        store.save("member_card",map("id",hash,"userId",s(user,"id"),"expiresAt",expiry.toString()));
        store.save("member_card_owner",map("id",s(user,"id"),"codeHash",hash));
        return map("code",0,"data",map("code",code,"serverNow",now.toString(),"expiresAt",expiry.toString(),"demo",false));
    }
    @PostMapping("verify-card") @Transactional
    public Map<String,Object> verify(@RequestBody Map<String,Object> input,HttpServletRequest request) {
        store.lockWrites();Map<String,Object> operator=auth.staff(request);auth.limit("verify-card:"+s(operator,"id"),120);
        Object raw=input.get("code");if(!(raw instanceof String)||!((String)raw).matches("SYH-MEMBER:[A-F0-9]{48}"))throw new ApiException(400,"请扫描沭阳之家电子会员卡二维码");
        Map<String,Object> card,user;
        try {card=store.get("member_card",auth.digest((String)raw));user=store.get("user",s(card,"userId"));}catch(ApiException e){if(e.status!=404)throw e;throw new ApiException(409,"会员码已失效，请持卡人刷新后重试");}
        if(!Instant.now().isBefore(Instant.parse(s(card,"expiresAt")))||!b(user,"enabled")||!s(user,"status").equals("approved")||b(user,"mustChangePassword")||s(user,"memberNo").isEmpty())throw new ApiException(409,"会员码已失效或会员状态不可用，请持卡人刷新后重试");
        return map("code",0,"data",map("name",s(user,"name"),"memberNo",s(user,"memberNo"),"status","approved","verifiedAt",now(),"demo",false));
    }
}
