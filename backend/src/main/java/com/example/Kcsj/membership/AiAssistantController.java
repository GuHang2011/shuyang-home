package com.example.Kcsj.membership;

import org.springframework.web.bind.annotation.*;
import javax.servlet.http.HttpServletRequest;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import static com.example.Kcsj.membership.MemberStore.*;

@RestController
@RequestMapping("/ai")
public class AiAssistantController {
    private final MemberAuth auth;
    private final AiAssistantService assistant;
    private final Set<String> active = ConcurrentHashMap.newKeySet();
    public AiAssistantController(MemberAuth auth, AiAssistantService assistant) { this.auth = auth;this.assistant = assistant; }
    @GetMapping("status") public Map<String,Object> status(HttpServletRequest request) { auth.member(auth.require(request));return map("code", 0, "data", assistant.status()); }
    @PostMapping("messages") public Map<String,Object> answer(@RequestBody Map<String,Object> input, HttpServletRequest request) {
        Map<String,Object> user = auth.require(request);auth.member(user);
        List<Map<String,Object>> messages = assistant.validate(input);
        if (!assistant.ready()) throw new ApiException(503, "AI 助手暂未启用，请联系管理员配置模型服务");
        String userId = s(user, "id");
        if (!active.add(userId)) throw new ApiException(409, "上一条问题仍在处理中，请稍候");
        try { auth.limit("ai:" + userId, 12);return map("code", 0, "data", assistant.answer(messages)); }
        finally { active.remove(userId); }
    }
}
