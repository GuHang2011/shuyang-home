package com.example.Kcsj.membership;

import org.springframework.stereotype.Component;
import java.util.*;
import static com.example.Kcsj.membership.MemberStore.*;

/** Called inside existing write transactions; no external push or network side effects. */
@Component
public class LifeSignals {
    private final MemberStore store;private final BusinessNotifications notifications;
    public LifeSignals(MemberStore store,BusinessNotifications notifications){this.store=store;this.notifications=notifications;}
    private void send(String user,String event,String target,String page,String message){notifications.life(user,target,event,message);}
    public void changed(String kind,Map<String,Object> row){
        String id=s(row,"id"),event=kind+":"+id+":"+s(row,"status")+":"+s(row,"updatedAt")+":"+s(row,"settlement");
        if(kind.equals("product")&&s(row,"status").equals("published")&&row.get("stock") instanceof Number&&((Number)row.get("stock")).intValue()>0){
            for(Map<String,Object>entry:store.all("life_entry"))if(s(entry,"type").equals("arrival")&&s(entry,"referenceId").equals(id)&&s(entry,"status").equals("open")){
                for(Map<String,Object>sub:store.all("life_subscription"))if(s(sub,"entryId").equals(s(entry,"id"))&&b(sub,"active"))send(s(sub,"userId"),"stock:"+id+":"+s(row,"stockRevision"),s(entry,"id"),"life","订阅的家乡特产已有库存，可查看商品下单");
            }
        }
    }
}
