import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getApp } from "@/apps/registry";

/** The app's name as page title and, for installable apps, their own manifest and home screen icon. */
export async function generateMetadata({ params }: Pick<PageProps<"/apps/[slug]/[[...path]]">, "params">): Promise<Metadata> {
  const app = getApp((await params).slug);
  if (!app) return {};
  return {
    title: app.name,
    ...(app.pwa && {
      manifest: app.pwa.manifest,
      icons: { apple: app.pwa.appleIcon },
      appleWebApp: { capable: true, title: app.name, statusBarStyle: "black" },
    }),
  };
}

export default function AppPage({ params }: PageProps<"/apps/[slug]/[[...path]]">) {
  return (
    <Suspense fallback={<p className="p-10 text-center text-zinc-400">Chargement…</p>}>
      <AppRenderer params={params} />
    </Suspense>
  );
}

async function AppRenderer({ params }: Pick<PageProps<"/apps/[slug]/[[...path]]">, "params">) {
  const { slug, path = [] } = await params;
  const app = getApp(slug);
  if (!app) notFound();
  if (!app.Page) return app.url ? redirect(app.url) : notFound();
  return <app.Page path={path.map(decodeURIComponent)} />;
}
