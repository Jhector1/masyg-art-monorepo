<#import "template.ftl" as t>

<@t.page title="Something went wrong">
  <h1 class="a-title">Something went wrong</h1>
  <p class="a-sub">An unexpected error occurred. Please try again.</p>

  <#if message?has_content>
    <div class="a-err">${message.summary?no_esc}</div>
  <#else>
    <div class="a-err">Unexpected error.</div>
  </#if>

  <#-- ✅ Always send user back to YOUR APP (client) to restart login.
      Prefer: rootUrl -> homeUrl -> baseUrl
      Avoid: url.loginRestartFlowUrl (can loop back into KC error/restart page) -->
  <#assign appBase = "">
  <#if client??>
    <#if client.rootUrl?has_content>
      <#assign appBase = client.rootUrl>
    <#elseif client.homeUrl?has_content>
      <#assign appBase = client.homeUrl>
    <#elseif client.baseUrl?has_content>
      <#assign appBase = client.baseUrl>
    </#if>
  </#if>

  <#-- normalize trailing slash -->
  <#assign appBaseNorm = appBase>
  <#if appBaseNorm?has_content && appBaseNorm?ends_with("/")>
    <#assign appBaseNorm = appBaseNorm?substring(0, appBaseNorm?length - 1)>
  </#if>

  <#-- your app route that starts auth -->
  <#assign backHref = (appBaseNorm?has_content)
    ?then(appBaseNorm + "/authenticate", "/")>

  <div class="a-row" style="margin-top:14px;">
    <a class="a-link" href="${backHref}">← Back to sign in</a>
  </div>
</@t.page>