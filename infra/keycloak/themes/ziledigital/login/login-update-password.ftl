<#import "template.ftl" as t>

<@t.page title="Update password">
  <h1 class="a-title">Update password</h1>

  <#-- Optional subtitle if Keycloak provides context -->
  <#if message?has_content && message.type == "info">
    <p class="a-sub">${message.summary}</p>
  <#else>
    <p class="a-sub">Choose a strong password to keep your account secure.</p>
  </#if>

  <#-- Error message -->
  <#if message?has_content && message.type == "error">
    <div class="a-err">${message.summary?no_esc}</div>
  </#if>

  <form action="${url.loginAction}" method="post">
    <div class="a-field">
      <label class="a-label" for="password-new">New password</label>
      <div class="a-pass">
        <input
          class="a-input"
          id="password-new"
          name="password-new"
          type="password"
          autocomplete="new-password"
          required
        />
        <button class="a-eye" type="button" aria-label="Show password" data-toggle="#password-new">
          👁
        </button>
      </div>
      <div class="a-hint">Use 10+ characters, mix letters, numbers, and symbols.</div>
    </div>

    <div class="a-field">
      <label class="a-label" for="password-confirm">Confirm new password</label>
      <div class="a-pass">
        <input
          class="a-input"
          id="password-confirm"
          name="password-confirm"
          type="password"
          autocomplete="new-password"
          required
        />
        <button class="a-eye" type="button" aria-label="Show password" data-toggle="#password-confirm">
          👁
        </button>
      </div>
    </div>

    <button class="a-btn" type="submit">Update password</button>

    <div class="a-row a-row-center" style="margin-top:14px;">
      <a class="a-link" href="${url.loginUrl}">Back to sign in</a>
    </div>
  </form>

  <script>
    // Minimal show/hide password (no deps)
    (function () {
      var btns = document.querySelectorAll("[data-toggle]");
      for (var i = 0; i < btns.length; i++) {
        btns[i].addEventListener("click", function () {
          var sel = this.getAttribute("data-toggle");
          var input = document.querySelector(sel);
          if (!input) return;
          input.type = input.type === "password" ? "text" : "password";
          this.textContent = input.type === "password" ? "👁" : "🙈";
        });
      }
    })();
  </script>
</@t.page>
