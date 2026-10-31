package com.example.Kcsj.membership;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import static com.example.Kcsj.membership.MemberStore.*;

/** Public built-in artwork contains no member or conversation data. */
@RestController
@RequestMapping("/chat")
public class StickerController {
    private final StickerCatalog catalog;
    public StickerController(StickerCatalog catalog) { this.catalog = catalog; }
    @GetMapping("/sticker-packs") public Map<String,Object> packs() { return map("code",0,"data",catalog.packs()); }
    @GetMapping(value="/stickers/{id}.png",produces=MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> image(@PathVariable String id) {
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).cacheControl(CacheControl.maxAge(1,TimeUnit.DAYS).cachePublic()).body(catalog.image(id));
    }
}
