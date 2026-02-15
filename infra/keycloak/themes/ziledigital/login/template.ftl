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

<#--
  Keycloak templates call:
    <#import "template.ftl" as layout>
    <@layout.registrationLayout; section> ... </@layout.registrationLayout>

  So the macro MUST have "; section" in the signature.
-->
<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false; section>

  <#-- 1) Title: render nested content in section="title" -->
  <#assign section = "title">
  <#assign _title><#nested></#assign>
  <#if !_title?has_content>
    <#assign _title = "ZileDigital Accounts">
  </#if>

  <@page title=_title?trim>

    <#-- 2) Header -->
    <#assign section = "header">
    <#nested>

    <#-- 3) Global message (optional; keep it once) -->
    <#if displayMessage && message?has_content>
      <#if message.type == "error">
        <div class="a-err">${message.summary?no_esc}</div>
      <#else>
        <div class="a-ok">${message.summary?no_esc}</div>
      </#if>
    </#if>

    <#-- 4) Form -->
    <#assign section = "form">
    <#nested>

    <#-- 5) Info -->
    <#if displayInfo>
      <#assign section = "info">
      <#nested>
    </#if>

  </@page>
</#macro>
