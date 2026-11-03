package qa.org.qna.myreminder;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;

public class AlarmReceiver extends BroadcastReceiver {
    public static final String CHANNEL_ID = "qna_myreminder_fullscreen_alarms";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;

        String id = intent.getStringExtra("id");
        String title = intent.getStringExtra("title");
        String project = intent.getStringExtra("project");
        String readyBy = intent.getStringExtra("readyBy");
        String notes = intent.getStringExtra("notes");
        boolean ttsEnabled = intent.getBooleanExtra("ttsEnabled", true);

        if (title == null || title.isEmpty()) {
            title = "QNA Reminder Alert";
        }
        if (project == null || project.isEmpty()) {
            project = "QNA post editor";
        }

        ensureNotificationChannel(context);

        Intent fullScreenIntent = new Intent(context, FullScreenAlertActivity.class);
        fullScreenIntent.setFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        fullScreenIntent.putExtra("id", id != null ? id : "rem-now");
        fullScreenIntent.putExtra("title", title);
        fullScreenIntent.putExtra("project", project);
        fullScreenIntent.putExtra("readyBy", readyBy != null ? readyBy : "");
        fullScreenIntent.putExtra("notes", notes != null ? notes : "");
        fullScreenIntent.putExtra("ttsEnabled", ttsEnabled);

        PendingIntent fullScreenPi = PendingIntent.getActivity(
            context,
            Math.abs((title + System.currentTimeMillis()).hashCode()),
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String subtitle = project + (readyBy != null && !readyBy.isEmpty() ? " • Ready on " + readyBy : "");

        Notification.Builder builder = new Notification.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("🚨 " + title)
            .setContentText(subtitle)
            .setColor(Color.parseColor("#8A1538"))
            .setCategory(Notification.CATEGORY_ALARM)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(fullScreenPi)
            .setFullScreenIntent(fullScreenPi, true);

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(Math.abs(title.hashCode()), builder.build());
        }

        try {
            context.startActivity(fullScreenIntent);
        } catch (Exception ignored) {
        }

        // Automatically schedule the next recurrence slot
        AlarmScheduler.rescheduleFromStorage(context);
    }

    public static void ensureNotificationChannel(Context context) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel ch = new NotificationChannel(
            CHANNEL_ID,
            "MyReminder QNA Full-Screen Alarms",
            NotificationManager.IMPORTANCE_HIGH
        );
        ch.setDescription("High-priority lock-screen & full-screen QNA task and schedule alarms");
        ch.enableLights(true);
        ch.setLightColor(Color.parseColor("#8A1538"));
        ch.enableVibration(true);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }
}
