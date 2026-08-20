import { describe, it, expect } from "vitest";
import { validatePayload, VIDEO_MIN_SEC, VIDEO_MAX_SEC } from "./submissions";

describe("validatePayload", () => {
  it("photo requires at least one upload", () => {
    expect(validatePayload("photo", { type: "photo", urls: [] }).ok).toBe(false);
    expect(validatePayload("photo", { type: "photo", urls: ["a.jpg"] }).ok).toBe(true);
  });
  it("video enforces duration + declarations", () => {
    expect(
      validatePayload("video", { type: "video", url: "v.mp4", durationSec: 30, declarations: { ownRecording: true, recordedToday: true } }).ok,
    ).toBe(true);
    expect(
      validatePayload("video", { type: "video", url: "v.mp4", durationSec: 5, declarations: { ownRecording: true, recordedToday: true } }).ok,
    ).toBe(false);
    expect(
      validatePayload("video", { type: "video", url: "v.mp4", durationSec: 30, declarations: { ownRecording: true, recordedToday: false } }).ok,
    ).toBe(false);
    expect(validatePayload("video", { type: "video", url: "", durationSec: 30, declarations: { ownRecording: true, recordedToday: true } }).ok).toBe(false);
  });
  it("video bounds match constants", () => {
    expect(VIDEO_MIN_SEC).toBe(20);
    expect(VIDEO_MAX_SEC).toBe(300);
  });
  it("text requires substance", () => {
    expect(validatePayload("text", { type: "text", text: "too short" }).ok).toBe(false);
    expect(
      validatePayload("text", { type: "text", text: "This is a genuinely useful review with enough detail to pass review." }).ok,
    ).toBe(true);
  });
  it("poll requires an option", () => {
    expect(validatePayload("poll", { type: "poll", option: "" }).ok).toBe(false);
    expect(validatePayload("poll", { type: "poll", option: "Jeepney" }).ok).toBe(true);
  });
  it("survey requires answers", () => {
    expect(validatePayload("survey", { type: "survey", answers: {} }).ok).toBe(false);
    expect(validatePayload("survey", { type: "survey", answers: { "1": "Yes" } }).ok).toBe(true);
  });
  it("labels requires file + counts summing to 100", () => {
    expect(validatePayload("labels", { type: "labels", fileUrl: "", counts: { a: 100 } }).ok).toBe(false);
    expect(validatePayload("labels", { type: "labels", fileUrl: "f.csv", counts: { a: 50, b: 49 } }).ok).toBe(false);
    expect(validatePayload("labels", { type: "labels", fileUrl: "f.csv", counts: { a: 50, b: 50 } }).ok).toBe(true);
  });
  it("rejects unknown types", () => {
    expect(validatePayload("mystery", { type: "text", text: "x" }).ok).toBe(false);
  });
});
