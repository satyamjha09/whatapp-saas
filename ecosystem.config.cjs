/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");

const cwd = __dirname;

const commonEnv = {
  NODE_ENV: "production",
};

function logFile(name, stream) {
  return path.join(cwd, "logs", `${name}-${stream}.log`);
}

function tsxWorker({ name, script, env = {} }) {
  return {
    name,
    cwd,
    script: "node_modules/tsx/dist/cli.mjs",
    args: script,
    instances: 1,
    autorestart: true,
    max_restarts: 20,
    min_uptime: "10s",
    env: {
      ...commonEnv,
      ...env,
    },
    error_file: logFile(name, "error"),
    out_file: logFile(name, "out"),
    log_date_format: "YYYY-MM-DD HH:mm:ss",
  };
}

module.exports = {
  apps: [
    {
      name: "tallykonnect-web",
      cwd,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "10s",
      env: commonEnv,
      error_file: logFile("web", "error"),
      out_file: logFile("web", "out"),
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },

    tsxWorker({
      name: "tallykonnect-message-worker",
      script: "src/workers/message.worker.ts",
    }),

    tsxWorker({
      name: "tallykonnect-bulk-message-worker",
      script: "src/workers/message.worker.ts",
      env: {
        WORKER_HEARTBEAT_NAME: "bulk-message-worker",
      },
    }),

    tsxWorker({
      name: "campaign-launch-worker",
      script: "src/workers/campaign-launch.worker.ts",
    }),

    tsxWorker({
      name: "tallykonnect-campaign-sequence-worker",
      script: "src/workers/campaign-sequence.worker.ts",
    }),

    tsxWorker({
      name: "tallykonnect-webhook-worker",
      script: "src/workers/webhook.worker.ts",
    }),

    tsxWorker({
      name: "tallykonnect-developer-webhook-worker",
      script: "src/workers/developer-webhook.worker.ts",
    }),

    tsxWorker({
      name: "tallykonnect-developer-webhook-outbox-worker",
      script: "src/workers/developer-webhook-outbox.worker.ts",
    }),

    tsxWorker({
      name: "tallykonnect-inbox-sla-worker",
      script: "src/workers/inbox-sla.worker.ts",
    }),

    tsxWorker({
      name: "tallykonnect-maintenance-worker",
      script: "src/workers/maintenance.worker.ts",
    }),

    tsxWorker({
      name: "tallykonnect-notification-email-worker",
      script: "src/workers/notification-email.worker.ts",
    }),

    tsxWorker({
      name: "tallykonnect-template-status-sync-worker",
      script: "src/workers/template-status-sync.worker.ts",
    }),

    tsxWorker({
      name: "tallykonnect-lead-score-worker",
      script: "src/workers/lead-score.worker.ts",
    }),
  ],
};
