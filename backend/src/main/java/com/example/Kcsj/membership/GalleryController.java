package com.example.Kcsj.membership;

import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import javax.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.*;
import java.util.stream.Collectors;
import static com.example.Kcsj.membership.MemberStore.*;
import static com.example.Kcsj.membership.MemberData.*;

@RestController @Transactional
public class GalleryController {
    private final MemberStore store;private final MemberAuth auth;private final MediaService media;
    public GalleryController(MemberStore store,MemberAuth auth,MediaService media){this.store=store;this.auth=auth;this.media=media;}
    private Map<String,Object> ok(Object row){return map("code",0,"data",row);}
    private List<Map<String,Object>> photos(String id,boolean staff){return store.all("album_photo").stream().filter(p->s(p,"albumId").equals(id)&&(staff||s(p,"status").equals("published"))).sorted(Comparator.comparing(p->s(p,"createdAt"))).collect(Collectors.toList());}
    @GetMapping("/albums") public Map<String,Object> albums(@RequestParam(defaultValue="false") boolean manage,HttpServletRequest req){Map<String,Object> actor=auth.optional(req);boolean staff=manage&&auth.isStaff(actor);if(manage&&!staff)throw new ApiException(403,"仅组织者可管理相册");return ok(map("albums",store.all("album").stream().filter(a->staff||s(a,"status").equals("published")).sorted(Comparator.comparing((Map<String,Object> a)->s(a,"date")).reversed()).map(a->{Map<String,Object> view=new LinkedHashMap<>(a);List<Map<String,Object>> p=photos(s(a,"id"),staff);view.put("count",p.size());if(!p.isEmpty())view.put("cover",s(p.get(0),"mediaId"));return view;}).collect(Collectors.toList()),"source",map("title","沭阳之家活动影像","url","https://m.alltuu.com/album/8676b95dd73d9e5401f58a6ff48d60a0/?menu=live","description","用户提供的活动原相册，点击前往查看。")));}
    @GetMapping("/albums/{id}") public Map<String,Object> detail(@PathVariable String id,HttpServletRequest req){Map<String,Object> actor=auth.optional(req),album=store.get("album",id);boolean staff=auth.isStaff(actor);if(!staff&&!s(album,"status").equals("published"))throw new ApiException(404,"相册未公开");return ok(map("album",album,"photos",photos(id,staff)));}
    @PostMapping("/albums") public Map<String,Object> save(@RequestBody Map<String,Object> input,HttpServletRequest req){store.lockWrites();Map<String,Object> actor=auth.staff(req);String id=text(input,"id",0,80);Map<String,Object> row=id.isEmpty()?map("id",id(),"createdAt",now()):store.get("album",id);String date=text(input,"date",10,10);try{java.time.LocalDate.parse(date);}catch(Exception e){throw new ApiException(400,"请填写有效活动日期");}row.putAll(map("title",text(input,"title",2,80),"description",text(input,"description",0,2000),"location",text(input,"location",0,150),"date",date,"status",choice(input,"status","draft","published")));store.save("album",row);auth.audit(actor,"album.save",s(row,"id"));return ok(row);}
    @PostMapping("/albums/{id}/photos") public Map<String,Object> photo(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req){store.lockWrites();Map<String,Object> actor=auth.staff(req);store.get("album",id);if(photos(id,true).size()>=500)throw new ApiException(409,"每个相册最多500张图片");String mediaId=media.bindImage(text(input,"mediaId",1,80),"album",actor);for(Map<String,Object> photo:photos(id,true))if(s(photo,"mediaId").equals(mediaId))return ok(photo);Map<String,Object> row=map("id",id(),"albumId",id,"mediaId",mediaId,"caption",text(input,"caption",0,300),"status",choice(input,"status","published","hidden"),"createdAt",now());store.save("album_photo",row);auth.audit(actor,"album.photo-add",s(row,"id"));return ok(row);}
    @PostMapping("/album-photos/{id}") public Map<String,Object> photoStatus(@PathVariable String id,@RequestBody Map<String,Object> input,HttpServletRequest req){store.lockWrites();Map<String,Object> actor=auth.staff(req),row=store.get("album_photo",id);row.put("status",choice(input,"status","published","hidden"));row.put("caption",text(input,"caption",0,300));store.save("album_photo",row);auth.audit(actor,"album.photo-update",id);return ok(row);}
}
