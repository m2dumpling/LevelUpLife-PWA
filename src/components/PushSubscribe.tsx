"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, BellOff } from "lucide-react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as Uint8Array<ArrayBuffer>;
}

export function PushSubscribe() {
  const [status, setStatus] = useState<"loading" | "unsupported" | "denied" | "granted" | "subscribed">("loading");
  const [vapidKey, setVapidKey] = useState<string | null>(null);

  // 获取 VAPID 公钥
  useEffect(() => {
    fetch("/api/push/vapid-key")
      .then((r) => r.json())
      .then((d) => {
        if (d.publicKey) setVapidKey(d.publicKey);
      })
      .catch(() => {});
  }, []);

  // 检测当前通知和订阅状态
  const checkStatus = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }
    if (!("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    const permission = Notification.permission;

    if (permission === "denied") {
      setStatus("denied");
      return;
    }

    // 检查是否已有推送订阅
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          setStatus("subscribed");
          setVapidKey(vapidKey); // keep
          return;
        }
      }
    } catch {}

    if (permission === "granted") {
      setStatus("granted");
    } else {
      setStatus("denied"); // "default" = not asked
    }
  }, [vapidKey]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // 订阅推送
  const subscribe = useCallback(async () => {
    if (!vapidKey) return;

    try {
      // 1. 请求通知权限
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }

      // 2. 注册 Service Worker
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      // 3. 订阅推送
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // 4. 发送订阅到服务器
      const subscriptionJSON = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscriptionJSON.endpoint,
          keys: {
            p256dh: subscriptionJSON.keys?.p256dh,
            auth: subscriptionJSON.keys?.auth,
          },
        }),
      });

      if (res.ok) {
        setStatus("subscribed");
        console.log("[Push] 订阅成功");
      } else {
        console.error("[Push] 订阅请求失败:", await res.text());
      }
    } catch (e) {
      console.error("[Push] 订阅失败:", e);
    }
  }, [vapidKey]);

  // 取消订阅
  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          // 通知服务器删除
          const subscriptionJSON = sub.toJSON();
          await fetch("/api/push/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: subscriptionJSON.endpoint }),
          });
          await sub.unsubscribe();
        }
      }
      setStatus("granted");
      console.log("[Push] 已取消订阅");
    } catch (e) {
      console.error("[Push] 取消失败:", e);
    }
  }, []);

  // 初始检测（如果没有 vapidKey，等获取到后再检）
  useEffect(() => {
    if (vapidKey) checkStatus();
  }, [vapidKey, checkStatus]);

  if (status === "loading") {
    return (
      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
        <Bell className="w-3 h-3" /> ...
      </span>
    );
  }

  if (status === "unsupported") return null;

  return (
    <button
      onClick={status === "subscribed" ? unsubscribe : subscribe}
      className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full transition-colors ${
        status === "subscribed"
          ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
          : status === "denied"
            ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
            : "bg-muted/50 text-muted-foreground hover:bg-muted"
      }`}
      title={
        status === "subscribed"
          ? "已开启通知，点击关闭"
          : status === "denied"
            ? "通知权限被拒绝，请在浏览器设置中开启"
            : "点击开启任务提醒通知"
      }
    >
      {status === "subscribed" ? (
        <>
          <Bell className="w-3 h-3" />
          <span>通知已开</span>
        </>
      ) : (
        <>
          <BellOff className="w-3 h-3" />
          <span>开启通知</span>
        </>
      )}
    </button>
  );
}
