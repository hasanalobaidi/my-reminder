package qa.org.qna.myreminder;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;

public class MainActivity extends Activity {
    public static final String BUNDLED_VERSION = "1.00.03";
    private WebView webView;
    private TextToSpeech tts;
    private File otaDir;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.parseColor("#8A1538"));
        getWindow().setNavigationBarColor(Color.parseColor("#110B0E"));

        AlarmReceiver.ensureNotificationChannel(this);
        requestNeededPermissions();

        otaDir = new File(getFilesDir(), "ota_bundle");
        ensureInitialOtaBundleExtracted();

        tts = new TextToSpeech(getApplicationContext(), new TextToSpeech.OnInitListener() {
            @Override
            public void onInit(int status) {
                if (status == TextToSpeech.SUCCESS && tts != null) {
                    tts.setLanguage(Locale.US);
                }
            }
        });

        webView = new WebView(this);
        setContentView(webView);

        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setMediaPlaybackRequiresUserGesture(false);
        ws.setAllowFileAccess(true);
        ws.setAllowContentAccess(true);
        ws.setAllowFileAccessFromFileURLs(true);
        ws.setAllowUniversalAccessFromFileURLs(true);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.addJavascriptInterface(new NativeBridge(), "MyReminderAndroid");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url != null && (url.endsWith(".ics") || url.endsWith(".apk"))) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                        return true;
                    } catch (Exception ignored) {
                    }
                }
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        request.grant(request.getResources());
                    }
                });
            }
        });

        loadActiveOtaBundle();
        checkGitHubOtaInBackground();
    }

    private void loadActiveOtaBundle() {
        File indexFile = new File(otaDir, "index.html");
        if (indexFile.exists()) {
            webView.loadUrl("file://" + indexFile.getAbsolutePath() + "?pairLan=" + Uri.encode("http://192.168.0.128:5252"));
        } else {
            webView.loadUrl("file:///android_asset/www/index.html?pairLan=" + Uri.encode("http://192.168.0.128:5252"));
        }
    }

    private void ensureInitialOtaBundleExtracted() {
        SharedPreferences prefs = getSharedPreferences(AlarmScheduler.PREFS_NAME, Context.MODE_PRIVATE);
        String installedVer = prefs.getString(AlarmScheduler.KEY_OTA_VERSION, "");
        File indexFile = new File(otaDir, "index.html");

        if (!indexFile.exists() || installedVer.isEmpty()) {
            copyAssetFolder(getAssets(), "www", otaDir);
            prefs.edit().putString(AlarmScheduler.KEY_OTA_VERSION, BUNDLED_VERSION).apply();
        }
    }

    private void copyAssetFolder(AssetManager am, String assetPath, File destDir) {
        try {
            String[] children = am.list(assetPath);
            if (children == null || children.length == 0) {
                copySingleAsset(am, assetPath, destDir);
            } else {
                if (!destDir.exists()) {
                    destDir.mkdirs();
                }
                for (String child : children) {
                    copyAssetFolder(am, assetPath + "/" + child, new File(destDir, child));
                }
            }
        } catch (IOException ignored) {
        }
    }

    private void copySingleAsset(AssetManager am, String assetPath, File outFile) {
        File parent = outFile.getParentFile();
        if (parent != null && !parent.exists()) {
            parent.mkdirs();
        }
        try (InputStream in = am.open(assetPath);
             FileOutputStream out = new FileOutputStream(outFile)) {
            byte[] buf = new byte[8192];
            int len;
            while ((len = in.read(buf)) != -1) {
                out.write(buf, 0, len);
            }
        } catch (IOException ignored) {
        }
    }

    private void checkGitHubOtaInBackground() {
        new Thread(new Runnable() {
            @Override
            public void run() {
                SharedPreferences prefs = getSharedPreferences(AlarmScheduler.PREFS_NAME, Context.MODE_PRIVATE);
                String currentVer = prefs.getString(AlarmScheduler.KEY_OTA_VERSION, BUNDLED_VERSION);
                String ghBundleUrl = "https://raw.githubusercontent.com/hasanalobaidi/my-reminder/main/public/ota-bundle.json";
                String macBundleUrl = "http://192.168.0.128:5252/api/ota/bundle";
                downloadAndApplyBundle(ghBundleUrl, macBundleUrl, currentVer, false);
            }
        }).start();
    }

    private void downloadAndApplyBundle(
        final String primaryUrl,
        final String fallbackUrl,
        final String currentVer,
        final boolean forceReload
    ) {
        try {
            String rawJson = fetchUrlText(primaryUrl);
            if (rawJson == null && fallbackUrl != null && !fallbackUrl.isEmpty()) {
                rawJson = fetchUrlText(fallbackUrl);
            }
            if (rawJson == null) return;

            JSONObject root = new JSONObject(rawJson);
            JSONObject bundle = root.has("bundle") ? root.getJSONObject("bundle") : root;
            final String newVer = bundle.optString("version", "");
            JSONObject filesObj = bundle.optJSONObject("files");
            if (newVer.isEmpty() || filesObj == null) return;

            if (!forceReload && newVer.compareTo(currentVer) <= 0) {
                return;
            }

            Iterator<String> keys = filesObj.keys();
            while (keys.hasNext()) {
                String relPath = keys.next();
                if (relPath.contains("..")) continue;
                String content = filesObj.optString(relPath, "");
                File outFile = new File(otaDir, relPath);
                File parent = outFile.getParentFile();
                if (parent != null && !parent.exists()) {
                    parent.mkdirs();
                }
                try (FileOutputStream fos = new FileOutputStream(outFile)) {
                    fos.write(content.getBytes(StandardCharsets.UTF_8));
                }
            }

            SharedPreferences prefs = getSharedPreferences(AlarmScheduler.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString(AlarmScheduler.KEY_OTA_VERSION, newVer).apply();

            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(
                        MainActivity.this,
                        "✨ MyReminder auto-updated to v" + newVer + " (Zero APK Reinstall)",
                        Toast.LENGTH_LONG
                    ).show();
                    loadActiveOtaBundle();
                }
            });
        } catch (Exception ignored) {
        }
    }

    private String fetchUrlText(String urlStr) {
        if (urlStr == null || urlStr.isEmpty()) return null;
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlStr + (urlStr.contains("?") ? "&" : "?") + "t=" + System.currentTimeMillis());
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(3500);
            conn.setReadTimeout(5000);
            conn.setUseCaches(false);
            if (conn.getResponseCode() != 200) return null;

            StringBuilder sb = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8)
            )) {
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line).append('\n');
                }
            }
            return sb.toString();
        } catch (Exception e) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private void requestNeededPermissions() {
        List<String> perms = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                perms.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            perms.add(Manifest.permission.RECORD_AUDIO);
        }
        if (!perms.isEmpty()) {
            requestPermissions(perms.toArray(new String[0]), 101);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        try {
            if (tts != null) {
                tts.stop();
                tts.shutdown();
            }
        } catch (Exception ignored) {
        }
        super.onDestroy();
    }

    public final class NativeBridge {
        @JavascriptInterface
        public void syncNativeAlarms(String remindersJson) {
            AlarmScheduler.saveAndScheduleAll(MainActivity.this, remindersJson);
        }

        @JavascriptInterface
        public void applyOtaBundleFromUrl(final String ghBundleUrl, final String macBundleUrl, final String targetVersion) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    SharedPreferences prefs = getSharedPreferences(AlarmScheduler.PREFS_NAME, Context.MODE_PRIVATE);
                    String currentVer = prefs.getString(AlarmScheduler.KEY_OTA_VERSION, BUNDLED_VERSION);
                    downloadAndApplyBundle(ghBundleUrl, macBundleUrl, currentVer, true);
                }
            }).start();
        }

        @JavascriptInterface
        public void speakNativeTts(final String text, final String lang) {
            if (tts == null || text == null || text.isEmpty()) return;
            try {
                if (lang != null && lang.startsWith("ar")) {
                    tts.setLanguage(new Locale("ar"));
                } else {
                    tts.setLanguage(Locale.US);
                }
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "qna-bridge-tts");
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void triggerNativeAlertNow(String title, String project, String readyBy, String notes) {
            Intent intent = new Intent(MainActivity.this, AlarmReceiver.class);
            intent.putExtra("id", "rem-manual");
            intent.putExtra("title", title);
            intent.putExtra("project", project);
            intent.putExtra("readyBy", readyBy);
            intent.putExtra("notes", notes);
            intent.putExtra("ttsEnabled", true);
            sendBroadcast(intent);
        }

        @JavascriptInterface
        public String getInstalledOtaVersion() {
            SharedPreferences prefs = getSharedPreferences(AlarmScheduler.PREFS_NAME, Context.MODE_PRIVATE);
            return prefs.getString(AlarmScheduler.KEY_OTA_VERSION, BUNDLED_VERSION);
        }
    }
}
