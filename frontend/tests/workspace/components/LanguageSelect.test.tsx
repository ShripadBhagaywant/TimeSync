// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LanguageSelect } from "@/features/workspace/components/LanguageSelect";
afterEach(cleanup);
it("opens outside clipping panels and selects a language", () => {
  const change=vi.fn();
  const {container}=render(<LanguageSelect value="English" onChange={change}/>);
  fireEvent.click(screen.getByRole("button", {name:"AI output language"}));
  expect(container.contains(screen.getByRole("menu"))).toBe(false);
  fireEvent.click(screen.getByRole("menuitem", {name:"Hindi"}));
  expect(change).toHaveBeenCalledWith("Hindi");
  expect(screen.queryByRole("menu")).toBeNull();
});
it("closes the floating menu when its panel scrolls", () => {
  const {container}=render(<LanguageSelect value="English" onChange={vi.fn()}/>);
  fireEvent.click(screen.getByRole("button", {name:"AI output language"}));
  fireEvent.scroll(container);
  expect(screen.queryByRole("menu")).toBeNull();
});
it("does not open while verification locks the language", () => {
  render(<LanguageSelect value="English" disabled onChange={vi.fn()}/>);
  fireEvent.click(screen.getByRole("button", {name:"AI output language"}));
  expect(screen.queryByRole("menu")).toBeNull();
});
