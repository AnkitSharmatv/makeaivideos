"use client";

import { useEffect, useRef, useState } from "react";
import { usePromptStore } from "@/stores/prompt";
import { useUiStore } from "@/stores/ui";
import { useModelStore } from "@/stores/model";
import { useKeysStore } from "@/stores/keys";
import { useProjectsStore } from "@/stores/projects";
import { PROVIDER_LABELS, type MediaKind } from "@/providers/types";
import { resolveSettings } from "@/providers/catalog-utils";
import { modelKey } from "@/providers";
import { startRuns } from "@/generation/lifecycle";
import { resolveMedia } from "@/generation/media";
import { MediaRoles } from "./MediaRoles";
import { useRefSuggestions, refHint } from "./useRefSuggestions";
import { PromptInput } from "./PromptInput";
import { BatchStepper } from "./BatchStepper";
import { ModelPicker } from "../picker/ModelPicker";
import { SettingsRail } from "../settings-rail/SettingsRail";
import { useCostHint } from "./useCostHint";
import { formatCredits, formatUsd } from "@/generation/pricing";

export function Composer() {
  const prompt = usePromptStore((s) => s.prompt);
  const negativePrompt = usePromptStore((s) => s.negativePrompt);
  const setNegativePrompt = usePromptStore((s) => s.setNegativePrompt);
  const seed = usePromptStore((s) => s.seed);
  const setSeed = usePromptStore((s) => s.setSeed);
  const media = usePromptStore((s) => s.media);

  const kind = useUiStore((s) => s.kind);
  const galleryTab = useUiStore((s) => s.galleryTab);
  const setGalleryTab = useUiStore((s) => s.setGalleryTab);
  const setKind = useUiStore((s) => s.setKind);
  const batch = useUiStore((s) => s.batch);
  const toast = useUiStore((s) => s.toast);
  const setNewProjectOpen = useUiStore((s) => s.setNewProjectOpen);
  const openKeyModal = useUiStore((s) => s.openKeyModal);

  const selectedKeys = useModelStore((s) => s.selected);
  const settingsAll = useModelStore((s) => s.settings);
  const modelFor = useModelStore((s) => s.modelFor);
  const keyStatus = useKeysStore((s) => s.status);
  const currentProject = useProjectsStore((s) => s.projects.find((p) => p.id === s.currentId) ?? null);
  const projectsLoaded = useProjectsStore((s) => s.loaded);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerWrapRef = useRef<HTMLDivElement>(null);

  // selectedKeys is read so the component re-renders when the selection changes.
  const model = selectedKeys[kind] ? modelFor(kind) : null;
  const hasKey = !!model && !!keyStatus?.[model.provider];
  const missingMedia = model ? model.media.filter((r) => (media[r.role]?.length ?? 0) < r.min) : [];
  const resolved = model ? resolveSettings(model, settingsAll[modelKey(model)] ?? {}) : {};
  const cost = useCostHint(model, resolved, batch, prompt, media);
  const suggestions = useRefSuggestions(model);
  const hint = refHint(model, suggestions.length);
  const showAdvanced = !!model?.advanced && (model.advanced.negativePrompt || model.advanced.seed);
  const locked = projectsLoaded && !currentProject;

  const blocker = !currentProject
    ? "Open a project first"
    : !model
      ? "Choose a model"
      : !hasKey
        ? `Add a ${PROVIDER_LABELS[model.provider]} key`
        : !prompt.trim()
          ? "Write a prompt"
          : missingMedia.length
            ? `Attach ${missingMedia.map((r) => r.label.toLowerCase()).join(" and ")}`
            : null;
  const canGenerate = blocker === null && !submitting;

  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!pickerWrapRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pickerOpen]);

  const submit = async () => {
    if (!canGenerate || !model || !currentProject) return;
    setSubmitting(true);
    try {
      const resolvedMedia = await resolveMedia(media, model.provider);
      await startRuns({
        model,
        projectId: currentProject.id,
        prompt: prompt.trim(),
        negativePrompt: model.advanced?.negativePrompt ? negativePrompt.trim() || undefined : undefined,
        seed: model.advanced?.seed && seed !== null ? seed : undefined,
        media: resolvedMedia,
        mediaRefs: media,
        settings: resolved,
        batch,
      });
      if (galleryTab === "favorites") setGalleryTab("projects");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not start the run.", "danger");
    } finally {
      setSubmitting(false);
    }
  };

  const chooseKind = (k: MediaKind) => {
    if (galleryTab === "image" || galleryTab === "video") setGalleryTab(k);
    else setKind(k);
  };

  return (
    <div className="composer-strip">
      <section className={`composer${locked ? " is-locked" : ""}`} aria-label="Composer">
        <div className="composer-row composer-head">
          <div className="composer-head-left">
            <div className="kind-switch" role="radiogroup" aria-label="Output kind">
              {(["image", "video"] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} className="chip" onClick={() => chooseKind(k)}>
                  {k === "image" ? "Image" : "Video"}
                </button>
              ))}
            </div>
            <div className="picker-anchor" ref={pickerWrapRef}>
              <button
                ref={triggerRef}
                type="button"
                className="btn btn-secondary btn-sm model-trigger"
                aria-haspopup="listbox"
                aria-expanded={pickerOpen}
                onClick={() => setPickerOpen((o) => !o)}
              >
                {model ? (
                  <>
                    <span className="model-trigger-provider">{PROVIDER_LABELS[model.provider]}</span>
                    <span className="model-trigger-label">{model.name}</span>
                  </>
                ) : (
                  <span className="model-trigger-label">Select {kind} model</span>
                )}
                <span aria-hidden="true" className="caret">
                  ▾
                </span>
              </button>
              {pickerOpen ? (
                <ModelPicker
                  kind={kind}
                  selected={model}
                  onClose={() => {
                    setPickerOpen(false);
                    triggerRef.current?.focus();
                  }}
                  onNeedKey={(p) => {
                    setPickerOpen(false);
                    openKeyModal("manage", p);
                  }}
                />
              ) : null}
            </div>
          </div>
          <BatchStepper max={model?.batch.max ?? 4} />
        </div>

        <PromptInput onSubmit={() => void submit()} suggestions={suggestions} tagsEnabled={!!model?.media.some((r) => r.role === "reference")} />

        {model && model.media.length > 0 ? <MediaRoles model={model} /> : null}
        {hint ? <p className="ref-hint">{hint}</p> : null}

        {model ? (
          <SettingsRail model={model} />
        ) : (
          <div className="settings-rail" aria-label="Model settings">
            <span className="settings-rail-empty">Pick a model to see its settings.</span>
          </div>
        )}

        {showAdvanced ? (
          <div className="advanced">
            <button type="button" className="btn btn-ghost btn-sm" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((o) => !o)}>
              Advanced {advancedOpen ? "▴" : "▾"}
            </button>
            {advancedOpen ? (
              <div className="advanced-row">
                {model?.advanced?.negativePrompt ? (
                  <label className="field advanced-field">
                    <span className="label">Negative prompt</span>
                    <input className="input" value={negativePrompt} placeholder="What to avoid" onChange={(e) => setNegativePrompt(e.target.value)} />
                  </label>
                ) : null}
                {model?.advanced?.seed ? (
                  <label className="field advanced-field advanced-seed">
                    <span className="label">Seed</span>
                    <input
                      className="input num"
                      inputMode="numeric"
                      value={seed ?? ""}
                      placeholder="random"
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^\d]/g, "");
                        setSeed(v ? Number(v) : null);
                      }}
                    />
                  </label>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="composer-row composer-foot">
          <span className="composer-hint">
            {blocker ? (
              <span className="composer-blocker">{blocker}</span>
            ) : (
              <>
                <span className="kbd">⌘</span>
                <span className="kbd">Enter</span>
                <span>to generate</span>
              </>
            )}
          </span>
          <button
            type="button"
            className="btn btn-primary btn-generate"
            disabled={!canGenerate}
            onClick={() => void submit()}
            title={cost ? `${cost.source === "live" ? "Quoted by the provider" : cost.source === "observed" ? "What this exact setup cost last time" : "From the provider's published rates"}${cost.approx ? " — final charge may differ" : ""}` : undefined}
          >
            <span>{submitting ? "Preparing…" : `Generate${model && batch > 1 ? ` ×${Math.min(batch, model.batch.max)}` : ""}`}</span>
            {cost ? (
              <span className="cost" aria-label={`Estimated cost ${cost.credits !== undefined ? `${formatCredits(cost.credits)} credits, ` : ""}${formatUsd(cost.usd)}`}>
                {cost.credits !== undefined ? (
                  <>
                    <b>{formatCredits(cost.credits)}</b> cr
                    <span aria-hidden="true">·</span>
                  </>
                ) : null}
                <span className={cost.approx ? "cost-approx" : undefined}>
                  {cost.approx ? "≈ " : ""}
                  {formatUsd(cost.usd)}
                </span>
              </span>
            ) : null}
          </button>
        </div>

        {locked ? (
          <div className="composer-lock" role="note">
            <span>Create or open a project — every result lives in one.</span>
            <div className="composer-lock-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setNewProjectOpen(true)}>
                New project
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setGalleryTab("projects")}>
                Open a project
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
