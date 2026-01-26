package com.zimfeast.driver.service;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import com.zimfeast.driver.R;
import com.zimfeast.driver.data.model.DeliveryOffer;
import com.zimfeast.driver.ui.MainActivity;

public class DeliveryNotificationService {
    
    private static final String CHANNEL_ID_DELIVERY = "ZimFeastDeliveryOffers";
    private static final int NOTIFICATION_ID_DELIVERY = 2001;
    
    private final Context context;
    private final NotificationManager notificationManager;
    
    public DeliveryNotificationService(Context context) {
        this.context = context;
        this.notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();
    }
    
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID_DELIVERY,
                "Delivery Offers",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notifications for new delivery offers");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 500, 200, 500});
            channel.enableLights(true);
            channel.setLightColor(0xFFFF6B35);
            channel.setBypassDnd(true);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            
            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();
            channel.setSound(soundUri, audioAttributes);
            
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }
    
    public void showDeliveryOfferNotification(DeliveryOffer offer) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("orderId", offer.getOrderId());
        intent.putExtra("fromNotification", true);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        
        String title = "New Delivery Request!";
        String message = String.format("Pickup from %s\n$%.2f - %.1f km", 
            offer.getRestaurantName(), 
            offer.getTotalEarnings(),
            offer.getDistance());
        
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID_DELIVERY)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setVibrate(new long[]{0, 500, 200, 500})
            .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setFullScreenIntent(pendingIntent, true);
        
        if (notificationManager != null) {
            notificationManager.notify(NOTIFICATION_ID_DELIVERY, builder.build());
        }
    }
    
    public void cancelDeliveryNotification() {
        if (notificationManager != null) {
            notificationManager.cancel(NOTIFICATION_ID_DELIVERY);
        }
    }
}
