<#import "template.ftl" as t>

<@t.page title="Review your profile">
  <h1 class="a-title">Review your profile</h1>
  <p class="a-sub">
    Confirm your details before we create your account.
  </p>

  <#if message?has_content && message.type == "error">
    <div class="a-err">${message.summary?no_esc}</div>
  </#if>

  <form action="${url.loginAction}" method="post">
    <#-- Common fields Keycloak typically asks for here -->
    <div class="a-field">
      <label class="a-label" for="firstName">First name</label>
      <input class="a-input" id="firstName" name="firstName" type="text"
             value="${(user.firstName!'')?html}" autocomplete="given-name" />
    </div>

    <div class="a-field">
      <label class="a-label" for="lastName">Last name</label>
      <input class="a-input" id="lastName" name="lastName" type="text"
             value="${(user.lastName!'')?html}" autocomplete="family-name" />
    </div>

    <div class="a-field">
      <label class="a-label" for="email">Email</label>
      <input class="a-input" id="email" name="email" type="email"
             value="${(user.email!'')?html}" autocomplete="email" />
      <div class="a-hint">We’ll use this for account recovery and notifications.</div>
    </div>

    <button class="a-btn" type="submit">Continue</button>
  </form>

  <div class="a-row a-row-center" style="margin-top:14px;">
    <a class="a-link" href="${url.loginUrl}">← Back to sign in</a>
  </div>
</@t.page>
