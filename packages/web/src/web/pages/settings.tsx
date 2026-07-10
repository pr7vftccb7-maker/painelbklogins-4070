import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import {
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  QrCode,
  DatabaseBackup,
  Download,
  Upload,
  CloudDownload,
  AlertTriangle,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Layout } from "../components/layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Modal } from "../components/ui/modal";
import { api } from "../lib/api";
import { getToken } from "../lib/auth";
import { useQuery } from "@tanstack/react-query";

export default function SettingsPage() {
  const { data, refetch } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await api.settings.$get();
      if (!res.ok) throw new Error("erro");
      return await res.json();
    },
  });

  const [token, setToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | boolean>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  const [pixKey, setPixKey] = useState("");
  const [pixName, setPixName] = useState("");
  const [savingPix, setSavingPix] = useState(false);
  const [pixSaved, setPixSaved] = useState(false);

  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<null | boolean>(null);

  const [savingTwofa, setSavingTwofa] = useState(false);
  const [twofaMsg, setTwofaMsg] = useState("");

  useEffect(() => {
    if (data) {
      setToken(data.telegramBotToken ?? "");
      setChatId(data.telegramChatId ?? "");
      setPixKey(data.pixKey ?? "");
      setPixName(data.pixName ?? "");
      setSmtpUser(data.smtpGmailUser ?? "");
      setSmtpPass(data.smtpGmailPass ?? "");
      setEmailTo(data.backupEmailTo ?? "");
    }
  }, [data]);

  async function save() {
    setSaving(true);
    setSavedMsg(false);
    await api.settings.telegram.$put({ json: { telegramBotToken: token, telegramChatId: chatId } });
    await refetch();
    setSaving(false);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  }

  async function savePix() {
    setSavingPix(true);
    setPixSaved(false);
    await api.settings.payment.$put({ json: { pixKey, pixName } });
    await refetch();
    setSavingPix(false);
    setPixSaved(true);
    setTimeout(() => setPixSaved(false), 2500);
  }

  async function test() {
    setTesting(true);
    setTestResult(null);
    const res = await api.settings.telegram.test.$post();
    setTestResult(res.ok);
    setTesting(false);
  }

  async function saveEmail() {
    setSavingEmail(true);
    setEmailSaved(false);
    await api.settings.email.$put({
      json: { smtpGmailUser: smtpUser, smtpGmailPass: smtpPass, backupEmailTo: emailTo },
    });
    await refetch();
    setSavingEmail(false);
    setEmailSaved(true);
    setTimeout(() => setEmailSaved(false), 2500);
  }

  async function testEmail() {
    setTestingEmail(true);
    setEmailTestResult(null);
    const res = await api.settings.email.test.$post();
    setEmailTestResult(res.ok);
    setTestingEmail(false);
  }

  async function toggleTwofa(next: boolean) {
    setSavingTwofa(true);
    setTwofaMsg("");
    try {
      const res = await api.settings.twofa.$put({ json: { enabled: next } });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setTwofaMsg(body.message ?? "Não foi possível salvar.");
      } else {
        setTwofaMsg(next ? "Verificação em duas etapas ativada." : "Verificação em duas etapas desativada.");
        setTimeout(() => setTwofaMsg(""), 2500);
      }
      await refetch();
    } catch {
      setTwofaMsg("Falha de conexão.");
    } finally {
      setSavingTwofa(false);
    }
  }

  return (
    <Layout>
      <div className="mb-6">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-3xl font-bold"
        >
          Configurações
        </motion.h1>
        <p className="mt-1 text-muted-foreground">Pagamento, notificações e integrações do painel</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 max-w-2xl rounded-2xl border border-border bg-card p-6"
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#2fbf71]/15 text-[#2fbf71]">
            <QrCode className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">Pagamento (PIX)</h2>
            <p className="text-sm text-muted-foreground">
              Sua chave PIX entra na mensagem de cobrança enviada ao cliente.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Chave PIX</Label>
            <Input
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="E-mail, telefone, CPF/CNPJ ou chave aleatória"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Nome do recebedor (opcional)</Label>
            <Input value={pixName} onChange={(e) => setPixName(e.target.value)} placeholder="Nome que aparece na cobrança" />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Button onClick={savePix} disabled={savingPix}>
              {savingPix && <Loader2 className="size-4 animate-spin" />}
              Salvar
            </Button>
            {pixSaved && <span className="text-sm text-[#2fbf71]">Salvo!</span>}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl rounded-2xl border border-border bg-card p-6"
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#229ED9]/15 text-[#229ED9]">
            <Send className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">Notificações no Telegram</h2>
            <p className="text-sm text-muted-foreground">
              Receba um alerta quando uma conta vencer.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Bot Token</Label>
            <Input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456:ABC-DEF..."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Chat ID</Label>
            <Input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="Seu chat ID" />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Salvar
            </Button>
            <Button variant="outline" onClick={test} disabled={testing || !data?.telegramConfigured}>
              {testing && <Loader2 className="size-4 animate-spin" />}
              Enviar teste
            </Button>
            {savedMsg && <span className="text-sm text-[#2fbf71]">Salvo!</span>}
            {testResult === true && (
              <span className="flex items-center gap-1 text-sm text-[#2fbf71]">
                <CheckCircle2 className="size-4" /> Mensagem enviada
              </span>
            )}
            {testResult === false && (
              <span className="flex items-center gap-1 text-sm text-destructive">
                <XCircle className="size-4" /> Falhou — verifique token/chat ID
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
          <p className="mb-2 font-medium text-foreground">Como configurar:</p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>No Telegram, fale com <span className="text-foreground">@BotFather</span> e crie um bot com <span className="text-foreground">/newbot</span>. Copie o token.</li>
            <li>Envie uma mensagem qualquer para o seu novo bot.</li>
            <li>Pegue seu Chat ID com <span className="text-foreground">@userinfobot</span> e cole acima.</li>
            <li>Salve e clique em "Enviar teste".</li>
          </ol>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 max-w-2xl rounded-2xl border border-border bg-card p-6"
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">Verificação em duas etapas (2FA)</h2>
            <p className="text-sm text-muted-foreground">
              Peça um código enviado ao seu Telegram para entrar no painel.
            </p>
          </div>
        </div>

        {!data?.telegramConfigured && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#f5a524]/40 bg-[#f5a524]/10 p-3 text-sm text-[#f5a524]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>Configure o Telegram acima antes de ativar a verificação em duas etapas.</span>
          </div>
        )}

        <label className="flex items-center justify-between gap-4 rounded-lg border border-border bg-secondary/40 p-4">
          <div>
            <p className="font-medium text-foreground">Exigir código no login</p>
            <p className="text-sm text-muted-foreground">
              O código é pedido uma vez por dia em cada dispositivo (fica confiável por 24h).
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(data?.twofaEnabled)}
            disabled={savingTwofa || !data?.telegramConfigured}
            onClick={() => toggleTwofa(!data?.twofaEnabled)}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              data?.twofaEnabled ? "bg-[#2fbf71]" : "bg-muted"
            }`}
          >
            <span
              className={`inline-block size-5 transform rounded-full bg-white transition-transform ${
                data?.twofaEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </label>

        {twofaMsg && (
          <div className="mt-3 text-sm text-muted-foreground">{twofaMsg}</div>
        )}

        <div className="mt-4 rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
          <p>
            Com o 2FA ligado, após digitar email e senha o painel envia um código de 6 dígitos ao
            Telegram configurado. Sem esse código, ninguém acessa os dados — mesmo com a senha.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 max-w-2xl rounded-2xl border border-border bg-card p-6"
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#e11d48]/15 text-[#e11d48]">
            <Mail className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">Backup por email (Gmail)</h2>
            <p className="text-sm text-muted-foreground">
              Envie o backup também para um email, via SMTP do Gmail.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Email do Gmail (remetente)</Label>
            <Input
              type="email"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              placeholder="seuemail@gmail.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Senha de app do Google</Label>
            <Input
              type="password"
              value={smtpPass}
              onChange={(e) => setSmtpPass(e.target.value)}
              placeholder="16 caracteres (não é sua senha normal)"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Enviar backup para</Label>
            <Input
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="Deixe vazio para usar o próprio Gmail acima"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button onClick={saveEmail} disabled={savingEmail}>
              {savingEmail && <Loader2 className="size-4 animate-spin" />}
              Salvar
            </Button>
            <Button
              variant="outline"
              onClick={testEmail}
              disabled={testingEmail || !data?.emailConfigured}
            >
              {testingEmail && <Loader2 className="size-4 animate-spin" />}
              Enviar teste
            </Button>
            {emailSaved && <span className="text-sm text-[#2fbf71]">Salvo!</span>}
            {emailTestResult === true && (
              <span className="flex items-center gap-1 text-sm text-[#2fbf71]">
                <CheckCircle2 className="size-4" /> Email enviado
              </span>
            )}
            {emailTestResult === false && (
              <span className="flex items-center gap-1 text-sm text-destructive">
                <XCircle className="size-4" /> Falhou — verifique email/senha de app
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
          <p className="mb-2 font-medium text-foreground">Como gerar a senha de app:</p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>Na Conta Google, ative a <span className="text-foreground">verificação em 2 etapas</span>.</li>
            <li>Acesse <span className="text-foreground">myaccount.google.com/apppasswords</span>.</li>
            <li>Crie uma senha de app (nome livre, ex: "Painel") e copie os 16 caracteres.</li>
            <li>Cole no campo "Senha de app" acima e salve.</li>
          </ol>
        </div>
      </motion.div>

      <BackupSection
        telegramConfigured={Boolean(data?.telegramConfigured)}
        emailConfigured={Boolean(data?.emailConfigured)}
      />
    </Layout>
  );
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "nunca";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

function BackupSection({
  telegramConfigured,
  emailConfigured,
}: {
  telegramConfigured: boolean;
  emailConfigured: boolean;
}) {
  const anyChannel = telegramConfigured || emailConfigured;
  const { data, refetch } = useQuery({
    queryKey: ["backup-status"],
    queryFn: async () => {
      const res = await api.backup.$get();
      if (!res.ok) throw new Error("erro");
      return await res.json();
    },
  });

  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [restoreMode, setRestoreMode] = useState<null | "upload" | "telegram">(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function flash(ok: boolean, text: string) {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 5000);
  }

  async function runBackupNow() {
    setRunning(true);
    setMsg(null);
    try {
      const res = await api.backup.run.$post();
      const body = await res.json();
      if (res.ok && "ok" in body && body.ok) {
        const dest: string[] = [];
        if ("telegram" in body && body.telegram?.ok) dest.push("Telegram");
        if ("email" in body && body.email?.ok) dest.push("email");
        const where = dest.length ? ` para ${dest.join(" e ")}` : "";
        const partial = "error" in body && body.error ? ` (aviso: ${body.error})` : "";
        flash(true, `Backup enviado${where} — ${body.rows} registros.${partial}`);
        await refetch();
      } else {
        const err = "error" in body ? body.error : "Falha ao gerar backup.";
        flash(false, err ?? "Falha ao gerar backup.");
      }
    } catch {
      flash(false, "Erro de conexão ao gerar backup.");
    }
    setRunning(false);
  }

  async function downloadBackup() {
    try {
      const res = await fetch("/api/backup/download", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        flash(false, "Falha ao baixar o backup.");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const name = cd.match(/filename="(.+?)"/)?.[1] ?? "backup-painel.json.gz";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      flash(false, "Erro ao baixar o backup.");
    }
  }

  function pickFile() {
    fileInputRef.current?.click();
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setPendingFile(f);
      setRestoreMode("upload");
    }
    e.target.value = "";
  }

  async function confirmRestore() {
    setRestoring(true);
    try {
      if (restoreMode === "upload" && pendingFile) {
        const form = new FormData();
        form.append("file", pendingFile);
        const res = await fetch("/api/backup/restore/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${getToken()}` },
          body: form,
        });
        const body = await res.json();
        if (res.ok && body.ok) flash(true, `Restaurado — ${body.inserted} registros.`);
        else flash(false, body.error ?? "Falha ao restaurar.");
      } else if (restoreMode === "telegram") {
        const res = await api.backup.restore.telegram.$post();
        const body = await res.json();
        if (res.ok && "ok" in body && body.ok) flash(true, `Restaurado do Telegram — ${body.inserted} registros.`);
        else flash(false, ("error" in body ? body.error : null) ?? "Falha ao restaurar.");
      }
      await refetch();
    } catch {
      flash(false, "Erro de conexão ao restaurar.");
    }
    setRestoring(false);
    setRestoreMode(null);
    setPendingFile(null);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 max-w-2xl rounded-2xl border border-border bg-card p-6"
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-[#f5a524]/15 text-[#f5a524]">
          <DatabaseBackup className="size-5" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold">Backup dos dados</h2>
          <p className="text-sm text-muted-foreground">
            Cópia de todos os dados enviada ao Telegram e/ou email — automático todo dia à meia-noite.
          </p>
        </div>
      </div>

      {!anyChannel && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#f5a524]/40 bg-[#f5a524]/10 p-3 text-sm text-[#f5a524]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>Configure o Telegram ou o backup por email acima para ativar o backup automático.</span>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-border bg-secondary/40 p-4 text-sm">
        <div>
          <p className="text-muted-foreground">Último backup</p>
          <p className="font-medium text-foreground">{fmtDateTime(data?.lastBackupAt ?? null)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Canais ativos</p>
          <p className="font-medium text-foreground">
            {[telegramConfigured && "Telegram", emailConfigured && "Email"].filter(Boolean).join(" + ") ||
              "Nenhum"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={runBackupNow} disabled={running || !anyChannel}>
          {running ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Fazer backup agora
        </Button>
        <Button variant="outline" onClick={downloadBackup}>
          <Download className="size-4" />
          Baixar cópia
        </Button>
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <p className="mb-1 font-medium text-foreground">Restaurar backup</p>
        <p className="mb-3 text-sm text-muted-foreground">
          Substitui <span className="text-destructive">todos</span> os dados atuais pelos do backup.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={pickFile}>
            <Upload className="size-4" />
            Enviar arquivo
          </Button>
          <Button
            variant="outline"
            onClick={() => setRestoreMode("telegram")}
            disabled={!data?.hasRemoteBackup}
          >
            <CloudDownload className="size-4" />
            Restaurar do Telegram
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".gz,.json,application/gzip,application/json"
          className="hidden"
          onChange={onFileChosen}
        />
      </div>

      {msg && (
        <div
          className={`mt-4 flex items-center gap-2 rounded-lg p-3 text-sm ${
            msg.ok
              ? "bg-[#2fbf71]/10 text-[#2fbf71]"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {msg.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
          {msg.text}
        </div>
      )}

      <Modal
        open={restoreMode !== null}
        onClose={() => {
          if (!restoring) {
            setRestoreMode(null);
            setPendingFile(null);
          }
        }}
        title="Confirmar restauração"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setRestoreMode(null);
                setPendingFile(null);
              }}
              disabled={restoring}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmRestore} disabled={restoring}>
              {restoring && <Loader2 className="size-4 animate-spin" />}
              Restaurar agora
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
            <AlertTriangle className="size-5" />
          </div>
          <div className="text-sm">
            <p className="mb-2 text-foreground">
              Isso vai <span className="font-semibold text-destructive">apagar todos os dados atuais</span> e
              substituir pelos dados do backup
              {restoreMode === "telegram" ? " mais recente do Telegram" : pendingFile ? ` "${pendingFile.name}"` : ""}.
            </p>
            <p className="text-muted-foreground">Essa ação não pode ser desfeita. Deseja continuar?</p>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
