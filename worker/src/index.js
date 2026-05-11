const GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN = "https://github.com/login/oauth/access_token";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/auth") {
      const params = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        redirect_uri: `${url.origin}/callback`,
        scope: "repo,user",
      });
      return Response.redirect(`${GITHUB_AUTHORIZE}?${params.toString()}`, 302);
    }

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) return new Response("Missing code", { status: 400 });

      const tokenResp = await fetch(GITHUB_TOKEN, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "decap-oauth-worker",
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const data = await tokenResp.json();

      if (data.error || !data.access_token) {
        const errMsg = `authorization:github:error:${JSON.stringify({
          message: data.error_description || data.error || "no access_token",
        })}`;
        return htmlPostMessage(errMsg);
      }

      const okMsg = `authorization:github:success:${JSON.stringify({
        token: data.access_token,
        provider: "github",
      })}`;
      return htmlPostMessage(okMsg);
    }

    return new Response("Not found", { status: 404 });
  },
};

function htmlPostMessage(message) {
  const html = `<!doctype html>
<html><body><script>
(function () {
  var msg = ${JSON.stringify(message)};
  function receive(e) {
    if (!window.opener) return;
    window.opener.postMessage(msg, e.origin);
    window.removeEventListener("message", receive, false);
  }
  window.addEventListener("message", receive, false);
  if (window.opener) window.opener.postMessage("authorizing:github", "*");
})();
</script><p>Authenticating… you can close this window.</p></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
