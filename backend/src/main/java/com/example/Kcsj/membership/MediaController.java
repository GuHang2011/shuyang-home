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
    @GetMapping("/media/{id}") public ResponseEntity<byte[]> download(@PathVariable String id,HttpServletRequest req){Map<String,Object> row=media.authorize(id,auth.optional(req));return ResponseEntity.ok().contentType(MediaType.parseMediaType(s(row,"mime"))).header("Content-Disposition",ContentDisposition.builder((s(row,"type").equals("image")||s(row,"type").equals("audio"))?"inline":"attachment").filename(s(row,"name"),StandardCharsets.UTF_8).build().toString()).body(media.bytes(id));}
}
