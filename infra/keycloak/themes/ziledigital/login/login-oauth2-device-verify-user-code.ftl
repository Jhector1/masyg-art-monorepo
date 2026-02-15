<#import "template.ftl" as t>

<@t.page title="Device verification">
  <h1 class="a-title">Device verification</h1>
  <p class="a-sub">
    Enter the code shown on your device to continue.
  </p>

  <#if message?has_content>
    <#if message.type == "error">
      <div class="a-err">${message.summary?no_esc}</div>
    <#else>
      <div class="a-ok">${message.summary?no_esc}</div>
    </#if>
  </#if>

  <form action="${url.loginAction}" method="post">
    <div class="a-field">
      <label class="a-label" for="user_code">Device code</label>
      <input
        class="a-input"
        id="user_code"
        name="user_code"
        type="text"
        autocomplete="one-time-code"
        placeholder="ABCD-EFGH"
        required
      />
      <div class="a-hint">Type the code exactly as shown.</div>
    </div>

    <button class="a-btn" type="submit">Continue</button>
  </form>

  <div class="a-row a-row-center" style="margin-top:14px;">
    <a class="a-link" href="${url.loginUrl}">← Back to sign in</a>
  </div>
</@t.page>
