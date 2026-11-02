package com.example.Kcsj.membership;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import java.util.*;
import java.nio.charset.StandardCharsets;
import static com.example.Kcsj.membership.MemberStore.*;

/** Persistent, recipient-only in-app messages. No SMS or external push delivery. */
@Component
public class BusinessNotifications {
    private final MemberStore store;
    public BusinessNotifications(MemberStore store){this.store=store;}
    private boolean changed(BusinessChange e,String key){return !s(e.before,key).equals(s(e.after,key));}
    private void send(BusinessChange e,String recipient,String message,String kind,String target) {
        if(recipient.isEmpty())return;
        String key=recipient+"|"+e.kind+"|"+s(e.after,"id")+"|"+s(e.after,"businessVersion")+"|"+message;
        String id=UUID.nameUUIDFromBytes(key.getBytes(StandardCharsets.UTF_8)).toString();
        if(store.all("business_notice").stream().anyMatch(n->s(n,"id").equals(id)))return;
        store.save("business_notice",map("id",id,"recipientId",recipient,"message",message,"kind",kind,"targetId",target,
            "createdAt",now(),"sequence",store.nextNotificationSequence(),"read",false));
    }
    @EventListener public void changed(BusinessChange e) {
        Map<String,Object> r=e.after;String id=s(r,"id"),state=s(r,"status");
        if(e.kind.equals("user")) {
            if(!e.before.isEmpty()&&changed(e,"status")&&Arrays.asList("approved","rejected").contains(state))
                send(e,id,state.equals("approved")?"你的入会申请已通过":"你的入会申请已退回，请查看原因","user",id);
        } else if(e.kind.equals("event")) {
            if(!e.before.isEmpty()&&(changed(e,"location")||changed(e,"status")&&state.equals("cancelled")))
                for(Map<String,Object> signup:store.all("signup"))if(s(signup,"eventId").equals(id)&&!s(signup,"status").equals("cancelled"))
                    send(e,s(signup,"userId"),state.equals("cancelled")?"你报名的活动已取消":"你报名活动的集合地点已更新","signup",s(signup,"id"));
        } else if(e.kind.equals("signup")) {
            if(changed(e,"status")) {
                Map<String,Object> event=store.get("event",s(r,"eventId"));
                if(state.equals("cancelled")&&s(event,"status").equals("cancelled"))return; // Event emits the cancellation once.
                send(e,s(r,"userId"),state.equals("registered")?"活动报名成功":state.equals("checked_in")?"活动签到已记录":"活动报名已取消","signup",id);
            }
        } else if(e.kind.equals("order")) {
            if(!e.before.isEmpty()&&changed(e,"status")) {
                Map<String,String> labels=new HashMap<>();labels.put("confirmed","订单已确认");labels.put("shipped","订单已发货，请查看物流信息");
                labels.put("ready","订单已备妥，可以自提了");labels.put("cancelled","订单已取消");labels.put("completed","订单已确认收货");
                if(labels.containsKey(state))send(e,s(r,"buyerId"),labels.get(state),"order",id);
            }
        } else if(e.kind.equals("exchange")||e.kind.equals("contact_exchange")) {
            boolean resource=e.kind.equals("exchange");String receiver=s(r,resource?"ownerId":"recipientId"),sender=s(r,"requesterId");
            if(e.before.isEmpty())send(e,receiver,resource?"收到一项资源交换申请":"收到一项联系方式交换申请",e.kind,id);
            else if(changed(e,"status")||changed(e,"ownerConfirmed")||changed(e,"requesterConfirmed")) {
                send(e,sender,resource?"资源交换进度已更新":"联系方式交换进度已更新",e.kind,id);
                send(e,receiver,resource?"资源交换进度已更新":"联系方式交换进度已更新",e.kind,id);
            }
        } else if(e.kind.equals("crowd_pledge")) {
            if(!e.before.isEmpty()&&changed(e,"status"))send(e,s(r,"supporterId"),"你的认领记录已更新",e.kind,id);
        } else {
            if(!e.before.isEmpty()&&changed(e,"status")&&Arrays.asList("approved","rejected","hidden","deleted","closed","withdrawn").contains(state))
                send(e,s(r,"authorId"),"你发布的内容处理结果已更新",e.kind,id);
            if(e.kind.equals("post")&&changed(e,"draftStatus")&&Arrays.asList("approved","rejected").contains(s(r,"draftStatus")))
                send(e,s(r,"authorId"),"互助信息修改的审核结果已更新","post",id);
        }
    }
}
