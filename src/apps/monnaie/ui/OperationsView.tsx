import { byDateDesc, categoriesOf, type Ledger } from "../money";
import { Screen } from "./kit";
import { OperationsClient } from "./OperationsClient";

export function OperationsView({ ledger }: { ledger: Ledger }) {
  return (
    <Screen section="operations" title="Opérations" subtitle={`${ledger.entries.length} lignes · cherche, filtre, reclasse.`}>
      <OperationsClient entries={[...ledger.entries].sort(byDateDesc)} categories={categoriesOf(ledger)} />
    </Screen>
  );
}
