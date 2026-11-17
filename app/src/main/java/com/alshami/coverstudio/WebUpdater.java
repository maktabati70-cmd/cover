package com.alshami.coverstudio;

import android.content.Context;
import android.content.res.AssetManager;
import android.webkit.WebResourceResponse;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Iterator;

/**
 * التحديث الصامت لواجهة الاستوديو من مستودع GitHub (فرع web-update):
 * • عند الفتح يُفحص version.json في الخلفية دون أي رسالة للمستخدم.
 * • تُنزَّل فقط الملفات التي تغيّرت (يُتحقق من بصمة SHA-256 لكل ملف).
 * • يُطبَّق الإصدار الجديد في الفتح التالي، وإن فشل تشغيله يُعاد الإصدار السابق تلقائياً.
 * • الملفات غير الموجودة في مجلد التحديث تُقدَّم من نسخة التطبيق الأصلية (assets).
 */
public class WebUpdater {

    private final Context ctx;
    private final File root;
    private final String[] bases;

    public WebUpdater(Context ctx, String repo) {
        this.ctx = ctx.getApplicationContext();
        this.root = new File(ctx.getFilesDir(), "web");
        this.bases = new String[]{
                "https://raw.githubusercontent.com/" + repo + "/web-update/",
                "https://cdn.jsdelivr.net/gh/" + repo + "@web-update/",
        };
    }

    // ───────── تحديد الإصدار النشط مع الحماية من التحديث المعطوب ─────────

    private File activeFile() { return new File(root, "active.txt"); }
    private File pendingFile() { return new File(root, "pending.txt"); }

    /** يُستدعى عند بدء التطبيق قبل تحميل الصفحة */
    public void onLaunch() {
        try {
            File pending = pendingFile();
            if (pending.exists()) {
                String state = readText(pending).trim();
                if ("booting".equals(state)) {
                    // الإصدار الجديد لم يؤكد نجاح تشغيله في المرة السابقة ← نعود للإصدار الأصلي
                    rollback();
                } else {
                    writeText(pending, "booting");
                }
            }
        } catch (Exception ignored) {
        }
    }

    /** الصفحة تستدعي هذا بعد أن تعمل بنجاح */
    public void markHealthy() {
        //noinspection ResultOfMethodCallIgnored
        pendingFile().delete();
    }

    private void rollback() {
        File dir = activeDir();
        //noinspection ResultOfMethodCallIgnored
        activeFile().delete();
        //noinspection ResultOfMethodCallIgnored
        pendingFile().delete();
        if (dir != null) deleteRecursive(dir);
    }

    public File activeDir() {
        try {
            File f = activeFile();
            if (!f.exists()) return null;
            File dir = new File(root, readText(f).trim());
            return dir.isDirectory() ? dir : null;
        } catch (Exception e) {
            return null;
        }
    }

    // ───────── تقديم الملفات ─────────

    /** PathHandler: من مجلد التحديث إن وُجد الملف، وإلا من assets الأصلية */
    public WebViewAssetLoader.PathHandler pathHandler() {
        final WebViewAssetLoader.AssetsPathHandler assets = new WebViewAssetLoader.AssetsPathHandler(ctx);
        return path -> {
            File dir = activeDir();
            if (dir != null && path != null && !path.contains("..")) {
                File f = new File(dir, path);
                if (f.isFile()) {
                    try {
                        return new WebResourceResponse(null, null, new FileInputStream(f));
                    } catch (IOException ignored) {
                    }
                }
            }
            return assets.handle(path);
        };
    }

    // ───────── فحص التحديث وتنزيله ─────────

    public void checkInBackground() {
        new Thread(() -> {
            try {
                check();
            } catch (Exception ignored) {
                // لا إنترنت أو المستودع غير متاح — نتجاهل بصمت
            }
        }).start();
    }

    private JSONObject manifestOf(File dir) {
        try {
            if (dir == null) return null;
            File f = new File(dir, "version.json");
            return f.isFile() ? new JSONObject(readText(f)) : null;
        } catch (Exception e) {
            return null;
        }
    }

    private JSONObject bundledManifest() {
        try (InputStream in = ctx.getAssets().open("version.json", AssetManager.ACCESS_STREAMING)) {
            return new JSONObject(new String(readAll(in), StandardCharsets.UTF_8));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    private void check() throws Exception {
        String remoteText = null;
        String base = null;
        for (String b : bases) {
            try {
                remoteText = new String(download(b + "version.json?t=" + System.currentTimeMillis()), StandardCharsets.UTF_8);
                base = b;
                break;
            } catch (Exception ignored) {
            }
        }
        if (remoteText == null) return;

        JSONObject remote = new JSONObject(remoteText);
        int remoteVersion = remote.optInt("version", 0);
        JSONObject bundled = bundledManifest();
        File currentDir = activeDir();
        JSONObject current = manifestOf(currentDir);
        int currentVersion = Math.max(bundled.optInt("version", 0), current != null ? current.optInt("version", 0) : 0);
        if (remoteVersion <= currentVersion) return;

        JSONObject remoteFiles = remote.getJSONObject("files");
        JSONObject bundledFiles = bundled.optJSONObject("files");
        JSONObject currentFiles = current != null ? current.optJSONObject("files") : null;

        String name = "v" + remoteVersion;
        File staging = new File(root, name + "_tmp");
        deleteRecursive(staging);
        if (!staging.mkdirs()) return;

        Iterator<String> keys = remoteFiles.keys();
        while (keys.hasNext()) {
            String path = keys.next();
            if (path.contains("..")) continue;
            String hash = remoteFiles.getString(path);
            if (bundledFiles != null && hash.equals(bundledFiles.optString(path))) continue; // موجود أصلاً في التطبيق
            File target = new File(staging, path);
            File parent = target.getParentFile();
            if (parent != null && !parent.exists() && !parent.mkdirs()) throw new IOException("mkdir");

            File existing = currentDir != null ? new File(currentDir, path) : null;
            if (existing != null && existing.isFile() && currentFiles != null && hash.equals(currentFiles.optString(path))) {
                copy(existing, target);
            } else {
                byte[] data = download(base + encodePath(path) + "?v=" + remoteVersion);
                if (!hash.equals(sha256(data))) throw new IOException("hash mismatch: " + path);
                writeBytes(target, data);
            }
        }
        writeText(new File(staging, "version.json"), remoteText);

        File finalDir = new File(root, name);
        deleteRecursive(finalDir);
        if (!staging.renameTo(finalDir)) throw new IOException("rename");
        writeText(activeFile(), name);
        writeText(pendingFile(), "new");

        // حذف الإصدارات القديمة
        File[] all = root.listFiles();
        if (all != null) {
            for (File f : all) {
                if (f.isDirectory() && !f.getName().equals(name)) deleteRecursive(f);
            }
        }
    }

    // ───────── أدوات ─────────

    private static String encodePath(String path) {
        StringBuilder sb = new StringBuilder();
        for (String part : path.split("/")) {
            if (sb.length() > 0) sb.append('/');
            try {
                sb.append(java.net.URLEncoder.encode(part, "UTF-8").replace("+", "%20"));
            } catch (Exception e) {
                sb.append(part);
            }
        }
        return sb.toString();
    }

    private static byte[] download(String url) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(60000);
        c.setUseCaches(false);
        c.setRequestProperty("Cache-Control", "no-cache");
        try {
            if (c.getResponseCode() != 200) throw new IOException("HTTP " + c.getResponseCode());
            try (InputStream in = c.getInputStream()) {
                return readAll(in);
            }
        } finally {
            c.disconnect();
        }
    }

    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        return out.toByteArray();
    }

    private static String sha256(byte[] data) throws Exception {
        byte[] d = MessageDigest.getInstance("SHA-256").digest(data);
        StringBuilder sb = new StringBuilder();
        for (byte b : d) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    private static String readText(File f) throws IOException {
        try (InputStream in = new FileInputStream(f)) {
            return new String(readAll(in), StandardCharsets.UTF_8);
        }
    }

    private static void writeText(File f, String text) throws IOException {
        writeBytes(f, text.getBytes(StandardCharsets.UTF_8));
    }

    private static void writeBytes(File f, byte[] data) throws IOException {
        File parent = f.getParentFile();
        if (parent != null && !parent.exists()) //noinspection ResultOfMethodCallIgnored
            parent.mkdirs();
        try (OutputStream out = new FileOutputStream(f)) {
            out.write(data);
        }
    }

    private static void copy(File from, File to) throws IOException {
        try (InputStream in = new FileInputStream(from)) {
            writeBytes(to, readAll(in));
        }
    }

    private static void deleteRecursive(File f) {
        if (f == null || !f.exists()) return;
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteRecursive(k);
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }
}
