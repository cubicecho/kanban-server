import { FormApi } from "@tanstack/react-form";
import { describe, expect, it } from "vitest";
import {
  type SettingsFieldsFragment,
  SettingsToolDiscoveryEnum,
} from "../web/__generated__/graphql/index.ts";
import { ANY_AGENT, dirtySections, toForm, toRow } from "../web/lib/settings-form.ts";

const ROW: SettingsFieldsFragment = {
  id: "default",
  baseUrl: "http://localhost:11434/v1",
  model: "llama3.1:8b",
  maxTokens: 4096,
  contextLength: 0,
  temperature: 0.2,
  maxToolIterations: 20,
  toolDiscovery: SettingsToolDiscoveryEnum.Eager,
  toolSelectModel: "",
  requestTimeoutSeconds: 120,
  maxRetries: 2,
  runRetentionDays: 30,
  workerIntervalSeconds: 5,
  refineAgentId: null,
  refinePrompt: "",
};

describe("settings form", () => {
  it("is clean when it is a copy of the row", () => {
    expect(dirtySections(toForm(ROW), ROW)).toEqual([]);
  });

  it("names every tab holding a change, in tab order", () => {
    const form = { ...toForm(ROW), refinePrompt: "ask more", maxRetries: 5, apiKey: "sk-x" };
    expect(dirtySections(form, ROW)).toEqual(["model", "limits", "refining"]);
  });

  it("crosses the refiner sentinel to null and back", () => {
    expect(toForm(ROW).refineAgentId).toBe(ANY_AGENT);
    expect(toRow(toForm(ROW)).refineAgentId).toBeNull();
  });

  it("keeps the key out of the row it writes", () => {
    expect(toRow({ ...toForm(ROW), apiKey: "sk-x" })).not.toHaveProperty("apiKey");
  });

  // What the page used to do: build the form from blanks, then `reset` it into the row. The next
  // render handed the blanks back as defaults, and an untouched form took them.
  it("holds the loaded row across a re-render when its defaults are the row", () => {
    const form = new FormApi({ defaultValues: toForm(ROW) });
    form.mount();
    form.update({ defaultValues: toForm(ROW) });
    expect(form.state.values.baseUrl).toBe(ROW.baseUrl);

    const saved = { ...ROW, model: "qwen3:14b" };
    form.reset(toForm(saved));
    form.update({ defaultValues: toForm(saved) });
    expect(form.state.values.model).toBe("qwen3:14b");
  });

  it("is what went wrong when the defaults were blanks", () => {
    const blank = { ...toForm(ROW), baseUrl: "" };
    const form = new FormApi({ defaultValues: blank });
    form.mount();
    form.reset(toForm(ROW));
    form.update({ defaultValues: { ...blank } });
    expect(form.state.values.baseUrl).toBe("");
  });
});
