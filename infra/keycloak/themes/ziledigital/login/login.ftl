<#import "template.ftl" as t>

<@t.page title="Sign in">
  <h1 class="a-title">Sign in</h1>
  <p class="a-sub">Use one account across Zile Universe.</p>

  <#assign hasMsg = message?has_content>
  <#assign isError = hasMsg && (message.type == "error")>
  <#assign isInfo  = hasMsg && !isError>

  <#-- Message banner -->
  <#if hasMsg>
    <#if isError>
      <div class="a-err">${message.summary?no_esc}</div>
    <#else>
      <div class="a-ok">${message.summary?no_esc}</div>
      <div class="a-hint">You can sign in now.</div>
    </#if>
  </#if>

  <#-- Optional: if you want "info screen" behavior, hide form on success -->
  <#-- Remove this whole <#if isInfo> block if you always want the form visible -->
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
          value="${(login.username!'')}"
        />
      </div>

      <div class="a-field">
        <label class="a-label" for="password">Password</label>
        <input class="a-input" id="password" name="password" type="password" autocomplete="current-password" />
      </div>

      <div class="a-row a-row-tight">
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

    <div class="a-row" style="margin-top:14px;">
      <#if url.termsUrl?? && url.termsUrl?has_content>
        <a class="a-link" href="${url.termsUrl}">Terms</a>
      <#else>
        <span></span>
      </#if>
    </div>
  </#if>
</@t.page>
