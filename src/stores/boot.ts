import { loadSnapshot } from "@/data/actions";
import { useProjectsStore } from "./projects";
import { useLibraryStore } from "./library";
import { useUploadsStore } from "./uploads";
import { usePromptsStore } from "./prompts";
import { useKeysStore } from "./keys";
import { useModelStore } from "./model";
import { resumeRuns } from "@/generation/lifecycle";

/** One round-trip after sign-in fills every store. */
export async function bootStores(): Promise<void> {
  const [snap] = await Promise.all([loadSnapshot(), useKeysStore.getState().refresh()]);
  useProjectsStore.getState().hydrate(snap.projects);
  useLibraryStore.getState().hydrate(snap.assets, snap.runs);
  useUploadsStore.getState().hydrate(snap.uploads);
  usePromptsStore.getState().hydrate(snap.prompts);
  useModelStore.getState().hydrateDisabled(snap.disabledModels);
  resumeRuns(snap.runs);
}

export function clearStores(): void {
  useProjectsStore.setState({ projects: [], loaded: false, currentId: null });
  useLibraryStore.setState({ assets: [], runs: [], loaded: false });
  useUploadsStore.setState({ uploads: [], loaded: false, busy: {} });
  usePromptsStore.setState({ prompts: [] });
  useKeysStore.setState({ status: null });
  useModelStore.setState({ disabled: [] });
}
