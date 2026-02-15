<#import "template.ftl" as t>

<@t.page title="Terms & Conditions">
  <h1 class="a-title">Terms &amp; Conditions</h1>
  <p class="a-sub">Please review and accept to continue.</p>

  <#if message?has_content && message.type == "error">
    <div class="a-err">${message.summary?no_esc}</div>
  </#if>

  <#-- Keycloak provides 'termsText' on this page -->
  <div class="a-field">
    <div class="a-input" style="height:220px; overflow:auto; padding:12px; line-height:1.45;">
      ${(termsText!"")?no_esc}
    </div>
    <div class="a-hint">Scroll to read. Acceptance is required.</div>
  </div>

  <form action="${url.loginAction}" method="post">
    <div class="a-row" style="margin-top:10px;">
      <label class="a-check">
        <input class="a-check__box" type="checkbox" name="accept" value="true" required />
        <span class="a-check__text">I accept the terms</span>
      </label>
    </div>

    <div style="margin-top:12px;">
      <button class="a-btn" type="submit">Continue</button>
    </div>
  </form>

  <div class="a-row a-row-center" style="margin-top:14px;">
    <a class="a-link" href="${url.loginUrl}">← Back to sign in</a>
  </div>
</@t.page>
