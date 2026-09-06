from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

old_css = ".info-section-title{font-size:.82rem;font-weight:850;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin:0 0 12px}.pay-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:26px}.pay-card{display:flex;flex-direction:column;gap:4px;text-decoration:none;padding:16px;border-radius:15px;border:1px solid var(--line);background:var(--input);color:var(--text);font-weight:800}.pay-card small{font-weight:700;color:#4da3ff}.pay-card.stripe small{color:#8e82ff}.pay-card:hover{border-color:var(--blue);transform:translateY(-1px)}"
new_css = ".info-section-title{font-size:.82rem;font-weight:850;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin:0 0 12px}.pay-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:14px}.pay-card{display:flex;flex-direction:column;min-width:0;padding:17px;border-radius:16px;border:1px solid var(--line);background:color-mix(in srgb,var(--input) 82%,var(--panel));color:var(--text)}.pay-brand{display:flex;align-items:center;gap:10px;margin-bottom:8px}.pay-symbol{display:grid;place-items:center;width:42px;height:42px;flex:0 0 42px;border-radius:12px;background:color-mix(in srgb,var(--blue) 10%,var(--panel));border:1px solid color-mix(in srgb,var(--blue) 35%,var(--line));color:#4da3ff;font-weight:900}.pay-card.stripe .pay-symbol{color:#ffcf4a;border-color:color-mix(in srgb,#ffcf4a 45%,var(--line));background:color-mix(in srgb,#ffcf4a 10%,var(--panel))}.pay-brand strong{font-size:1.02rem}.pay-desc{margin:0!important;color:var(--muted);font-size:.88rem;line-height:1.5!important}.pay-badges{display:flex;flex-wrap:wrap;gap:7px;margin:13px 0 15px}.pay-badges span{padding:5px 9px;border-radius:999px;border:1px solid var(--line);background:var(--panel);color:var(--muted);font-size:.72rem;font-weight:750}.pay-action{display:flex;align-items:center;justify-content:center;min-height:44px;margin-top:auto;padding:9px 12px;border-radius:12px;text-decoration:none;color:#061018;font-weight:900;text-align:center;background:linear-gradient(90deg,#54e8ff,#4da3ff)}.pay-card.stripe .pay-action{background:linear-gradient(90deg,#ffe45c,#ffb84d)}.pay-action:hover{filter:brightness(1.05);transform:translateY(-1px)}.payment-availability{font-size:.78rem;color:var(--muted);margin:0 0 24px;line-height:1.5}"
if old_css not in s:
    raise SystemExit('Expected payment CSS block not found')
s = s.replace(old_css, new_css, 1)

old_html = '''      <div class="info-section-title" data-info-i18n="direct">Direct online payments</div>
      <div class="pay-grid">
        <a class="pay-card" href="https://www.paypal.com/ncp/payment/RU2CWCNVQ7XD6" target="_blank" rel="noopener noreferrer">
          <small>PayPal Account</small><span data-info-i18n="paypal">Donate via PayPal</span>
        </a>
        <a class="pay-card stripe" href="https://buy.stripe.com/7sYeVd7Blfe89cm0k02kw00" target="_blank" rel="noopener noreferrer">
          <small>Card Payment</small><span data-info-i18n="stripe">Donate via Stripe</span>
        </a>
      </div>

      <div class="info-section-title" data-info-i18n="crypto">Crypto wallets</div>'''
new_html = '''      <div class="info-section-title" data-info-i18n="direct">Direct online payments</div>
      <div class="pay-grid">
        <article class="pay-card">
          <div class="pay-brand"><span class="pay-symbol">P</span><strong>PayPal</strong></div>
          <p class="pay-desc" data-info-i18n="paypalDesc">Pay securely with PayPal or other payment options offered by PayPal Checkout.</p>
          <div class="pay-badges"><span>PayPal</span><span data-info-i18n="cards">Debit / Credit Card</span><span>Apple Pay</span></div>
          <a class="pay-action" href="https://www.paypal.com/ncp/payment/RU2CWCNVQ7XD6" target="_blank" rel="noopener noreferrer" data-info-i18n="paypal">Donate via PayPal</a>
        </article>
        <article class="pay-card stripe">
          <div class="pay-brand"><span class="pay-symbol">S</span><strong>Stripe</strong></div>
          <p class="pay-desc" data-info-i18n="stripeDesc">Pay securely by card or with payment methods available through Stripe Checkout.</p>
          <div class="pay-badges"><span data-info-i18n="cards">Debit / Credit Card</span><span>Link</span><span data-info-i18n="digitalWallets">Digital wallets</span></div>
          <a class="pay-action" href="https://buy.stripe.com/7sYeVd7Blfe89cm0k02kw00" target="_blank" rel="noopener noreferrer" data-info-i18n="stripe">Donate via Stripe</a>
        </article>
      </div>
      <p class="payment-availability" data-info-i18n="availability">Available payment methods can vary by country, device and payment provider.</p>

      <div class="info-section-title" data-info-i18n="crypto">Crypto wallets</div>'''
if old_html not in s:
    raise SystemExit('Expected payment HTML block not found')
s = s.replace(old_html, new_html, 1)

repls = {
"paypal:'Donate via PayPal',stripe:'Donate via Stripe',crypto:": "paypal:'Donate with PayPal ↗',stripe:'Donate with Stripe ↗',paypalDesc:'Pay securely with PayPal or other payment options offered by PayPal Checkout.',stripeDesc:'Pay securely by card or with payment methods available through Stripe Checkout.',cards:'Debit / Credit Card',digitalWallets:'Digital wallets',availability:'Available payment methods can vary by country, device and payment provider.',crypto:",
"paypal:'Doniraj putem PayPala',stripe:'Doniraj karticom putem Stripea',crypto:": "paypal:'Doniraj putem PayPala ↗',stripe:'Doniraj putem Stripea ↗',paypalDesc:'Platite sigurno putem PayPala ili drugim načinima plaćanja koje nudi PayPal Checkout.',stripeDesc:'Platite sigurno karticom ili načinima plaćanja dostupnima putem Stripe Checkouta.',cards:'Debitna / kreditna kartica',digitalWallets:'Digitalni novčanici',availability:'Dostupni načini plaćanja mogu se razlikovati ovisno o državi, uređaju i pružatelju plaćanja.',crypto:",
"paypal:'Dona con PayPal',stripe:'Dona con Stripe',crypto:": "paypal:'Dona con PayPal ↗',stripe:'Dona con Stripe ↗',paypalDesc:'Paga in modo sicuro con PayPal o con gli altri metodi disponibili tramite PayPal Checkout.',stripeDesc:'Paga in modo sicuro con carta o con i metodi disponibili tramite Stripe Checkout.',cards:'Carta di debito / credito',digitalWallets:'Portafogli digitali',availability:'I metodi di pagamento disponibili possono variare in base al Paese, al dispositivo e al fornitore di pagamento.',crypto:",
"paypal:'Über PayPal spenden',stripe:'Über Stripe spenden',crypto:": "paypal:'Mit PayPal spenden ↗',stripe:'Mit Stripe spenden ↗',paypalDesc:'Sicher mit PayPal oder weiteren von PayPal Checkout angebotenen Zahlungsmethoden bezahlen.',stripeDesc:'Sicher per Karte oder mit den über Stripe Checkout verfügbaren Zahlungsmethoden bezahlen.',cards:'Debit- / Kreditkarte',digitalWallets:'Digitale Wallets',availability:'Verfügbare Zahlungsmethoden können je nach Land, Gerät und Zahlungsanbieter variieren.',crypto:",
"paypal:'Donar con PayPal',stripe:'Donar con Stripe',crypto:": "paypal:'Donar con PayPal ↗',stripe:'Donar con Stripe ↗',paypalDesc:'Paga de forma segura con PayPal u otros métodos disponibles mediante PayPal Checkout.',stripeDesc:'Paga de forma segura con tarjeta o con los métodos disponibles mediante Stripe Checkout.',cards:'Tarjeta de débito / crédito',digitalWallets:'Carteras digitales',availability:'Los métodos de pago disponibles pueden variar según el país, el dispositivo y el proveedor de pago.',crypto:"
}
for old, new in repls.items():
    if old not in s:
        raise SystemExit('Translation anchor not found: ' + old[:35])
    s = s.replace(old, new, 1)

if 'apps-games-info-standard.js' in s:
    raise SystemExit('Unexpected shared Info script found')

p.write_text(s, encoding='utf-8')
print('Date Lotto Info upgraded')
