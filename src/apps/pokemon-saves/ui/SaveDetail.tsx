import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ConsoleTabs } from "@/components/console/ConsoleTabs";
import { NavGrid } from "@/components/console/NavGrid";
import { editSave } from "../server/actions";
import { badgeImages, getGame, gradient, type Game } from "../games";
import type { Mon } from "../parsers";
import { getSaveMeta, getSaveView, type SaveView } from "../server/store";
import { BoxViewer } from "./BoxViewer";
import { DeleteButton } from "./DeleteButton";
import { ReplaceForm } from "./ReplaceForm";
import { Cover, formatDate, formatMoney, formatPlayTime, Panel, Stat } from "./shared";
import { ItemIcon, monText, Sprite } from "./sprites";

const field = "rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30";

export async function SaveDetail({ id }: { id: string }) {
  const meta = await getSaveMeta(id);
  if (!meta) notFound();
  const save = await getSaveView(meta);
  const game = getGame(save.gameId)!;
  const boxes = save.parsed?.boxes.filter((box) => box.mons.length > 0) ?? [];
  const notices = [save.parseError && `Lecture impossible : ${save.parseError}`, ...(save.parsed?.warnings ?? [])].filter(Boolean) as string[];

  const tabs = [
    { label: "Carte dresseur", content: <TrainerCard save={save} game={game} /> },
    { label: `Équipe (${save.info.party.length})`, content: <Party party={save.info.party} game={game} /> },
    ...(boxes.length ? [{ label: `Boîtes (${boxes.reduce((n, b) => n + b.mons.length, 0)})`, content: <BoxViewer boxes={boxes} gen={game.gen} accent={game.colors[0]} accentDark={game.colors[1]} /> }] : []),
    { label: "Infos", content: <Infos save={save} game={game} /> },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-6">
      <header className="mb-8 flex flex-wrap items-center gap-4">
        <Cover game={game} className="h-16 w-16 rounded-2xl shadow-md ring-4 ring-white" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Pokémon {game.name}</p>
          <h1 className="truncate text-3xl font-black">{save.label}</h1>
        </div>
        <a href={`/api/pokemon-saves/saves/${save.id}/file`} className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow-sm transition hover:scale-105">
          ⬇ Télécharger
        </a>
        <DeleteButton id={save.id} />
      </header>
      {notices.map((notice) => (
        <p key={notice} className="mb-4 rounded-2xl bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800">⚠ {notice}</p>
      ))}
      <ConsoleTabs tabs={tabs} />
    </main>
  );
}

function TrainerCard({ save, game }: { save: SaveView; game: Game }) {
  const { parsed, info } = save;
  const badges = badgeImages(game);
  return (
    <div className="pop-in relative mx-auto max-w-4xl overflow-hidden rounded-[2rem] p-1.5 shadow-xl" style={{ background: gradient(game) }}>
      <div className="relative overflow-hidden rounded-[1.6rem] bg-white/92 p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-20" style={{ background: gradient(game) }} />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400">Carte dresseur</p>
            <h2 className="mt-1 text-5xl font-black tracking-tight">{info.trainer ?? "?"}</h2>
            <p className="mt-1 font-mono text-sm text-zinc-500">ID No. {parsed ? String(parsed.trainerId).padStart(5, "0") : "—"}</p>
          </div>
          <Cover game={game} className="w-24 rounded-xl shadow-lg ring-4 ring-white sm:w-28" />
        </div>

        <dl className="relative mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <BigStat icon={<ItemIcon name="amulet-coin" />} label="Argent" value={formatMoney(info.money)} />
          <BigStat icon={<ItemIcon name="vs-recorder" />} label="Temps de jeu" value={formatPlayTime(info.hours, info.minutes)} />
          <BigStat icon={<ItemIcon name="poke-ball" />} label="Pokédex" value={parsed?.pokedex ? `${parsed.pokedex.owned} pris` : "—"} sub={parsed?.pokedex ? `${parsed.pokedex.seen} vus` : undefined} />
          <BigStat icon={<ItemIcon name="town-map" />} label="Lieu" value={info.location ?? "—"} />
        </dl>

        {parsed?.badges !== undefined && badges.length > 0 && (
          <div className="relative mt-8">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Badges · {Math.min(parsed.badges, badges.length)}/{badges.length}</p>
            <div className="flex flex-wrap gap-3">
              {badges.map((src, i) => {
                const earned = i < parsed.badges!;
                return (
                  <span key={src} className={`flex h-14 w-14 items-center justify-center rounded-2xl ${earned ? "bg-zinc-50 shadow-inner" : "bg-zinc-100"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className={`h-10 w-10 object-contain ${earned ? "drop-shadow-md" : "opacity-20 grayscale"}`} />
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div className="relative mt-8 flex flex-wrap items-end justify-between gap-4 border-t border-zinc-100 pt-5">
          <div className="flex gap-1">
            {info.party.map((mon, i) => (
              <Sprite key={i} mon={mon} gen={game.gen} size={56} />
            ))}
          </div>
          <p className="text-xs text-zinc-400">Sauvegardée le {formatDate(save.fileDate)}</p>
        </div>
      </div>
    </div>
  );
}

function BigStat({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-4">
      <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
        {icon} {label}
      </dt>
      <dd className="mt-1 truncate text-lg font-black">{value}</dd>
      {sub && <dd className="text-xs text-zinc-500">{sub}</dd>}
    </div>
  );
}

function Party({ party, game }: { party: Mon[]; game: Game }) {
  if (!party.length) return <p className="py-16 text-center text-zinc-400">Aucune équipe connue. Complète-la dans l&apos;onglet Infos.</p>;
  return (
    <div className="mx-auto max-w-5xl">
      <NavGrid
        columnsClassName="grid-cols-3 lg:grid-cols-6"
        items={party.map((mon, i) => {
          const text = monText(mon);
          return {
            key: String(i),
            label: text.title,
            sublabel: text.subtitle,
            tile: (
              <div
                className="flex h-full w-full items-center justify-center"
                style={{ background: `radial-gradient(circle at 50% 45%, ${mon.shiny ? "#fde68a" : `${game.colors[0]}38`}, #ffffff 72%)` }}
              >
                <Sprite mon={mon} gen={game.gen} size={120} />
                {mon.level && <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-black shadow">Nv. {mon.level}</span>}
                {mon.shiny && <span className="absolute right-2 top-1.5 text-lg text-yellow-500 drop-shadow">✦</span>}
              </div>
            ),
          };
        })}
      />
    </div>
  );
}

function Infos({ save, game }: { save: SaveView; game: Game }) {
  const { parsed } = save;
  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <Panel>
        <dl className="grid grid-cols-2 gap-5 md:grid-cols-3">
          <Stat label="Jeu" value={`Pokémon ${game.name}`} />
          <Stat label="Rival" value={parsed?.rival || "—"} />
          <Stat label="Fichier" value={`${save.fileName} · ${Math.round(save.size / 1024)} Ko`} />
          <Stat label="Date de la save" value={formatDate(save.fileDate)} />
          <Stat label="Ajoutée le" value={formatDate(save.uploadedAt)} />
          <Stat label="Lecture" value={game.format ? (save.parseError ? "Erreur" : "Automatique") : "Manuelle"} />
          <Stat label="Mise à jour" value={`${formatDate(save.updatedAt)} (${save.source === "api" ? "API" : "web"})`} />
          <Stat label="Slot de backup" value={save.slot ?? "—"} />
          <Stat label="SHA-256" value={<span className="font-mono text-xs" title={save.sha256}>{save.sha256.slice(0, 16)}…</span>} />
        </dl>
        {save.notes && <p className="mt-5 whitespace-pre-wrap rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600">{save.notes}</p>}
      </Panel>
      <Panel>
        <h3 className="mb-1 text-lg font-black">Fichier & versions</h3>
        <p className="mb-4 text-sm text-zinc-500">Remplacer le fichier garde l&apos;ancien dans les versions (les 10 dernières).</p>
        <ReplaceForm id={save.id} />
        {save.versions.length > 0 && (
          <ul className="mt-5 divide-y divide-zinc-100 rounded-2xl bg-zinc-50">
            {save.versions.map((version) => (
              <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span>
                  <span className="font-bold">Remplacée le {formatDate(version.replacedAt)}</span>
                  <span className="text-zinc-400"> · {version.fileName} · {Math.round(version.size / 1024)} Ko</span>
                </span>
                <a href={`/api/pokemon-saves/saves/${save.id}/versions/${version.id}/file`} className="rounded-full bg-white px-3 py-1 text-xs font-bold shadow-sm hover:scale-105">
                  ⬇ Télécharger
                </a>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel>
        <h3 className="mb-4 text-lg font-black">Modifier / compléter</h3>
        <form action={editSave.bind(null, save.id)} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom de la save"><input name="label" defaultValue={save.label} className={field} /></Field>
          <Field label="Dresseur (remplace la valeur lue)"><input name="trainer" defaultValue={save.manual.trainer} placeholder={parsed?.trainer} className={field} /></Field>
          <Field label="Lieu"><input name="location" defaultValue={save.manual.location} placeholder={parsed?.location} className={field} /></Field>
          <Field label="Argent"><input name="money" type="number" min={0} defaultValue={save.manual.money} placeholder={parsed?.money?.toString()} className={field} /></Field>
          <Field label="Heures de jeu"><input name="hours" type="number" min={0} defaultValue={save.manual.hours} placeholder={parsed?.playTime.hours.toString()} className={field} /></Field>
          <Field label="Équipe (ex : Pikachu 45, Dracaufeu 50)"><input name="team" defaultValue={save.manual.team} className={field} /></Field>
          <Field label="Notes" wide><textarea name="notes" defaultValue={save.notes} rows={3} className={field} /></Field>
          <button className="justify-self-start rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-bold text-white shadow hover:brightness-105">Enregistrer</button>
        </form>
      </Panel>
    </div>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`grid gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400 ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      {children}
    </label>
  );
}
