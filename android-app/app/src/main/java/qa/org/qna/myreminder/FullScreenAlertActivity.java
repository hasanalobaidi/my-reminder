package qa.org.qna.myreminder;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.speech.tts.TextToSpeech;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.util.Locale;

public class FullScreenAlertActivity extends Activity {
    private Ringtone activeRingtone;
    private Vibrator vibrator;
    private TextToSpeech tts;
    private String spokenSummary = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
        );
        getWindow().setStatusBarColor(Color.parseColor("#8A1538"));
        getWindow().setNavigationBarColor(Color.parseColor("#11070B"));

        Intent intent = getIntent();
        final String id = intent != null && intent.getStringExtra("id") != null ? intent.getStringExtra("id") : "rem-now";
        final String title = intent != null && intent.getStringExtra("title") != null ? intent.getStringExtra("title") : "Prepare the 3 weekly templates";
        final String project = intent != null && intent.getStringExtra("project") != null ? intent.getStringExtra("project") : "QNA post editor";
        final String readyBy = intent != null && intent.getStringExtra("readyBy") != null ? intent.getStringExtra("readyBy") : "";
        final String notes = intent != null && intent.getStringExtra("notes") != null ? intent.getStringExtra("notes") : "";
        final boolean ttsEnabled = intent == null || intent.getBooleanExtra("ttsEnabled", true);

        spokenSummary = "QNA Reminder. " + title + ". Project: " + project + "."
            + (!readyBy.isEmpty() ? " Target deadline: ready on " + readyBy + "." : "")
            + (!notes.isEmpty() ? " " + notes : "");

        ScrollView rootScroll = new ScrollView(this);
        rootScroll.setFillViewport(true);
        rootScroll.setBackgroundColor(Color.parseColor("#18060D"));

        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setGravity(Gravity.CENTER);
        int pad = dp(24);
        container.setPadding(pad, pad, pad, pad);

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        int cardPad = dp(26);
        card.setPadding(cardPad, cardPad, cardPad, cardPad);
        GradientDrawable cardBg = new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[] { Color.parseColor("#8A1538"), Color.parseColor("#2A0611") }
        );
        cardBg.setCornerRadius(dp(22));
        cardBg.setStroke(dp(2), Color.parseColor("#D4AF37"));
        card.setBackground(cardBg);

        TextView badgeView = new TextView(this);
        badgeView.setText("🚨 QNA FULL-SCREEN ALARM • " + project.toUpperCase(Locale.US));
        badgeView.setTextColor(Color.parseColor("#D4AF37"));
        badgeView.setTextSize(13f);
        badgeView.setTypeface(Typeface.DEFAULT_BOLD);
        card.addView(badgeView);

        TextView titleView = new TextView(this);
        titleView.setText(title);
        titleView.setTextColor(Color.WHITE);
        titleView.setTextSize(28f);
        titleView.setTypeface(Typeface.DEFAULT_BOLD);
        titleView.setPadding(0, dp(14), 0, dp(10));
        card.addView(titleView);

        if (!readyBy.isEmpty()) {
            TextView readyView = new TextView(this);
            readyView.setText("🎯 Target Deadline: Ready on " + readyBy);
            readyView.setTextColor(Color.parseColor("#FFF6D6"));
            readyView.setTextSize(16f);
            readyView.setTypeface(Typeface.DEFAULT_BOLD);
            readyView.setPadding(0, 0, 0, dp(12));
            card.addView(readyView);
        }

        if (!notes.isEmpty()) {
            TextView notesView = new TextView(this);
            notesView.setText(notes);
            notesView.setTextColor(Color.parseColor("#F5E9EE"));
            notesView.setTextSize(15f);
            notesView.setPadding(dp(12), dp(10), dp(12), dp(14));
            GradientDrawable notesBg = new GradientDrawable();
            notesBg.setColor(Color.parseColor("#33FFFFFF"));
            notesBg.setCornerRadius(dp(10));
            notesView.setBackground(notesBg);
            card.addView(notesView);
        }

        LinearLayout actionsCol = new LinearLayout(this);
        actionsCol.setOrientation(LinearLayout.VERTICAL);
        actionsCol.setPadding(0, dp(20), 0, 0);

        Button dismissBtn = makeButton("✅ Acknowledge & Dismiss Alarm", "#D4AF37", "#1B1316");
        dismissBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                stopAlertMedia();
                finish();
            }
        });
        actionsCol.addView(dismissBtn);

        Button snoozeBtn = makeButton("💤 Snooze 10 Minutes", "#3B101E", "#FFFFFF");
        snoozeBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                AlarmScheduler.scheduleSnooze(FullScreenAlertActivity.this, id, title, project, readyBy, notes, 10);
                stopAlertMedia();
                finish();
            }
        });
        actionsCol.addView(snoozeBtn);

        Button speakBtn = makeButton("🔊 Speak Reminder Aloud Again (TTS)", "#3B101E", "#FFFFFF");
        speakBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                speakNow();
            }
        });
        actionsCol.addView(speakBtn);

        Button openAppBtn = makeButton("📱 Open MyReminder Control Center", "#231217", "#D4AF37");
        openAppBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                stopAlertMedia();
                Intent mainIntent = new Intent(FullScreenAlertActivity.this, MainActivity.class);
                mainIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                startActivity(mainIntent);
                finish();
            }
        });
        actionsCol.addView(openAppBtn);

        card.addView(actionsCol);
        container.addView(card);
        rootScroll.addView(container);
        setContentView(rootScroll);

        startAlertMedia(ttsEnabled);
    }

    private Button makeButton(String label, String bgHex, String textHex) {
        Button btn = new Button(this);
        btn.setText(label);
        btn.setAllCaps(false);
        btn.setTextColor(Color.parseColor(textHex));
        btn.setTextSize(15f);
        btn.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor(bgHex));
        bg.setCornerRadius(dp(12));
        bg.setStroke(dp(1), Color.parseColor("#66D4AF37"));
        btn.setBackground(bg);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        lp.bottomMargin = dp(10);
        btn.setLayoutParams(lp);
        btn.setPadding(dp(14), dp(14), dp(14), dp(14));
        return btn;
    }

    private void startAlertMedia(final boolean ttsEnabled) {
        try {
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null) {
                long[] pattern = new long[] { 0, 500, 300, 500, 300, 700 };
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
            }
        } catch (Exception ignored) {
        }

        try {
            Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
            activeRingtone = RingtoneManager.getRingtone(getApplicationContext(), alarmUri);
            if (activeRingtone != null) {
                activeRingtone.play();
            }
        } catch (Exception ignored) {
        }

        if (ttsEnabled) {
            tts = new TextToSpeech(getApplicationContext(), new TextToSpeech.OnInitListener() {
                @Override
                public void onInit(int status) {
                    if (status == TextToSpeech.SUCCESS && tts != null) {
                        tts.setLanguage(Locale.US);
                        speakNow();
                    }
                }
            });
        }
    }

    private void speakNow() {
        try {
            if (tts != null) {
                tts.speak(spokenSummary, TextToSpeech.QUEUE_FLUSH, null, "qna-fs-tts");
            }
        } catch (Exception ignored) {
        }
    }

    private void stopAlertMedia() {
        try {
            if (activeRingtone != null && activeRingtone.isPlaying()) {
                activeRingtone.stop();
            }
        } catch (Exception ignored) {
        }
        try {
            if (vibrator != null) {
                vibrator.cancel();
            }
        } catch (Exception ignored) {
        }
        try {
            if (tts != null) {
                tts.stop();
                tts.shutdown();
                tts = null;
            }
        } catch (Exception ignored) {
        }
    }

    @Override
    protected void onDestroy() {
        stopAlertMedia();
        super.onDestroy();
    }

    private int dp(int v) {
        float d = getResources().getDisplayMetrics().density;
        return Math.round(v * d);
    }
}
