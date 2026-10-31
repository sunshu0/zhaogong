/**
 * A button among several whose changes run one at a time, while `working` names the one on its way (UI review 3, as
 * the moderation cards do): the pressed button shows its spinner and keeps the focus (Button loading, #202); the
 * others are disabled until it is done, without saying they are working themselves.
 */
export function busyFor(working: string | undefined, key: string) {
  return { loading: working === key, disabled: working !== undefined && working !== key };
}
