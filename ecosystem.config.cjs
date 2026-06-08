module.exports = {
  apps: [
    {
      name: "leveluplife-pwa",
      script: ".next/standalone/server.js",
      cwd: "/opt/levelup-life-pwa",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
        HOSTNAME: "0.0.0.0",
        // Share the standard web app database so PWA reminders use the same users/tasks.
        DATABASE_PATH: "/opt/levelup-life/data/levelup.db",
      },
      max_memory_restart: "300M",
      restart_delay: 3000,
      max_restarts: 10,
      exp_backoff_restart_delay: 100,
    },
  ],
};
