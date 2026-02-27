<#import "template.ftl" as t>

<@t.page title="Something went wrong">
  <h1 class="a-title">Something went wrong</h1>
  <p class="a-sub">An unexpected error occurred. Please try again.</p>

  <#-- ✅ DO NOT use ?html in Keycloak 26 (auto-escaping is already on) -->
  <#if message?has_content>
    <div class="a-err">${message.summary}</div>
  <#else>
    <div class="a-err">Unexpected error.</div>
  </#if>

  <#-- ✅ Prefer sending the user BACK to the app to restart auth -->
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

  <#-- your app login start route -->
  <#assign appLoginPath = "/authenticate">

  <#assign backHref = "">
  <#if appBaseNorm?has_content>
    <#assign backHref = appBaseNorm + appLoginPath>
  <#elseif url?? && url.loginRestartFlowUrl?? && url.loginRestartFlowUrl?has_content>
    <#-- fallback (keeps user in KC; use only if app base missing) -->
    <#assign backHref = url.loginRestartFlowUrl>
  <#else>
    <#assign backHref = "/">
  </#if>

  <div class="a-row" style="margin-top:14px;">
    <a class="a-link" href="${backHref}">← Back to sign in</a>
  </div>

  <p class="a-sub" style="margin-top:10px;">
    An error occurred, please login again through your application.
  </p>
</@t.page>