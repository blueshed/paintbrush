import { describe, test, expect } from "bun:test";
import { matchRoute } from "./routes";

describe("matchRoute", () => {
  test("exact match returns empty params", () => {
    expect(matchRoute("/", "/")).toEqual({});
    expect(matchRoute("/about", "/about")).toEqual({});
  });

  test("no match returns null", () => {
    expect(matchRoute("/", "/about")).toBeNull();
    expect(matchRoute("/about", "/")).toBeNull();
  });

  test("different segment count returns null", () => {
    expect(matchRoute("/a/b", "/a")).toBeNull();
    expect(matchRoute("/a", "/a/b")).toBeNull();
  });

  test("single param extraction", () => {
    expect(matchRoute("/user/:id", "/user/42")).toEqual({ id: "42" });
  });

  test("multiple params", () => {
    expect(matchRoute("/org/:org/repo/:repo", "/org/acme/repo/widget")).toEqual({
      org: "acme",
      repo: "widget",
    });
  });

  test("decodes URI components", () => {
    expect(matchRoute("/tag/:name", "/tag/hello%20world")).toEqual({
      name: "hello world",
    });
  });

  test("returns null for malformed URI encoding", () => {
    expect(matchRoute("/tag/:name", "/tag/%ZZ")).toBeNull();
  });

  test("static segments must match exactly", () => {
    expect(matchRoute("/api/users", "/api/users")).toEqual({});
    expect(matchRoute("/api/users", "/api/posts")).toBeNull();
  });

  test("empty path segments", () => {
    // both have same structure so they match
    expect(matchRoute("//a", "//a")).toEqual({});
    // mismatch
    expect(matchRoute("//a", "//b")).toBeNull();
  });
});
