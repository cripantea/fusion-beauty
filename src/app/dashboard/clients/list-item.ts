import type { ClientDTO, ClientListItemDTO } from "./actions";

/** Voce di elenco per una cliente appena creata (nessuno storico). */
export function toNewClientListItem(client: ClientDTO): ClientListItemDTO {
  return {
    ...client,
    lastAppointment: null,
    visits: 0,
    totalSpent: 0,
    lastVisit: null,
    isInactive: false,
  };
}
