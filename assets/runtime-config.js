(function () {
  'use strict';

  var API_URL = 'https://script.google.com/macros/s/AKfycbyevPoSgnnlyJXhaphkPCjEvFBMq1gdqTbrZ521JdXukkq2_PUPjOGuG0gmEAoZjYeX6w/exec';

  /*
   * Nao colocar token real neste arquivo publico.
   * O token real fica no Google Apps Script em Script Properties.
   */
  window.ACS_RUNTIME_CONFIG = Object.assign({}, window.ACS_RUNTIME_CONFIG || {}, {

    BUILD_VERSION: '20260517-007-v57',
    API_URL: API_URL,
    SHEETS_WEBAPP_URL: API_URL,
    API_TOKEN: '',
    LAB_ACCESS_KEY: '',
    ACE_LAB_ACCESS_KEY: '',
    MAP_CENTER: [-21.9325, -42.6075],
    MAP_ZOOM: 13,
    FRONTEND_PATCH: 'painel-007-trilha-agentes-v57'
  });
}());
