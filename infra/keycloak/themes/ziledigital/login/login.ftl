<#import "template.ftl" as t>
<@t.page title="Sign in">
  <h1 class="a-title">Sign in</h1>
  <p class="a-sub">Use one account across Zile Universe.</p>

  <#if message?has_content && message.type == "error">
    <div class="a-err">${message.summary?no_esc}</div>
  </#if>

  <form action="${url.loginAction}" method="post">
    <div class="a-field">
      <label class="a-label" for="username">Email</label>
      <input class="a-input" id="username" name="username" type="text" autocomplete="username" />
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
</@t.page>
