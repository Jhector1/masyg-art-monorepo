<#import "template.ftl" as t>
<@t.page title="Reset password">
  <h1 class="a-title">Reset password</h1>
  <p class="a-sub">We’ll email you a reset link.</p>

  <#if message?has_content>
    <#if message.type == "error">
      <div class="a-err">${message.summary?no_esc}</div>
    <#else>
      <div class="a-ok">${message.summary?no_esc}</div>
    </#if>
  </#if>

  <form action="${url.loginAction}" method="post">
    <div class="a-field">
      <label class="a-label" for="username">Email</label>
      <input class="a-input" id="username" name="username" type="text" autocomplete="email" />
    </div>

    <button class="a-btn" type="submit">Send reset email</button>
  </form>

  <div class="a-row" style="margin-top:14px;">
    <a class="a-link" href="${url.loginUrl}">← Back to sign in</a>
  </div>
</@t.page>
