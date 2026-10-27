import { accountNamesOf, byDateDesc, categoriesOf, type Ledger } from "../money";
import { Screen } from "./kit";
import { LinesBrowser } from "./LinesBrowser";

export function LinesView({ ledger }: { ledger: Ledger }) {
  const entries = [...ledger.entries].sort(byDateDesc);
  return (
    <Screen section="lignes" title="Lignes" subtitle="Toutes tes lignes : cherche, sélectionne, renomme ou reclasse d'un coup." hints={["Clic, Maj+clic : sélection", "⌘A : tout", "Échap : rien"]}>
      <LinesBrowser entries={entries} categories={categoriesOf(ledger)} names={accountNamesOf(ledger)} />
    </Screen>
  );
}
