package com.example.Kcsj.membership;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Keys are supplied by the platform deployment environment, never saved with records. */
@Component
public class RecordCipher {
    private final byte[] key;private final SecureRandom random=new SecureRandom();
    public RecordCipher(@Value("${shuyang.data-key:}") String value){try{key=value.isEmpty()?null:Base64.getDecoder().decode(value);if(key!=null&&key.length!=16&&key.length!=32)throw new IllegalArgumentException();if(key!=null&&Cipher.getMaxAllowedKeyLength("AES")<key.length*8)throw new IllegalArgumentException();}catch(Exception e){throw new IllegalStateException("SHUYANG_DATA_KEY must be a Base64 AES key supported by this Java runtime (16 bytes, or 32 with AES-256 support).");}}
    public boolean enabled(){return key!=null;}
    public String encode(String plain){if(key==null)return plain;return "enc:v1:"+Base64.getEncoder().encodeToString(seal(plain.getBytes(StandardCharsets.UTF_8),key));}
    public String decode(String stored){if(!stored.startsWith("enc:v1:"))return stored;if(key==null)throw new IllegalStateException("Encrypted records require the original SHUYANG_DATA_KEY");return new String(open(Base64.getDecoder().decode(stored.substring(7)),key),StandardCharsets.UTF_8);}
    public byte[] seal(byte[] plain,byte[] secret){try{byte[] iv=new byte[12];random.nextBytes(iv);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,new SecretKeySpec(secret,"AES"),new GCMParameterSpec(128,iv));byte[] payload=cipher.doFinal(plain),out=new byte[iv.length+payload.length];System.arraycopy(iv,0,out,0,iv.length);System.arraycopy(payload,0,out,iv.length,payload.length);return out;}catch(Exception e){throw new IllegalStateException("Encryption failed",e);}}
    public byte[] open(byte[] encrypted,byte[] secret){try{if(encrypted.length<28)throw new IllegalArgumentException();Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,new SecretKeySpec(secret,"AES"),new GCMParameterSpec(128,Arrays.copyOf(encrypted,12)));return cipher.doFinal(encrypted,12,encrypted.length-12);}catch(Exception e){throw new IllegalStateException("Encryption key or authenticated data is invalid",e);}}
}
