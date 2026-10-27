// What every bank export parser produces.

/** One line of a bank export. */
export type BankOperation = {
  /** Stable id of the operation: re-importing an overlapping export skips it. */
  importId: string;
  /** YYYY-MM-DD, the day of the payment (falls back on the booking day). */
  date: string;
  /** YYYY-MM-DD, the day the bank booked it: when it hits the balance. */
  bookedDate: string;
  /** Short label ("SB CROUSTY", "VIREMENT VERS THIBAUD EVRARD", "Burger King"). */
  label: string;
  /** Full label and extra information, for display. */
  detail: string;
  /** Signed amount in cents, fees included: money out is negative. */
  amount: number;
  /** Bank's operation type ("Carte bancaire", "Paiement par carte", "Virement"…), "" when the export has none. */
  type: string;
  /** Bank's own categories (Caisse d'Épargne only). */
  bankCategory: string;
  bankSubcategory: string;
  /** Balance of the account right after this operation, when the export gives it (Revolut, Crédit Mutuel). */
  balance?: number;
};

export type BankId = "caisse-epargne" | "revolut" | "credit-mutuel";

/** A parsed export: the bank, its product when it tells it (Revolut "Pro"), and the operations, oldest first. */
export type BankFile = { bank: BankId; bankName: string; product?: string; operations: BankOperation[] };
