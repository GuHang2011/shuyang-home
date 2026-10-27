package com.example.Kcsj.membership;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.stereotype.Component;
import javax.annotation.PostConstruct;
import java.util.*;
import java.util.concurrent.locks.ReentrantReadWriteLock;

/** Versioned JSON records keep pilot data portable; all SQL values are parameterized. */
@Component
public class MemberStore {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final RecordCipher cipher;
    /** Coordinates record reads and writes before they contend on H2 TEXT/CLOB storage. */
    private final ReentrantReadWriteLock dataMutex = new ReentrantReadWriteLock(true);
    public MemberStore(JdbcTemplate jdbc, ObjectMapper json, RecordCipher cipher) { this.jdbc = jdbc; this.json = json; this.cipher=cipher; }
    @PostConstruct
    public void init() {
        jdbc.execute("CREATE TABLE IF NOT EXISTS syh_record (kind VARCHAR(32) NOT NULL, id VARCHAR(80) NOT NULL, body TEXT NOT NULL, PRIMARY KEY(kind,id))");
        jdbc.execute("CREATE TABLE IF NOT EXISTS syh_session (token_hash VARCHAR(64) PRIMARY KEY, user_id VARCHAR(80) NOT NULL, expires_at BIGINT NOT NULL)");
        jdbc.execute("CREATE TABLE IF NOT EXISTS syh_write_lock (id INT PRIMARY KEY)");
        jdbc.update("INSERT INTO syh_write_lock(id) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM syh_write_lock WHERE id=1)");
        jdbc.execute("CREATE TABLE IF NOT EXISTS syh_security_epoch (id INT PRIMARY KEY, revision BIGINT NOT NULL)");
        jdbc.update("INSERT INTO syh_security_epoch(id,revision) SELECT 1,0 WHERE NOT EXISTS (SELECT 1 FROM syh_security_epoch WHERE id=1)");
        if(cipher.enabled())jdbc.query("SELECT kind,id,body FROM syh_record WHERE body NOT LIKE 'enc:v1:%'",rs->{String body=rs.getString(3);jdbc.update("UPDATE syh_record SET body=? WHERE kind=? AND id=?",cipher.encode(body),rs.getString(1),rs.getString(2));});
    }
    /** Hold the pilot's write lock through transaction commit, including last-admin checks. */
    public void lockWrites() {
        boolean synchronizedTx = TransactionSynchronizationManager.isSynchronizationActive();
        dataMutex.writeLock().lock();
        try {
            jdbc.queryForObject("SELECT id FROM syh_write_lock WHERE id=1 FOR UPDATE", Integer.class);
            if (synchronizedTx) {
                TransactionSynchronizationManager.registerSynchronization(releaseWriteMutex());
            } else {
                dataMutex.writeLock().unlock();
            }
        } catch (RuntimeException e) {
            dataMutex.writeLock().unlock();
            throw e;
        }
    }

    /**
     * Try to enter a write transaction without waiting. Scheduled maintenance should skip a
     * tick while an interactive write is in progress instead of producing lock-timeout noise.
     */
    public boolean tryLockWrites() {
        if (!dataMutex.writeLock().tryLock()) return false;
        try {
            jdbc.queryForObject("SELECT id FROM syh_write_lock WHERE id=1 FOR UPDATE", Integer.class);
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(releaseWriteMutex());
            } else {
                dataMutex.writeLock().unlock();
            }
            return true;
        } catch (RuntimeException e) {
            dataMutex.writeLock().unlock();
            return false;
        }
    }

    private TransactionSynchronization releaseWriteMutex() {
        return new TransactionSynchronization() {
            @Override public void afterCompletion(int status) {
                dataMutex.writeLock().unlock();
            }
        };
    }
    public List<Map<String,Object>> all(String kind) {
        dataMutex.readLock().lock();
        try {
            return jdbc.query("SELECT body FROM syh_record WHERE kind=? ORDER BY id", (rs, i) -> read(rs.getString(1)), kind);
        } finally {
            dataMutex.readLock().unlock();
        }
    }
    public Map<String,Object> get(String kind, String id) {
        dataMutex.readLock().lock();
        try {
            List<Map<String,Object>> values = jdbc.query("SELECT body FROM syh_record WHERE kind=? AND id=?", (rs,i) -> read(rs.getString(1)), kind,id);
            if (values.isEmpty()) throw new ApiException(404,"记录不存在");
            return values.get(0);
        } finally {
            dataMutex.readLock().unlock();
        }
    }
    public void save(String kind, Map<String,Object> body) {
        dataMutex.writeLock().lock();
        try {
            String data;
            try { data = cipher.encode(json.writeValueAsString(body)); } catch (Exception e) { throw new IllegalStateException(e); }
            String id = s(body,"id");
            int changed = jdbc.update("UPDATE syh_record SET body=? WHERE kind=? AND id=?", data,kind,id);
            if (changed == 0) jdbc.update("INSERT INTO syh_record(kind,id,body) VALUES(?,?,?)",kind,id,data);
            if(securityKind(kind))jdbc.update("UPDATE syh_security_epoch SET revision=revision+1 WHERE id=1");
        } finally {
            dataMutex.writeLock().unlock();
        }
    }
    private boolean securityKind(String kind){return Arrays.asList("user","permission_grant","scope_delegation","helper_grant","role_assignment","identity_binding","identity_review").contains(kind);}
    public long securityEpoch(){
        dataMutex.readLock().lock();
        try { return jdbc.queryForObject("SELECT revision FROM syh_security_epoch WHERE id=1",Long.class); }
        finally { dataMutex.readLock().unlock(); }
    }
    public List<String> kinds(){
        dataMutex.readLock().lock();
        try { return jdbc.query("SELECT DISTINCT kind FROM syh_record ORDER BY kind",(rs,i)->rs.getString(1)); }
        finally { dataMutex.readLock().unlock(); }
    }
    public void delete(String kind, String id) {
        dataMutex.writeLock().lock();
        try { jdbc.update("DELETE FROM syh_record WHERE kind=? AND id=?",kind,id);if(securityKind(kind))jdbc.update("UPDATE syh_security_epoch SET revision=revision+1 WHERE id=1"); }
        finally { dataMutex.writeLock().unlock(); }
    }
    public void session(String hash,String userId,long expires) {
        jdbc.update("DELETE FROM syh_session WHERE expires_at<?",System.currentTimeMillis());
        jdbc.update("INSERT INTO syh_session(token_hash,user_id,expires_at) VALUES(?,?,?)",hash,userId,expires);
    }
    public String sessionUser(String hash) {
        List<String> ids = jdbc.query("SELECT user_id FROM syh_session WHERE token_hash=? AND expires_at>?",(rs,i)->rs.getString(1),hash,System.currentTimeMillis());
        if(ids.isEmpty()) throw new ApiException(401,"登录已失效，请重新登录");
        return ids.get(0);
    }
    public void revoke(String userId) { jdbc.update("DELETE FROM syh_session WHERE user_id=?",userId); }
    public void logout(String hash) { jdbc.update("DELETE FROM syh_session WHERE token_hash=?",hash); }
    private Map<String,Object> read(String value) {
        try { return json.readValue(cipher.decode(value), new TypeReference<LinkedHashMap<String,Object>>(){}); } catch (Exception e) { throw new IllegalStateException(e); }
    }
    public static String id() { return UUID.randomUUID().toString(); }
    public static String now() { return java.time.Instant.now().toString(); }
    public static String s(Map<String,Object> value, String key) { Object v=value.get(key); return v == null ? "" : String.valueOf(v); }
    public static boolean b(Map<String,Object> value,String key) { return Boolean.TRUE.equals(value.get(key)); }
    public static Map<String,Object> map(Object... values) {
        Map<String,Object> result = new LinkedHashMap<>();
        for(int i=0;i<values.length;i+=2) result.put(String.valueOf(values[i]),values[i+1]);
        return result;
    }
}
