<#import "template.ftl" as t>

<@t.page title="Info">
  <h1 class="a-title">${(messageHeader!"Info")?html}</h1>

  <#if messageSummary?has_content>
    <p class="a-sub">${messageSummary?no_esc}</p>
  <#else>
    <p class="a-sub">You can close this page or go back to sign in.</p>
  </#if>

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
