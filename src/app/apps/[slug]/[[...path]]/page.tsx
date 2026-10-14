import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getApp } from "@/apps/registry";

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
