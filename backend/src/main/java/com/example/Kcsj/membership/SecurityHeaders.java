package com.example.Kcsj.membership;
import org.springframework.stereotype.Component;import org.springframework.web.filter.OncePerRequestFilter;import javax.servlet.*;import javax.servlet.http.*;import java.io.IOException;
@Component public class SecurityHeaders extends OncePerRequestFilter {
 protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws ServletException,IOException{response.setHeader("X-Content-Type-Options","nosniff");response.setHeader("Referrer-Policy","same-origin");response.setHeader("X-Frame-Options","DENY");response.setHeader("Cache-Control","no-store");chain.doFilter(request,response);}
}
