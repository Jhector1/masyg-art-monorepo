<#import "template.ftl" as t>

<@t.page title="Update password">
  <h1 class="a-title">Set a new password</h1>
  <p class="a-sub">Choose a strong password you’ll remember.</p>

  <#if message?has_content && message.type == "error">
    <div class="a-err">${message.summary?no_esc}</div>
  </#if>

  <form action="${url.loginAction}" method="post">
    <div class="a-field">
      <label class="a-label" for="password-new">New password</label>
      <input class="a-input" id="password-new" name="password-new" type="password" autocomplete="new-password" required />
    </div>

    <div class="a-field">
      <label class="a-label" for="password-confirm">Confirm password</label>
      <input class="a-input" id="password-confirm" name="password-confirm" type="password" autocomplete="new-password" required />
    </div>

    <div class="a-row" style="margin-top:10px;">
      <label class="a-check">
        <input type="checkbox" required />
        <span>I understand this will update my account password.</span>
      </label>
    </div>

    <button class="a-btn" type="submit">Update password</button>
  </form>

  <div class="a-row" style="margin-top:14px;">
    <a class="a-link" href="${url.loginUrl}">← Back to sign in</a>
  </div>
</@t.page>
