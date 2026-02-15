<#import "template.ftl" as t>

<@t.page title="Verify your email">
  <h1 class="a-title">Verify your email</h1>
  <p class="a-sub">
    We sent a verification link to your email. Open it to continue.
  </p>

  <#if message?has_content>
    <#if message.type == "error">
      <div class="a-err">${message.summary?no_esc}</div>
    <#else>
      <div class="a-ok">${message.summary?no_esc}</div>
    </#if>
  </#if>

  <div class="a-row a-row-center" style="margin-top:14px;">
    <a class="a-link" href="${url.loginUrl}">← Back to sign in</a>
  </div>
</@t.page>
