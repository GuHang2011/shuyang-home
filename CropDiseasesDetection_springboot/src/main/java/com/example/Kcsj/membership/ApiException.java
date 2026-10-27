package com.example.Kcsj.membership;

public class ApiException extends RuntimeException {
    public final int status;
    public final String code;
    public ApiException(int status, String message) { this(status, String.valueOf(status), message); }
    public ApiException(int status, String code, String message) { super(message); this.status = status; this.code = code; }
}
