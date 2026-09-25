"use client";

import { useEffect, useRef, useState } from "react";
import { useUiStore } from "@/stores/ui";
import { useKeysStore } from "@/stores/keys";
import { useModelStore } from "@/stores/model";
import { usePromptStore } from "@/stores/prompt";
import { useSessionStore } from "@/stores/session";
import { bootStores, clearStores } from "@/stores/boot";
import { Topbar } from "./topbar/Topbar";
import { Composer } from "./composer/Composer";
import { Gallery } from "./gallery/Gallery";
import { KeyModal } from "./key-modal/KeyModal";
import { Viewer } from "./viewer/Viewer";
import { UndoBar } from "./UndoBar";
import { Toasts } from "./Toasts";
import { NewProjectDialog } from "./projects/NewProjectDialog";
import { ModelSettings } from "./models/ModelSettings";
import { AuthScreen } from "./auth/AuthScreen";
import "./studio.css";

export function Studio() {
  const keyModal = useUiStore((s) => s.keyModal);
  const openKeyModal = useUiStore((s) => s.openKeyModal);
  const keyStatus = useKeysStore((s) => s.status);
  const viewerAssetId = useUiStore((s) => s.viewerAssetId);
  const newProjectOpen = useUiStore((s) => s.newProjectOpen);
  const modelSettingsOpen = useUiStore((s) => s.modelSettingsOpen);
  const auth = useSessionStore((s) => s.auth);
  const refreshAuth = useSessionStore((s) => s.refresh);
  const [booted, setBooted] = useState(false);
  const started = useRef(false);

  // Persisted UI state, then who's signed in.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void useUiStore.persist.rehydrate();
    void useModelStore.persist.rehydrate();
    void usePromptStore.persist.rehydrate();
    void refreshAuth();
  }, [refreshAuth]);

  // With a user: one snapshot fills every store and resumes in-flight runs.
  const userId = auth?.user?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void bootStores().then(() => {
      if (!cancelled) setBooted(true);
    });
    return () => {
      cancelled = true;
      setBooted(false);
    };
  }, [userId]);

  // Gate: signed in but no provider key yet → the key modal is the first thing on screen.
  useEffect(() => {
    if (booted && keyStatus && !Object.values(keyStatus).some(Boolean) && keyModal === null) openKeyModal("gate");
  }, [booted, keyStatus, keyModal, openKeyModal]);

  if (!auth) return <div className="studio" aria-busy="true" />;
  if (!auth.user) return <AuthScreen auth={auth} onSignedIn={() => void refreshAuth()} />;

  return (
    <div className="studio">
      <Topbar
        user={auth.user}
        licensee={auth.licensee}
        onSignedOut={() => {
          clearStores();
          void refreshAuth();
        }}
      />
      <Gallery />
      <Composer />
      {keyModal ? <KeyModal mode={keyModal.mode} initialProvider={keyModal.provider} /> : null}
      {viewerAssetId ? <Viewer assetId={viewerAssetId} /> : null}
      {newProjectOpen ? <NewProjectDialog /> : null}
      {modelSettingsOpen ? <ModelSettings /> : null}
      <UndoBar />
      <Toasts />
    </div>
  );
}
