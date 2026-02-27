<#import "template.ftl" as t>

<@t.page title="Something went wrong">
  <h1 class="a-title">Something went wrong</h1>
  <p class="a-sub">An unexpected error occurred. Please try again.</p>

  <#if message?has_content>
    <div class="a-err">${message.summary?no_esc}</div>
  <#else>
    <div class="a-err">Unexpected error.</div>
  </#if>

  <#-- Always send user back to the application to restart auth -->
  <#assign appBase =
    (client?? && client.baseUrl?has_content)
      ?then(client.baseUrl,
        (client?? && client.rootUrl?has_content)
          ?then(client.rootUrl, "")
      )
  >

  <#-- normalize trailing slash -->
  <#assign appBaseNorm = appBase>
  <#if appBaseNorm?has_content && appBaseNorm?ends_with("/")>
    <#assign appBaseNorm = appBaseNorm?substring(0, appBaseNorm?length - 1)>
  </#if>

  <#assign backHref =
    (appBaseNorm?has_content)
      ?then(appBaseNorm + "/authenticate",
        (url.loginRestartFlowUrl?? && url.loginRestartFlowUrl?has_content)
          ?then(url.loginRestartFlowUrl, "/")
      )
  >

  <div class="a-row" style="margin-top:14px;">
    <a class="a-link" href="${backHref}">← Back to sign in</a>
  </div>

  <p class="a-sub" style="margin-top:10px;">
    An error occurred. Please log in again through your application.
  </p>
</@t.page>