/**
 * PayPi SDK v1.0.0
 * Payment Gateway for Pi Network
 * 
 * DISCLAIMER: PayPi is an independent payment gateway compatible with Pi Network.
 * PayPi is not affiliated with, endorsed by, or sponsored by Pi Network.
 * "Pi Network" is a trademark of Pi Community Company.
 * 
 * Usage:
 * <script  src="https://paypi-plugin.pages.dev/sdk/v1/paypi.js"
  data-api-url="https://paypi-plugin.pages.dev"></script>
 * <div data-paypi-amount="10" data-paypi-order="ORD-123"></div>
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    apiBaseUrl: document.currentScript?.getAttribute('data-api-url') || window.location.origin,
    debug: document.currentScript?.getAttribute('data-debug') === 'true',
    theme: document.currentScript?.getAttribute('data-theme') || 'default',
    version: '1.0.0'
  };

  // Logging helper
  function log(...args) {
    if (CONFIG.debug) console.log('[PayPi]', ...args);
  }

  // Check if Pi SDK is loaded
  function checkPiSDK() {
    if (typeof window.Pi === 'undefined') {
      console.error('[PayPi] Pi SDK not loaded. Add <script src="https://sdk.minepi.com/pi-sdk.js"></script> before paypi.js');
      return false;
    }
    return true;
  }

  // Initialize Pi SDK
  async function initPi() {
    if (window._piInitialized) return true;
    
    try {
      log('Initializing Pi SDK...');
      await window.Pi.init({ version: "2.0", sandbox: CONFIG.apiBaseUrl.includes('localhost') });
      window._piInitialized = true;
      log('Pi SDK initialized');
      return true;
    } catch (error) {
      console.error('[PayPi] Pi SDK initialization failed:', error);
      return false;
    }
  }

  // Create payment button
  function createPayButton(container) {
    const amount = parseFloat(container.getAttribute('data-paypi-amount'));
    const orderId = container.getAttribute('data-paypi-order');
    const description = container.getAttribute('data-paypi-description') || `Order ${orderId}`;
    const buttonText = container.getAttribute('data-paypi-button-text') || `Pay ${amount} π`;
    const onSuccess = container.getAttribute('data-paypi-success');
    const onError = container.getAttribute('data-paypi-error');

    if (!amount || !orderId) {
      console.error('[PayPi] Missing required attributes: data-paypi-amount and data-paypi-order');
      return;
    }

    // Create button HTML
    const button = document.createElement('button');
    button.className = 'paypi-button';
    button.innerHTML = `
      <span class="paypi-icon">π</span>
      <span class="paypi-text">${buttonText}</span>
    `;

    // Create status display
    const status = document.createElement('div');
    status.className = 'paypi-status';
    status.style.display = 'none';

    // Append elements
    container.appendChild(button);
    container.appendChild(status);

    // Add styles
    addStyles();

    // Button click handler
    button.addEventListener('click', async () => {
      await processPayment(button, status, {
        amount,
        orderId,
        description,
        onSuccess,
        onError
      });
    });

    log('Payment button created:', { amount, orderId });
  }

  // Process payment
  async function processPayment(button, statusDiv, options) {
    const { amount, orderId, description, onSuccess, onError } = options;

    try {
      // Disable button
      button.disabled = true;
      button.classList.add('paypi-loading');
      button.querySelector('.paypi-text').textContent = 'Initializing...';

      // Check and init Pi SDK
      if (!checkPiSDK()) {
        throw new Error('Pi Browser required. Please open this page in Pi Browser.');
      }

      await initPi();

      // ============================================
      // STEP 1: CHECK MERCHANT CREDITS
      // ============================================
      button.querySelector('.paypi-text').textContent = 'Checking credits...';
      showStatus(statusDiv, 'Verifying merchant balance...', 'loading');

      const creditCheck = await fetch(`${CONFIG.apiBaseUrl}/api/merchant/check-credits`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amount
        })
      });

      if (!creditCheck.ok) {
        throw new Error('Failed to verify merchant credits');
      }

      const creditStatus = await creditCheck.json();

      if (!creditStatus.has_credits) {
        throw new Error('Merchant has insufficient credits. Please contact merchant to refill.');
      }

      if (creditStatus.warning) {
        log('⚠️ Merchant has low credit balance');
      }

      log('✅ Merchant has sufficient credits:', creditStatus);

      // Optionally show credit info to customer (for transparency)
      if (CONFIG.debug) {
        console.log('[PayPi] Credit check:', {
          needed: creditStatus.needed + ' credits',
          balance: creditStatus.balance + ' credits',
          capacity: creditStatus.capacity
        });
      }

      // ============================================
      // STEP 2: AUTHENTICATE USER
      // ============================================
      button.querySelector('.paypi-text').textContent = 'Authenticating...';
      const auth = await window.Pi.authenticate(['payments', 'wallet_address'], undefined);
      
      if (!auth?.user?.uid) {
        throw new Error('Authentication failed');
      }

      log('User authenticated:', auth.user.uid);

      // Show processing status
      showStatus(statusDiv, 'Processing payment...', 'loading');
      button.querySelector('.paypi-text').textContent = 'Creating payment...';

      // Create Pi payment
      window.Pi.createPayment({
        amount: amount,
        memo: description,
        metadata: {
          order_id: orderId,
          paypi_version: CONFIG.version,
          gateway: 'paypi'
        }
      }, {
        onReadyForServerApproval: async (paymentId) => {
          log('Payment ready for approval:', paymentId);
          button.querySelector('.paypi-text').textContent = 'Approving...';

          // Call merchant's approve endpoint
          const approveRes = await fetch(`${CONFIG.apiBaseUrl}/api/pi/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              payment_id: paymentId,
              order_id: orderId,
              user_uid: auth.user.uid,
              username: auth.user.username,
              amount: amount
            })
          });

          if (!approveRes.ok) {
            throw new Error('Payment approval failed');
          }

          log('Payment approved');
        },

        onReadyForServerCompletion: async (paymentId, txid) => {
          log('Payment ready for completion:', { paymentId, txid });
          button.querySelector('.paypi-text').textContent = 'Completing...';

          // Call merchant's complete endpoint
          const completeRes = await fetch(`${CONFIG.apiBaseUrl}/api/pi/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              payment_id: paymentId,
              txid: txid,
              order_id: orderId
            })
          });

          if (!completeRes.ok) {
            throw new Error('Payment completion failed');
          }

          log('Payment completed successfully');

          // Show success
          showStatus(statusDiv, `✅ Payment successful! Transaction: ${txid.substring(0, 10)}...`, 'success');
          button.style.display = 'none';

          // Call success callback
          if (onSuccess) {
            if (typeof window[onSuccess] === 'function') {
              window[onSuccess]({ orderId, txid, amount });
            } else {
              window.location.href = onSuccess;
            }
          }
        },

        onCancel: (paymentId) => {
          log('Payment cancelled:', paymentId);
          showStatus(statusDiv, '⚠️ Payment cancelled', 'error');
          resetButton(button, `Pay ${amount} π`);
        },

        onError: (error) => {
          log('Payment error:', error);
          throw new Error(error.message || 'Payment failed');
        }
      });

    } catch (error) {
      console.error('[PayPi] Payment error:', error);
      
      // Determine error type for better user messaging
      let errorMessage = error.message;
      
      if (error.message.includes('insufficient credits')) {
        errorMessage = '⚠️ Merchant needs to refill credits. Please contact merchant.';
      } else if (error.message.includes('Merchant has low credit balance')) {
        errorMessage = 'Payment processing may be slow due to merchant\'s low balance.';
      } else if (error.message.includes('Pi Browser required')) {
        errorMessage = '⚠️ Please open this page in Pi Browser to pay with Pi.';
      }
      
      showStatus(statusDiv, `❌ ${errorMessage}`, 'error');
      resetButton(button, `Pay ${amount} π`);

      // Call error callback
      if (onError) {
        if (typeof window[onError] === 'function') {
          window[onError](error);
        }
      }
    }
  }

  // Show status message
  function showStatus(statusDiv, message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `paypi-status paypi-status-${type}`;
    statusDiv.style.display = 'block';
  }

  // Reset button state
  function resetButton(button, text) {
    button.disabled = false;
    button.classList.remove('paypi-loading');
    button.querySelector('.paypi-text').textContent = text;
  }

  // Add styles (Blue/Green theme - NOT Pi's purple!)
  function addStyles() {
    if (document.getElementById('paypi-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'paypi-styles';
    styles.textContent = `
      .paypi-button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 14px 28px;
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);
      }

      .paypi-button:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(37, 99, 235, 0.4);
        background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
      }

      .paypi-button:active:not(:disabled) {
        transform: translateY(0);
      }

      .paypi-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .paypi-button.paypi-loading .paypi-icon {
        animation: paypi-spin 1s linear infinite;
      }

      @keyframes paypi-spin {
        to { transform: rotate(360deg); }
      }

      .paypi-icon {
        font-size: 20px;
        line-height: 1;
      }

      .paypi-status {
        margin-top: 12px;
        padding: 12px 16px;
        border-radius: 6px;
        font-size: 14px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      .paypi-status-loading {
        background: #fef3c7;
        color: #92400e;
        border-left: 4px solid #f59e0b;
      }

      .paypi-status-success {
        background: #d1fae5;
        color: #065f46;
        border-left: 4px solid #10b981;
      }

      .paypi-status-error {
        background: #fee2e2;
        color: #991b1b;
        border-left: 4px solid #ef4444;
      }
    `;

    document.head.appendChild(styles);
  }

  // Initialize on DOM ready
  function init() {
    log('PayPi SDK v' + CONFIG.version + ' initializing...');

    // Find all payment containers
    const containers = document.querySelectorAll('[data-paypi-amount]');
    
    if (containers.length === 0) {
      log('No payment containers found. Add data-paypi-amount to your elements.');
      return;
    }

    containers.forEach(container => {
      createPayButton(container);
    });

    log(`Initialized ${containers.length} payment button(s)`);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose API for programmatic use
  window.PayPi = {
    version: CONFIG.version,
    createPayment: processPayment,
    init: initPi
  };

  log('PayPi SDK loaded - Payment Gateway for Pi Network');
})();