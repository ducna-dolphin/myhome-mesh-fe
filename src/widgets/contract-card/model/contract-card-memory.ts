/**
 * Expanded state of "Thông tin hợp đồng" for this session, in memory only (no localStorage):
 * expanded on the first visit, and a collapse sticks while the user moves between tabs and
 * sub-pages (the Internet layout remounts when coming back from a sub-page).
 */
let expanded = true;

export const contractCardMemory = {
  isExpanded: (): boolean => expanded,
  setExpanded(next: boolean): void {
    expanded = next;
  },
  /** Test helper: back to the first-visit state. */
  reset(): void {
    expanded = true;
  },
};
