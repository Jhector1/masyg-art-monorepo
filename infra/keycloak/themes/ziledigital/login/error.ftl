<#import "template.ftl" as t>

<@t.page title="Something went wrong">
  <h1 class="a-title">Something went wrong</h1>
  <p class="a-sub">An unexpected error occurred. Please try again.</p>

  <#if message?has_content>
    <div class="a-err">${message.summary?no_esc}</div>
  <#else>
    <div class="a-err">Unexpected error.</div>
  </#if>

  <#-- Prefer restarting the login flow if Keycloak provides it -->
  <#assign backHref = (url.loginRestartFlowUrl?? && (url.loginRestartFlowUrl?has_content))
    ?then(url.loginRestartFlowUrl,
      (client?? && client.baseUrl?has_content)
        ?then(client.baseUrl + "/authenticate", "/"))>

  <div class="a-row" style="margin-top:14px;">
    <a class="a-link" href="${backHref}">← Back to sign in</a>
  </div>
</@t.page>
