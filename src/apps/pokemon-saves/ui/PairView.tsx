import { listDevices } from "@/lib/devices";
import { formatDate, PageTitle, Panel } from "./shared";
import { PairForm, RevokeButton } from "./PairForm";

/** Pairs a device (e.g. the Switch backup app) from the code it shows, and lists paired devices. */
export async function PairView() {
  const devices = await listDevices();
  return (
    <main className="mx-auto grid w-full max-w-3xl gap-6 px-6 py-6">
      <PageTitle title="Appairer un appareil" subtitle="Saisis le code affiché par l'appareil : il recevra sa propre clé API." />
      <Panel>
        <PairForm />
      </Panel>
      <Panel>
        <h2 className="mb-4 text-lg font-black">
          Appareils appairés <span className="text-zinc-400">({devices.length})</span>
        </h2>
        {devices.length ? (
          <ul className="divide-y divide-zinc-100">
            {devices.map((device) => (
              <li key={device.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{device.name}</p>
                  <p className="text-xs text-zinc-500">
                    Appairé le {formatDate(device.createdAt)} · {device.lastUsedAt ? `utilisé le ${formatDate(device.lastUsedAt)}` : "jamais utilisé"}
                  </p>
                </div>
                <RevokeButton id={device.id} name={device.name} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-400">Aucun appareil appairé.</p>
        )}
      </Panel>
    </main>
  );
}
