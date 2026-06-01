/**
 * Next.js Instrumentation — 服务端启动钩子
 *
 * 在 Node.js runtime 下启动 Web Push 定时调度器。
 * 参考: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startPushScheduler } = await import("@/lib/push-scheduler");
    startPushScheduler();
  }
}
