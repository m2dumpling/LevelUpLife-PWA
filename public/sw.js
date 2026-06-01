/**
 * Service Worker — Web Push 接收 + 通知展示
 *
 * 接收 VPS 推送调度器发来的推送 → 弹出系统通知
 * 点击通知 → 打开对应页面
 */

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: event.data.text() || "LevelUp Life", body: "" };
  }

  const { title, body, icon, badge, vibrate, data: payload, tag, actions } = data;

  event.waitUntil(
    self.registration.showNotification(title || "LevelUp Life", {
      body: body || "",
      icon: icon || "/icons/icon-192.png",
      badge: badge || "/icons/icon-72.png",
      vibrate: vibrate || [200, 100, 200],
      tag: tag || "default",
      data: payload || {},
      actions: actions || [{ action: "open", title: "打开" }],
      requireInteraction: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // 如果已有打开的窗口，聚焦它
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return (client as WindowClient).focus();
        }
      }
      // 没有则打开新窗口
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
