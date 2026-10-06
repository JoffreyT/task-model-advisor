import { en } from "./en";
import { fr } from "./fr";
import type { Messages } from "./types";

export type { CursorSuccessInput, Messages } from "./types";

export function messagesFor(language: string | undefined): Messages {
  return language === "fr" ? fr : en;
}
