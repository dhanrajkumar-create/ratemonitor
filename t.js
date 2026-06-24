fetch('https://www.transfergo.com/currency-converter/cad-to-php')
  .then(r => r.text())
  .then(t => {
    const match = t.match(/class="currency-converter-calculator__exchange-rate-value"[^>]*>\s*([0-9.]+)\s*</i);
    console.log(match ? match[1] : 'Not Found');
  });
