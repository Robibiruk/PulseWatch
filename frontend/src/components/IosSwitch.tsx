import { useId } from "react";

/**
 * iOS-style toggle switch (faithful port of the Uiverse/styled-components snippet,
 * reimplemented as a plain React + CSS component — no extra deps).
 */
export function IosSwitch({
  on,
  onChange,
  disabled,
  id,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  id?: string;
}) {
  const auto = useId();
  const cid = id || `ios-switch-${auto}`;
  return (
    <div className={`ios-switch ${disabled ? "disabled" : ""}`}>
      <input
        type="checkbox"
        className="ios-switch-checkbox"
        id={cid}
        checked={on}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label className="ios-switch-track" htmlFor={cid}>
        <span className="ios-switch-thumb" />
      </label>
    </div>
  );
}

export default IosSwitch;
