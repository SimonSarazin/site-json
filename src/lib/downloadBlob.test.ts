// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { downloadBlob } from "./downloadBlob";

describe("downloadBlob", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => "blob:fake-url");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("déclenche le clic sur un <a download> pointant vers l'URL du blob", () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    downloadBlob(new Blob(["x"]), "rapport.csv");

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("révoque l'URL — mais pas AVANT que le navigateur ait eu l'occasion d'amorcer le téléchargement", () => {
    // La course évitée : une révocation synchrone, juste après `click()`, annule le téléchargement
    // sur Firefox/Safari (cf. finding de revue). Vérifié en échec : sans le `setTimeout`, `revoke`
    // serait déjà appelé à ce point.
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    downloadBlob(new Blob(["x"]), "rapport.csv");

    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
  });
});
