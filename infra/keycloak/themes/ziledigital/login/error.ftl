<#import "template.ftl" as t>
<@t.page title="Something went wrong">
  <h1 class="a-title">Something went wrong</h1>
  <p class="a-sub">An unexpected error occurred. Please try again.</p>

  <#if message?has_content>
    <div class="a-err">${message.summary?no_esc}</div>
  <#else>
    <div class="a-err">Unexpected error.</div>
  </#if>

  <div class="a-row" style="margin-top:14px;">
    <a class="a-link" href="${url.loginUrl}">← Back to sign in</a>
  </div>
</@t.page>
