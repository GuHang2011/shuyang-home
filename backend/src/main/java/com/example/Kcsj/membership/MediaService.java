package com.example.Kcsj.membership;

import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.multipart.MultipartFile;
import javax.annotation.PostConstruct;
import javax.imageio.*;
import javax.imageio.stream.ImageInputStream;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import static com.example.Kcsj.membership.MemberStore.*;
import static com.example.Kcsj.membership.MemberData.*;

/** Private database-backed attachments. No token URLs and no public upload directory. */
@Service
public class MediaService {
    private final MemberStore store;private final MemberAuth auth;private final JdbcTemplate jdbc;private final ForumPolicy policy;
    public MediaService(MemberStore store,MemberAuth auth,JdbcTemplate jdbc,ForumPolicy policy){this.store=store;this.auth=auth;this.jdbc=jdbc;this.policy=policy;}
    @PostConstruct public void init(){jdbc.execute("CREATE TABLE IF NOT EXISTS syh_attachment (id VARCHAR(80) PRIMARY KEY, content BLOB NOT NULL)");}
    public void chatAccess(String roomId,Map<String,Object> actor,boolean sending){
        auth.member(actor);Map<String,Object> room=store.get("chat_room",roomId);
        if(!store.all("chat_member").stream().anyMatch(m->s(m,"roomId").equals(roomId)&&s(m,"userId").equals(s(actor,"id"))&&b(m,"active")))throw new ApiException(403,"仅会话成员可以访问附件");
        if(sending&&!s(room,"status").equals("active"))throw new ApiException(409,"会话暂时不能发送附件");
        if(sending&&s(room,"type").equals("direct"))for(Object id:(List<?>)room.get("participants"))if(!id.equals(s(actor,"id"))){Map<String,Object> peer=store.get("user",String.valueOf(id));if(!b(peer,"enabled")||!s(peer,"status").equals("approved")||policy.blocked(s(actor,"id"),String.valueOf(id)))throw new ApiException(403,"对方暂时无法接收附件");}
    }
    public Map<String,Object> upload(MultipartFile file,String scope,String roomId,String originalName,Map<String,Object> actor){
        auth.member(actor);if(!Arrays.asList("chat","album","product","forum").contains(scope))throw new ApiException(400,"附件用途无效");
        if(scope.equals("chat"))chatAccess(roomId,actor,true);else if(!scope.equals("forum")&&(scope.equals("product")?!auth.isAdmin(actor):!auth.isStaff(actor)))throw new ApiException(403,"仅管理人员可以上传展示图片");
        if(file.isEmpty()||file.getSize()>15*1024*1024)throw new ApiException(413,"附件须为1字节至15MB，图片最多8MB");
        auth.limit("upload:"+s(actor,"id"),40);
        String name=(!originalName.isEmpty()?originalName:Optional.ofNullable(file.getOriginalFilename()).orElse("附件")).replace('\\','/');name=name.substring(name.lastIndexOf('/')+1).replaceAll("[\\p{Cntrl}]","");if(name.length()>100)name=name.substring(name.length()-100);
        String ext=name.contains(".")?name.substring(name.lastIndexOf('.')+1).toLowerCase(Locale.ROOT):"";
        byte[] bytes;String mime;boolean image=Arrays.asList("jpg","jpeg","png").contains(ext),audio=scope.equals("forum")&&!image;
        try {
            bytes=file.getBytes();
            if(audio){
                if(bytes.length>10*1024*1024)throw new ApiException(413,"论坛语音不能超过10MB");
                mime=audioMime(ext,bytes);image=false;
            }else if(image){
                if(bytes.length>8*1024*1024)throw new ApiException(413,"图片不能超过8MB");
                try(ImageInputStream stream=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))){
                    Iterator<ImageReader> readers=ImageIO.getImageReaders(stream);if(!readers.hasNext())throw new ApiException(400,"无法识别图片，请选择JPG或PNG");ImageReader reader=readers.next();
                    try{reader.setInput(stream);String format=reader.getFormatName().toLowerCase(Locale.ROOT);if(!Arrays.asList("jpeg","png").contains(format)||((long)reader.getWidth(0))*reader.getHeight(0)>20000000)throw new ApiException(400,"图片格式无效或超过2000万像素");BufferedImage decoded=reader.read(0);ByteArrayOutputStream output=new ByteArrayOutputStream();ImageIO.write(decoded,format,output);bytes=output.toByteArray();mime=format.equals("png")?"image/png":"image/jpeg";name=name.substring(0,name.lastIndexOf('.'))+(format.equals("png")?".png":".jpg");}finally{reader.dispose();}
                }
            }else{
                if(!scope.equals("chat"))throw new ApiException(400,"相册和商品仅支持JPG、PNG图片");
                if(!Arrays.asList("pdf","txt","docx","xlsx","pptx","zip").contains(ext))throw new ApiException(400,"支持PDF、TXT、DOCX、XLSX、PPTX、ZIP文件，以及JPG、PNG图片");
                if(ext.equals("pdf")&&!new String(Arrays.copyOf(bytes,Math.min(5,bytes.length)),StandardCharsets.US_ASCII).equals("%PDF-"))throw new ApiException(400,"PDF文件内容无效");
                if(Arrays.asList("docx","xlsx","pptx","zip").contains(ext)&&(bytes.length<4||bytes[0]!='P'||bytes[1]!='K'))throw new ApiException(400,"文件内容与扩展名不匹配");
                mime="application/octet-stream";
            }
        }catch(ApiException e){throw e;}catch(Exception e){throw new ApiException(400,"附件读取失败，请更换文件");}
        if(bytes.length>15*1024*1024)throw new ApiException(413,"处理后的附件超过15MB");
        store.lockWrites();
        for(Map<String,Object> old:store.all("attachment"))if(s(old,"messageId").isEmpty()&&!b(old,"linked")&&Instant.parse(s(old,"createdAt")).isBefore(Instant.now().minusSeconds(86400))){jdbc.update("DELETE FROM syh_attachment WHERE id=?",s(old,"id"));store.delete("attachment",s(old,"id"));}
        long total=0,daily=0;for(Map<String,Object> row:store.all("attachment")){long size=((Number)row.get("size")).longValue();total+=size;if(s(row,"ownerId").equals(s(actor,"id"))&&Instant.parse(s(row,"createdAt")).isAfter(Instant.now().minusSeconds(86400)))daily+=size;}
        if(daily+bytes.length>100L*1024*1024||total+bytes.length>1024L*1024*1024)throw new ApiException(413,"附件存储额度已满，请联系管理员");
        Map<String,Object> row=map("id",id(),"ownerId",s(actor,"id"),"scope",scope,"roomId",scope.equals("chat")?roomId:"","name",name,"size",bytes.length,"type",audio?"audio":image?"image":"file","mime",mime,"createdAt",now());
        jdbc.update("INSERT INTO syh_attachment(id,content) VALUES (?,?)",s(row,"id"),bytes);store.save("attachment",row);return projection(row);
    }
    public Map<String,Object> projection(Map<String,Object> row){return pick(row,"id","name","size","type","mime");}
    private String audioMime(String ext,byte[] bytes){
        if(bytes.length>=12){
            String first=new String(bytes,0,4,StandardCharsets.US_ASCII),next=new String(bytes,8,4,StandardCharsets.US_ASCII);
            if(ext.equals("wav")&&bytes.length>=44&&first.equals("RIFF")&&next.equals("WAVE"))return "audio/wav";
            if(ext.equals("m4a")&&new String(bytes,4,4,StandardCharsets.US_ASCII).equals("ftyp"))return "audio/mp4";
            if(ext.equals("mp3")&&(first.startsWith("ID3")||((bytes[0]&255)==255&&(bytes[1]&224)==224&&(bytes[1]&6)!=0)))return "audio/mpeg";
        }
        throw new ApiException(400,"请选择有效的MP3、M4A或WAV语音文件");
    }
    public Map<String,Object> bindForum(String attachmentId,String kind,String recordId,Map<String,Object> actor){
        Map<String,Object> row=store.get("attachment",attachmentId);
        if(!s(row,"ownerId").equals(s(actor,"id"))||!s(row,"scope").equals("forum")||!s(row,"type").equals("audio")||b(row,"linked"))throw new ApiException(403,"请选择本人上传且尚未发布的论坛语音");
        row.putAll(map("linked",true,"forumKind",kind,"forumId",recordId));store.save("attachment",row);return projection(row);
    }
    public List<Map<String,Object>> bindForumPhotos(List<String> ids,String kind,String recordId,Map<String,Object> actor){
        List<Map<String,Object>> photos=new ArrayList<>();
        for(String id:ids){
            Map<String,Object> row=store.get("attachment",id);
            if(!s(row,"ownerId").equals(s(actor,"id"))||!s(row,"scope").equals("forum")||!s(row,"type").equals("image")||b(row,"linked"))throw new ApiException(403,"请选择本人上传且尚未发布的论坛照片");
            row.putAll(map("linked",true,"forumKind",kind,"forumId",recordId));store.save("attachment",row);photos.add(projection(row));
        }
        return photos;
    }
    private boolean forumVisible(Map<String,Object> row,Map<String,Object> actor,String board){
        return !s(row,"status").equals("deleted")&&!policy.hiddenAuthor(actor,s(row,"authorId"))&&(s(row,"status").equals("approved")||(actor!=null&&s(row,"authorId").equals(s(actor,"id")))||policy.moderates(actor,board));
    }
    public Map<String,Object> bindChat(String attachmentId,String room,String message,Map<String,Object> actor){Map<String,Object> row=store.get("attachment",attachmentId);if(!s(row,"ownerId").equals(s(actor,"id"))||!s(row,"scope").equals("chat")||!s(row,"roomId").equals(room)||(!s(row,"messageId").isEmpty()&&!s(row,"messageId").equals(message)))throw new ApiException(403,"附件不能用于此消息");row.put("messageId",message);store.save("attachment",row);return projection(row);}
    public String bindImage(String attachmentId,String scope,Map<String,Object> actor){Map<String,Object> row=store.get("attachment",attachmentId);if(!s(row,"scope").equals(scope)||!s(row,"type").equals("image")||(!s(row,"ownerId").equals(s(actor,"id"))&&!auth.isAdmin(actor)))throw new ApiException(403,"请选择当前用途的图片");row.put("linked",true);store.save("attachment",row);return attachmentId;}
    public Map<String,Object> authorize(String id,Map<String,Object> actor){
        Map<String,Object> row=store.get("attachment",id);String scope=s(row,"scope");
        if(scope.equals("forum")){
            if(!b(row,"linked")){
                if(actor==null||!s(row,"ownerId").equals(s(actor,"id")))throw new ApiException(404,"附件尚未发布");
                auth.member(actor);return row;
            }
            Map<String,Object> post=store.get(s(row,"forumKind"),s(row,"forumId"));
            Map<String,Object> topic=s(row,"forumKind").equals("forum_topic")?post:store.get("forum_topic",s(post,"topicId"));
            String board=s(topic,"category");
            if(!policy.canRead(actor,board)||!forumVisible(topic,actor,board)||!forumVisible(post,actor,board))throw new ApiException(404,"附件不存在或尚未公开");
            return row;
        }
        if(scope.equals("chat")){chatAccess(s(row,"roomId"),actor,false);if(!s(row,"messageId").isEmpty()){if(b(store.get("chat_message",s(row,"messageId")),"recalled"))throw new ApiException(404,"附件已撤回");}else if(!s(row,"ownerId").equals(s(actor,"id")))throw new ApiException(403,"附件尚未发送");return row;}
        boolean published=scope.equals("product")?store.all("product").stream().anyMatch(p->s(p,"status").equals("published")&&p.get("images") instanceof List&&((List<?>)p.get("images")).contains(id)):
            store.all("album_photo").stream().anyMatch(p->s(p,"mediaId").equals(id)&&s(p,"status").equals("published")&&s(store.get("album",s(p,"albumId")),"status").equals("published"));
        if(!published&&(actor==null||!auth.isStaff(actor)))throw new ApiException(404,"图片尚未公开");return row;
    }
    public byte[] bytes(String id){return jdbc.queryForObject("SELECT content FROM syh_attachment WHERE id=?",byte[].class,id);}
}
