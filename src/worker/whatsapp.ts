import { randomUUID } from "crypto";
import { connectAgentWhatsApp, disconnectAgentWhatsApp, listLocalSessionStatuses, refreshWhatsAppContactMetadata, touchSessionHeartbeat } from "../lib/whatsapp/manager";
import { claimWhatsAppRuntime, listWhatsAppInstanceRuntimes, updateWhatsAppRuntime } from "../lib/whatsapp/runtimeStore";
import { completeWhatsAppTask, failWhatsAppTask, listPendingWhatsAppTasks, markWhatsAppTaskProcessing } from "../lib/whatsapp/taskStore";
import type { Json } from "../lib/database.types";
import { isEvolutionProvider } from "../lib/whatsapp/provider";

const workerId = process.env.WHATSAPP_WORKER_ID || `worker-${randomUUID()}`;
const pollMs = Number(process.env.WHATSAPP_WORKER_POLL_MS || 5000);

let isSyncing = false;

async function syncDesiredState() {
  if (isEvolutionProvider()) {
    return;
  }

  if (isSyncing) {
    return;
  }

  isSyncing = true;

  try {
    const runtimes = await listWhatsAppInstanceRuntimes();
    const localSessions = new Map(
      listLocalSessionStatuses().map((session) => [session.agentId, session]),
    );

    for (const runtime of runtimes) {
      const localSession = localSessions.get(runtime.agentId);

      if (runtime.desiredState === "connected") {
        if (!localSession) {
          const claimed = await claimWhatsAppRuntime(runtime.agentId, workerId, pollMs * 4);
          if (claimed) {
            await connectAgentWhatsApp(runtime.agentId, { workerId });
          }
        } else if (localSession.state === "connected") {
          await touchSessionHeartbeat(runtime.agentId, workerId);
        }
        continue;
      }

      if (localSession) {
        await disconnectAgentWhatsApp(runtime.agentId);
        continue;
      }

      if (runtime.state !== "disconnected" || runtime.workerId) {
        await updateWhatsAppRuntime(runtime.agentId, {
          state: "disconnected",
          qrDataUri: null,
          workerId: null,
          connectedAt: null,
          heartbeatAt: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    console.error(`[WhatsAppWorker:${workerId}] Sync failed`, error);
  } finally {
    isSyncing = false;
  }
}

async function processTasks() {
  if (isEvolutionProvider()) {
    return;
  }

  try {
    const tasks = await listPendingWhatsAppTasks();
    const localSessions = new Map(
      listLocalSessionStatuses().map((session) => [session.agentId, session]),
    );

    for (const task of tasks) {
      if (task.status === "processing") {
        continue;
      }

      if (task.taskType !== "refresh_contact_metadata") {
        await failWhatsAppTask(task.id, `Unsupported task type: ${task.taskType}`);
        continue;
      }

      const localSession = localSessions.get(task.agentId);
      if (!localSession || localSession.state !== "connected") {
        continue;
      }

      const claimedTask = await markWhatsAppTaskProcessing(task.id);
      if (!claimedTask) {
        continue;
      }

      try {
        const jid = typeof claimedTask.payload === "object" && claimedTask.payload && "jid" in claimedTask.payload
          ? claimedTask.payload.jid
          : null;

        if (typeof jid !== "string" || !jid.trim()) {
          throw new Error("Missing jid in refresh_contact_metadata payload.");
        }

        const contact = await refreshWhatsAppContactMetadata(claimedTask.agentId, jid);
        await completeWhatsAppTask(claimedTask.id, JSON.parse(JSON.stringify(contact)) as Json);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown WhatsApp task error";
        await failWhatsAppTask(claimedTask.id, message);
      }
    }
  } catch (error) {
    console.error(`[WhatsAppWorker:${workerId}] Task processing failed`, error);
  }
}

const providerMode = isEvolutionProvider() ? "evolution (idle mode)" : "worker";
console.log(`[WhatsAppWorker:${workerId}] starting with poll interval ${pollMs}ms in ${providerMode}`);

async function main() {
  await syncDesiredState();
  await processTasks();
  setInterval(() => {
    void syncDesiredState();
    void processTasks();
  }, pollMs);
}

main().catch((error) => {
  console.error(`[WhatsAppWorker:${workerId}] Fatal startup error`, error);
  process.exit(1);
});
