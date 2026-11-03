package qa.org.qna.myreminder;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Calendar;
import java.util.TimeZone;

public final class AlarmScheduler {
    public static final String PREFS_NAME = "myreminder_native_prefs";
    public static final String KEY_REMINDERS_JSON = "saved_reminders_json";
    public static final String KEY_OTA_VERSION = "installed_ota_version";

    private AlarmScheduler() {}

    public static void saveAndScheduleAll(Context context, String remindersJson) {
        if (context == null || remindersJson == null) return;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_REMINDERS_JSON, remindersJson).apply();
        scheduleAllFromJson(context, remindersJson);
    }

    public static void rescheduleFromStorage(Context context) {
        if (context == null) return;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String json = prefs.getString(KEY_REMINDERS_JSON, "[]");
        scheduleAllFromJson(context, json);
    }

    public static void scheduleAllFromJson(Context context, String remindersJson) {
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;

            JSONArray arr = new JSONArray(remindersJson);
            long nowMs = System.currentTimeMillis();

            for (int i = 0; i < arr.length(); i++) {
                JSONObject r = arr.optJSONObject(i);
                if (r == null) continue;

                String id = r.optString("id", "rem-" + i);
                boolean enabled = r.optBoolean("enabled", true);
                String status = r.optString("status", "pending");

                int reqCode = Math.abs(id.hashCode());
                if (!enabled || "completed".equalsIgnoreCase(status) || "trashed".equalsIgnoreCase(status)) {
                    cancelAlarm(context, am, reqCode);
                    continue;
                }

                long nextTriggerMs = computeNextTriggerMs(r, nowMs);
                if (nextTriggerMs > nowMs) {
                    scheduleSingleAlarm(
                        context,
                        am,
                        reqCode,
                        nextTriggerMs,
                        id,
                        r.optString("title", "QNA Reminder"),
                        r.optString("project", "QNA post editor"),
                        r.optString("readyByDay", ""),
                        r.optString("notes", ""),
                        r.optBoolean("ttsEnabled", true)
                    );
                }
            }
        } catch (Exception ignored) {
        }
    }

    public static void scheduleSnooze(
        Context context,
        String id,
        String title,
        String project,
        String readyBy,
        String notes,
        int minutes
    ) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        long triggerAt = System.currentTimeMillis() + (minutes * 60_000L);
        int reqCode = Math.abs((id + "-snooze").hashCode());
        scheduleSingleAlarm(context, am, reqCode, triggerAt, id, title, project, readyBy, notes, true);
    }

    private static void cancelAlarm(Context context, AlarmManager am, int reqCode) {
        Intent intent = new Intent(context, AlarmReceiver.class);
        int flags = PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getBroadcast(context, reqCode, intent, flags);
        if (pi != null) {
            am.cancel(pi);
        }
    }

    private static void scheduleSingleAlarm(
        Context context,
        AlarmManager am,
        int reqCode,
        long triggerAtMs,
        String id,
        String title,
        String project,
        String readyBy,
        String notes,
        boolean ttsEnabled
    ) {
        Intent intent = new Intent(context, AlarmReceiver.class);
        intent.putExtra("id", id);
        intent.putExtra("title", title);
        intent.putExtra("project", project);
        intent.putExtra("readyBy", readyBy);
        intent.putExtra("notes", notes);
        intent.putExtra("ttsEnabled", ttsEnabled);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getBroadcast(context, reqCode, intent, flags);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
            }
        } catch (SecurityException se) {
            am.set(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
        }
    }

    private static long computeNextTriggerMs(JSONObject r, long nowMs) {
        TimeZone qatarTz = TimeZone.getTimeZone("Asia/Qatar");
        String scheduleType = r.optString("scheduleType", "weekly");
        JSONArray daysArr = r.optJSONArray("daysOfWeek");
        JSONArray timesArr = r.optJSONArray("times");
        if (timesArr == null || timesArr.length() == 0) {
            timesArr = new JSONArray().put("11:00");
        }

        long bestCandidate = -1L;

        for (int dayOffset = 0; dayOffset <= 7; dayOffset++) {
            Calendar cal = Calendar.getInstance(qatarTz);
            cal.setTimeInMillis(nowMs);
            cal.add(Calendar.DAY_OF_YEAR, dayOffset);

            String dayName = getDayName(cal.get(Calendar.DAY_OF_WEEK));
            if ("weekly".equalsIgnoreCase(scheduleType) && daysArr != null && daysArr.length() > 0) {
                boolean matchDay = false;
                for (int d = 0; d < daysArr.length(); d++) {
                    if (dayName.equalsIgnoreCase(daysArr.optString(d, ""))) {
                        matchDay = true;
                        break;
                    }
                }
                if (!matchDay) continue;
            }

            for (int t = 0; t < timesArr.length(); t++) {
                String hhmm = timesArr.optString(t, "11:00");
                String[] parts = hhmm.split(":");
                if (parts.length < 2) continue;
                try {
                    int hour = Integer.parseInt(parts[0].trim());
                    int minute = Integer.parseInt(parts[1].trim());
                    Calendar slot = (Calendar) cal.clone();
                    slot.set(Calendar.HOUR_OF_DAY, hour);
                    slot.set(Calendar.MINUTE, minute);
                    slot.set(Calendar.SECOND, 0);
                    slot.set(Calendar.MILLISECOND, 0);

                    long slotMs = slot.getTimeInMillis();
                    if (slotMs > nowMs + 2000L) {
                        if (bestCandidate == -1L || slotMs < bestCandidate) {
                            bestCandidate = slotMs;
                        }
                    }
                } catch (NumberFormatException ignored) {
                }
            }
        }
        return bestCandidate;
    }

    private static String getDayName(int calendarDay) {
        switch (calendarDay) {
            case Calendar.SUNDAY: return "sunday";
            case Calendar.MONDAY: return "monday";
            case Calendar.TUESDAY: return "tuesday";
            case Calendar.WEDNESDAY: return "wednesday";
            case Calendar.THURSDAY: return "thursday";
            case Calendar.FRIDAY: return "friday";
            case Calendar.SATURDAY: return "saturday";
            default: return "tuesday";
        }
    }
}
