<#import "template.ftl" as t>
<@t.page title="Create account">
  <h1 class="a-title">Create account</h1>
  <p class="a-sub">Create your SSO profile for all apps.</p>

  <#if message?has_content && message.type == "error">
    <div class="a-err">${message.summary?no_esc}</div>
  </#if>

  <form action="${url.registrationAction}" method="post">
    <div class="a-field">
      <label class="a-label" for="firstName">First name</label>
      <input class="a-input" id="firstName" name="firstName" type="text" autocomplete="given-name" />
    </div>

    <div class="a-field">
      <label class="a-label" for="lastName">Last name</label>
      <input class="a-input" id="lastName" name="lastName" type="text" autocomplete="family-name" />
    </div>

    <div class="a-field">
      <label class="a-label" for="email">Email</label>
      <input class="a-input" id="email" name="email" type="email" autocomplete="email" />
    </div>

    <div class="a-field">
      <label class="a-label" for="username">Username</label>
      <input class="a-input" id="username" name="username" type="text" autocomplete="username" />
    </div>

    <div class="a-field">
      <label class="a-label" for="password">Password</label>
      <input class="a-input" id="password" name="password" type="password" autocomplete="new-password" />
    </div>

    <div class="a-field">
      <label class="a-label" for="password-confirm">Confirm password</label>
      <input class="a-input" id="password-confirm" name="password-confirm" type="password" autocomplete="new-password" />
    </div>

    <div class="a-row" style="margin-bottom:12px;">
      <a class="a-link" href="${url.loginUrl}">Back to sign in</a>
    </div>

    <button class="a-btn" type="submit">Create account</button>
  </form>
</@t.page>
