type AuthPath = "/login" | "/login/char" | "/login/scope";

export function buildAuthHref(
  path: AuthPath,
  currentHref = window.location.href,
): string {
  const sourceUrl = new URL(currentHref, window.location.href);
  const loginUrl = new URL(path, sourceUrl);
  loginUrl.searchParams.set("src", sourceUrl.toString());

  return loginUrl.toString();
}

export function buildLoginHref(currentHref = window.location.href): string {
  return buildAuthHref("/login", currentHref);
}

export function buildScopeLoginHref(
  currentHref = window.location.href,
): string {
  return buildAuthHref("/login/scope", currentHref);
}

export function redirectToLogin(currentHref = window.location.href): string {
  const loginHref = buildLoginHref(currentHref);
  window.location.assign(loginHref);

  return loginHref;
}
