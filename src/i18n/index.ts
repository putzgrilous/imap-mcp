import { en, type MessageKey } from "./locales/en.js";
import { ptBR } from "./locales/pt-BR.js";

const locales: Record<string, Record<MessageKey, string>> = {
  en,
  "pt-BR": ptBR,
  pt: ptBR,
};

let activeLocale: Record<MessageKey, string> = en;

export function initLocale(locale: string): void {
  activeLocale = locales[locale] ?? locales[locale.split("-")[0]] ?? en;
}

export function t(key: MessageKey, vars?: Record<string, string>): string {
  let msg = activeLocale[key] ?? en[key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      msg = msg.replaceAll(`{{${k}}}`, v);
    }
  }
  return msg;
}
