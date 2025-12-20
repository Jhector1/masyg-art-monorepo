<#import "template.ftl" as t>
<@t.page title="Sign in">
  <h1 class="a-title">Sign in</h1>
  <p class="a-sub">Use one account across ZileDigital + JeanyvesHector.</p>

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

    <div class="a-row" style="margin-bottom:12px;">
      <a class="a-link" href="${url.loginResetCredentialsUrl}">Forgot password?</a>
      <#if realm.registrationAllowed>
        <a class="a-link" href="${url.registrationUrl}">Create account</a>
      </#if>
    </div>

    <button class="a-btn" type="submit">Continue</button>
  </form>
</@t.page>
