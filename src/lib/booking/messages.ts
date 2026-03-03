/**
 * Italian message templates for the conversational booking flow.
 * All user-facing text in one place for easy maintenance.
 */

import type { ProposedSlotOption } from "./types";

export function greetKnown(name: string): string {
  return `Ciao ${name}! Che tipo di visita desideri prenotare?`;
}

export const GREET_UNKNOWN =
  "Benvenuto! Per prenotare un appuntamento, come ti chiami? (Nome e Cognome)";

export function askService(name: string): string {
  return `Grazie ${name}! Che tipo di visita desideri prenotare?`;
}

export const ASK_DATE =
  "Per quando preferisci? (es: lunedi prossimo, domani, il 15 marzo)";

export function slotsFound(slots: readonly ProposedSlotOption[]): string {
  const lines = slots.map((s) => {
    const date = new Date(s.startAt);
    const dayStr = date.toLocaleDateString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const timeStr = date.toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${s.index}. ${dayStr} ore ${timeStr} - ${s.providerName}`;
  });

  return `Ho trovato questi slot disponibili:\n\n${lines.join("\n")}\n\nRispondi con il numero (${slots.map((s) => s.index).join(", ")}) per confermare.`;
}

export const NO_SLOTS =
  "Non ci sono slot disponibili per quella data. Prova un'altra data o scrivi 'annulla' per uscire.";

export function confirmed(
  service: string,
  date: string,
  time: string,
  provider: string
): string {
  return `Perfetto! Il tuo appuntamento e' stato prenotato:\n- ${service}\n- ${date} ore ${time}\n- ${provider}\n\nRiceverai un promemoria prima dell'appuntamento. A presto!`;
}

export const CANCELLED =
  "Prenotazione annullata. Se desideri prenotare in futuro, scrivi 'prenotare'.";

export const EXPIRED =
  "La sessione di prenotazione e' scaduta per inattivita'. Scrivi 'prenotare' per ricominciare.";

export const MAX_ATTEMPTS =
  "Mi dispiace, non sono riuscito a capire. Contatta la segreteria per assistenza nella prenotazione.";

export const INVALID_SERVICE =
  "Per favore indica il tipo di visita desiderata.";

export const INVALID_NAME =
  "Non ho capito il nome. Per favore scrivi Nome e Cognome (es: Mario Rossi).";

export const INVALID_DATE =
  "Non ho capito la data. Prova con: domani, lunedi prossimo, il 15 marzo...";

export const INVALID_SLOT =
  "Scelta non valida. Per favore rispondi con il numero dello slot desiderato.";

export const SLOT_TAKEN =
  "Lo slot selezionato non e' piu' disponibile. Prova un'altra data o scrivi 'annulla'.";

export const GENERIC_ERROR =
  "Si e' verificato un errore. Riprova o contatta la segreteria.";
