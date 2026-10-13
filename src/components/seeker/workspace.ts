/** The workspace's name for the active identity. */
export function workspaceTitle(isEmployer: boolean): string {
  return isEmployer ? "雇主工作台" : "求职者工作台";
}
