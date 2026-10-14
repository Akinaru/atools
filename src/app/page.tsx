import { NavGrid } from "@/components/console/NavGrid";
import { apps } from "@/apps/registry";

const SLOTS_PER_ROW = 5;
const MIN_SLOTS = 10;

export default function Home() {
  // Empty slots fill the home screen up to two full rows, like a console with few apps.
  const placeholders = Math.max(MIN_SLOTS - apps.length, (SLOTS_PER_ROW - (apps.length % SLOTS_PER_ROW)) % SLOTS_PER_ROW);
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-8">
      <NavGrid
        columnsClassName="grid-cols-3 sm:grid-cols-5"
        placeholders={placeholders}
        items={apps.map((app) => ({
          key: app.slug,
          href: app.url ?? `/apps/${app.slug}`,
          external: !!app.url,
          label: app.name,
          sublabel: app.description,
          tile: app.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={app.cover} alt="" className="h-full w-full object-cover" style={{ background: app.accent }} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-6xl" style={{ background: app.accent }}>
              {app.icon}
            </div>
          ),
        }))}
      />
    </main>
  );
}
