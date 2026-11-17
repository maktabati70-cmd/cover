package com.alshami.coverstudio;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * استوديو الأغلفة — تطبيق أندرويد يعرض الاستوديو كاملاً داخل WebView.
 * • الملفات تُخدم من assets عبر WebViewAssetLoader (أصل https آمن → تعمل كل ميزات المتصفح).
 * • رفع الصور عبر منتقي الملفات في الهاتف.
 * • التصدير والحفظ: الصفحة ترسل الملف عبر AndroidBridge فيُحفظ في الصور/التنزيلات.
 * تطوير أبو عبدالله الشامي
 */
public class MainActivity extends Activity {

    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/assets/index.html";
    private static final String FOLDER = "استوديو الأغلفة";
    private static final int FILE_REQUEST = 1001;
    private static final int STORAGE_REQUEST = 1002;

    private WebView web;
    private WebUpdater updater;
    private ValueCallback<Uri[]> fileCallback;
    private long lastBackPress = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.parseColor("#0D0B09"));
        getWindow().setNavigationBarColor(Color.parseColor("#0D0B09"));
        WebView.setWebContentsDebuggingEnabled(true);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#070605"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        // التحديث الصامت: الملفات المحدَّثة من المستودع لها الأولوية على نسخة التطبيق الأصلية
        updater = new WebUpdater(this, BuildConfig.UPDATE_REPO);
        updater.onLaunch();
        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/assets/", updater.pathHandler())
                .build();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse response = assetLoader.shouldInterceptRequest(request.getUrl());
                // نوع MIME صحيح ضروري: المتصفح يرفض ملفات JavaScript (module) بنوع خاطئ
                if (response != null) {
                    String mime = mimeFor(request.getUrl().getPath());
                    if (mime != null) response.setMimeType(mime);
                }
                return response;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (HOST.equals(uri.getHost())) return false;
                // الروابط الخارجية تُفتح في المتصفح
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;

                boolean imagesOnly = false;
                String[] types = params.getAcceptTypes();
                if (types != null && types.length > 0) {
                    imagesOnly = true;
                    for (String t : types) {
                        if (t == null || !t.trim().startsWith("image/")) {
                            imagesOnly = false;
                            break;
                        }
                    }
                }

                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(imagesOnly ? "image/*" : "*/*");
                try {
                    startActivityForResult(Intent.createChooser(intent, "اختر ملفاً"), FILE_REQUEST);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        web.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            web.loadUrl(START_URL);
        }

        updater.checkInBackground();

        if (Build.VERSION.SDK_INT < 29
                && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, STORAGE_REQUEST);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_REQUEST && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        long now = System.currentTimeMillis();
        if (now - lastBackPress < 2000) {
            super.onBackPressed();
            return;
        }
        lastBackPress = now;
        Toast.makeText(this, "اضغط رجوع مرة أخرى للخروج", Toast.LENGTH_SHORT).show();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }

    private static String mimeFor(String path) {
        if (path == null) return null;
        String p = path.toLowerCase();
        if (p.endsWith(".js") || p.endsWith(".mjs")) return "text/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".woff")) return "font/woff";
        if (p.endsWith(".wasm")) return "application/wasm";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".png")) return "image/png";
        return null;
    }

    // ───────── حفظ الملفات في الهاتف ─────────

    private String saveFile(String name, String mime, byte[] data) throws IOException {
        boolean image = mime != null && mime.startsWith("image/");
        String baseDir = image ? Environment.DIRECTORY_PICTURES : Environment.DIRECTORY_DOWNLOADS;

        if (Build.VERSION.SDK_INT >= 29) {
            ContentResolver resolver = getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, baseDir + "/" + FOLDER);
            Uri collection = image ? MediaStore.Images.Media.EXTERNAL_CONTENT_URI : MediaStore.Downloads.EXTERNAL_CONTENT_URI;
            Uri uri = resolver.insert(collection, values);
            if (uri == null) throw new IOException("تعذّر إنشاء الملف");
            try (OutputStream os = resolver.openOutputStream(uri)) {
                if (os == null) throw new IOException("تعذّر فتح الملف");
                os.write(data);
            }
        } else {
            File dir = new File(Environment.getExternalStoragePublicDirectory(baseDir), FOLDER);
            if (!dir.exists() && !dir.mkdirs()) throw new IOException("تعذّر إنشاء المجلد");
            File file = new File(dir, name);
            try (FileOutputStream fos = new FileOutputStream(file)) {
                fos.write(data);
            }
            MediaScannerConnection.scanFile(this, new String[]{file.getAbsolutePath()}, new String[]{mime}, null);
        }
        return image ? "الصور" : "التنزيلات";
    }

    /** واجهة تستدعيها الصفحة: beginFile ← appendChunk (Base64) ← finishFile */
    private class AndroidBridge {
        private final Map<Integer, ByteArrayOutputStream> buffers = new HashMap<>();
        private final Map<Integer, String[]> meta = new HashMap<>();
        private final AtomicInteger seq = new AtomicInteger(1);

        @JavascriptInterface
        public boolean isAndroid() {
            return true;
        }

        /** الصفحة تؤكد أنها عملت بنجاح ← يُعتمد الإصدار المحدَّث نهائياً */
        @JavascriptInterface
        public void appReady() {
            if (updater != null) updater.markHealthy();
        }

        @JavascriptInterface
        public String appVersion() {
            return BuildConfig.VERSION_NAME;
        }

        @JavascriptInterface
        public int beginFile(String name, String mime) {
            int id = seq.getAndIncrement();
            synchronized (buffers) {
                buffers.put(id, new ByteArrayOutputStream());
                meta.put(id, new String[]{name, mime});
            }
            return id;
        }

        @JavascriptInterface
        public void appendChunk(int id, String base64) {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            synchronized (buffers) {
                ByteArrayOutputStream out = buffers.get(id);
                if (out != null) out.write(bytes, 0, bytes.length);
            }
        }

        @JavascriptInterface
        public void finishFile(int id) {
            final ByteArrayOutputStream out;
            final String[] m;
            synchronized (buffers) {
                out = buffers.remove(id);
                m = meta.remove(id);
            }
            if (out == null || m == null) return;
            final byte[] data = out.toByteArray();
            new Thread(() -> {
                String message;
                try {
                    String where = saveFile(m[0], m[1], data);
                    message = "تم الحفظ في " + where + " ← " + FOLDER;
                } catch (Exception e) {
                    message = "تعذّر الحفظ: " + e.getMessage();
                }
                final String msg = message;
                runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show());
            }).start();
        }
    }
}
