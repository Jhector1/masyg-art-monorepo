<#import "template.ftl" as t>

<@t.page title="Confirm logout">
  <h1 class="a-title">Log out?</h1>

  <#-- pick app name safely -->
  <#assign appName = "your app">
  <#if client??>
    <#if client.name?? && client.name?has_content>
      <#assign appName = client.name>
    <#elseif client.clientId?? && client.clientId?has_content>
      <#assign appName = client.clientId>
    </#if>
  </#if>

  <p class="a-sub">
    You’re about to sign out of ZileDigital Accounts (SSO).
    This will also sign you out of <b>${appName?esc}</b>.
  </p>

  <#if message?has_content>
    <#if message.type == "error">
      <div class="a-err">${message.summary?no_esc}</div>
    <#else>
      <div class="a-ok">${message.summary?no_esc}</div>
    </#if>
  </#if>

  <form action="${url.logoutConfirmAction}" method="post">
    <#-- only include if present -->
    <#if logoutConfirm?? && logoutConfirm.code??>
      <input type="hidden" name="session_code" value="${logoutConfirm.code}" />
    </#if>
    <button class="a-btn" type="submit">Log out</button>
  </form>

  <#-- IMPORTANT: avoid url.loginUrl here; often has no client context -->
  <#assign backToApp = "/" >
  <#if client?? && client.baseUrl?? && client.baseUrl?has_content>
    <#assign backToApp = client.baseUrl>
  </#if>

  <div class="a-row" style="margin-top:14px;">
    <a class="a-link" href="${backToApp}">← Back to app</a>
  </div>
</@t.page>
