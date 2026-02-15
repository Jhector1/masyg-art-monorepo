<#-- themes/ziledigital/login/template.ftl -->

<#-- ============================================================
  Simple page macro you can use from your own templates:
    <#import "template.ftl" as t>
    <@t.page title="Sign in"> ... </@t.page>
============================================================ -->

<#macro page title="" bodyClass="">
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />

  <link rel="icon" href="${url.resourcesPath}/img/favicon.ico" />
  <link rel="icon" type="image/png" sizes="32x32" href="${url.resourcesPath}/img/favicon-32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="${url.resourcesPath}/img/favicon-16.png" />

  <title>${title}</title>

  <link rel="stylesheet" href="${url.resourcesPath}/css/styles.css" />
</head>
<body class="${bodyClass!}">
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
        <#-- Optional links (set in theme.properties if you want) -->
        <#assign _terms = properties.zdTermsUrl!"" />
        <#assign _privacy = properties.zdPrivacyUrl!"" />
        <#if _terms?has_content || _privacy?has_content>
          <span class="a-foot__links">
            <#if _terms?has_content>
              <a class="a-link" href="${_terms}" target="_blank" rel="noopener">Terms</a>
            </#if>
            <#if _terms?has_content && _privacy?has_content> · </#if>
            <#if _privacy?has_content>
              <a class="a-link" href="${_privacy}" target="_blank" rel="noopener">Privacy</a>
            </#if>
          </span>
          <span> · </span>
        </#if>

        © ${.now?string["yyyy"]} ZileDigital • accounts.ziledigital.com
      </div>
    </div>
  </div>
</body>
</html>
</#macro>


<#-- ============================================================
  Keycloak compatibility macro used by many built-in login templates:
    <@layout.registrationLayout ...; section>
      <#if section = "title">...</#if>
      <#if section = "header">...</#if>
      <#if section = "form">...</#if>
      <#if section = "info">...</#if>
    </@layout.registrationLayout>
============================================================ -->

<#macro registrationLayout
  bodyClass=""
  displayInfo=false
  displayMessage=true
  displayRequiredFields=false
  ; section
>
  <#-- Capture "title" section safely (Keycloak templates usually provide it) -->
  <#assign _title = "ZileDigital Accounts">
  <#attempt>
    <#assign _t><#nested "title"></#assign>
    <#if _t?has_content>
      <#assign _title = _t?trim>
    </#if>
  <#recover>
  </#attempt>

  <@page title=_title bodyClass=bodyClass>
    <#-- Optional top header slot -->
    <#attempt><#nested "header"><#recover></#attempt>

    <#-- Global message (Keycloak sets `message`) -->
    <#if displayMessage && message?has_content>
      <#if message.type == "error">
        <div class="a-err">${message.summary?no_esc}</div>
      <#else>
        <div class="a-ok">${message.summary?no_esc}</div>
      </#if>
    </#if>

    <#-- Main form area -->
    <#attempt><#nested "form"><#recover></#attempt>

    <#-- Optional info slot (e.g., “Already have an account?”) -->
    <#if displayInfo>
      <#attempt><#nested "info"><#recover></#attempt>
    </#if>
  </@page>
</#macro>
