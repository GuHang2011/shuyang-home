package com.example.Kcsj.membership;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.*;
import javax.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import static com.example.Kcsj.membership.MemberStore.*;

@RestController @Transactional
public class MediaController {
    private final MediaService media;private final MemberAuth auth;
    public MediaController(MediaService media,MemberAuth auth){this.media=media;this.auth=auth;}
    @PostMapping("/media/upload") public Map<String,Object> upload(@RequestParam MultipartFile file,@RequestParam String scope,@RequestParam(defaultValue="") String roomId,@RequestParam(defaultValue="") String originalName,HttpServletRequest req){return map("code",0,"data",media.upload(file,scope,roomId,originalName,auth.require(req)));}
    @GetMapping("/media/{id}") public ResponseEntity<byte[]> download(@PathVariable String id,HttpServletRequest req){
        // Recheck visibility even for range requests; a removed slide is no longer public.
        Map<String,Object> row=media.authorize(id,auth.optional(req));byte[] bytes=media.bytes(id);String type=s(row,"type");
        HttpHeaders headers=new HttpHeaders();headers.setContentType(MediaType.parseMediaType(s(row,"mime")));
        headers.set("Content-Disposition",ContentDisposition.builder(java.util.Arrays.asList("image","audio","video").contains(type)?"inline":"attachment").filename(s(row,"name"),StandardCharsets.UTF_8).build().toString());
        headers.set("Cache-Control","private, no-store");headers.set("X-Content-Type-Options","nosniff");
        if(type.equals("video")||type.equals("audio")){
            headers.set("Accept-Ranges","bytes");String range=req.getHeader("Range");
            if(range!=null){try{
                java.util.List<HttpRange> ranges=HttpRange.parseRanges(range);
                if(ranges.size()!=1||bytes.length==0)throw new IllegalArgumentException();
                long start=ranges.get(0).getRangeStart(bytes.length),end=ranges.get(0).getRangeEnd(bytes.length);
                if(start<0||start>=bytes.length||end<start)throw new IllegalArgumentException();
                headers.set("Content-Range","bytes "+start+"-"+end+"/"+bytes.length);
                return new ResponseEntity<>(java.util.Arrays.copyOfRange(bytes,(int)start,(int)end+1),headers,HttpStatus.PARTIAL_CONTENT);
            }catch(IllegalArgumentException ex){headers.set("Content-Range","bytes */"+bytes.length);return new ResponseEntity<>(new byte[0],headers,HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);}}
        }
        return new ResponseEntity<>(bytes,headers,HttpStatus.OK);
    }
}
