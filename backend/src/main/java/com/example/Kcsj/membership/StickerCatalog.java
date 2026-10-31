package com.example.Kcsj.membership;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;
import java.io.InputStream;
import java.io.IOException;
import java.util.*;
import static com.example.Kcsj.membership.MemberStore.*;

/** Curated, bundled artwork; no user-controlled URLs or uploads in the catalogue. */
@Component
public class StickerCatalog {
    private final List<Map<String,Object>> packs;
    private final Map<String,Map<String,Object>> stickers = new LinkedHashMap<>();
    private final Map<String,byte[]> images = new HashMap<>();
    @SuppressWarnings("unchecked")
    public StickerCatalog(ObjectMapper json) throws IOException {
        try (InputStream input = new ClassPathResource("stickers/catalog.json").getInputStream()) {
            packs = json.readValue(input, new TypeReference<List<Map<String,Object>>>() {});
        }
        for (Map<String,Object> pack : packs) {
            for (Map<String,Object> item : (List<Map<String,Object>>) pack.get("stickers")) {
                String id = s(item,"id");
                if (!id.matches("[a-z0-9-]{1,40}") || stickers.containsKey(id)) throw new IOException("Invalid sticker catalogue");
                item.put("packId",s(pack,"id"));
                stickers.put(id,Collections.unmodifiableMap(new LinkedHashMap<>(item)));
                try (InputStream input = new ClassPathResource("stickers/"+id+".png").getInputStream()) {
                    images.put(id,StreamUtils.copyToByteArray(input));
                }
            }
        }
    }
    public List<Map<String,Object>> packs() { return packs; }
    public Map<String,Object> require(String id) {
        Map<String,Object> sticker = stickers.get(id);
        if (sticker == null) throw new ApiException(400,"这个表情暂不可用，请重新选择");
        return sticker;
    }
    public byte[] image(String id) {
        byte[] bytes = images.get(id);
        if (bytes == null) throw new ApiException(404,"表情图片不存在");
        return bytes;
    }
    public String fallback(String id) { return "[表情] "+s(require(id),"label"); }
}
