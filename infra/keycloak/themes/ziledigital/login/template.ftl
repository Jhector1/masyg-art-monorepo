<#-- themes/ziledigital/login/template.ftl -->

<#macro page title="">
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link rel="icon" href="${url.resourcesPath}/img/favicon.ico" />
  <link rel="icon" type="image/png" sizes="32x32" href="${url.resourcesPath}/img/favicon-32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="${url.resourcesPath}/img/favicon-16.png" />

  <title>${title?esc}</title>
  <link rel="stylesheet" href="${url.resourcesPath}/css/styles.css" />
</head>
<body>
  <div class="a-wrap">
    <div class="a-card">
      <div class="a-top">
        <img class="a-logo" src="${url.resourcesPath}/img/logo.svg" alt="ZileDigital" />
        <div class="a-brand">
          <b>ZileDigital Accounts</b>
          <span>Single Sign-On</span>
        </div>
      </div>

      <div class="a-body">
        <#nested>
      </div>

      <div class="a-foot">
        © ${.now?string["yyyy"]} ZileDigital • accounts.ziledigital.com
      </div>
    </div>
  </div>
</body>
</html>
</#macro>

<#-- Compatibility macro used by many Keycloak templates -->
<#macro registrationLayout
  bodyClass=""
  displayInfo=false
  displayMessage=true
  displayRequiredFields=false;
  section
>
  <#-- title -->
  <#assign _title = "ZileDigital Accounts">
  <#attempt>
    <#assign _t><#nested "title"></#assign>
    <#if _t?has_content>
      <#assign _title = _t?trim>
    </#if>
  <#recover>
  </#attempt>

  <@page title=_title>
    <#-- optional messages block some templates provide -->
    <#attempt><#nested "messages"><#recover></#attempt>

    <#-- optional global message -->
    <#if displayMessage && message?has_content>
      <#if message.type == "error">
        <div class="a-err">${message.summary?no_esc}</div>
      <#else>
        <div class="a-ok">${message.summary?no_esc}</div>
      </#if>
    </#if>

    <#attempt><#nested "header"><#recover></#attempt>
    <#attempt><#nested "form"><#recover></#attempt>

    <#if displayInfo>
      <#attempt><#nested "info"><#recover></#attempt>
    </#if>
  </@page>
</#macro>
