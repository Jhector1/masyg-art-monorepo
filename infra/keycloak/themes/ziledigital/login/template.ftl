<#macro page title="">
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title?html}</title>
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
