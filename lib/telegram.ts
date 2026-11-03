import { readFile } from "node:fs/promises";
import { env } from "@/lib/env";

export function telegramConfigured(): boolean {
  return Boolean(env("TELEGRAM_BOT_TOKEN") && env("TELEGRAM_CHAT_ID"));
}

export async function sendTelegramAudio(options: {
  filePath: string;
  filename: string;
  caption: string;
}): Promise<void> {
  const token = env("TELEGRAM_BOT_TOKEN");
  const chatId = env("TELEGRAM_CHAT_ID");
  if (!token || !chatId) {
    throw new Error("Telegram is not connected.");
  }
  const bytes = await readFile(options.filePath);
  const form = new FormData();
  form.set("chat_id", chatId);
  form.set("caption", options.caption.slice(0, 1000));
  form.set("title", "Morning recording");
  form.set(
    "audio",
    new Blob([bytes], { type: "audio/mpeg" }),
    options.filename,
  );
  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendAudio`,
    { method: "POST", body: form },
  );
  const json = (await response.json()) as {
    ok?: boolean;
    description?: string;
  };
  if (!response.ok || !json.ok) {
    throw new Error(json.description || `Telegram rejected the audio (${response.status}).`);
  }
}

export async function sendTelegramMessage(text: string): Promise<void> {
  const token = env("TELEGRAM_BOT_TOKEN");
  const chatId = env("TELEGRAM_CHAT_ID");
  if (!token || !chatId) throw new Error("Telegram is not connected.");
  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4000),
        disable_web_page_preview: false,
      }),
    },
  );
  const json = (await response.json()) as {
    ok?: boolean;
    description?: string;
  };
  if (!response.ok || !json.ok) {
    throw new Error(json.description || `Telegram rejected the message (${response.status}).`);
  }
}
