import { ImportClient } from "./ImportClient";
import { Screen } from "./kit";

export function ImportView() {
  return (
    <Screen section="import" title="Import" subtitle="Ton relevé bancaire en quelques clics, sans tout retaper.">
      <ImportClient />
    </Screen>
  );
}
