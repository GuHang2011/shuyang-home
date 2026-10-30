package com.example.Kcsj.membership;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.Map;

@RestControllerAdvice
public class ApiErrors {
    private static final Logger log = LoggerFactory.getLogger(ApiErrors.class);
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String,Object>> api(ApiException e) {
        return ResponseEntity.status(e.status).body(MemberStore.map("code", e.code, "message", e.getMessage(), "msg", e.getMessage()));
    }
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String,Object>> size(Exception e) { return api(new ApiException(413, "附件超过上传大小限制")); }
    @ExceptionHandler({HttpMessageNotReadableException.class, MissingServletRequestParameterException.class, MissingServletRequestPartException.class})
    public ResponseEntity<Map<String,Object>> input(Exception e) { return api(new ApiException(400, "请求内容不完整或格式错误")); }
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Map<String,Object>> method(Exception e) { return api(new ApiException(405, "该接口不支持此操作方式")); }
    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<Map<String,Object>> media(Exception e) { return api(new ApiException(415, "请求内容类型不受支持")); }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String,Object>> unknown(Exception e) {
        log.error("Membership request failed: {}", e.getClass().getSimpleName());
        return api(new ApiException(500, "服务暂时不可用，请稍后重试"));
    }
}
