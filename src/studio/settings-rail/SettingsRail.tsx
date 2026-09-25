"use client";

import type { ModelSpec, SettingSpec, SettingValue } from "@/providers/types";
import { useModelStore } from "@/stores/model";
import { modelKey } from "@/providers";
import { Dropdown } from "../ui/Dropdown";

type Props = { model: ModelSpec };

function EnumSetting({ spec, value, onChange }: { spec: Extract<SettingSpec, { type: "enum" }>; value: string; onChange: (v: string) => void }) {
  return <Dropdown label={spec.label} value={value} options={spec.values} onChange={onChange} />;
}

function NumberSetting({ spec, value, onChange }: { spec: Extract<SettingSpec, { type: "number" }>; value: number; onChange: (v: number) => void }) {
  const decimals = spec.step < 1 ? String(spec.step).split(".")[1]?.length ?? 1 : 0;
  const fmt = (n: number) => n.toFixed(decimals);
  const clamp = (n: number) => Math.min(spec.max, Math.max(spec.min, Number(fmt(n))));
  return (
    <div className="setting" role="group" aria-label={spec.label}>
      <span className="setting-label">{spec.label}</span>
      <div className="stepper">
        <button type="button" aria-label={`Decrease ${spec.label}`} disabled={value <= spec.min} onClick={() => onChange(clamp(value - spec.step))}>
          −
        </button>
        <span className="stepper-value num" aria-live="polite">
          {fmt(value)}
          {spec.unit ? <span className="stepper-unit">{spec.unit}</span> : null}
        </span>
        <button type="button" aria-label={`Increase ${spec.label}`} disabled={value >= spec.max} onClick={() => onChange(clamp(value + spec.step))}>
          +
        </button>
      </div>
    </div>
  );
}

function BoolSetting({ spec, value, onChange }: { spec: Extract<SettingSpec, { type: "boolean" }>; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className="toggle" role="switch" aria-checked={value} onClick={() => onChange(!value)}>
      <i aria-hidden="true" />
      {spec.label}
    </button>
  );
}

export function SettingsRail({ model }: Props) {
  const mk = modelKey(model);
  const values = useModelStore((s) => s.settings[mk]);
  const setSetting = useModelStore((s) => s.setSetting);
  const resetSettings = useModelStore((s) => s.resetSettings);

  if (model.settings.length === 0) {
    return (
      <div className="settings-rail" aria-label="Model settings">
        <span className="settings-rail-empty">{model.name} has no adjustable settings.</span>
      </div>
    );
  }

  const get = (spec: SettingSpec): SettingValue => {
    const v = values?.[spec.key];
    if (spec.type === "enum") return typeof v === "string" && spec.values.includes(v) ? v : spec.default;
    if (spec.type === "number") return typeof v === "number" ? v : spec.default;
    return typeof v === "boolean" ? v : spec.default;
  };
  const dirty = model.settings.some((spec) => get(spec) !== spec.default);

  return (
    <div className="settings-rail" aria-label="Model settings">
      {model.settings.map((spec) => {
        if (spec.type === "enum") return <EnumSetting key={spec.key} spec={spec} value={get(spec) as string} onChange={(v) => setSetting(model, spec.key, v)} />;
        if (spec.type === "number") return <NumberSetting key={spec.key} spec={spec} value={get(spec) as number} onChange={(v) => setSetting(model, spec.key, v)} />;
        return <BoolSetting key={spec.key} spec={spec} value={get(spec) as boolean} onChange={(v) => setSetting(model, spec.key, v)} />;
      })}
      {dirty ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => resetSettings(model)}>
          Reset
        </button>
      ) : null}
    </div>
  );
}
