export function isTrustedUserGesture(event: Pick<Event, "isTrusted">): boolean {
  return event.isTrusted;
}
