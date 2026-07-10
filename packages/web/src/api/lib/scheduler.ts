import { runBackup } from "./backup";

/**
 * Agendador simples de backup diário.
 * Dispara todo dia à meia-noite (horário local do servidor).
 * Reagenda a si mesmo a cada execução.
 */

let started = false;

function msUntilNextMidnight(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0); // próxima meia-noite local
  return next.getTime() - now.getTime();
}

async function fireBackup() {
  try {
    const result = await runBackup("auto");
    if (result.ok) {
      console.log(`[backup] automático OK — ${result.rows} registros enviados ao Telegram.`);
    } else {
      console.warn(`[backup] automático FALHOU: ${result.error}`);
    }
  } catch (err) {
    console.error("[backup] erro inesperado:", err);
  }
}

function scheduleNext() {
  const delay = msUntilNextMidnight();
  setTimeout(async () => {
    await fireBackup();
    scheduleNext(); // reagenda para a próxima meia-noite
  }, delay);
  const hours = (delay / 3_600_000).toFixed(1);
  console.log(`[backup] próximo backup automático em ~${hours}h (meia-noite).`);
}

/** Inicia o agendador de backup diário. Idempotente. */
export function startBackupScheduler() {
  if (started) return;
  started = true;
  scheduleNext();
}
