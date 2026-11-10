package com.example.Kcsj.membership;

import org.springframework.stereotype.Service;
import java.util.*;
import static com.example.Kcsj.membership.MemberStore.*;

@Service
public class ForumPolicy {
    public static final String RAILWAY_BOARD="淮新高铁";
    public static final List<String> BOARDS=Arrays.asList("乡情闲聊","苏州生活","创业交流","家乡故事",RAILWAY_BOARD);
    public static final List<String> RAILWAY_TYPES=Arrays.asList("进展讨论","站点与接驳","返乡出行","资料分享","提问求证");
    public static Map<String,Object> railwayMetadata(Map<String,Object> input,String board) {
        if(!RAILWAY_BOARD.equals(board))return Collections.emptyMap();
        String type=MemberData.text(input,"discussionType",0,40);
        if(type.isEmpty())type=RAILWAY_TYPES.get(0);
        if(!RAILWAY_TYPES.contains(type))throw new ApiException(400,"请选择有效的高铁话题类型");
        String name=MemberData.text(input,"sourceName",0,100),url=MemberData.text(input,"sourceUrl",0,1000);
        if(name.isEmpty()!=url.isEmpty())throw new ApiException(400,"来源名称与原文链接请一起填写");
        if(!url.isEmpty()) {
            try {
                java.net.URI uri=new java.net.URI(url);
                if(!Arrays.asList("http","https").contains(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null||uri.getPort()>65535||url.matches(".*[\\\\<>\\p{Cntrl}].*"))throw new IllegalArgumentException();
            }catch(Exception e){throw new ApiException(400,"原文链接须为有效的http或https地址，不可包含账号信息");}
        }
        return map("discussionType",type,"sourceName",name,"sourceUrl",url);
    }
    private final MemberStore store;private final MemberAuth auth;
    public ForumPolicy(MemberStore store,MemberAuth auth){this.store=store;this.auth=auth;}
    public boolean moderates(Map<String,Object> actor,String board){return auth.isStaff(actor)||(actor!=null&&b(actor,"enabled")&&s(actor,"status").equals("approved")&&s(actor,"role").equals("moderator")&&actor.get("forumBoards") instanceof List&&((List<?>)actor.get("forumBoards")).contains(board));}
    public void requireModerator(Map<String,Object> actor,String board){if(!moderates(actor,board))throw new ApiException(403,"你没有该板块的管理权限");}
    public boolean blocked(String first,String second){return store.all("member_block").stream().anyMatch(r->b(r,"active")&&((s(r,"ownerId").equals(first)&&s(r,"targetId").equals(second))||(s(r,"ownerId").equals(second)&&s(r,"targetId").equals(first))));}
    public boolean hiddenAuthor(Map<String,Object> actor,String author){return actor!=null&&store.all("member_block").stream().anyMatch(r->b(r,"active")&&s(r,"ownerId").equals(s(actor,"id"))&&s(r,"targetId").equals(author));}
    public boolean canRead(Map<String,Object> actor,String board){
        if(actor==null)return true;
        return store.all("forum_restriction").stream().noneMatch(r->s(r,"userId").equals(s(actor,"id"))&&s(r,"board").equals(board)&&b(r,"active")&&s(r,"action").equals("kick"));
    }
    public void participating(Map<String,Object> actor,String board,boolean write){
        if(actor==null)return;
        boolean banned=store.all("forum_restriction").stream().anyMatch(r->s(r,"userId").equals(s(actor,"id"))&&s(r,"board").equals(board)&&b(r,"active")&&(write||s(r,"action").equals("kick")));
        if(banned)throw new ApiException(403,write?"你在该板块暂时不能发言，请联系管理员":"你已被移出该板块，请联系管理员");
    }
}
