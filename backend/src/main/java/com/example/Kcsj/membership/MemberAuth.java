package com.example.Kcsj.membership;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import javax.annotation.PostConstruct;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import javax.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import static com.example.Kcsj.membership.MemberStore.*;
import static com.example.Kcsj.membership.MemberData.*;

/** Adapted from the counselor system: salted password hashes and revocable hashed sessions. */
@Service
public class MemberAuth {
    private final MemberStore store;
    private final SecureRandom random=new SecureRandom();
    private final Map<String,long[]> attempts=new HashMap<>();
    @Value("${shuyang.admin-password:}") private String initialPassword;
    public MemberAuth(MemberStore store) { this.store=store; }

    @PostConstruct public void bootstrap() {
        if(store.all("user").stream().anyMatch(u->s(u,"role").equals("superadmin"))) return;
        Optional<Map<String,Object>> legacy=store.all("user").stream().filter(u->s(u,"username").equals("admin")&&s(u,"role").equals("admin")).findFirst();
        if(legacy.isPresent()){Map<String,Object> admin=legacy.get();admin.put("role","superadmin");store.save("user",admin);store.revoke(s(admin,"id"));audit(admin,"account.superadmin-migration",s(admin,"id"));return;}
        if(store.all("user").stream().anyMatch(u->s(u,"role").equals("admin"))||initialPassword.isEmpty()) return;
        passwordPolicy(initialPassword);
        Map<String,Object> admin=map("id",id(),"username","admin","name","平台管理员","phone","","role","superadmin",
            "status","approved","enabled",true,"mustChangePassword",true,"createdAt",now(),
            "passwordHash",hashPassword(initialPassword),"directoryVisible",false,"phoneVisible",false);
        store.save("user",admin);
        audit(admin,"account.bootstrap",s(admin,"id"));
    }
    public synchronized void limit(String key,int max) {
        long current=System.currentTimeMillis();
        if(attempts.size()>5000) attempts.entrySet().removeIf(e->current-e.getValue()[0]>900000);
        if(attempts.size()>10000) throw new ApiException(429,"访问繁忙，请稍后再试");
        long[] count=attempts.computeIfAbsent(key,k->new long[]{current,0});
        if(current-count[0]>900000) { count[0]=current; count[1]=0; }
        if(++count[1]>max) throw new ApiException(429,"尝试次数过多，请15分钟后重试");
    }
    @Transactional public Map<String,Object> register(Map<String,Object> input,String remote) {
        limit("register:"+remote,10);
        store.lockWrites();
        if(!flag(input,"consent")) throw new ApiException(400,"请阅读并同意隐私说明和自愿参与约定");
        String phone=text(input,"phone",11,11);
        if(!phone.matches("1[3-9][0-9]{9}")) throw new ApiException(400,"请输入有效的11位手机号");
        if(store.all("user").stream().anyMatch(u->s(u,"username").equals(phone))) throw new ApiException(409,"该手机号已申请，请直接登录或联系管理员");
        String password=text(input,"password",12,128); passwordPolicy(password);
        Map<String,Object> user=profile(input);
        user.putAll(map("id",id(),"username",phone,"phone",phone,"passwordHash",hashPassword(password),"role","member",
            "status","pending","enabled",true,"createdAt",now(),"consentAt",now(),"consentVersion","2026-10-27",
            "mustChangePassword",false,"reviewNote",""));
        store.save("user",user); audit(user,"membership.apply",s(user,"id"));
        return session(user);
    }
    @Transactional public Map<String,Object> login(Map<String,Object> input,String remote) {
        String username=text(input,"username",1,80).toLowerCase(Locale.ROOT);
        String password=text(input,"password",1,128);
        limit("login-ip:"+remote,100); limit("login:"+remote+":"+username,10);
        store.lockWrites();
        Map<String,Object> user=store.all("user").stream().filter(u->s(u,"username").equals(username)).findFirst().orElse(null);
        if(user==null||!verify(password,s(user,"passwordHash"))) throw new ApiException(401,"账号或密码错误");
        if(!b(user,"enabled")) throw new ApiException(403,"账号已停用，请联系管理员");
        audit(user,"auth.login",s(user,"id")); return session(user);
    }
    public Map<String,Object> optional(HttpServletRequest request) {
        return request.getHeader("Authorization")==null?null:require(request);
    }
    public Map<String,Object> require(HttpServletRequest request) {
        String token=request.getHeader("Authorization");
        if(token==null||!token.startsWith("Bearer ")||token.length()>200) throw new ApiException(401,"请先登录");
        Map<String,Object> user=store.get("user",store.sessionUser(digest(token.substring(7))));
        if(!b(user,"enabled")) throw new ApiException(401,"账号已停用，请联系管理员");
        String path=request.getRequestURI();
        if(b(user,"mustChangePassword")&&!Arrays.asList("/auth/me","/auth/password","/auth/logout").contains(path))
            throw new ApiException(403,"PASSWORD_CHANGE_REQUIRED","请先修改初始密码");
        return user;
    }
    public void member(Map<String,Object> user) {
        if(user==null) throw new ApiException(401,"请先登录");
        if(!s(user,"status").equals("approved")) throw new ApiException(403,"入会审核通过后即可参与，请在“我的”查看进度");
    }
    public boolean isStaff(Map<String,Object> user) { return user!=null&&Arrays.asList("superadmin","admin","organizer").contains(s(user,"role"))&&s(user,"status").equals("approved"); }
    public boolean isAdmin(Map<String,Object> user) { return isStaff(user)&&Arrays.asList("superadmin","admin").contains(s(user,"role")); }
    public boolean isSuper(Map<String,Object> user) { return isAdmin(user)&&s(user,"role").equals("superadmin"); }
    public Map<String,Object> staff(HttpServletRequest request) {
        Map<String,Object> user=require(request);
        if(!isStaff(user)) throw new ApiException(403,"仅管理员或志愿组织者可以操作");
        return user;
    }
    public Map<String,Object> admin(HttpServletRequest request) {
        Map<String,Object> user=staff(request);
        if(!isAdmin(user)) throw new ApiException(403,"仅管理员可以操作");
        return user;
    }
    public Map<String,Object> session(Map<String,Object> user) {
        byte[] bytes=new byte[32];random.nextBytes(bytes);
        String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        store.session(digest(token),s(user,"id"),System.currentTimeMillis()+12*60*60*1000L);
        return map("token",token,"user",self(user));
    }
    @Transactional public Map<String,Object> changePassword(HttpServletRequest request,Map<String,Object> input) {
        store.lockWrites(); Map<String,Object> user=require(request);
        limit("password:"+s(user,"id"),10);
        String old=text(input,"oldPassword",1,128), next=text(input,"newPassword",12,128);
        if(!verify(old,s(user,"passwordHash"))) throw new ApiException(400,"原密码不正确");
        passwordPolicy(next); if(old.equals(next)) throw new ApiException(400,"新密码不能与原密码相同");
        user.put("passwordHash",hashPassword(next));user.put("mustChangePassword",false);
        store.save("user",user);store.revoke(s(user,"id"));audit(user,"auth.password",s(user,"id"));return session(user);
    }
    @Transactional public void logout(HttpServletRequest request) {
        require(request);store.logout(digest(request.getHeader("Authorization").substring(7)));
    }
    public void audit(Map<String,Object> actor,String action,String target) {
        store.save("audit",map("id",id(),"time",now(),"operator",s(actor,"name"),"operatorId",s(actor,"id"),"action",action,"target",target));
    }
    public void passwordPolicy(String password) {
        if(password.length()<12||password.length()>128||!password.matches(".*[A-Za-z].*")||!password.matches(".*[0-9].*"))
            throw new ApiException(400,"密码须为12至128位，且包含字母和数字");
    }
    public String hashPassword(String password) {
        byte[] salt=new byte[16];random.nextBytes(salt);
        return "pbkdf2$120000$"+Base64.getEncoder().encodeToString(salt)+"$"+Base64.getEncoder().encodeToString(pbkdf2(password,salt,120000));
    }
    public boolean verify(String password,String encoded) {
        try {String[] parts=encoded.split("\\$");return parts.length==4&&MessageDigest.isEqual(Base64.getDecoder().decode(parts[3]),pbkdf2(password,Base64.getDecoder().decode(parts[2]),Integer.parseInt(parts[1])));}
        catch(Exception e) { return false; }
    }
    private byte[] pbkdf2(String password,byte[] salt,int rounds) {
        PBEKeySpec spec=new PBEKeySpec(password.toCharArray(),salt,rounds,256);
        try {return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();}
        catch(Exception e) {throw new IllegalStateException(e);} finally {spec.clearPassword();}
    }
    public String digest(String value) {
        try {byte[] bytes=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));StringBuilder out=new StringBuilder();for(byte v:bytes)out.append(String.format("%02x",v));return out.toString();}
        catch(Exception e) {throw new IllegalStateException(e);}
    }
}
