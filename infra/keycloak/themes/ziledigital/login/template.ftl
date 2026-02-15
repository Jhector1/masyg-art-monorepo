<#macro registrationLayout
  bodyClass=""
  displayInfo=false
  displayMessage=true
  displayRequiredFields=false;
  section
>
  <#-- Title: some templates don't provide a title section -->
  <#assign _title = "ZileDigital Accounts">
  <#attempt>
    <#assign _t><#nested "title"></#assign>
    <#if _t?has_content>
      <#assign _title = _t?trim>
    </#if>
  <#recover>
    <#-- keep default -->
  </#attempt>

  <@page title=_title>
    <#-- Some Keycloak templates use "messages" section -->
    <#attempt>
      <#nested "messages">
    <#recover>
    </#attempt>

    <#-- optional global message -->
    <#if displayMessage && message?has_content>
      <#if message.type == "error">
        <div class="a-err">${message.summary?no_esc}</div>
      <#else>
        <div class="a-ok">${message.summary?no_esc}</div>
      </#if>
    </#if>

    <#-- header block -->
    <#attempt><#nested "header"><#recover></#attempt>

    <#-- form block -->
    <#attempt><#nested "form"><#recover></#attempt>

    <#-- info block -->
    <#if displayInfo>
      <#attempt><#nested "info"><#recover></#attempt>
    </#if>
  </@page>
</#macro>
