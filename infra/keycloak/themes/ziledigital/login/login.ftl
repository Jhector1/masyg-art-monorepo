<#import "template.ftl" as t>

<@t.page title="Sign in">
  <h1 class="a-title">Sign in</h1>
  <p class="a-sub">Use one account across Zile Universe.</p>

  <#-- Decide if we are in "info mode" (non-error message present) -->
  <#assign hasMsg = message?has_content>
  <#assign isError = hasMsg && (message.type == "error")>
  <#assign isInfo = hasMsg && !isError>

  <#-- Message banner -->
  <#if hasMsg>
    <#if isError>
      <div class="a-err">${message.summary?no_esc}</div>
    <#else>
      <div class="a-ok">
        ${message.summary?no_esc}
      </div>
      <div class="a-hint">
        You can sign in now with your new password.
      </div>
    </#if>
  </#if>

  <#-- If you want: when it's an info/success message, hide the form and just show a CTA -->
  <#-- Comment this block out if you always want the form visible -->
  <#if isInfo>
    <div class="a-row a-row-center" style="margin-top:14px;">
      <a class="a-link" href="${url.loginRestartFlowUrl!url.loginUrl}">Continue to sign in</a>
    </div>

  <#else>
    <form action="${url.loginAction}" method="post">
      <div class="a-field">
        <label class="a-label" for="username">Email</label>
        <input
          class="a-input"
          id="username"
          name="username"
          type="text"
          autocomplete="username"
          value="${(login.username!'')?html}"
        />
      </div>

      <div class="a-field">
        <label class="a-label" for="password">Password</label>
        <input class="a-input" id="password" name="password" type="password" autocomplete="current-password" />
      </div>

      <div class="a-row a-row-tight">
        <#-- Remember Me (only show if enabled) -->
        <#if realm.rememberMe>
          <label class="a-check">
            <input class="a-check__box" type="checkbox" id="rememberMe" name="rememberMe"
              <#if login.rememberMe?? && login.rememberMe == "on">checked</#if> />
            <span class="a-check__text">Remember me</span>
          </label>
        <#else>
          <span></span>
        </#if>

        <a class="a-link" href="${url.loginResetCredentialsUrl}">Forgot password?</a>
      </div>

      <button class="a-btn" type="submit">Continue</button>
    </form>

    <#if realm.registrationAllowed>
      <div class="a-row" style="margin-top:14px;">
        <span class="a-sub" style="margin:0;">New here?</span>
        <a class="a-link" href="${url.registrationUrl}">Create account</a>
      </div>
    </#if>

    <#-- Optional footer links -->
    <div class="a-row" style="margin-top:14px;">
      <#-- Terms link shows only if Keycloak exposes it -->
      <#if url.termsUrl?? && url.termsUrl?has_content>
        <a class="a-link" href="${url.termsUrl}">Terms</a>
      <#else>
        <span></span>
      </#if>

      <#-- Privacy link if you have one (optional) -->
      <#-- <a class="a-link" href="https://ziledigital.com/privacy">Privacy</a> -->
    </div>
  </#if>
</@t.page>
