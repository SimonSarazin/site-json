import { describe, it, expect } from "vitest";
import { decodeCsvParam } from "./urlCsv";

describe("decodeCsvParam", () => {
  it("découpe sur la virgule et décode chaque segment", () => {
    expect(decodeCsvParam("coworking, meeting-room")).toEqual(["coworking", "meeting-room"]);
    expect(decodeCsvParam("a%2Cb,c")).toEqual(["a,b", "c"]);
  });
  it("absent ou vide : liste vide ; segment mal encodé gardé tel quel", () => {
    expect(decodeCsvParam(null)).toEqual([]);
    expect(decodeCsvParam(",,")).toEqual([]);
    expect(decodeCsvParam("100%")).toEqual(["100%"]);
  });
});
