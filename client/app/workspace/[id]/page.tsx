import { NotebookApp } from "@/components/notebook/notebook-app";
export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <NotebookApp initialWorkspaceId={id} />;
}
