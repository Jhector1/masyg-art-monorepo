<#import "template.ftl" as t>

<@t.page title="Update password">
  <h1 class="a-title">Set a new password</h1>
  <p class="a-sub">Choose a strong password you’ll remember.</p>

  <#if message?has_content && message.type == "error">
    <div class="a-err">${message.summary?no_esc}</div>
  </#if>

  <form id="pwForm" action="${url.loginAction}" method="post">
    <div class="a-field">
      <label class="a-label" for="password-new">New password</label>
      <input class="a-input" id="password-new" name="password-new" type="password" autocomplete="new-password" required />
    </div>

    <div class="a-field">
      <label class="a-label" for="password-confirm">Confirm password</label>
      <input class="a-input" id="password-confirm" name="password-confirm" type="password" autocomplete="new-password" required />
    </div>

    <div class="a-row" style="margin-top:10px;">
      <label class="a-check">
        <input
          class="a-check__box"
          id="ack"
          name="ack"
          type="checkbox"
          required
        />
        <span class="a-check__text">I understand this will update my account password.</span>
      </label>
    </div>

    <div id="ackErr" class="a-err" style="display:none; margin-top:10px;">
      Please confirm before continuing.
    </div>

    <button id="submitBtn" class="a-btn" type="submit" disabled style="opacity:.75">
      Update password
    </button>
  </form>

  <div class="a-row" style="margin-top:14px;">
    <a class="a-link" href="${url.loginUrl}">← Back to sign in</a>
  </div>

  <script>
    (function () {
      var form = document.getElementById("pwForm");
      var ack = document.getElementById("ack");
      var btn = document.getElementById("submitBtn");
      var err = document.getElementById("ackErr");

      function sync() {
        var ok = !!ack.checked;
        btn.disabled = !ok;
        btn.style.opacity = ok ? "1" : ".75";
        if (ok) err.style.display = "none";
      }

      ack.addEventListener("change", sync);
      sync();

      form.addEventListener("submit", function (e) {
        if (!ack.checked) {
          e.preventDefault();
          err.style.display = "block";
          ack.focus();
        }
      });
    })();
  </script>
</@t.page>
