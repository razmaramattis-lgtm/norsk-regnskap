import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/ui";
import { BilagEditor } from "@/components/app/BilagEditor";

export const Route = createFileRoute("/_authenticated/app/bilag/ny")({
  head: () => ({ meta: [{ title: "Nytt bilag – Fjordbok" }] }),
  component: () => (
    <>
      <PageHeader title="Nytt bilag" sub="Fortell hva som har skjedd, så lager vi posteringene. Du kan alltid justere dem." />
      <BilagEditor />
    </>
  ),
});
