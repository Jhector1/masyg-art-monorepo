<#import "template.ftl" as t>

<@t.page title="Set up authenticator">
  <h1 class="a-title">Set up authenticator</h1>
  <p class="a-sub">
    Scan the QR code in your authenticator app, then enter the one-time code.
  </p>

  <#if message?has_content>
    <#if message.type == "error">
      <div class="a-err">${message.summary?no_esc}</div>
    <#else>
      <div class="a-ok">${message.summary?no_esc}</div>
    </#if>
  </#if>

  <#-- QR code -->
  <div class="a-field" style="display:grid; place-items:center; margin-top:14px;">
    <div style="padding:14px; border-radius:16px; border:1px solid var(--border); background: rgba(255,255,255,0.04);">
      <img
        alt="QR code"
        src="data:image/png;base64,${totp.totpSecretQrCode}"
        style="width:220px; height:220px; display:block;"
      />
    </div>
    <div class="a-hint" style="text-align:center; margin-top:10px;">
      Can’t scan? Use this secret key:
      <span class="a-kbd">${totp.totpSecretEncoded}</span>
    </div>
  </div>

  <form action="${url.loginAction}" method="post">
    <div class="a-field">
      <label class="a-label" for="totp">One-time code</label>
      <input
        class="a-input"
        id="totp"
        name="totp"
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        placeholder="123456"
        required
      />
      <div class="a-hint">Enter the 6-digit code from your authenticator app.</div>
    </div>

    <button class="a-btn" type="submit">Verify &amp; continue</button>
  </form>

  <div class="a-row a-row-center" style="margin-top:14px;">
    <a class="a-link" href="${url.loginUrl}">← Back to sign in</a>
  </div>
</@t.page>
