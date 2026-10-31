package com.example.Kcsj.membership;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;
import java.io.*;
import java.util.*;
import java.util.zip.*;
import static com.example.Kcsj.membership.MemberStore.*;

/** Small, typed XLSX files. Formula cells, macros and external links are never evaluated. */
@Component
public class BusinessWorkbook {
    public static final int MAX_BYTES=2*1024*1024, MAX_ROWS=500;
    public List<Map<String,Object>> read(String filename,String encoded,List<String> headers) {
        if(!filename.toLowerCase(Locale.ROOT).endsWith(".xlsx"))throw new ApiException(400,"请选择 .xlsx 格式的 Excel 文件");
        if(encoded.length()>((MAX_BYTES+2)/3)*4)throw new ApiException(400,"文件不能超过2MB");
        try {
            byte[] bytes=Base64.getDecoder().decode(encoded);
            if(bytes.length>MAX_BYTES)throw new ApiException(400,"文件不能超过2MB");
            checkArchive(bytes);
            try(XSSFWorkbook book=new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
                if(book.getNumberOfSheets()!=1||!book.getExternalLinksTable().isEmpty())throw new ApiException(400,"请保留一个工作表，且不要包含外部链接");
                Sheet sheet=book.getSheetAt(0);
                if(sheet.getLastRowNum()>MAX_ROWS)throw new ApiException(400,"每次最多导入500行，请分批处理并清除多余空行格式");
                Row heading=sheet.getRow(0);
                if(heading==null||heading.getLastCellNum()!=headers.size())throw new ApiException(400,"表头与模板不一致，请使用当前导入模板");
                for(int c=0;c<headers.size();c++)if(!headers.get(c).equals(value(heading.getCell(c))))throw new ApiException(400,"表头与模板不一致：第"+(c+1)+"列应为“"+headers.get(c)+"”");
                List<Map<String,Object>> rows=new ArrayList<>();
                for(int n=1;n<=sheet.getLastRowNum();n++) {
                    Row row=sheet.getRow(n);if(row==null)continue;
                    if(row.getLastCellNum()>headers.size())throw new ApiException(400,"第"+(n+1)+"行有模板之外的列");
                    Map<String,Object> fields=new LinkedHashMap<>();boolean empty=true;
                    for(int c=0;c<headers.size();c++){String cell=value(row.getCell(c));fields.put(headers.get(c),cell);if(!cell.isEmpty())empty=false;}
                    if(!empty)rows.add(map("line",n+1,"values",fields));
                }
                if(rows.isEmpty())throw new ApiException(400,"文件没有数据，请在表头下填写后重新选择");
                return rows;
            }
        }catch(ApiException e){throw e;}catch(Exception e){throw new ApiException(400,"无法读取文件，请使用未加密的 Excel .xlsx 模板，勿修改文件扩展名");}
    }
    private String value(Cell cell) {
        if(cell==null||cell.getCellType()==CellType.BLANK)return "";
        if(cell.getCellType()==CellType.FORMULA)throw new ApiException(400,"导入文件不能包含公式，请粘贴为纯文本后重试");
        if(cell.getCellType()!=CellType.STRING)throw new ApiException(400,"导入单元格请使用文本格式，保留编号和原始内容");
        String text=cell.getStringCellValue().trim();
        if(text.length()>1000)throw new ApiException(400,"单元格内容过长，最多1000字");
        return text;
    }
    private void checkArchive(byte[] bytes) throws IOException {
        int entries=0,total=0;boolean content=false;
        try(ZipInputStream zip=new ZipInputStream(new ByteArrayInputStream(bytes))) {
            ZipEntry entry;byte[] buffer=new byte[8192];
            while((entry=zip.getNextEntry())!=null) {
                if(++entries>256)throw new ApiException(400,"文件结构过于复杂，请复制数据到新模板");
                String name=entry.getName().toLowerCase(Locale.ROOT);
                if(name.contains("vbaproject")||name.contains("externallinks/")||name.startsWith("xl/embeddings/"))throw new ApiException(400,"文件不能包含宏、嵌入对象或外部链接");
                if(name.equals("[content_types].xml"))content=true;
                int count;while((count=zip.read(buffer))!=-1){total+=count;if(total>8*1024*1024)throw new ApiException(400,"解压内容过大，请使用精简模板");}
            }
        }
        if(!content)throw new ApiException(400,"文件不是有效的 .xlsx 工作簿");
    }
    public Map<String,Object> write(String filename,List<String> headers,List<List<String>> rows) {
        try(XSSFWorkbook book=new XSSFWorkbook();ByteArrayOutputStream out=new ByteArrayOutputStream()) {
            Sheet sheet=book.createSheet("业务数据");CellStyle text=book.createCellStyle();text.setDataFormat(book.createDataFormat().getFormat("@"));
            Font bold=book.createFont();bold.setBold(true);CellStyle heading=book.createCellStyle();heading.cloneStyleFrom(text);heading.setFont(bold);
            for(int c=0;c<headers.size();c++){sheet.setDefaultColumnStyle(c,text);sheet.setColumnWidth(c,Math.min(44,Math.max(18,headers.get(c).length()*3))*256);}
            List<List<String>> all=new ArrayList<>();all.add(headers);all.addAll(rows);
            for(int r=0;r<all.size();r++){Row row=sheet.createRow(r);for(int c=0;c<all.get(r).size();c++){Cell cell=row.createCell(c,CellType.STRING);cell.setCellValue(all.get(r).get(c));cell.setCellStyle(r==0?heading:text);}}
            sheet.createFreezePane(0,1);sheet.setRepeatingRows(new org.apache.poi.ss.util.CellRangeAddress(0,0,-1,-1));sheet.getPrintSetup().setLandscape(true);sheet.setFitToPage(true);sheet.getPrintSetup().setFitWidth((short)1);sheet.getPrintSetup().setFitHeight((short)0);
            book.write(out);return map("filename",filename,"mime","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","base64",Base64.getEncoder().encodeToString(out.toByteArray()));
        }catch(IOException e){throw new ApiException(500,"文件生成失败，请稍后重试");}
    }
}
