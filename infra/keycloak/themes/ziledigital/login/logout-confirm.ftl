<#import "template.ftl" as t>

<@t.page title="Confirm logout">
  <h1 class="a-title">Log out?</h1>
  <p class="a-sub">You’re about to sign out of ZileDigital Accounts (SSO).</p>

  <#if message?has_content>
    <#if message.type == "error">
      <div class="a-err">${message.summary?no_esc}</div>
    <#else>
      <div class="a-ok">${message.summary?no_esc}</div>
    </#if>
  </#if>

  <form action="${url.logoutConfirmAction}" method="post">
    <input type="hidden" name="session_code" value="${logoutConfirm.code!""}" />
    <button class="a-btn" type="submit">Log out</button>
  </form>

  <#-- After logout, do NOT send users to url.loginUrl (often no client context).
      Send them back to the app to restart sign-in. -->
  <#assign backToApp = (client?? && client.baseUrl?has_content)
    ?then(client.baseUrl + "/authenticate", "/")>

  <div class="a-row" style="margin-top:14px;">
    <a class="a-link" href="${backToApp}">← Back to sign in</a>
  </div>
</@t.page>
